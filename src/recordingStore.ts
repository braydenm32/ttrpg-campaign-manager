import { useSyncExternalStore } from 'react'
import { db, newId, type Bookmark, type RecordingChunk, type Session } from './db'
import { saveFileAsAsset } from './hooks'
import { startRecording, type ActiveRecording, type RecordSource } from './recorder'

/**
 * The recording in progress, kept outside any one screen so it carries on while the GM moves
 * around the app (to the Lectern, a map, a page). Every few seconds of audio is also saved to this
 * device straight away, so if the browser crashes or the tab closes, the session page can put the
 * recording back together.
 */
export interface LiveRecording {
  recordingId: string
  sessionId: string
  worldId: string
  sessionNumber: number
  rec: ActiveRecording
  bookmarks: Bookmark[]
  bytes: number
}

let live: LiveRecording | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const recordingStore = {
  get: () => live,
  subscribe: (l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

export const useLiveRecording = () => useSyncExternalStore(recordingStore.subscribe, recordingStore.get)

const fileName = (n: number, startedAt: number, mime: string) =>
  `Session ${n} – ${new Date(startedAt).toLocaleString()}.${mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'}`

const warnOnLeave = (e: BeforeUnloadEvent) => e.preventDefault()

export async function beginRecording(session: Session, source: RecordSource) {
  if (live) throw new Error(`Session #${live.sessionNumber} is already being recorded. Stop that one first.`)
  const recordingId = newId()
  let seq = 0
  const rec = await startRecording(source, (piece, bytes) => {
    const current = live
    if (!current || current.recordingId !== recordingId) return
    current.bytes = bytes
    emit()
    db.recordingChunks
      .add({ recordingId, sessionId: session.id, worldId: session.worldId, startedAt: current.rec.startedAt, seq: seq++, mime: current.rec.mime, blob: piece, bookmarks: current.bookmarks })
      .catch(() => {
        // Storage full or blocked: the recording still lives in memory until Stop.
      })
  })
  live = { recordingId, sessionId: session.id, worldId: session.worldId, sessionNumber: session.number, rec, bookmarks: [], bytes: 0 }
  window.addEventListener('beforeunload', warnOnLeave)
  emit()
}

export function addBookmark(text: string) {
  if (!live) return
  live = { ...live, bookmarks: [...live.bookmarks, { id: newId(), t: (Date.now() - live.rec.startedAt) / 1000, text: text.trim() || 'Bookmark' }] }
  emit()
}

/** Recordings being saved after Stop: their pieces are still there for a moment, but they aren't cut off. */
const saving = new Set<string>()

/** Stops the recording and saves it as one file on the session. */
export async function endRecording() {
  const cur = live
  if (!cur) return
  saving.add(cur.recordingId)
  live = undefined
  window.removeEventListener('beforeunload', warnOnLeave)
  emit()
  try {
    const blob = await cur.rec.stop()
    await attach(cur.sessionId, cur.worldId, cur.sessionNumber, cur.rec.startedAt, blob, cur.bookmarks)
    await db.recordingChunks.where({ recordingId: cur.recordingId }).delete()
  } finally {
    saving.delete(cur.recordingId)
  }
}

async function attach(sessionId: string, worldId: string, n: number, startedAt: number, blob: Blob, bookmarks: Bookmark[]) {
  const assetId = await saveFileAsAsset(worldId, blob, fileName(n, startedAt, blob.type), ['recording'])
  await db.sessions
    .where('id')
    .equals(sessionId)
    .modify((s) => {
      s.recordings = [...s.recordings, { assetId, startedAt, bookmarks }]
    })
}

/** Recordings of a session that were cut off (the app closed before Stop), as saved so far. */
export async function unsavedRecordings(sessionId: string) {
  const pieces = await db.recordingChunks.where({ sessionId }).toArray()
  const byId = new Map<string, RecordingChunk[]>()
  for (const p of pieces) if (p.recordingId !== live?.recordingId && !saving.has(p.recordingId)) byId.set(p.recordingId, [...(byId.get(p.recordingId) ?? []), p])
  return [...byId.entries()].map(([recordingId, list]) => {
    list.sort((a, b) => a.seq - b.seq)
    return { recordingId, startedAt: list[0].startedAt, bytes: list.reduce((n, p) => n + p.blob.size, 0), seconds: list.length * 5, pieces: list }
  })
}

/** Joins the saved pieces of a cut-off recording into one file on its session. */
export async function recoverRecording(sessionId: string, recordingId: string, sessionNumber: number) {
  const list = (await db.recordingChunks.where({ recordingId }).toArray()).sort((a, b) => a.seq - b.seq)
  if (!list.length) return
  const blob = new Blob(list.map((p) => p.blob), { type: list[0].mime })
  await attach(sessionId, list[0].worldId, sessionNumber, list[0].startedAt, blob, list.at(-1)!.bookmarks)
  await db.recordingChunks.where({ recordingId }).delete()
}

export const discardRecording = (recordingId: string) => db.recordingChunks.where({ recordingId }).delete()
