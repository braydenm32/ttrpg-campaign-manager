import { type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import { blankEntity, typeLabel, type Entity, type World } from './db'
import { Help } from './help'
import { Ico, TypeIcon } from './icons'
import { PagePicker } from './PagePicker'
import { SeenMark } from './reveal'
import { treeRoots } from './hooks'
import { useKept } from './ai/kept'
import { openNewPage } from './pendingPages'
import { pagePath } from './paths'
import { isPartOf, isPlace, placeAbove, sameKind, withBelow } from './nesting'

/**
 * The editor's "where it sits" boxes. A place has one, Inside (another place). Any other page has
 * "Part of" (a page of its own kind: a faction under a faction) and, while it isn't part of one,
 * "Located in" (a place). Both set the one `parentId`, so a page that is part of another sits where
 * that one sits, and the box says so.
 */
export function ParentFields({ d, opened, entities, world, onPick }: { d: Entity; opened: Entity; entities: Entity[]; world?: World | null; onPick: (id: string | undefined) => void }) {
  // A page can't go under itself or under anything below it, so it can never loop.
  const below = withBelow(d.id, entities)
  const byId = new Map(entities.map((x) => [x.id, x]))
  const current = d.parentId ? byId.get(d.parentId) : undefined
  // Old pages (and hand-written ones) may sit somewhere else; that page is still offered, so it shows.
  const keep = (xs: Entity[]) => (current && !xs.includes(current) ? [current, ...xs] : xs)
  const places = entities.filter((x) => x.type === 'location' && !below.has(x.id))
  if (d.type === 'location')
    return (
      <label>
        Inside
        <PagePicker entities={keep(places)} value={d.parentId ?? ''} onPick={(id) => onPick(id || undefined)} placeholder="(none): type a place…" label="Inside" recent />
      </label>
    )
  const label = typeLabel(d, world)
  const kin = entities.filter((x) => sameKind(x, d) && !below.has(x.id))
  const partOf = current && isPartOf(current, d) ? current : undefined
  const where = d.type === 'event' ? 'Where it happened' : 'Located in'
  // Back from "Part of" to none: the place it had when the editor opened, if it had one.
  const was = opened.parentId ? byId.get(opened.parentId) : undefined
  return (
    <>
      <label>
        <span>
          Part of <Help topic="partOf" />
        </span>
        <PagePicker
          entities={kin}
          value={partOf?.id ?? ''}
          onPick={(id) => onPick(id || (was && !isPartOf(was, d) ? was.id : undefined))}
          placeholder={`(none): type a ${label.one.toLowerCase()}…`}
          label="Part of"
          recent
        />
      </label>
      {partOf ? (
        <p className="muted small part-of-where">
          {placeAbove(partOf, byId) ? `${where}: ${placeAbove(partOf, byId)!.name}, where “${partOf.name}” is.` : `It sits wherever “${partOf.name}” is.`}
        </p>
      ) : (
        <label>
          {where}
          <PagePicker entities={keep(places)} value={d.parentId ?? ''} onPick={(id) => onPick(id || undefined)} placeholder="(none): type a place…" label={where} recent />
        </label>
      )}
    </>
  )
}

/**
 * On a page that isn't a place: the pages of its own kind under it, and (for the GM) a button to
 * start a new one there. `kids` sit straight under it; `branch` is them and everything below them. A player sees only the ones they can see, and no count of the rest.
 */
export function UnderIt({ page, kids, branch, world, isGM, worldId }: { page: Entity; kids: Entity[]; branch: Entity[]; world?: World | null; isGM: boolean; worldId: string }) {
  const navigate = useNavigate()
  const label = typeLabel(page, world)
  // People under people are rare: the button waits until someone is there (Part of still works).
  const offer = isGM && !page.template && world && (kids.length > 0 || (page.type !== 'npc' && page.type !== 'pc'))
  if (!kids.length && !offer) return null
  const start = () => {
    if (!world) return
    const e = { ...blankEntity(world.id, page.type, `New ${label.one}`), ...(page.customType ? { customType: page.customType } : {}), parentId: page.id }
    openNewPage(navigate, e)
  }
  if (!kids.length)
    return (
      <p className="row add-under">
        <button type="button" className="ghost" onClick={start}>
          + New {label.one.toLowerCase()} under it
        </button>
      </p>
    )
  return (
    <section className="under-it">
      <h2>
        <TypeIcon type={page.type} custom={world?.customTypes?.find((c) => c.id === page.customType)} /> Under it <span className="count">{kids.length}</span>{' '}
        {isGM && <Help topic="partOf" />}
      </h2>
      <PageTree worldId={worldId} entities={branch} isGM={isGM} roots={new Set(kids.map((k) => k.id))} />
      {offer && (
        <button type="button" className="ghost" onClick={start}>
          + New {label.one.toLowerCase()} under it
        </button>
      )}
    </section>
  )
}

/**
 * A list as a tree: each page with the pages under it indented beneath, folded away with the
 * arrow (the fold is remembered while the app is open). `entities` is the list's own pages, so a
 * player's list holds only pages they can see, and one under a page they can't see starts a branch
 * of its own with nothing to show the hidden one.
 */
export function PageTree({ worldId, entities, isGM, roots: given }: { worldId: string; entities: Entity[]; isGM: boolean; roots?: Set<string> }) {
  const [folded, setFolded] = useKept<string[]>(`tree.folded:${worldId}`, [])
  const roots = given ?? treeRoots(entities)
  const kidsOf = (id: string) => entities.filter((e) => e.parentId === id && !roots.has(e.id))
  const render = (list: Entity[], depth: number): ReactNode => {
    if (!list.length || depth > 12) return null
    return (
      <ul className={depth === 0 ? 'tree' : ''}>
        {list.map((e) => {
          const kids = kidsOf(e.id)
          const shut = folded.includes(e.id)
          return (
            <li key={e.id} className={kids.length ? 'has-kids' : undefined}>
              {kids.length > 0 && (
                <button
                  type="button"
                  className="ghost fold"
                  aria-expanded={!shut}
                  aria-label={`${shut ? 'Open' : 'Fold'} ${e.name}`}
                  onClick={() => setFolded((f) => (f.includes(e.id) ? f.filter((x) => x !== e.id) : [...f, e.id]))}
                >
                  <Ico as={shut ? CaretRight : CaretDown} />
                </button>
              )}
              <Link to={pagePath(worldId, e.id)}>{e.name}</Link> {isGM && <SeenMark entity={e} />}
              {e.summary && <span className="muted"> · {e.summary}</span>}
              {shut && <span className="muted small"> · {kids.length} under it</span>}
              {!shut && render(kids, depth + 1)}
            </li>
          )
        })}
      </ul>
    )
  }
  return <>{render(entities.filter((e) => roots.has(e.id)), 0)}</>
}

/** A card's "Part of …" line, when the page sits under a page of its own kind the viewer can see. */
export function PartOfLine({ entity, byId }: { entity: Entity; byId: Map<string, Entity> }) {
  const p = entity.parentId ? byId.get(entity.parentId) : undefined
  if (!p || !isPartOf(p, entity) || isPlace(entity)) return null
  return <p className="muted small part-of">Part of {p.name}</p>
}
