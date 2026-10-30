import { blankLectern, blankPrep, db, newId, type CheckItem, type Entity, type Session } from './db'

/** Today's date on this device, "2026-10-26" (not UTC, which is a day off in the evening or morning in many places). */
export function localDate(t: number | Date = new Date()) {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A leftover from session #n, tagged so the GM can see where it came from. */
const carried = (items: CheckItem[] | undefined, n: number) =>
  (items ?? []).filter((x) => !x.done && x.text.trim()).map((x) => ({ id: newId(), done: false, text: /\(from #\d+\)$/.test(x.text) ? x.text : `${x.text} (from #${n})` }))

/**
 * Books a date for the next session: the next one, if it's already made and not played or dated
 * yet, takes the date; otherwise a new one is made.
 */
export async function bookNextSession(worldId: string, campaignId: string, date: string) {
  const last = (await db.sessions.where({ campaignId }).sortBy('number')).at(-1)
  const today = localDate()
  if (last && !isPlayed(last) && !last.startedAt && !last.recordings.length && (!last.date || last.date > today)) {
    await db.sessions.update(last.id, { date })
    return { ...last, date }
  }
  return createNextSession(worldId, campaignId, date)
}

/**
 * Makes the next session of a campaign. The prep starts with the clues the players haven't found
 * and the scenes they didn't reach last time, and the Lectern starts where the party left off
 * (same place, same people around). It has no date until one is set or booked.
 */
export async function createNextSession(worldId: string, campaignId: string, date = '') {
  const all = await db.sessions.where({ campaignId }).sortBy('number')
  const prev = all.at(-1)
  const number = (prev?.number ?? 0) + 1
  const prep = blankPrep()
  if (prev?.prep) {
    prep.clues = carried(prev.prep.clues, prev.number)
    prep.scenes = carried(prev.prep.scenes, prev.number)
  }
  const lectern = blankLectern()
  if (prev?.lectern) {
    lectern.sceneId = prev.lectern.sceneId
    lectern.sceneText = prev.lectern.sceneText
    lectern.presentIds = [...prev.lectern.presentIds]
  }
  const session: Session = {
    id: newId(),
    worldId,
    campaignId,
    number,
    title: `Session ${number}`,
    date,
    notes: '',
    recap: '',
    visibility: 'gm',
    entityIds: [],
    recordings: [],
    prep: prep.clues.length || prep.scenes.length ? prep : undefined,
    lectern: prev?.lectern ? lectern : undefined,
    createdAt: Date.now(),
  }
  await db.sessions.add(session)
  return session
}

/** The player characters who play in a campaign: ones marked for it, or for no campaign in particular. */
export function partyOf(entities: Entity[], campaignId: string | undefined, { activeOnly = false } = {}) {
  return entities.filter(
    (e) =>
      e.type === 'pc' &&
      !e.template &&
      (!campaignId || !e.campaignId || e.campaignId === campaignId) &&
      (!activeOnly || !e.status || e.status === 'alive'),
  )
}

/**
 * Where a session is in its life: Planned (nothing written yet), Preparing (a plan, prep or notes
 * on it), Playing (started at the table, or live or recording right now) and Played. Played comes
 * from "Mark as played" at the end of Wrap up, or, for sessions from before there was such a mark,
 * from a written recap or a date that has gone by.
 */
export type SessionStage = 'planned' | 'preparing' | 'playing' | 'played'

export const STAGES: Record<SessionStage, { label: string; tone: string }> = {
  planned: { label: 'Planned', tone: '' },
  preparing: { label: 'Preparing', tone: 'warn' },
  playing: { label: 'Playing', tone: 'good' },
  played: { label: 'Played', tone: 'done' },
}

type StageFacts = Pick<Session, 'recap' | 'date' | 'notes' | 'prep' | 'startedAt' | 'playedAt'>

/** Whether a session has been played: marked played, written up, or its date has gone by. */
export const isPlayed = (s: Pick<Session, 'recap' | 'date' | 'playedAt'>, today = localDate()) => !!s.playedAt || !!s.recap.trim() || (!!s.date && s.date < today)

/** Whether there's any plan for a session yet. */
const hasPlan = (s: StageFacts) => {
  const p = s.prep
  return !!(s.notes.trim() || p?.strongStart.trim() || p?.scenes.length || p?.clues.length || p?.encounters.length)
}

/** A session's stage. `live` says it's being played right now (live to players, or recording on this device). */
export function sessionStage(s: StageFacts, live = false, today = localDate()): SessionStage {
  if (s.playedAt) return 'played'
  if (live) return 'playing'
  if (s.recap.trim() || (s.date && s.date < today)) return 'played'
  if (s.startedAt) return 'playing'
  return hasPlan(s) ? 'preparing' : 'planned'
}

/** The part of a session that opens when the address names none: Wrap up once it's being played or has been, otherwise Prepare. */
export const sessionFirstTab = (s: StageFacts) => (['playing', 'played'].includes(sessionStage(s)) ? 'notes' : 'prep')

/** Whether a session has been played (the old name, kept for the places that ask it this way). */
export const playedAlready = isPlayed

/** "Start playing": the session is under way (the first time only, so the start time stays the real one). */
export const startPlaying = (sessionId: string) =>
  db.sessions
    .where('id')
    .equals(sessionId)
    .modify((s) => {
      if (!s.startedAt) s.startedAt = Date.now()
    })

/**
 * "Mark as played", at the end of Wrap up: the session is done and the next one becomes the one in
 * hand. If the campaign has no next session yet, one is made (carrying over unfound clues and
 * unplayed scenes). Gives back the next session, and an undo that takes the mark back (and the
 * session it made, if nobody has touched it since).
 */
export async function markPlayed(session: Session) {
  await db.sessions.update(session.id, { playedAt: Date.now(), startedAt: session.startedAt ?? Date.now() })
  const later = (await db.sessions.where({ campaignId: session.campaignId }).sortBy('number')).filter((s) => s.number > session.number)
  const made = later.length ? undefined : await createNextSession(session.worldId, session.campaignId)
  const next = later[0] ?? made!
  const undo = async () => {
    await db.sessions.update(session.id, { playedAt: undefined })
    if (!made) return
    const now = await db.sessions.get(made.id)
    if (now && JSON.stringify(now) === JSON.stringify(made)) await db.sessions.delete(made.id)
  }
  return { next, undo }
}
