import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { blankPrep, db, typeLabel, type Entity, type Session, type World } from './db'
import { foeCount } from './encounters'
import { Help } from './help'
import { asPlayerSees, useAssetUrl, useVisibleEntities, useWorld } from './hooks'
import { Markdown } from './Markdown'
import { listedEntries } from './tables'
import { StatusBadge } from './status'
import { ForcePlayerView, useViewMode } from './viewMode'
import { Ico, PageIcon } from './icons'
import { ArrowLeft, Eye, Lock, Printer } from '@phosphor-icons/react'
import { Skeleton } from './components'
import { pagePath, worldPath } from './paths'
import { canSeeMap } from './counts'
import { pinRevealed, playersImageId } from './fog'
import { mapKey } from './mapKey'

/** Opens the print page for a page or a session. In the player view it opens the player copy, so a GM previewing as a player never prints secrets by surprise. */
export function PrintButton({ to }: { to: string }) {
  const { isGM } = useViewMode()
  return (
    <Link className="button" to={isGM ? to : `${to}?copy=players`} title="Print this, or save it as a PDF">
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
  const { worldId } = useWorld()
  const [params] = useSearchParams()
  const world = useLiveQuery(async () => (await db.worlds.get(worldId)) ?? null, [worldId])
  if (world === undefined)
    return (
      <div className="print-page world-bare">
        <Skeleton />
      </div>
    )
  if (world === null)
    return (
      <div className="print-page world-bare">
        <div className="calm-note card print-missing">
          <p>World not found. It isn’t on this device.</p>
          <Link className="button" to="/">
            Go to your worlds
          </Link>
        </div>
      </div>
    )
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
  // Opened straight from a link or in a new tab, there's nothing to go back to: Back opens the page or session instead.
  const back = () => {
    const first = ((window.history.state as { idx?: number } | null)?.idx ?? 0) === 0
    if (first) navigate(kind === 'e' ? pagePath(world.id, id) : kind === 'm' ? `${worldPath(world.id)}/maps/${id}` : `${worldPath(world.id)}/s/${id}`)
    else navigate(-1)
  }
  const playerCopy = !!world.shared || params.get('copy') === 'players'
  useEffect(() => {
    // Give pictures a moment to load before the print window opens.
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="print-page world-bare">
      <div className="print-controls">
        <button className="print-back" onClick={back}>
          <Ico as={ArrowLeft} /> Back
        </button>
        {!world.shared && (
          <div className="segmented">
            <button className={isGM ? 'on' : ''} aria-pressed={isGM} onClick={() => setParams({}, { replace: true })}>
              <Ico as={Lock} /> GM copy
            </button>
            <button className={!isGM ? 'on' : ''} aria-pressed={!isGM} onClick={() => setParams({ copy: 'players' }, { replace: true })}>
              <Ico as={Eye} /> Player copy
            </button>
          </div>
        )}
        <Help topic="print" />
        <button className="primary print-go" onClick={() => window.print()}>
          <Ico as={Printer} /> Print or save as PDF
        </button>
        <p className="muted small print-note">
          {playerCopy ? 'The player copy: secrets, GM notes and hidden pages are left out.' : 'Your copy, with secrets and GM notes. Choose Player copy for one to hand out.'}
        </p>
      </div>
      <div className="print-sheet">
        {kind === 'e' ? <PrintEntity world={world} id={id} /> : kind === 'm' ? <PrintMap world={world} id={id} /> : <PrintSession world={world} id={id} />}
      </div>
    </div>
  )
}

function PrintEntity({ world, id }: { world: World; id: string }) {
  const { isGM, canSeeEntity } = useViewMode()
  const stored = useLiveQuery(async () => (await db.entities.get(id)) ?? null, [id])
  const entities = useVisibleEntities(world.id)
  const image = useAssetUrl(stored && (isGM || canSeeEntity(stored)) ? stored.imageId : undefined)
  if (stored === undefined) return null
  if (!stored || stored.worldId !== world.id) return <Missing world={world}>Page not found. It may have been deleted.</Missing>
  if (!isGM && !canSeeEntity(stored)) return <Missing world={world}>This page is GM only, so a player copy would be empty. Reveal it first, or print the GM copy.</Missing>
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
      <Markdown text={e.body} entities={entities} worldId={world.id} showSecrets={isGM} stillLinks />
      {e.type === 'table' && (
        <ol className="table-entries">
          {listedEntries(e, isGM).map((x, i) => (
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
          <Markdown text={e.gmNotes} entities={entities} worldId={world.id} showSecrets stillLinks />
        </Section>
      )}
    </article>
  )
}

function PrintSession({ world, id }: { world: World; id: string }) {
  const { isGM, canSee } = useViewMode()
  const s = useLiveQuery(async () => (await db.sessions.get(id)) ?? null, [id])
  const entities = useVisibleEntities(world.id)
  if (s === undefined) return null
  if (!s || s.worldId !== world.id) return <Missing world={world}>Session not found. It may have been deleted.</Missing>
  if (!canSee(s.visibility)) return <Missing world={world}>This session is GM only, so a player copy would be empty. Reveal it first, or print the GM copy.</Missing>
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
          <Markdown text={s.notes} entities={entities} worldId={world.id} showSecrets stillLinks />
        </Section>
      )}
      {!isGM && (s.recap ? <Markdown text={s.recap} entities={entities} worldId={world.id} showSecrets={false} stillLinks /> : <p className="muted">No recap yet.</p>)}
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
              {enc.notes && <Markdown text={enc.notes} entities={entities} worldId={worldId} showSecrets stillLinks />}
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

/** Nothing to print: says why, with the way back into the world. */
/**
 * A map with its numbered key, for running a dungeon or town from paper. The player copy prints the
 * players' picture (fog and secrets left out) with only the numbers and key entries they can see.
 */
function PrintMap({ world, id }: { world: World; id: string }) {
  const { isGM } = useViewMode()
  const map = useLiveQuery(async () => (await db.maps.get(id)) ?? null, [id])
  const pins = useLiveQuery(() => db.pins.where({ mapId: id }).toArray(), [id])
  const entities = useVisibleEntities(world.id)
  const fog = map?.fog?.on ? map.fog : undefined
  const imageId = !map ? undefined : isGM ? map.imageId : fog?.imageId ?? playersImageId(map)
  const image = useAssetUrl(map && (isGM || canSeeMap(map, false)) ? imageId : undefined)
  if (map === undefined || !pins) return null
  if (!map || map.worldId !== world.id) return <Missing world={world}>Map not found. It may have been deleted.</Missing>
  if (!isGM && !canSeeMap(map, false)) return <Missing world={world}>This map is GM only, so a player copy would be empty. Reveal it first, or print the GM copy.</Missing>
  const seen = isGM ? pins : pins.filter((p) => p.visibility === 'players' && pinRevealed(fog, p))
  const key = map.numbers ? mapKey(seen, entities, map.height, isGM) : []
  return (
    <article className="print-map">
      <div className="muted">Map · {world.name}</div>
      <h1>{map.name}</h1>
      <div className="print-map-picture">
        {image && <img src={image} alt={map.name} />}
        {key.map((k) =>
          k.at ? (
            <span key={k.pin.id} className="print-map-no" style={{ left: `${(k.at[0] / map.width) * 100}%`, top: `${(k.at[1] / map.height) * 100}%` }}>
              {k.n}
            </span>
          ) : null,
        )}
      </div>
      {key.length > 0 ? (
        <>
          <h2>Key</h2>
          <ol className="print-map-key">
            {key.map((k) => (
              <li key={k.pin.id} value={k.n}>
                <b>{k.title}</b>
                {k.line && ` — ${k.line}`}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="muted small">No numbered key: switch on “Show numbers” in the map’s settings to add one.</p>
      )}
    </article>
  )
}

function Missing({ world, children }: { world: World; children: ReactNode }) {
  return (
    <div className="print-missing">
      <p>{children}</p>
      <Link className="button" to={worldPath(world.id)}>
        Back to the world
      </Link>
    </div>
  )
}
