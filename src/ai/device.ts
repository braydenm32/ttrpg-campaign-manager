import { ALL_FORMATS, AudioBufferSink, BlobSource, Input } from 'mediabunny'
import type { TranscriptLine } from '../db'
import { cleanLines } from './transcript'
import type { WorkerRequest, WorkerResponse } from './whisper.worker'

const RATE = 16000
/** Audio is handed to Whisper a couple of minutes at a time, so progress can be saved as it goes. */
const WINDOW_S = 120
/** Windows quieter than this are skipped: Whisper invents words in silence. */
const SILENCE_RMS = 0.004

export interface DeviceProgress {
  phase: 'download' | 'transcribe'
  /** 0 to 1. */
  fraction: number
  detail: string
}

/** One window of 16 kHz mono audio, with when it starts in the recording. */
interface Window {
  start: number
  samples: Float32Array
}

/**
 * Reads the recording a piece at a time and turns it into 16 kHz mono audio,
 * without ever holding the whole (possibly hours-long) session in memory.
 */
export async function* audioWindows(blob: Blob, from: number): AsyncGenerator<Window> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS })
  const track = await input.getPrimaryAudioTrack()
  if (!track) throw new Error('This recording has no audio track.')
  if (!(await track.canDecode())) {
    yield* decodeWholeFile(blob, from)
    return
  }
  const sink = new AudioBufferSink(track)
  const size = WINDOW_S * RATE
  let buf = new Float32Array(size)
  let filled = 0
  let start = from
  for await (const { buffer, timestamp } of sink.buffers(from)) {
    if (filled === 0) start = Math.max(timestamp, from)
    const mono = downmix(buffer)
    const ratio = buffer.sampleRate / RATE
    // Box-filter resample: average each group of source samples into one 16 kHz sample.
    for (let pos = 0; pos < mono.length; pos += ratio) {
      const a = Math.floor(pos)
      const b = Math.min(mono.length, Math.max(a + 1, Math.floor(pos + ratio)))
      let sum = 0
      for (let i = a; i < b; i++) sum += mono[i]
      buf[filled++] = sum / (b - a)
      if (filled === size) {
        yield { start, samples: buf }
        buf = new Float32Array(size)
        filled = 0
        start = timestamp + (pos + ratio) / buffer.sampleRate
      }
    }
  }
  if (filled > RATE) yield { start, samples: buf.slice(0, filled) }
}

/** Fallback for browsers without the streaming decoder: decode everything at once at 16 kHz. */
async function* decodeWholeFile(blob: Blob, from: number): AsyncGenerator<Window> {
  const ctx = new OfflineAudioContext(1, RATE, RATE)
  const audio = await ctx.decodeAudioData(await blob.arrayBuffer())
  const mono = downmix(audio)
  for (let s = Math.floor(from * RATE); s < mono.length; s += WINDOW_S * RATE) {
    yield { start: s / RATE, samples: mono.slice(s, s + WINDOW_S * RATE) }
  }
}

function downmix(b: AudioBuffer) {
  if (b.numberOfChannels === 1) return b.getChannelData(0)
  const out = new Float32Array(b.length)
  for (let c = 0; c < b.numberOfChannels; c++) {
    const d = b.getChannelData(c)
    for (let i = 0; i < d.length; i++) out[i] += d[i] / b.numberOfChannels
  }
  return out
}

const rms = (a: Float32Array) => {
  let s = 0
  for (let i = 0; i < a.length; i += 4) s += a[i] * a[i]
  return Math.sqrt(s / Math.ceil(a.length / 4))
}

export async function recordingDuration(blob: Blob) {
  try {
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS })
    return await input.computeDuration()
  } catch {
    return 0
  }
}

/**
 * Transcribes a recording on this device. Calls onLines after every couple of minutes of audio
 * with everything heard so far, so the caller can save progress and pick up where it left off.
 */
export async function transcribeOnDevice(opts: {
  blob: Blob
  model: string
  language?: string
  /** Seconds already transcribed (when carrying on from an earlier run). */
  from: number
  duration: number
  signal: AbortSignal
  onProgress: (p: DeviceProgress) => void
  onLines: (lines: TranscriptLine[], doneUntil: number) => Promise<void>
}) {
  const worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' })
  let waiting: { resolve: (m: WorkerResponse) => void; reject: (e: Error) => void } | undefined
  const abort = () => {
    worker.terminate()
    waiting?.reject(new DOMException('Cancelled', 'AbortError'))
  }
  opts.signal.addEventListener('abort', abort)
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const m = e.data
    if (m.type === 'download') {
      opts.onProgress({
        phase: 'download',
        fraction: m.total ? m.loaded / m.total : 0,
        detail: `Downloading the speech model (one time only): ${Math.round(m.loaded / 1e6)} of ${Math.round(m.total / 1e6)} MB`,
      })
    } else if (m.type === 'error') waiting?.reject(new Error(m.message))
    else waiting?.resolve(m)
  }
  worker.onerror = (e) => waiting?.reject(new Error(e.message || 'The speech model stopped working.'))
  const send = (req: WorkerRequest, transfer: Transferable[] = []) =>
    new Promise<WorkerResponse>((resolve, reject) => {
      waiting = { resolve, reject }
      worker.postMessage(req, transfer)
    })

  try {
    opts.onProgress({ phase: 'download', fraction: 0, detail: 'Loading the speech model…' })
    await send({ type: 'load', model: opts.model }).catch((err: Error) => {
      if (err.name === 'AbortError') throw err
      throw new Error(
        /fetch|network|load/i.test(err.message)
          ? 'Couldn’t download the speech model. The first on-device transcript needs an internet connection; after that it works offline.'
          : `The speech model couldn’t start on this device: ${err.message}`,
      )
    })
    let id = 0
    const began = Date.now()
    for await (const w of audioWindows(opts.blob, opts.from)) {
      if (opts.signal.aborted) throw new DOMException('Cancelled', 'AbortError')
      const end = w.start + w.samples.length / RATE
      let lines: TranscriptLine[] = []
      if (rms(w.samples) >= SILENCE_RMS) {
        const res = await send({ type: 'transcribe', id: ++id, audio: w.samples, language: opts.language }, [w.samples.buffer])
        if (res.type === 'result')
          lines = cleanLines(res.chunks.map((c) => ({ start: c.start + w.start, end: c.end + w.start, text: c.text })))
      }
      await opts.onLines(lines, end)
      const done = opts.duration ? Math.min(1, end / opts.duration) : 0
      const rate = (end - opts.from) / ((Date.now() - began) / 1000)
      const left = opts.duration && rate > 0 ? (opts.duration - end) / rate : 0
      opts.onProgress({
        phase: 'transcribe',
        fraction: done,
        detail: `Transcribed ${Math.round(end / 60)} of ${Math.round(opts.duration / 60)} minutes${left > 60 ? `, about ${Math.round(left / 60)} min to go` : ''}`,
      })
    }
  } finally {
    opts.signal.removeEventListener('abort', abort)
    worker.terminate()
  }
}
