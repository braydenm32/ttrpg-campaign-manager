import { NpcLines } from '../ai/Flavour'
import { renameLinks } from '../links'
import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Empty, Skeleton, TagInput } from '../components'
import { blankEntity, db, deleteEntity, ENTITY_LABELS, ENTITY_TYPES, HAS_STATUS, LIFE_STATUS, PICKER_TYPES, saveEntity, templateOf, THREAD_STATUS, typeLabel, type Entity, type EntityType, type LifeStatus, type ThreadStatus, type World } from '../db'
import { HistoryButton } from '../History'
import { listedEntries, TableRoller } from '../tables'
import { newThread, threadLinks, URGENCY, useCampaigns, useWorldSessions } from '../threads'
import { asPlayerSees, saveFileAsAsset, useAssetUrl, useVisibleEntities, useWorld } from '../hooks'
import { findBacklinks, Markdown } from '../Markdown'
import { SecretTextarea } from '../SecretTextarea'
import { SecretNamesWarning } from '../SecretNamesWarning'
import { CharacterOwnerBox } from '../players/Characters'
import { PlayerNotesBox } from '../players/Notes'
import { RevealedToBadge, RevealToPicker } from '../players/Secrets'
import { useViewMode } from '../viewMode'
import { lastSeenIn, StatusBadge } from '../status'
import { PrintButton } from '../print'
import { AskGmBox } from '../players/Questions'
import { ShowButton } from '../showing'
import { CalDateInput, formatDate, toDays } from '../calendar'
import { RelationsBox } from '../relations'
import { SessionMentions } from '../sessionMentions'
import { ClocksBox } from '../clocks'
import { QuestBox, questProgress } from '../quests'
import { Ico, TypeIcon } from '../icons'
import { dropHeldPage, heldPage } from '../pendingPages'
import { markSaved, toast } from '../undo'
import { DotsThreeOutline, Eye, Lock, MapPin, MapTrifold, PenNib, PencilSimple, Ruler, Sparkle, Spiral, UserCircle } from '@phosphor-icons/react'
import { initials } from '../text'
import { ImportSheetButton } from '../sheets/ImportSheet'
import { pagePath, resolvePage, typePath, usePathsVersion, worldPath } from '../paths'
import { canSeeMap, quantityLabel } from '../counts'
import { pinRevealed } from '../fog'
import { JumpRow, useKeepScroll } from '../jump'
import { NewPageButton } from '../NewPage'
import { PageVisibility, SeenMark } from '../reveal'
import { useCharacterOwners } from '../players/owners'
import { keyNumbers, NumberTiles } from '../players/sheetGlance'

export default function EntityPage() {
  const { worldId } = useWorld()
  const { entityId: param = '' } = useParams()
  usePathsVersion()
  const entityId = resolvePage(worldId, param)
  const [params, setParams] = useSearchParams()
  const { isGM, canSeeEntity } = useViewMode()
  // null once we know the page isn't there (undefined means still loading).
  const stored = useLiveQuery(async () => (await db.entities.get(entityId)) ?? null, [entityId])
  const editing = isGM && params.get('edit') === '1'
  // A new page that isn't saved yet (see pendingPages.ts) opens straight in the editor.
  const held = editing && stored === null ? heldPage(entityId) : undefined

  if (stored === undefined) return <Skeleton />
  if (held && held.worldId === worldId) return <EntityEditor key={held.id} entity={held} fresh held onDone={() => setParams({})} />
  if (stored === null || stored.worldId !== worldId || stored.template && !isGM || !canSeeEntity(stored))
    return <Empty>This page doesn't exist or hasn't been revealed.</Empty>
  const entity = isGM ? stored : asPlayerSees(stored)

  return editing ? (
    <EntityEditor key={entity.id} entity={entity} fresh={params.get('new') === '1' && entity.createdAt === entity.updatedAt} onDone={() => setParams({})} />
  ) : (
    <EntityView entity={entity} onEdit={() => setParams({ edit: '1' })} />
  )
}

