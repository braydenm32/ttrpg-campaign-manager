import type { TranscriptLine } from '../db'

const API = 'https://api.assemblyai.com/v2'

/** Turns network and API failures into something a GM can act on. */
async function call<T>(url: string, key: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { ...init, signal, headers: { authorization: key, ...init.headers } })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new Error('Could not reach AssemblyAI. Check your internet connection and try again.')
  }
  if (res.status === 401) throw new Error('AssemblyAI didn’t accept the API key. Check it in World settings → AI tools.')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`AssemblyAI said: ${body.error ?? res.statusText}`)
  }
  return res.json()
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Cancelled', 'AbortError'))
    })
  })

/** Uploads the recording and starts a transcription job with speaker labels. Returns the job id. */
export async function startCloudJob(blob: Blob, key: string, language: 'en' | 'auto', signal: AbortSignal) {
  const { upload_url } = await call<{ upload_url: string }>(
    `${API}/upload`,
    key,
    { method: 'POST', body: blob, headers: { 'content-type': 'application/octet-stream' } },
    signal,
  )
  const job = await call<{ id: string }>(
    `${API}/transcript`,
    key,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        audio_url: upload_url,
        speaker_labels: true,
        ...(language === 'auto' ? { language_detection: true } : { language_code: 'en' }),
      }),
    },
    signal,
  )
  return job.id
}

interface Utterance {
  speaker: string
  text: string
  start: number
  end: number
}

/** Waits for a job to finish and returns its lines (AssemblyAI times are in milliseconds). */
export async function waitForCloudJob(id: string, key: string, signal: AbortSignal): Promise<TranscriptLine[]> {
  for (;;) {
    const job = await call<{ status: string; error?: string; utterances?: Utterance[] | null; text?: string }>(
      `${API}/transcript/${id}`,
      key,
      {},
      signal,
    )
    if (job.status === 'completed') {
      return (job.utterances ?? []).map((u) => ({ start: u.start / 1000, end: u.end / 1000, text: u.text, speaker: u.speaker }))
    }
    if (job.status === 'error') throw new Error(`AssemblyAI couldn’t transcribe this recording: ${job.error ?? 'unknown error'}`)
    await wait(5000, signal)
  }
}
