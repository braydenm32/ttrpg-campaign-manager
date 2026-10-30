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
  if (last && !last.recap.trim() && !last.recordings.length && (!last.date || last.date > today)) {
    await db.sessions.update(last.id, { date })
    return { ...last, date }
  }
  return createNextSession(worldId, campaignId, date)
}

/**
 * Makes the next session of a campaign. The prep starts with the clues the players haven't found
 * and the scenes they didn't reach last time, and the Lectern starts where the party left off
 * (same place, same people around).
 */
export async function createNextSession(worldId: string, campaignId: string, date = localDate()) {
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

/** The part of a session that opens when the address names none: its prep until something is written or recorded, then the notes. */
export const sessionFirstTab = (s: Pick<Session, 'notes' | 'recordings'>) => (!s.notes.trim() && !s.recordings.length ? 'prep' : 'notes')

/** Whether a session has been played: it has a recap, or its date has gone by. */
export const playedAlready = (s: Pick<Session, 'recap' | 'date'>) => !!s.recap.trim() || (!!s.date && s.date < localDate())
