import { useSyncExternalStore } from 'react'
import type { ClaudeModel } from './claude'

/**
 * Claude jobs that keep going when the GM leaves the page they started on. Each job has a fixed id
 * (the kind of job and what it's for, e.g. "recap:<session id>"), so its panel finds it again when
 * the GM comes back: still writing, or finished and waiting to be looked at. Jobs live in memory
 * for this tab (closing the tab stops them); finished ones are also kept in session storage so a
 * reload doesn't lose an answer that was paid for.
 */

export interface ClaudeJobState {
  id: string
  worldId: string
  /** What it is, for the note in the top bar: "Recap of session 3". */
  title: string
  /** The page it belongs to (its address without ?…), and the address to go back to it. */
  path: string
  href: string
  model: ClaudeModel
  status: 'writing' | 'done' | 'failed'
  /** What Claude has written so far, and what it's reading (with tools). */
  text: string
  step: string
  /** What the GM asked, for jobs that show it while writing. */
  asked?: string
  /** The finished answer, until its panel has used it. */
  result?: string
  /** "That cost about US$0.04 with Claude Sonnet 5.5." */
  note?: string
  /** Said alongside the answer when it isn't the whole of it. */
  warning?: string
  error?: string
  /** The answer was already put where it belongs (a recap draft saved), so the panel only shows the note. */
  handled?: boolean
  startedAt: number
}

export interface JobWork {
  signal: AbortSignal
  onText: (soFar: string) => void
  onStep: (what: string) => void
}

const STORE = 'codex.claudeJobs'
const jobs = new Map<string, ClaudeJobState>()
const aborts = new Map<string, AbortController>()
const listeners = new Set<() => void>()
let list: ClaudeJobState[] = []

try {
  for (const j of JSON.parse(sessionStorage.getItem(STORE) ?? '[]') as ClaudeJobState[]) if (j.status !== 'writing') jobs.set(j.id, j)
  list = [...jobs.values()]
} catch {
  // Nothing kept, or storage blocked.
}

/** `keep` saves finished jobs to session storage (not needed for each bit of streamed text). */
function changed(keep = true) {
  list = [...jobs.values()]
  if (keep) {
    try {
      const finished = list.filter((j) => j.status !== 'writing')
      if (finished.length) sessionStorage.setItem(STORE, JSON.stringify(finished))
      else sessionStorage.removeItem(STORE)
    } catch {
      // Storage full or blocked: finished jobs last until the page closes.
    }
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

function patch(id: string, p: Partial<ClaudeJobState>, keep = true) {
  const j = jobs.get(id)
  if (!j) return
  jobs.set(id, { ...j, ...p })
  changed(keep)
}

/**
 * Starts a job (unless that one is already writing). `work` does the asking. It returns the answer
 * for its panel to pick up, or no text when it has already put the answer where it belongs (a recap
 * draft saved, an answer added to the conversation), which works even if the panel is closed by then.
 */
export function startJob(
  meta: Pick<ClaudeJobState, 'id' | 'worldId' | 'title' | 'path' | 'href' | 'model' | 'asked'>,
  work: (w: JobWork) => Promise<{ text?: string; note?: string; warning?: string }>,
) {
  if (jobs.get(meta.id)?.status === 'writing') return
  const abort = new AbortController()
  aborts.set(meta.id, abort)
  jobs.set(meta.id, { ...meta, status: 'writing', text: '', step: '', startedAt: Date.now() })
  changed()
  const mine = () => aborts.get(meta.id) === abort
  void (async () => {
    try {
      const res = await work({
        signal: abort.signal,
        onText: (text) => mine() && patch(meta.id, { text }, false),
        onStep: (step) => mine() && patch(meta.id, { step, text: '' }, false),
      })
      if (!mine()) return
      aborts.delete(meta.id)
      patch(meta.id, { status: 'done', result: res.text, handled: res.text === undefined, note: res.note, warning: res.warning, text: '', step: '' })
    } catch (err) {
      if (!mine()) return
      aborts.delete(meta.id)
      if ((err as Error).name === 'AbortError' || abort.signal.aborted) {
        jobs.delete(meta.id)
        changed()
      } else patch(meta.id, { status: 'failed', error: (err as Error).message || 'Something went wrong.', text: '', step: '' })
    }
  })()
}

/** Stops a job that's writing; nothing is kept from it. */
export function stopJob(id: string) {
  aborts.get(id)?.abort()
  aborts.delete(id)
  if (jobs.delete(id)) changed()
}

/** Forgets a finished job once its panel has used or shown it. */
export function clearJob(id: string) {
  if (jobs.get(id)?.status === 'writing') return
  if (jobs.delete(id)) changed()
}

/** Puts a dismissed job back (Undo), unless a new one with its id has started since. */
export function restoreJob(job: ClaudeJobState) {
  if (jobs.has(job.id)) return
  jobs.set(job.id, job)
  changed()
}

/** Takes a finished job's answer (or problem) into its panel, then forgets the job. */
export function takeFinished(job: ClaudeJobState, onResult: ((text: string) => void) | undefined, setError: (e: string) => void, setNote?: (n: string) => void) {
  // Handed over once only, even if the panel asks twice.
  if (jobs.get(job.id) !== job || job.status === 'writing') return
  if (job.status === 'failed') setError(job.error ?? 'Something went wrong.')
  else {
    if (job.result !== undefined) onResult?.(job.result)
    setNote?.(job.note ?? '')
    setError(job.warning ?? '')
  }
  clearJob(job.id)
}

/** The page a job belongs to can get a tidier address after it starts; its panel keeps this up to date. */
export function moveJob(id: string, path: string, href: string) {
  const j = jobs.get(id)
  if (j && (j.path !== path || j.href !== href)) patch(id, { path, href })
}

export const useJob = (id: string) => useSyncExternalStore(subscribe, () => jobs.get(id))
export const useJobs = () => useSyncExternalStore(subscribe, () => list)
export const writingOn = (path: string) => list.filter((j) => j.status === 'writing' && j.path === path)
export const anyWriting = () => list.some((j) => j.status === 'writing')
