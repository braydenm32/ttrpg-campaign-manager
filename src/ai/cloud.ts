import type { Session, TranscriptLine } from '../db'

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
      `${API}/transcript/${encodeURIComponent(id)}`,
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

/** How long one delete may take before it counts as failed (and is tried again later). */
const DELETE_WAIT = 8000

/**
 * Deletes a finished transcript from AssemblyAI once it's saved here, so the table's talk doesn't sit
 * in another company's storage. "missing" when AssemblyAI has no such job for this key (already
 * deleted, say), "refused" when it won't delete it with this key (another account's, or a job still
 * being made), "failed" when it couldn't be asked. A failure never undoes the saved transcript.
 */
export async function deleteCloudJob(id: string, key: string): Promise<'deleted' | 'missing' | 'refused' | 'failed'> {
  try {
    const signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(DELETE_WAIT) : undefined
    const res = await fetch(`${API}/transcript/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { authorization: key }, signal })
    if (res.ok) return 'deleted'
    if (res.status === 404) return 'missing'
    return res.status >= 400 && res.status < 500 && res.status !== 429 ? 'refused' : 'failed'
  } catch {
    return 'failed'
  }
}

/*
 * Every job this device sends to AssemblyAI is noted here (in this browser only) until AssemblyAI's
 * copy is deleted, so nothing is left there by accident: a transcript started over, a session deleted
 * while AssemblyAI was still working, a delete that failed, or the app closing before it got to it.
 * Each time a session's recordings are opened, jobs no longer waited on are deleted (deleteCloudLeftovers).
 */
const LEFT = 'codex.assemblyLeft'
const HOUR = 60 * 60_000
const MONTH = 30 * 24 * HOUR

interface Left {
  id: string
  /** When it was noted. */
  at: number
  /** Which key sent it (a fingerprint, not the key): on a shared computer, only that key deletes it. */
  key: string
  /** The world its session is in. */
  world?: string
  /** No transcript waits on it any more (saved, started over, or its session deleted): delete it whenever possible. */
  done?: boolean
  /** Other keys AssemblyAI wouldn't delete it with (someone else's account, say): not tried with them again. */
  missedBy?: string[]
}

/** A short fingerprint of a key, to tell keys apart without keeping a second copy of one. */
function keyMark(key: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}

function readLeft(): Left[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(LEFT) ?? '[]')
    return Array.isArray(list) ? list.filter((x): x is Left => !!x && typeof x.id === 'string' && typeof x.key === 'string' && typeof x.at === 'number') : []
  } catch {
    return []
  }
}

function writeLeft(list: Left[]) {
  try {
    if (list.length) localStorage.setItem(LEFT, JSON.stringify(list))
    else localStorage.removeItem(LEFT)
  } catch {
    // Storage blocked: the job is just deleted now, or not at all.
  }
}

/** Notes a job sent from this device, until its copy at AssemblyAI is deleted (or kept on purpose). */
export function noteCloudJob(id: string, key: string, world: string) {
  writeLeft([...readLeft().filter((j) => j.id !== id), { id, at: Date.now(), key: keyMark(key), world }])
}

/** Stops tracking a job without deleting it: the GM keeps a copy at AssemblyAI. */
export function keepCloudJob(id: string) {
  writeLeft(readLeft().filter((j) => j.id !== id))
}

/** Deletes a job's copy at AssemblyAI now nothing waits on it; until that works, it stays noted and is tried again later. */
export async function forgetCloudJob(id: string, key: string) {
  const left = readLeft()
  const was = left.find((j) => j.id === id)
  // Without a key here, the device that sent it deletes it later (it's noted there).
  if (!key) {
    if (was) writeLeft(left.map((j) => (j.id === id ? { ...j, done: true } : j)))
    return false
  }
  const mark = keyMark(key)
  writeLeft([...left.filter((j) => j.id !== id), { ...(was ?? { id, at: Date.now(), key: mark }), done: true }])
  const result = await deleteCloudJob(id, key)
  const sender = !was || was.key === mark
  // "Not found" only proves it's gone when asked with the key that sent it.
  if (result === 'deleted' || (result === 'missing' && sender)) {
    keepCloudJob(id)
    return true
  }
  // Another key that can't delete it (another account's) isn't tried on it again; the key that sent it still is.
  if (!sender && result !== 'failed')
    writeLeft(readLeft().map((j) => (j.id === id ? { ...j, missedBy: [...new Set([...(j.missedBy ?? []), mark])] } : j)))
  return false
}

/** The AssemblyAI jobs of transcripts still being made in these sessions, which must not be deleted there. */
export const jobsInUse = (sessions: Session[]) =>
  new Set(sessions.flatMap((s) => s.recordings.flatMap((r) => (r.transcript?.engine === 'cloud' && r.transcript.pending?.jobId ? [r.transcript.pending.jobId] : []))))

let sweeping: Promise<number> | undefined
/**
 * Tries again to delete every job sent from this device that nothing here waits on any more: one
 * finished with (saved, started over, its session deleted) at once, any other after an hour (its
 * transcript saved or started over on another device, say). One whose world isn't on this device
 * (taken off it, but maybe still in the cloud) waits a month, as another device may still pick its
 * transcript up. A job another key sent is tried with this one too (the same account's new key, say)
 * until AssemblyAI says this key can't delete it. Nothing new is tried after `deadline`. Returns how
 * many copies are still at AssemblyAI that nothing here waits on.
 */
export function deleteCloudLeftovers(key: string, deadline = Infinity) {
  sweeping ??= (async () => {
    if (!key || !readLeft().length) return 0
    const mark = keyMark(key)
    const { db } = await import('../db')
    const waiting = jobsInUse(await db.sessions.toArray())
    const worlds = new Set(await db.worlds.toCollection().primaryKeys())
    const age = (j: Left) => Date.now() - j.at
    const due = (j: Left) => j.done || (age(j) > HOUR && ((!!j.world && worlds.has(j.world)) || age(j) > MONTH))
    for (const j of readLeft()) {
      if (Date.now() > deadline) break
      if (!waiting.has(j.id) && due(j) && !j.missedBy?.includes(mark)) await forgetCloudJob(j.id, key)
    }
    return readLeft().filter((j) => !waiting.has(j.id)).length
  })().finally(() => (sweeping = undefined))
  return sweeping
}