function EntityView({ entity: e, onEdit }: { entity: Entity; onEdit: () => void }) {
  const { worldId, world } = useWorld()
  const { isGM, canSee, previewAs } = useViewMode()
  const entities = useVisibleEntities(worldId)
  const sessions = useWorldSessions(worldId)
  const image = useAssetUrl(e.imageId)
  const { owners } = useCharacterOwners(e.type === 'pc' ? world : undefined)
  const pins =
    useLiveQuery(
      async () => {
        const ps = (await db.pins.where({ entityId: e.id }).toArray()).filter((p) => canSee(p.visibility))
        const maps = await db.maps.bulkGet(ps.map((p) => p.mapId))
        // Like the map itself: players don't get a pin still under the fog.
        return ps.flatMap((p, i) => (maps[i] && canSeeMap(maps[i]!, isGM) && (isGM || pinRevealed(maps[i]!.fog, p)) ? [{ pin: p, map: maps[i]! }] : []))
      },
      [e.id, isGM],
    ) ?? []
  const ownMaps =
    useLiveQuery(() => db.maps.where({ locationId: e.id }).filter((m) => canSeeMap(m, isGM)).toArray(), [e.id, isGM]) ??
    []

  const byId = new Map(entities.map((x) => [x.id, x]))
  const ancestors: Entity[] = []
  for (let p = e.parentId && byId.get(e.parentId); p && ancestors.length < 12; p = p.parentId ? byId.get(p.parentId) : undefined)
    ancestors.unshift(p)
  const inside = entities.filter((x) => x.parentId === e.id)
  const backlinks = findBacklinks(e, entities, isGM)
  const groups = ENTITY_TYPES.map((t) => [t, inside.filter((x) => x.type === t)] as const).filter(([, xs]) => xs.length)
  const seen = HAS_STATUS.includes(e.type) ? lastSeenIn(e, sessions, isGM) : undefined
  // A player's own character: their numbers first, and a word that it's them.
  const owner = e.type === 'pc' ? owners.get(e.id) : undefined
  const isYou = !isGM && e.type === 'pc' && (!!owner?.mine || !!previewAs?.characterNames.some((n) => n.toLowerCase() === e.name.toLowerCase()))
  // Where it is on a map: its own map (a town's map), else the first pin.
  const onMap = ownMaps[0] ? `${worldPath(worldId)}/maps/${ownMaps[0].id}` : pins[0] ? `${worldPath(worldId)}/maps/${pins[0].map.id}?pin=${pins[0].pin.id}` : undefined
  const gmNotes = isGM && !!e.gmNotes.trim()
  // A long page gets a row to jump to its parts.
  const long = (e.body?.length ?? 0) + (e.gmNotes?.length ?? 0) > 1400 || backlinks.length > 8
  const jumps = [
    { id: 'page-top', label: 'Summary' },
    { id: 'page-details', label: 'Details' },
    ...(gmNotes ? [{ id: 'page-gm-notes', label: 'GM notes' }] : []),
    ...(backlinks.length ? [{ id: 'page-mentioned', label: 'Mentioned in' }] : []),
  ]
  const [allMentions, setAllMentions] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const MENTIONS = 10
  const mentions = allMentions ? backlinks : backlinks.slice(0, MENTIONS)
  // Back from a page you opened from here lands where you were.
  useKeepScroll(entities.length > 0)

  return (
    <div className="page entity-page" id="page-top">
      <nav className={`runhead crumbs ${ancestors.length > 1 ? 'deep' : ''}`} aria-label="Where this page sits">
        <Link to={typePath(worldId, e.type, e.customType)}>{typeLabel(e, world).many}</Link>
        {ancestors.map((a, i) => (
          <span key={a.id} className={i < ancestors.length - 1 ? 'crumb-mid' : 'crumb-last'}>
            {/* On a phone the places in between fold into "…". */}
            {i === ancestors.length - 1 && ancestors.length > 1 && (
              <span aria-hidden="true" className="crumb-dots">
                {' › … '}
              </span>
            )}
            <span aria-hidden="true" className="crumb-sep">
              {' › '}
            </span>
            <Link to={`${pagePath(worldId, a.id)}`}>{a.name}</Link>
          </span>
        ))}
      </nav>
      <header className="page-header entity-head">
        <div>
          <div className="kicker">
            <TypeIcon type={e.type} custom={world?.customTypes?.find((c) => c.id === e.customType)} /> {typeLabel(e, world).one}
            {e.type === 'item' && quantityLabel(e) && ` · ${quantityLabel(e)}`}
            {e.type === 'item' && e.heldBy && ` · carried by ${e.heldBy === 'party' ? 'the party' : (entities.find((x) => x.id === e.heldBy)?.name ?? 'someone')}`}
            {e.type === 'event' &&
              [formatDate(world?.calendar, e.eventWhen), e.eventDate].filter(Boolean).map((x) => ` · ${x}`)}
            {e.type === 'event' &&
              ` · ${e.eventEra === 'campaign' ? 'during the campaign' : (world?.ages?.find((a) => a.id === e.eventAge)?.name ?? 'before the campaign')}`}
            {e.questStatus && ` · ${e.questStatus}`}
            {e.type === 'quest' && questProgress(e) && ` · ${questProgress(e)}`}
            {e.type === 'thread' && ` · ${THREAD_STATUS[e.threadStatus ?? 'open'].label}`}
            {e.type === 'thread' && e.threadUrgency && e.threadUrgency !== 'normal' && ` · ${URGENCY[e.threadUrgency].icon} ${URGENCY[e.threadUrgency].label}`}
          </div>
          <h1>
            {e.name} {!isGM && <RevealedToBadge entity={e} world={world} entities={entities} isGM={isGM} />}
          </h1>
          {e.summary && <p className="lead">{e.summary}</p>}
        </div>
      </header>

      {e.type === 'pc' && !e.template && (keyNumbers(e).length > 0 || isYou) && (
        <section className={`pc-glance ${isYou ? 'you' : ''}`} aria-label="At a glance">
          {isYou && (
            <p className="pc-you">
              <Ico as={UserCircle} /> This is you{owner?.mine ? '' : previewAs ? ` (as ${previewAs.name})` : ''}
            </p>
          )}
          <NumberTiles c={e} />
        </section>
      )}

      <div className="page-strip">
        <div className="page-facts">
          <StatusBadge entity={e} showAlive />
          {isGM && !e.template && <PageVisibility entity={e} world={world} entities={entities} />}
          {seen && (
            <Link className="tag strip-chip" to={`${worldPath(worldId)}/s/${seen.id}`} title="The latest session it turned up in">
              In #{seen.number} {seen.title}
            </Link>
          )}
          {isGM && <span className="muted small strip-edited">Edited {editedAgo(e.updatedAt)}</span>}
        </div>
        <div className="page-actions">
          {isGM && (
            <button className="primary" onClick={onEdit}>
              <Ico as={PencilSimple} /> Edit
            </button>
          )}
          {onMap && (
            <Link className="button" to={onMap}>
              <Ico as={MapPin} /> On the map
            </Link>
          )}
          {/* On a phone the rarer ones fold behind "More". */}
          <button type="button" className="page-more-toggle" aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>
            <Ico as={DotsThreeOutline} /> More
          </button>
          <span className={`page-more ${moreOpen ? 'open' : ''}`}>
            {isGM && !e.template && e.visibility === 'players' && <ShowButton worldId={worldId} what={{ kind: 'page', title: e.name, entityId: e.id }} />}
            {isGM && e.type === 'pc' && !e.template && world && <ImportSheetButton worldId={worldId} system={world.system} into={e} label="Update from sheet" />}
            {isGM && <HistoryButton entity={e} />}
            <PrintButton to={`${worldPath(worldId)}/print/e/${e.id}`} />
            {isGM && world && !e.template && e.type !== 'custom' && <NewPageButton world={world} type={e.type} className="ghost new-from-page" />}
          </span>
        </div>
      </div>
      {long && (
        <JumpRow targets={jumps} label="Parts of this page" className="page-jumps" help="pageJumps" />
      )}
      {e.template && (
        <p className="notice">
          <Ico as={Ruler} /> This is a template <Help topic="templates" />: a starting point for new {typeLabel(e, world).many.toLowerCase()}. It’s
          GM only and doesn’t show up in lists.
        </p>
      )}

      <div className="entity-layout">
        <div className="entity-main">
          {e.type === 'table' && (
            <div className="card">
              <TableRoller tables={[e, ...entities.filter((x) => x.type === 'table' && x.id !== e.id)]} fixed={e} worldId={worldId} entities={entities} showSecrets={isGM} />
              <ol className="table-entries">
                {listedEntries(e, isGM).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ol>
            </div>
          )}
          {e.body ? (
            <div className="entity-prose">
              <Markdown text={e.body} entities={entities} worldId={worldId} showSecrets={isGM} />
            </div>
          ) : isGM && !e.template ? (
            <button className="write-description" onClick={onEdit}>
              <Ico as={PencilSimple} /> Write a description
            </button>
          ) : null}
          {e.playerBody && (
            <section className="player-written">
              <h2><Ico as={PenNib} /> In the player’s words</h2>
              <Markdown text={e.playerBody} entities={entities} worldId={worldId} showSecrets={false} />
            </section>
          )}
          {gmNotes && (
            <div className="secret" id="page-gm-notes">
              <strong>
                <Ico as={Lock} /> GM notes
              </strong>
              <Markdown text={e.gmNotes} entities={entities} worldId={worldId} showSecrets />
            </div>
          )}
          {isGM && world && !e.template && e.type === 'npc' && <NpcLines world={world} entity={e} entities={entities} />}
          {(e.body || gmNotes) && <div className="fleuron" aria-hidden="true">❦</div>}
          {!e.template && e.type === 'quest' && <QuestBox quest={e} entities={entities} isGM={isGM} worldId={worldId} />}
          {!e.template && <ClocksBox entity={e} isGM={isGM} worldId={worldId} />}
          {!e.template && <RelationsBox entity={e} entities={entities} isGM={isGM} worldId={worldId} />}
          {world && <PlayerNotesBox world={world} entityId={e.id} entities={entities} />}
          {world && <AskGmBox world={world} entityId={e.id} />}
          {isGM && e.type === 'location' && <AddInside parent={e} />}
          {groups.map(([t, xs]) => (
            <section key={t}>
              <h2>
                <TypeIcon type={t} /> {ENTITY_LABELS[t].many} here
              </h2>
              <ul className="entity-list">
                {xs.map((x) => (
                  <li key={x.id}>
                    <Link to={`${pagePath(worldId, x.id)}`}>{x.name}</Link> {isGM && <SeenMark entity={x} />}
                    {x.summary && <span className="muted"> · {x.summary}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {backlinks.length > 0 && (
            <section id="page-mentioned">
              <h2>
                Mentioned in <span className="count">{backlinks.length}</span>
              </h2>
              <ul className={`entity-list mentioned ${backlinks.length > 6 ? 'many' : ''}`}>
                {mentions.map((x) => (
                  <li key={x.id}>
                    <Link to={`${pagePath(worldId, x.id)}`}>
                      <TypeIcon type={x.type} /> {x.name}
                    </Link>
                  </li>
                ))}
              </ul>
              {backlinks.length > MENTIONS && (
                <button type="button" className="ghost show-all" aria-expanded={allMentions} onClick={() => setAllMentions(!allMentions)}>
                  {allMentions ? 'Show fewer' : `Show all ${backlinks.length}`}
                </button>
              )}
            </section>
          )}
          {!e.template && <SessionMentions entity={e} sessions={sessions} worldId={worldId} isGM={isGM} />}
        </div>
        <aside className="entity-side" id="page-details">
          <div className="infobox">
            {image ? (
              <img className="portrait" src={image} alt={e.name} />
            ) : isGM && !e.template ? (
              <button className="portrait-placeholder" onClick={onEdit} title="Add a picture">
                <span aria-hidden="true">{initials(e.name)}</span>
                <small>Add a picture</small>
              </button>
            ) : (
              <div className="portrait-placeholder" aria-hidden="true">
                <span>{initials(e.name)}</span>
              </div>
            )}
            <dl className="facts">
              {e.type === 'pc' && !!e.inspiration && (
                <div>
                  <dt>Inspiration</dt>
                  <dd className="inspired">
                    <Ico as={Sparkle} /> {e.inspiration}
                  </dd>
                </div>
              )}
              {ancestors.length > 0 && (
                <div>
                  <dt>{e.type === 'location' ? 'Inside' : e.type === 'event' ? 'Where' : 'Located in'}</dt>
                  <dd>
                    <Link to={`${pagePath(worldId, ancestors.at(-1)!.id)}`}>{ancestors.at(-1)!.name}</Link>
                  </dd>
                </div>
              )}
              {e.fields.map((f, i) => (
                <div key={i} className={f.gm ? 'gm-field' : undefined}>
                  <dt>
                    {f.gm && <span title="GM only"><Ico as={Lock} /> </span>}
                    {f.key}
                  </dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
              {(e.type === 'pc' || e.type === 'npc') && entities.some((x) => x.type === 'item' && x.heldBy === e.id) && (
                <div>
                  <dt>Carries</dt>
                  <dd>
                    {entities
                      .filter((x) => x.type === 'item' && x.heldBy === e.id)
                      .map((x, i) => (
                        <span key={x.id}>
                          {i > 0 && ', '}
                          <Link to={pagePath(worldId, x.id)}>{x.name}</Link>
                          {(x.quantity ?? 1) > 1 && ` (${x.quantity})`}
                        </span>
                      ))}
                  </dd>
                </div>
              )}
              {(ownMaps.length > 0 || pins.length > 0) && (
                <div>
                  <dt>Maps</dt>
                  <dd>
                    {ownMaps.map((m) => (
                      <Link key={m.id} className="block" to={`${worldPath(worldId)}/maps/${m.id}`}>
                        <Ico as={MapTrifold} /> Open {m.name}
                      </Link>
                    ))}
                    {pins.map(({ pin, map }) => (
                      <Link key={pin.id} className="block" to={`${worldPath(worldId)}/maps/${map.id}?pin=${pin.id}`}>
                        <Ico as={MapPin} /> On {map.name}
                      </Link>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </div>
          {e.type === 'pc' && world && <CharacterOwnerBox entity={e} world={world} />}
          {e.type === 'quest' && isGM && <QuestThreads quest={e} entities={entities} worldId={worldId} />}
          {(e.tags.length > 0 || (isGM && !!e.gmTags?.length)) && (
            <div className="tags">
              {e.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
              {isGM &&
                e.gmTags?.map((t) => (
                  <span key={`gm-${t}`} className="tag gm" title="GM only">
                    <Ico as={Lock} /> {t}
                  </span>
                ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

/** "today", "yesterday", "3 days ago", else the date: when a page last changed. */
function editedAgo(at: number) {
  const day = (t: number) => Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / 86400000)
  const days = day(Date.now()) - day(at)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  return `on ${new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: days > 300 ? 'numeric' : undefined })}`
}

/** Enter in a single-line box shouldn't save the whole page and close the editor. */
const noEnter = (ev: { key: string; preventDefault: () => void }) => ev.key === 'Enter' && ev.preventDefault()

/** What differs between two copies of a page: only these fields are written when the editor saves. */
function changes(from: Entity, to: Entity): Partial<Entity> {
  const a = from as unknown as Record<string, unknown>
  const b = to as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
    if (k !== 'updatedAt' && JSON.stringify(a[k]) !== JSON.stringify(b[k])) out[k] = b[k]
  return out as Partial<Entity>
}

/** An unsaved edit is kept on this device while you type, so leaving the page by mistake doesn't lose it. */
const draftKey = (id: string) => `codex.draft.${id}`
function readDraft(id: string): { base: Entity; d: Entity; at: number } | null {
  try {
    const raw = localStorage.getItem(draftKey(id))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function clearDraft(id: string) {
  try {
    localStorage.removeItem(draftKey(id))
  } catch {
    // Storage blocked: nothing was kept anyway.
  }
}

/**
 * Writes what changed in the editor (from `opened` to `d`) on top of the page as it is now, so
 * edits made meanwhile elsewhere survive. Returns the page as it was before, for Undo (null if it's new).
 */
async function writeChanges(opened: Entity, d: Entity, world: World | null | undefined) {
  const before = (await db.entities.get(opened.id)) ?? null
  const current = before ?? opened
  const mine = changes(opened, d)
  const merged = { ...current, ...mine, updatedAt: Date.now() }
  if ('name' in mine) merged.name = d.name.trim() || 'Untitled'
  // A new calendar date puts the event in its place on the timeline; an unchanged one keeps its order among same-day events.
  if ('eventWhen' in mine && merged.type === 'event' && merged.eventWhen && world?.calendar) merged.eventOrder = toDays(world.calendar, merged.eventWhen)
  await saveEntity(merged)
  clearDraft(opened.id)
  dropHeldPage(opened.id)
  // Renamed: links to the old name (and :::for passages, for a player character) follow it.
  const renamed = merged.template ? '' : await renameLinks(opened.worldId, current, merged)
  return { before, merged, renamed }
}

/**
 * The page editor. Nothing typed here is lost: Save writes it; leaving any other way (a link, Back,
 * another screen) saves it too, with Undo; closing the tab asks first, and the draft is also kept on
 * this device. A new page (`held`) is only added to the world once there's something to keep.
 */
function EntityEditor({ entity, fresh, held = false, onDone }: { entity: Entity; fresh: boolean; held?: boolean; onDone: () => void }) {
  const { worldId, world } = useWorld()
  const navigate = useNavigate()
  // The page as it was when the editor opened. Saving writes only what you changed from this, on top of
  // the page as it is now, so edits that arrived meanwhile (a player, a co-GM, another device) survive.
  const [opened] = useState(entity)
  const [d, setD] = useState<Entity>(entity)
  const entities = useVisibleEntities(worldId)
  const image = useAssetUrl(d.imageId)
  const set = <K extends keyof Entity>(k: K, v: Entity[K]) => setD((x) => ({ ...x, [k]: v }))
  const campaigns = useCampaigns(worldId)
  const dirty = JSON.stringify(d) !== JSON.stringify(opened)
  const changedElsewhere = entity.updatedAt !== opened.updatedAt
  const [kept, setKept] = useState(() => {
    const k = readDraft(entity.id)
    return k && Object.keys(changes(k.base, k.d)).length ? k : null
  })

  useEffect(() => {
    if (!dirty) return
    const warn = (ev: BeforeUnloadEvent) => ev.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(entity.id), JSON.stringify({ base: opened, d, at: Date.now() }))
      } catch {
        // Storage full or blocked: the edit just isn't kept.
      }
    }, 600)
    return () => clearTimeout(t)
  }, [dirty, d, entity.id, opened])

  // What leaving saves: kept up to date for the moment the editor closes.
  const leaving = useRef({ d, dirty, closed: false })
  useEffect(() => {
    leaving.current.d = d
    leaving.current.dirty = dirty
  }, [d, dirty])
  useEffect(() => {
    const keep = () => {
      if (!leaving.current.dirty) return
      try {
        localStorage.setItem(draftKey(entity.id), JSON.stringify({ base: opened, d: leaving.current.d, at: Date.now() }))
      } catch {
        // As below.
      }
    }
    window.addEventListener('pagehide', keep)
    return () => {
      window.removeEventListener('pagehide', keep)
      const { d: last, dirty: changed, closed } = leaving.current
      if (closed || !changed) return
      // Left without Save or Cancel (a link, Back, another screen): keep what was typed, with Undo.
      void writeChanges(opened, last, world).then(({ before, merged }) =>
        toast(`Saved your changes to “${merged.name}”.`, () => (before ? db.entities.put(before) : db.entities.delete(merged.id))),
      )
    }
    // Once per editor: `opened` and `world` are what it opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    leaving.current.closed = true
    const { renamed } = await writeChanges(opened, d, world)
    if (renamed) alert(renamed)
    markSaved()
    onDone()
  }
  const cancel = async () => {
    if (dirty && !confirm('Throw away what you changed on this page?')) return
    leaving.current.closed = true
    clearDraft(entity.id)
    // A brand-new page goes away again, so Cancel doesn't leave clutter behind.
    if (held) dropHeldPage(entity.id)
    if (fresh) {
      if (!held) await db.entities.delete(entity.id)
      navigate(typePath(worldId, entity.type, entity.customType), { replace: true })
      return
    }
    onDone()
  }
  const saveAsTemplate = async () => {
    const t: Entity = { ...templateOf(d), name: d.name.trim() || 'Untitled', template: true }
    await db.entities.add(t)
    alert(`Saved “${t.name}” as a template. Choose it next time you make a new ${typeLabel(d, world).one.toLowerCase()}. Templates are listed in World settings.`)
  }
  // Anything can sit "inside" a location, and locations can nest, but a place can't go inside itself or anything inside it.
  const within = new Set([d.id])
  for (let grew = true; grew; ) {
    grew = false
    for (const x of entities) {
      if (!x.parentId || !within.has(x.parentId) || within.has(x.id)) continue
      within.add(x.id)
      grew = true
    }
  }
  const parents = entities.filter((x) => x.type === 'location' && !within.has(x.id))

  return (
    <div className="page">
      <form
        className="form editor"
        onSubmit={(ev) => {
          ev.preventDefault()
          save()
        }}
      >
        <div className="editor-top">
          {d.template ? (
            <span className="muted small"><Ico as={Ruler} /> Template <Help topic="templates" /></span>
          ) : (
            <div className="segmented vis-choice" role="group" aria-label="Who can read this page">
              <button type="button" className={d.visibility === 'gm' ? 'on' : ''} aria-pressed={d.visibility === 'gm'} onClick={() => set('visibility', 'gm')}>
                <Ico as={Lock} /> GM only
              </button>
              <button type="button" className={d.visibility === 'players' ? 'on' : ''} aria-pressed={d.visibility === 'players'} onClick={() => set('visibility', 'players')}>
                <Ico as={Eye} /> Players can see it
              </button>
            </div>
          )}
          {!d.template && <Help topic="visibility" />}
        </div>
        <header className="page-header">
          <div className="title-block">
            <input
              className="title-input"
              value={d.name}
              onChange={(ev) => set('name', ev.target.value)}
              placeholder={`Name this ${typeLabel(d, world).one.toLowerCase()}`}
              autoFocus={fresh}
              onFocus={fresh ? (ev) => ev.target.select() : undefined}
            />
            <div className="row small aliases">
              <span className="muted">
                Also called <Help topic="aliases" />
              </span>
              <TagInput tags={d.aliases ?? []} onChange={(t) => set('aliases', t.length ? t : undefined)} placeholder="Add a nickname…" />
            </div>
          </div>
        </header>
        {kept && !dirty && (
          <p className="notice">
            You have unsaved changes to this page from {new Date(kept.at).toLocaleString()}.{' '}
            <button
              type="button"
              onClick={() => {
                setD({ ...entity, ...changes(kept.base, kept.d) })
                setKept(null)
              }}
            >
              Restore them
            </button>{' '}
            <button
              type="button"
              className="ghost"
              onClick={() => {
                clearDraft(entity.id)
                setKept(null)
              }}
            >
              Throw them away
            </button>
          </p>
        )}
        {changedElsewhere && (
          <p className="notice">
            This page was changed somewhere else while you were editing (another device, a co-GM or a player). When you save, only what you changed here is written, on top of their changes.
          </p>
        )}
        {d.visibility === 'gm' && !d.template && world && (
          <RevealToPicker world={world} entities={entities} value={d.revealedTo ?? []} onChange={(ids) => set('revealedTo', ids.length ? ids : undefined)} />
        )}
        {!d.template && (
          <details className="secrets-explained">
            <summary>
              <Ico as={Lock} /> What players see of this page {d.visibility === 'gm' ? '(nothing yet: it’s GM only)' : ''}
            </summary>
            <div className="grid-2 small">
              <div>
                <strong>
                  <Ico as={Eye} /> Once it’s revealed
                </strong>
                <ul>
                  <li>The name, summary and description</li>
                  <li>Details and tags, except the ones marked GM only</li>
                  <li>A “Secret for…” passage: only the characters it names</li>
                </ul>
              </div>
              <div>
                <strong>
                  <Ico as={Lock} /> Never
                </strong>
                <ul>
                  <li>GM notes (below the description)</li>
                  <li>GM-only passages in the description (the <Ico as={Lock} /> GM-only passage button)</li>
                  <li>Details with the <Ico as={Lock} /> lock, and GM-only tags</li>
                </ul>
              </div>
            </div>
            <Help topic="secrets" />
          </details>
        )}
        <div className="grid-2">
          <label>
            Type
            <select
              value={d.type === 'custom' ? `custom:${d.customType}` : d.type}
              onChange={(ev) => {
                const v = ev.target.value
                // A page that becomes a quest or a thread starts open, as a new one does.
                setD((x) => ({
                  ...(v.startsWith('custom:') ? { ...x, type: 'custom', customType: v.slice(7) } : { ...x, type: v as EntityType, customType: undefined }),
                  ...(v === 'quest' && !x.questStatus ? { questStatus: 'open' as const } : {}),
                  ...(v === 'thread' && !x.threadStatus ? { threadStatus: 'open' as const, threadUrgency: x.threadUrgency ?? ('normal' as const) } : {}),
                }))
              }}
            >
              {PICKER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ENTITY_LABELS[t].one}
                </option>
              ))}
              {world?.customTypes?.map((c) => (
                <option key={c.id} value={`custom:${c.id}`}>
                  {c.icon} {c.one}
                </option>
              ))}
              {d.type === 'custom' && !world?.customTypes?.some((c) => c.id === d.customType) && <option value={`custom:${d.customType}`}>(removed type)</option>}
            </select>
          </label>
          <label>
            {d.type === 'event' ? 'Where it happened' : d.type === 'location' ? 'Inside' : 'Located in'}
            <select value={d.parentId ?? ''} onChange={(ev) => set('parentId', ev.target.value || undefined)}>
              <option value="">(none)</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {d.type === 'event' && (
            <>
              {world?.calendar && (
                <label>
                  <span>
                    Date on the calendar <Help topic="calendar" />
                  </span>
                  <CalDateInput calendar={world.calendar} value={d.eventWhen} onChange={(v) => set('eventWhen', v)} />
                </label>
              )}
              <label>
                {world?.calendar ? 'Or describe when' : 'In-world date'}
                <input
                  value={d.eventDate ?? ''}
                  onChange={(ev) => set('eventDate', ev.target.value)}
                  placeholder={world?.calendar && d.eventWhen ? formatDate(world.calendar, d.eventWhen, false) : 'e.g. 1492 DR, Year of Three Ships'}
                />
              </label>
              <label>
                When
                <select value={d.eventEra ?? 'pre'} onChange={(ev) => set('eventEra', ev.target.value as Entity['eventEra'])}>
                  <option value="pre">Before the campaign (history)</option>
                  <option value="campaign">During the campaign</option>
                </select>
              </label>
              {d.eventEra !== 'campaign' && !!world?.ages?.length && (
                <label>
                  <span>
                    Age of history <Help topic="ages" />
                  </span>
                  <select value={d.eventAge ?? ''} onChange={(ev) => set('eventAge', ev.target.value || undefined)}>
                    <option value="">(no particular age)</option>
                    {world.ages.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
          {d.type === 'thread' && <ThreadFields d={d} set={set} />}
          {d.type === 'item' && (
            <>
              <label>
                <span>
                  Carried by <Help topic="loot" />
                </span>
                <select value={d.heldBy ?? ''} onChange={(ev) => set('heldBy', ev.target.value || undefined)}>
                  <option value="">(nobody: not in the party’s hands)</option>
                  <option value="party">🎒 The party stash</option>
                  {entities
                    .filter((x) => x.type === 'pc' || x.type === 'npc')
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {ENTITY_LABELS[x.type].icon} {x.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                How many
                <input type="number" min={0} value={d.quantity ?? 1} onChange={(ev) => set('quantity', ev.target.value === '' ? undefined : Math.max(0, Number(ev.target.value)))} />
              </label>
            </>
          )}
          {HAS_STATUS.includes(d.type) && (
            <label>
              <span>
                Status <Help topic="lifeStatus" />
              </span>
              <select value={d.status ?? ''} onChange={(ev) => set('status', (ev.target.value || undefined) as Entity['status'])}>
                <option value="">(not set)</option>
                {(Object.keys(LIFE_STATUS) as LifeStatus[]).map((k) => (
                  <option key={k} value={k}>
                    {LIFE_STATUS[k].icon} {LIFE_STATUS[k].label}
                  </option>
                ))}
              </select>
              {d.status && (
                <span className="row small">
                  <input type="checkbox" checked={!!d.statusKnown} onChange={(ev) => set('statusKnown', ev.target.checked || undefined)} />
                  Players know this
                </span>
              )}
            </label>
          )}
          {d.type === 'pc' && (
            <label>
              <span>
                Inspiration <Help topic="inspiration" />
              </span>
              <input type="number" min={0} value={d.inspiration ?? 0} onChange={(ev) => set('inspiration', Math.max(0, Number(ev.target.value) || 0) || undefined)} />
            </label>
          )}
          {d.type === 'pc' && campaigns.length > 1 && (
            <label>
              <span>
                Plays in <Help topic="partyCampaign" />
              </span>
              <select value={d.campaignId ?? ''} onChange={(ev) => set('campaignId', ev.target.value || undefined)}>
                <option value="">Any campaign</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {d.type === 'quest' && (
            <label>
              Status
              <select value={d.questStatus ?? 'open'} onChange={(ev) => set('questStatus', ev.target.value as Entity['questStatus'])}>
                <option value="open">Open (not taken)</option>
                <option value="active">Active</option>
                <option value="done">Done</option>
                <option value="failed">Failed</option>
              </select>
            </label>
          )}
        </div>
        {d.type === 'table' && (
          <label>
            <span>
              Entries, one per line <Help topic="randomTables" />
            </span>
            <textarea
              rows={10}
              value={(d.entries ?? []).join('\n')}
              onChange={(ev) => set('entries', ev.target.value.split('\n'))}
              placeholder={'A rat the size of a dog\n3x Nothing but the smell\n{1d6} goblins arguing over a boot\nA door to {Dungeon rooms}'}
            />
            <small className="muted">“3x” makes an entry three times as likely. {'{2d6}'} rolls dice; {'{Another table}'} rolls on your other table.</small>
          </label>
        )}
        <label>
          Summary
          <input value={d.summary} onChange={(ev) => set('summary', ev.target.value)} placeholder="One line shown in lists and on map pins" />
        </label>
        <label>
          <span>
            Description <Help topic="secrets" />
          </span>
          <SecretTextarea worldId={worldId} rows={10} value={d.body} onChange={(v) => set('body', v)} />
          <small className="muted">Link pages by typing @ or [[ and a name. The buttons hide a passage from every player, or keep it for some characters only.</small>
        </label>
        <SecretNamesWarning worldId={worldId} texts={[d.summary, d.body, d.playerBody]} show={d.visibility === 'players' && !d.template} />
        <label className="gm-notes-field">
          <span>
            <Ico as={Lock} /> GM notes: never shown to players <Help topic="gmNotes" />
          </span>
          <textarea rows={4} value={d.gmNotes} onChange={(ev) => set('gmNotes', ev.target.value)} placeholder="Secrets, plans, stat lines, what they really want…" />
        </label>
        {d.type === 'pc' && (
          <label>
            <span>
              In the player’s words <Help topic="editCharacter" />
            </span>
            <textarea rows={4} value={d.playerBody ?? ''} onChange={(ev) => set('playerBody', ev.target.value || undefined)} />
            <small className="muted">The player who claimed this character can write here themselves. Players can read it, so keep secrets out.</small>
          </label>
        )}
        <div className="grid-2">
          <div>
            <div className="label">
              Details <Help topic="fields" />
            </div>
            {d.fields.map((f, i) => (
              <div key={i} className={`row field-row ${f.gm ? 'gm-field' : ''}`}>
                <input
                  value={f.key}
                  placeholder="Field"
                  aria-label="Detail"
                  onKeyDown={noEnter}
                  onChange={(ev) => set('fields', d.fields.map((x, j) => (j === i ? { ...x, key: ev.target.value } : x)))}
                />
                <input
                  value={f.value}
                  placeholder="Value"
                  aria-label={`${f.key || 'Detail'}: value`}
                  onKeyDown={noEnter}
                  onChange={(ev) => set('fields', d.fields.map((x, j) => (j === i ? { ...x, value: ev.target.value } : x)))}
                />
                <button
                  type="button"
                  className={`ghost field-lock ${f.gm ? 'on' : ''}`}
                  title={f.gm ? 'GM only: players never see this. Click to show it to players.' : 'Players see this once the page is revealed. Click to keep it GM only.'}
                  aria-label={f.gm ? 'GM only' : 'Players see it'}
                  aria-pressed={!!f.gm}
                  onClick={() => set('fields', d.fields.map((x, j) => (j === i ? { ...x, gm: !x.gm || undefined } : x)))}
                >
                  <Ico as={f.gm ? Lock : Eye} />
                </button>
                <button type="button" className="ghost" aria-label="Remove this detail" onClick={() => set('fields', d.fields.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" onClick={() => set('fields', [...d.fields, { key: '', value: '' }])}>
              + Field
            </button>
          </div>
          <div>
            <div className="label">Image</div>
            {image && <img className="portrait" src={image} alt="" />}
            <div className="row">
              <label className="button">
                {d.imageId ? 'Replace image' : 'Upload image'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={async (ev) => {
                    const f = ev.target.files?.[0]
                    if (f) set('imageId', await saveFileAsAsset(worldId, f, f.name, [d.name]))
                  }}
                />
              </label>
              {d.imageId && (
                <button type="button" onClick={() => set('imageId', undefined)}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="grid-2">
          <div>
            <div className="label">Tags</div>
            <TagInput tags={d.tags} onChange={(t) => set('tags', t)} />
          </div>
          <div>
            <div className="label">
              <Ico as={Lock} /> GM-only tags <Help topic="gmTags" />
            </div>
            <TagInput tags={d.gmTags ?? []} onChange={(t) => set('gmTags', t.length ? t : undefined)} />
          </div>
        </div>
        <div className="row spread">
          <div className="row">
            <button
              type="button"
              className="danger"
              onClick={async () => {
                if (!confirm(`Delete "${entity.name}"? You can bring it back from World settings → Recently deleted, on this device.`)) return
                clearDraft(entity.id)
                await deleteEntity(entity.id)
                navigate(entity.template ? `${worldPath(worldId)}/settings` : typePath(worldId, entity.type, entity.customType))
              }}
            >
              Delete
            </button>
            {!d.template && (
              <button type="button" title="Keep a copy of this page as a starting point for new ones" onClick={saveAsTemplate}>
                <Ico as={Ruler} /> Save as template
              </button>
            )}
          </div>
        </div>
        {/* Save stays in reach at the foot of the screen, however long the page. */}
        <div className="editor-bar">
          <Help topic="pageDrafts" />
          <button type="button" onClick={cancel}>
            Cancel
          </button>
          <button className="primary">Save</button>
        </div>
      </form>
    </div>
  )
}

function ThreadFields({ d, set }: { d: Entity; set: <K extends keyof Entity>(k: K, v: Entity[K]) => void }) {
  const sessions = useWorldSessions(d.worldId)
  const sessionSelect = (key: 'raisedIn' | 'tiedOffIn', label: string) => (
    <label>
      {label}
      <select value={d[key] ?? ''} onChange={(ev) => set(key, ev.target.value || undefined)}>
        <option value="">(none)</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            #{s.number} {s.title}
          </option>
        ))}
      </select>
    </label>
  )
  return (
    <>
      <label>
        Status
        <select value={d.threadStatus ?? 'open'} onChange={(ev) => set('threadStatus', ev.target.value as ThreadStatus)}>
          {(Object.keys(THREAD_STATUS) as ThreadStatus[]).map((k) => (
            <option key={k} value={k}>
              {THREAD_STATUS[k].label}: {THREAD_STATUS[k].hint.toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      <label>
        Urgency
        <select value={d.threadUrgency ?? 'normal'} onChange={(ev) => set('threadUrgency', ev.target.value as Entity['threadUrgency'])}>
          {(['high', 'normal', 'low'] as const).map((u) => (
            <option key={u} value={u}>
              {URGENCY[u].icon} {URGENCY[u].label}
            </option>
          ))}
        </select>
      </label>
      {sessionSelect('raisedIn', 'Raised in session')}
      {sessionSelect('tiedOffIn', 'Tied off in session')}
    </>
  )
}

/** Quick way to make a new place inside this one (a district in a city, a room in a building). */
function AddInside({ parent }: { parent: Entity }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  return (
    <form
      className="row add-inside"
      onSubmit={async (ev) => {
        ev.preventDefault()
        if (!name.trim()) return
        const child = { ...blankEntity(parent.worldId, 'location', name.trim()), parentId: parent.id }
        await db.entities.add(child)
        setName('')
        navigate(`${pagePath(parent.worldId, child.id)}`)
      }}
    >
      <input value={name} onChange={(ev) => setName(ev.target.value)} placeholder={`Add a place inside ${parent.name}, e.g. a district or building`} />
      <button disabled={!name.trim()}>+ Add place inside</button>
    </form>
  )
}

/** On a quest: the loose threads that follow it, and a button to start one (for urgency and "going cold"). */
function QuestThreads({ quest, entities, worldId }: { quest: Entity; entities: Entity[]; worldId: string }) {
  const navigate = useNavigate()
  const following = entities.filter((t) => t.type === 'thread' && threadLinks(t, entities, true).some((x) => x.id === quest.id))
  return (
    <div className="side-box">
      <h3>
        <Ico as={Spiral} /> Loose threads <Help topic="trackAsThread" />
      </h3>
      {following.map((t) => (
        <Link key={t.id} className="block" to={`${pagePath(worldId, t.id)}`}>
          {t.name} <span className="muted small">· {t.threadStatus ?? 'open'}</span>
        </Link>
      ))}
      <button
        className="block"
        onClick={async () => {
          const t = { ...newThread(worldId, quest.name), summary: quest.summary, body: `Follows the quest [[${quest.name}]].` }
          await db.entities.add(t)
          navigate(`${pagePath(worldId, t.id)}`)
        }}
      >
        + Track as thread
      </button>
    </div>
  )
}
