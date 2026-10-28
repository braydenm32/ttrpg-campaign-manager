import { Link } from 'react-router-dom'
import { Help } from './help'
import type { Entity, Session } from './db'
import { namesOf } from './links'
import { formatTime } from './recorder'
import { worldPath } from './paths'
import { stripSecrets } from './Markdown'

/** Words that start a name without being one ("Brother Tallow" isn't heard as "Brother"). */
const TITLES = new Set(['the', 'old', 'young', 'brother', 'sister', 'father', 'mother', 'lord', 'lady', 'sir', 'dame', 'captain', 'king', 'queen', 'prince', 'princess', 'master', 'mistress', 'doctor', 'dr', 'saint', 'st'])

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The spoken forms of a page's name: its name, nicknames and, for people, their first name. */
function spokenNames(e: Entity) {
  const names = [e.name, ...(e.aliases ?? [])].map((n) => n.trim()).filter((n) => n.length >= 3)
  const first = e.name.trim().split(/\s+/)[0]
  if ((e.type === 'npc' || e.type === 'pc') && first && first !== e.name.trim() && first.length >= 3 && !TITLES.has(first.toLowerCase())) names.push(first)
  return [...new Set(names)]
}

/** Sessions whose notes (GM only) or recap link to this page. */
function linkingSessions(e: Entity, sessions: Session[], isGM: boolean) {
  const needles = new Set(namesOf(e))
  const links = (text: string) => [...text.matchAll(/\[\[([^\]|]+)/g)].some((m) => needles.has(m[1].trim().toLowerCase()))
  // In the GM's player preview, hidden passages of a recap don't count.
  return sessions.filter((s) => links(isGM ? s.recap : stripSecrets(s.recap)) || (isGM && links(s.notes)))
}

/** Lines in session transcripts where the page's name was said. Names are matched as written (capitalised). */
function heardIn(e: Entity, sessions: Session[]) {
  const names = spokenNames(e)
  if (!names.length) return []
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.map(escapeRe).join('|')})(?![\\p{L}\\p{N}])`, 'u')
  const out: { session: Session; assetId: string; start: number; text: string }[] = []
  for (const s of sessions)
    for (const r of s.recordings ?? [])
      for (const l of r.transcript && !r.transcript.pending ? r.transcript.lines : []) if (re.test(l.text)) out.push({ session: s, assetId: r.assetId, start: l.start, text: l.text })
  return out
}

/** "Mentioned in sessions" and, for the GM, "Heard in" with times that open the recording there. */
export function SessionMentions({ entity, sessions, worldId, isGM }: { entity: Entity; sessions: Session[]; worldId: string; isGM: boolean }) {
  const linked = linkingSessions(entity, sessions, isGM)
  const heard = isGM ? heardIn(entity, sessions) : []
  if (!linked.length && !heard.length) return null
  const bySession = new Map<string, typeof heard>()
  for (const h of heard) bySession.set(h.session.id, [...(bySession.get(h.session.id) ?? []), h])
  const sessionLink = (s: Session) => `${worldPath(worldId)}/s/${s.id}`
  return (
    <>
      {linked.length > 0 && (
        <section>
          <h2>
            In sessions <Help topic="sessionMentions" />
          </h2>
          <ul className="entity-list">
            {linked.map((s) => (
              <li key={s.id}>
                <Link to={sessionLink(s)}>
                  #{s.number} {s.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {heard.length > 0 && (
        <section>
          <h2>
            Heard in <Help topic="heardIn" />
          </h2>
          <ul className="entity-list heard-in">
            {[...bySession.values()].map((hs) => (
              <li key={hs[0].session.id}>
                <Link to={sessionLink(hs[0].session)}>
                  #{hs[0].session.number} {hs[0].session.title}
                </Link>
                <ul>
                  {hs.slice(0, 4).map((h) => (
                    <li key={`${h.assetId}-${h.start}`} className="small">
                      <Link to={`${sessionLink(h.session)}?play=${h.assetId}&t=${Math.floor(h.start)}`}>
                        <code>{formatTime(h.start)}</code>
                      </Link>{' '}
                      “{h.text.length > 140 ? `${h.text.slice(0, 140)}…` : h.text}”
                    </li>
                  ))}
                  {hs.length > 4 && <li className="muted small">and {hs.length - 4} more times</li>}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
