import { db, type Entity, type Session } from './db'
import { Help } from './help'
import { partyOf } from './sessions'

/**
 * Who was there: the player characters at the table for a session (Session.present). Ticked on the
 * Lectern's strip and in Wrap up, everyone ticked until the GM says otherwise. It reaches the recap and
 * highlights prompts, Spotlight, and players (on the recap); downtime is offered to those who were there.
 */

/** The ids of the characters who were there: the ticked ones, or (nothing ticked yet) the whole party. */
export function presentIds(session: Pick<Session, 'present' | 'campaignId'>, entities: Entity[]) {
  return session.present ?? partyOf(entities, session.campaignId, { activeOnly: true }).map((e) => e.id)
}

/** The characters who were there, by page (only those the viewer can see). */
export function presentCharacters(session: Pick<Session, 'present' | 'campaignId'>, entities: Entity[]) {
  const ids = new Set(presentIds(session, entities))
  return entities.filter((e) => e.type === 'pc' && ids.has(e.id))
}

/** For prompts: "Who was there: Wren, Silas (Tibbet wasn't)." Empty when there's no party. */
export function presentLine(session: Pick<Session, 'present' | 'campaignId'>, entities: Entity[]) {
  const party = partyOf(entities, session.campaignId, { activeOnly: true })
  if (!party.length) return ''
  const here = presentCharacters(session, entities)
  const away = party.filter((p) => !here.some((h) => h.id === p.id))
  return `Player characters at the table this session: ${here.map((e) => e.name).join(', ') || 'none'}.${away.length ? ` Not there: ${away.map((e) => e.name).join(', ')}.` : ''}`
}

/** The row of ticks. Saving keeps a list from then on (an empty list means nobody was there). */
export function WhoWasThere({ session, entities, compact }: { session: Session; entities: Entity[]; compact?: boolean }) {
  const party = partyOf(entities, session.campaignId, { activeOnly: !session.present })
  const shown = session.present ? [...party, ...entities.filter((e) => e.type === 'pc' && session.present!.includes(e.id) && !party.includes(e))] : party
  if (!shown.length) return null
  const ids = new Set(presentIds(session, entities))
  const toggle = (id: string, on: boolean) =>
    db.sessions
      .where('id')
      .equals(session.id)
      .modify((s) => {
        const now = new Set(s.present ?? partyOf(entities, s.campaignId, { activeOnly: true }).map((e) => e.id))
        if (on) now.add(id)
        else now.delete(id)
        s.present = [...now]
      })
  return (
    <fieldset className={`who-was-there ${compact ? 'compact' : ''}`}>
      <legend className="small">
        Who was there <Help topic="whoWasThere" />
      </legend>
      {shown.map((e) => (
        <label key={e.id} className="inline-check small who-chip">
          <input type="checkbox" checked={ids.has(e.id)} onChange={(ev) => toggle(e.id, ev.target.checked)} />
          {e.name}
        </label>
      ))}
    </fieldset>
  )
}

/** One quiet line on the session page: "At the table: Wren, Silas", once the GM has ticked who was there. */
export function PresentLine({ session, entities }: { session: Session; entities: Entity[] }) {
  if (!session.present) return null
  const here = presentCharacters(session, entities)
  if (!here.length) return null
  return (
    <p className="small muted present-line">
      At the table: {here.map((e) => e.name).join(', ')} <Help topic="whoWasThere" />
    </p>
  )
}
