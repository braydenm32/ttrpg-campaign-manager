/**
 * Session audio recording.
 *  - "mic": one microphone in the room (in-person play).
 *  - "mic+system": microphone mixed with audio from another tab or app the GM shares
 *    (Discord, Zoom, Foundry in a browser tab), for online play.
 */
export type RecordSource = 'mic' | 'mic+system'

export interface ActiveRecording {
  stop: () => Promise<Blob>
  startedAt: number
  mime: string
}

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

export function recordingSupported() {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

export function systemAudioSupported() {
  return !!navigator.mediaDevices?.getDisplayMedia
}

/** Starts recording. onPiece gets each few seconds of audio as it's made, so it can be saved straight away. */
export async function startRecording(source: RecordSource, onPiece?: (piece: Blob, totalBytes: number) => void): Promise<ActiveRecording> {
  const streams: MediaStream[] = []
  const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  streams.push(mic)

  let recordStream = mic
  let ctx: AudioContext | undefined
  if (source === 'mic+system') {
    let shared: MediaStream
    try {
      // Browsers require video in the request; we ignore the picture and keep the audio.
      shared = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    } catch (err) {
      mic.getTracks().forEach((t) => t.stop())
      throw err
    }
    streams.push(shared)
    if (!shared.getAudioTracks().length) {
      streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
      throw new Error('No audio was shared. When choosing what to share, pick the tab or screen and tick "Share audio".')
    }
    ctx = new AudioContext()
    const dest = ctx.createMediaStreamDestination()
    ctx.createMediaStreamSource(mic).connect(dest)
    ctx.createMediaStreamSource(new MediaStream(shared.getAudioTracks())).connect(dest)
    recordStream = dest.stream
  }

  const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m))
  const rec = new MediaRecorder(recordStream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined)
  const chunks: Blob[] = []
  let bytes = 0
  rec.ondataavailable = (e) => {
    if (e.data.size) {
      chunks.push(e.data)
      bytes += e.data.size
      onPiece?.(e.data, bytes)
    }
  }
  rec.start(5000)

  return {
    startedAt: Date.now(),
    mime: rec.mimeType || mimeType || 'audio/webm',
    stop: () =>
      new Promise<Blob>((resolve) => {
        rec.onstop = () => {
          streams.forEach((s) => s.getTracks().forEach((t) => t.stop()))
          ctx?.close()
          resolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }))
        }
        rec.stop()
      }),
  }
}

export function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
