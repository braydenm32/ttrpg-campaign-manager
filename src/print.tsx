import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { blankPrep, db, typeLabel, type Entity, type Session, type World } from './db'
import { foeCount } from './encounters'
import { Help } from './help'
import { asPlayerSees, useAssetUrl, useVisibleEntities } from './hooks'
import { Markdown } from './Markdown'
import { StatusBadge } from './status'
import { ForcePlayerView, useViewMode } from './viewMode'
import { Ico, PageIcon } from './icons'
import { Eye, Lock, Printer } from '@phosphor-icons/react'

/** Opens the print page for a page or a session. */
export function PrintButton({ to }: { to: string }) {
  return (
    <Link className="button" to={to} title="Print this, or save it as a PDF">
      <Ico as={Printer} /> Print
    </Link>
  )
}

/**
 * A clean, printable copy of one page or session, without the sidebar and buttons. The browser's
 * print window can also save it as a PDF. The GM chooses between their own copy (secrets included)
 * and a player copy, which leaves out everything players can't see.
 */
export default function PrintPage() {
  const { worldId = '' } = useParams()
  const [params] = useSearchParams()
  const world = useLiveQuery(async () => (await db.worlds.get(worldId)) ?? null, [worldId])
  if (world === undefined) return null
  if (world === null) return <div className="print-page">World not found.</div>
  const playerCopy = !!world.shared || params.get('copy') === 'players'
  return playerCopy ? (
    <ForcePlayerView>
      <PrintBody world={world} />
    </ForcePlayerView>
  ) : (
    <PrintBody world={world} />
  )
}

function PrintBody({ world }: { world: World }) {
  const { kind, id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { isGM } = useViewMode()
  useEffect(() => {
    // Give pictures a moment to load before the print window opens.
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="print-page">
      <div className="print-controls row wrap">
        <button onClick={() => navigate(-1)}>← Back</button>
        <button className="primary" onClick={() => window.print()}>
          <Ico as={Printer} /> Print or save as PDF
        </button>
        {!world.shared && (
          <div className="segmented">
            <button className={isGM ? 'on' : ''} onClick={() => setParams({}, { replace: true })}>
              <Ico as={Lock} /> GM copy
            </button>
            <button className={!isGM ? 'on' : ''} onClick={() => setParams({ copy: 'players' }, { replace: true })}>
              <Ico as={Eye} /> Player copy
            </button>
          </div>
        )}
        <Help topic="print" />
        {params.get('copy') === 'players' && <span className="muted small">Secrets, GM notes and hidden pages are left out.</span>}
      </div>
      {kind === 'e' ? <PrintEntity world={world} id={id} /> : <PrintSession world={world} id={id} />}
    </div>
  )
}

function PrintEntity({ world, id }: { world: World; id: string }) {
  const { isGM, canSeeEntity } = useViewMode()
  const stored = useLiveQuery(() => db.entities.get(id), [id])
  const entities = useVisibleEntities(world.id)
  const image = useAssetUrl(stored && (isGM || canSeeEntity(stored)) ? stored.imageId : undefined)
  if (stored === undefined) return null
  if (!stored || stored.worldId !== world.id) return <p>Page not found.</p>
  if (!isGM && !canSeeEntity(stored)) return <p className="notice">This page is GM only, so a player copy would be empty. Reveal it first, or print the GM copy.</p>
  const e: Entity = isGM ? stored : asPlayerSees(stored)
  return (
    <article>
      <div className="muted">
        <PageIcon page={e} world={world} /> {typeLabel(e, world).one} · {world.name}
      </div>
      <h1>{e.name}</h1>
      <StatusBadge entity={e} />
      {e.summary && <p className="lead">{e.summary}</p>}
      {image && <img className="print-image" src={image} alt={e.name} />}
      <Markdown text={e.body} entities={entities} worldId={world.id} showSecrets={isGM} />
      {e.type === 'table' && (
        <ol className="table-entries">
          {(e.entries ?? []).filter((x) => x.trim() && !x.trim().startsWith('#')).map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ol>
      )}
      {e.fields.length > 0 && (
        <dl className="fields">
          {e.fields.map((f, i) => (
            <div key={i}>
              <dt>{f.key}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {isGM && e.gmNotes && (
        <Section title="GM notes">
          <Markdown text={e.gmNotes} entities={entities} worldId={world.id} showSecrets />
        </Section>
      )}
    </article>
  )
}

function PrintSession({ world, id }: { world: World; id: string }) {
  const { isGM, canSee } = useViewMode()
  const s = useLiveQuery(() => db.sessions.get(id), [id])
  const entities = useVisibleEntities(world.id)
  if (s === undefined) return null
  if (!s || s.worldId !== world.id) return <p>Session not found.</p>
  if (!canSee(s.visibility)) return <p className="notice">This session is GM only, so a player copy would be empty. Reveal it first, or print the GM copy.</p>
  const featured = entities.filter((e) => s.entityIds.includes(e.id))
  return (
    <article>
      <div className="muted">{world.name}</div>
      <h1>
        Session {s.number}: {s.title}
      </h1>
      {s.date && <div className="muted">{s.date}</div>}
      {isGM ? <PrintPrep session={s} entities={entities} worldId={world.id} /> : null}
      {isGM && s.notes.trim() && (
        <Section title="GM notes">
          <Markdown text={s.notes} entities={entities} worldId={world.id} showSecrets />
        </Section>
      )}
      {!isGM && (s.recap ? <Markdown text={s.recap} entities={entities} worldId={world.id} showSecrets={false} /> : <p className="muted">No recap yet.</p>)}
      {featured.length > 0 && (
        <Section title="Featured">
          <ul>
            {featured.map((e) => (
              <li key={e.id}>
                <b>{e.name}</b>
                {e.summary && ` · ${e.summary}`}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  )
}

function PrintPrep({ session, entities, worldId }: { session: Session; entities: Entity[]; worldId: string }) {
  const p = { ...blankPrep(), ...session.prep }
  if (!p.strongStart && !p.scenes.length && !p.clues.length && !p.encounters.length) return null
  const list = (items: { id: string; text: string; done: boolean }[]) => (
    <ul className="print-checks">
      {items.map((x) => (
        <li key={x.id}>
          {x.done ? '☑' : '☐'} {x.text}
        </li>
      ))}
    </ul>
  )
  return (
    <>
      {p.strongStart && (
        <Section title="Strong start">
          <p>{p.strongStart}</p>
        </Section>
      )}
      {p.scenes.length > 0 && <Section title="Scenes">{list(p.scenes)}</Section>}
      {p.clues.length > 0 && <Section title="Secrets and clues">{list(p.clues)}</Section>}
      {p.encounters.length > 0 && (
        <Section title="Encounters">
          {p.encounters.map((enc) => (
            <div key={enc.id} className="print-encounter">
              <h3>
                {enc.name} <span className="muted small">({foeCount(enc)})</span>
              </h3>
              <table className="foe-table">
                <tbody>
                  {enc.foes.map((f) => (
                    <tr key={f.id}>
                      <td>{f.count > 1 ? `${f.count}× ` : ''}{f.name}</td>
                      <td>{f.hp != null && `HP ${f.hp}`}</td>
                      <td>{f.ac && `AC ${f.ac}`}</td>
                      <td>{f.side === 'foe' ? '' : f.side === 'pc' ? 'PC' : 'Ally'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {enc.notes && <Markdown text={enc.notes} entities={entities} worldId={worldId} showSecrets />}
            </div>
          ))}
        </Section>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="print-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
