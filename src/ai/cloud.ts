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
  if (res.status === 401) throw new Error('AssemblyAI didn’t accept the API key. Check it in World settings → This device.')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`AssemblyAI said: ${body.error ?? res.statusText}`)
  }
  return res.json()
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const stop = () => {
      clearTimeout(t)
      reject(new DOMException('Cancelled', 'AbortError'))
    }
    if (signal.aborted) return stop()
    // Each wait takes its listener off again, so a long job doesn't pile them up.
    const t = setTimeout(() => {
      signal.removeEventListener('abort', stop)
      resolve()
    }, ms)
    signal.addEventListener('abort', stop, { once: true })
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
        // The best model ($0.21 an hour), falling back to Universal-2 for languages it doesn't cover.
        speech_models: ['universal-3-5-pro', 'universal-2'],
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

/**
 * Deletes a finished transcript from AssemblyAI once it's saved here, so the table's talk doesn't sit
 * in another company's storage. True when it worked; a failure never undoes the saved transcript.
 */
export async function deleteCloudJob(id: string, key: string) {
  try {
    const res = await fetch(`${API}/transcript/${id}`, { method: 'DELETE', headers: { authorization: key } })
    return res.ok
  } catch {
    return false
  }
}

/*
 * Every job this device sends to AssemblyAI is noted here (in this browser only) until AssemblyAI's
 * copy is deleted, so nothing is left there by accident: a transcript started over, a session deleted
 * while AssemblyAI was still working, a delete that failed, or the app closing before it got to it.
 * Each time a session's recordings are opened, jobs no longer waited on are deleted (see TranscriptPanel).
 */
const LEFT = 'codex.assemblyLeft'

function readLeft(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(LEFT) ?? '[]')
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeLeft(ids: string[]) {
  try {
    if (ids.length) localStorage.setItem(LEFT, JSON.stringify([...new Set(ids)]))
    else localStorage.removeItem(LEFT)
  } catch {
    // Storage blocked: the job is just deleted now, or not at all.
  }
}

/** Jobs sent from this device whose copy may still be at AssemblyAI. */
export const cloudJobsLeft = readLeft

/** Notes a job sent from this device, until its copy at AssemblyAI is deleted (or kept on purpose). */
export function noteCloudJob(id: string) {
  writeLeft([...readLeft(), id])
}

/** Stops tracking a job without deleting it: the GM keeps a copy at AssemblyAI. */
export function keepCloudJob(id: string) {
  writeLeft(readLeft().filter((x) => x !== id))
}

/** Deletes a job's copy at AssemblyAI; until that works, it stays noted and is tried again later. */
export async function forgetCloudJob(id: string, key: string) {
  noteCloudJob(id)
  if (!key || !(await deleteCloudJob(id, key))) return false
  keepCloudJob(id)
  return true
}

let sweeping: Promise<number> | undefined
/**
 * Tries again to delete every noted job nothing here waits on any more (`wanted` is the jobs of
 * transcripts still being made). Returns how many are still left at AssemblyAI.
 */
export function deleteCloudLeftovers(key: string, wanted: Set<string>) {
  sweeping ??= (async () => {
    for (const id of readLeft()) if (!wanted.has(id)) await forgetCloudJob(id, key)
    return readLeft().filter((id) => !wanted.has(id)).length
  })().finally(() => (sweeping = undefined))
  return sweeping
}
