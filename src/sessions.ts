import { toast } from './undo'
import { blankLectern, blankPrep, db, newId, type CalDate, type CheckItem, type Entity, type PrepScene, type Session } from './db'

/** Today's date on this device, "2026-10-26" (not UTC, which is a day off in the evening or morning in many places). */
export function localDate(t: number | Date = new Date()) {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A leftover from session #n, tagged so the GM can see where it came from. */
const carried = <T extends CheckItem>(items: T[] | undefined, n: number) =>
  (items ?? []).filter((x) => !x.done && x.text.trim()).map((x) => ({ id: newId(), done: false, text: /\(from #\d+\)$/.test(x.text) ? x.text : `${x.text} (from #${n})` }))

/** An unplayed scene from session #n, with its scene card (all but its fight, which belongs to that session's plan). */
const carriedScenes = (scenes: PrepScene[] | undefined, n: number): PrepScene[] => {
  const left = (scenes ?? []).filter((x) => !x.done && x.text.trim())
  return carried(left, n).map((c, i) => {
    const card = { ...left[i] }
    delete card.encounterId
    return { ...card, ...c }
  })
}

/**
 * The session a campaign plays next, for booking a date and for carrying leftovers on: the first one
 * (lowest number) that hasn't been played, started or recorded. Not the last one written: a GM who
 * plans ahead has several waiting.
 */
export const firstUnplayed = (sessions: Session[], today = localDate()) =>
  [...sessions].sort((a, b) => a.number - b.number).find((s) => !isPlayed(s, today) && !s.startedAt && !s.recordings.length)

/**
 * Books a date for the next session: the next one to play, if it's already made, takes the date;
 * otherwise a new one is made.
 */
export async function bookNextSession(worldId: string, campaignId: string, date: string) {
  const next = firstUnplayed(await db.sessions.where({ campaignId }).toArray())
  if (next) {
    await db.sessions.update(next.id, { date })
    return { ...next, date }
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
    prep.scenes = carriedScenes(prev.prep.scenes, prev.number)
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

type StageFacts = Pick<Session, 'recap' | 'date' | 'notes' | 'prep' | 'startedAt' | 'playedAt'> & { createdAt?: number }

/**
 * Sessions made from this day on are only played once "Mark as played" says so (or a recap is
 * written on one never started). Older ones, from before there was such a mark, also count as
 * played once their date has gone by, as they always did.
 */
const MARK_NEEDED_SINCE = new Date(2026, 10, 27).getTime()

/** Whether a date that has gone by is enough to call a session played: only for sessions from before "Mark as played". */
const datePlays = (s: { date: string; createdAt?: number }, today: string) => !!s.date && s.date < today && (s.createdAt ?? 0) < MARK_NEEDED_SINCE

/**
 * Whether a session has been played: marked played. A session you pressed "Start playing" on is not,
 * however much recap you type, until you mark it. Only a session never started in the app (an old
 * or imported one) counts as played by a written recap, or, for one made before "Mark as played"
 * existed, by a date that has gone by.
 */
export const isPlayed = (s: Pick<Session, 'recap' | 'date' | 'playedAt'> & { startedAt?: number; createdAt?: number }, today = localDate()) =>
  !!s.playedAt || (!s.startedAt && (!!s.recap.trim() || datePlays(s, today)))

/** Whether a session's date has gone by without it being started or marked played: the Desk asks what happened. */
export const isOverdue = (s: Pick<Session, 'recap' | 'date' | 'playedAt'> & { startedAt?: number; createdAt?: number }, today = localDate()) =>
  !!s.date && s.date < today && !s.startedAt && !isPlayed(s, today)

/** Whether there's any plan for a session yet. */
const hasPlan = (s: StageFacts) => {
  const p = s.prep
  return !!(s.notes.trim() || p?.strongStart.trim() || p?.scenes.length || p?.clues.length || p?.encounters.length)
}

/** A session's stage. `live` says it's being played right now (live to players, or recording on this device). */
export function sessionStage(s: StageFacts, live = false, today = localDate()): SessionStage {
  if (s.playedAt) return 'played'
  if (live) return 'playing'
  if (s.startedAt) return 'playing'
  if (s.recap.trim() || datePlays(s, today)) return 'played'
  return hasPlan(s) ? 'preparing' : 'planned'
}

/** The part of a session that opens when the address names none: Wrap up once it's being played or has been, otherwise Prepare. */
export const sessionFirstTab = (s: StageFacts) => (['playing', 'played'].includes(sessionStage(s)) ? 'notes' : 'prep')

/** Whether a session has been played (the old name, kept for the places that ask it this way). */
export const playedAlready = isPlayed

/**
 * "Start playing": the session is under way (the first time only, so the start time stays the real
 * one). It also notes the world's date as the day the session starts in the world, if the session
 * has none yet. Gives back an undo that puts it back to not started, or nothing if it was already
 * under way.
 */
export async function startPlaying(sessionId: string) {
  const before = await db.sessions.get(sessionId)
  if (!before || before.startedAt) return undefined
  const today = before.worldDate ? undefined : (await db.worlds.get(before.worldId))?.calendar?.today
  await db.sessions
    .where('id')
    .equals(sessionId)
    .modify((s) => stampStart(s, today))
  return () => notStarted(sessionId, !!today)
}

/**
 * "Start playing" as the buttons do it: starts the session and says so in the note at the bottom,
 * with a way back for a press by mistake. Mentions another session of the campaign that is still
 * being played, since two at once is nearly always a slip.
 */
export async function startAndTell(session: Pick<Session, 'id' | 'number' | 'title' | 'campaignId'>) {
  const undo = await startPlaying(session.id)
  if (!undo) return
  const other = (await db.sessions.where({ campaignId: session.campaignId }).toArray()).find((s) => s.id !== session.id && s.startedAt && !s.playedAt)
  toast(`#${session.number} ${session.title} is being played.${other ? ` #${other.number} ${other.title} is still being played too.` : ''}`, undo, 'Not started after all')
}

/** "Not started after all": takes a start back, so the session is being prepared again. */
export const notStarted = (sessionId: string, clearWorldDate = false) =>
  db.sessions
    .where('id')
    .equals(sessionId)
    .modify((s) => {
      delete s.startedAt
      delete s.playStart
      if (clearWorldDate) delete s.worldDate
    })

/**
 * The first time a session is started: notes the time, what was already planned (see
 * Session.playStart) and, if the session has no date in the world yet, the world's date today.
 */
export function stampStart(s: Session, worldToday?: CalDate) {
  if (s.startedAt) return
  s.startedAt = Date.now()
  s.playStart = { notes: s.notes, entityIds: [...s.entityIds] }
  if (worldToday && !s.worldDate) s.worldDate = { ...worldToday }
}

/** Pages that came up in play: added after play began, or put in a scene, a fight or the Lectern's place. Without a start mark, all of those linked. */
export function featuredInPlay(s: Pick<Session, 'entityIds' | 'lectern' | 'startedAt' | 'playedAt' | 'playStart'>) {
  if (!s.startedAt) return s.playedAt ? s.entityIds : []
  const l = s.lectern
  const played = new Set([l?.sceneId, ...(l?.presentIds ?? []), ...(l?.combat.combatants.map((c) => c.entityId) ?? [])].filter((x): x is string => !!x))
  if (!s.playStart) return played.size ? s.entityIds.filter((id) => played.has(id)) : s.entityIds
  const planned = new Set(s.playStart.entityIds)
  return s.entityIds.filter((id) => !planned.has(id) || played.has(id))
}

/** What the GM wrote in the notes during play (the prep script that was there at the start left out), where that's known. */
export function notesFromPlay(s: Pick<Session, 'notes' | 'startedAt' | 'playStart'>) {
  const before = s.playStart?.notes
  return s.startedAt && before && s.notes.startsWith(before) ? s.notes.slice(before.length) : s.notes
}

/**
 * "Not played yet": takes the mark back. The session goes back to Playing (it was started), so
 * "Mark as played" is there again; a recap or a past date no longer makes it played. Gives back an
 * undo that restores the mark.
 */
export async function unmarkPlayed(session: Session) {
  const { playedAt, startedAt } = session
  await db.sessions.update(session.id, { playedAt: undefined, startedAt: startedAt ?? Date.now() })
  return () => db.sessions.update(session.id, { playedAt, startedAt })
}

/**
 * "Mark as played", at the end of Wrap up: the session is done and the next one becomes the one in
 * hand. Unfound clues and unplayed scenes carry over to it: into a new session if the campaign has
 * none waiting, or added to the end of the next one's plan if it's already made. A date still ahead
 * (or none) becomes today, the day it was played. Gives back the next session, how much was carried
 * into one that already existed, and an undo that takes all of it back (and the session it made, if
 * nobody has touched it since).
 */
export async function markPlayed(session: Session) {
  const today = localDate()
  const date = !session.date || session.date > today ? today : session.date
  await db.sessions.update(session.id, { playedAt: Date.now(), startedAt: session.startedAt ?? Date.now(), date })
  const later = (await db.sessions.where({ campaignId: session.campaignId }).sortBy('number')).filter((s) => s.number > session.number)
  const made = later.length ? undefined : await createNextSession(session.worldId, session.campaignId)
  const next = later[0] ?? made!
  // Leftovers go into a next session that was already written, unless they're there from an earlier go.
  const fresh = <T extends CheckItem>(items: T[], have: CheckItem[] | undefined) => {
    const texts = new Set((have ?? []).map((x) => x.text))
    return items.filter((x) => !texts.has(x.text))
  }
  const clues = made ? [] : fresh(carried(session.prep?.clues, session.number), next.prep?.clues)
  const scenes = made ? [] : fresh(carriedScenes(session.prep?.scenes, session.number), next.prep?.scenes)
  const added = new Set<string>([...clues, ...scenes].map((x) => x.id))
  if (added.size)
    await db.sessions
      .where('id')
      .equals(next.id)
      .modify((s) => {
        s.prep ??= blankPrep()
        s.prep.clues = [...s.prep.clues, ...clues]
        s.prep.scenes = [...s.prep.scenes, ...scenes]
      })
  const undo = async () => {
    await db.sessions.update(session.id, { playedAt: undefined, date: session.date })
    if (added.size)
      await db.sessions
        .where('id')
        .equals(next.id)
        .modify((s) => {
          if (!s.prep) return
          s.prep.clues = s.prep.clues.filter((x) => !added.has(x.id))
          s.prep.scenes = s.prep.scenes.filter((x) => !added.has(x.id))
        })
    if (!made) return
    const now = await db.sessions.get(made.id)
    if (now && JSON.stringify(now) === JSON.stringify(made)) await db.sessions.delete(made.id)
  }
  return { next, undo, carried: { clues: clues.length, scenes: scenes.length } }
}
