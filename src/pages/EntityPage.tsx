import { renameLinks } from '../links'
import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Empty, TagInput, VisibilityBadge, VisibilityToggle } from '../components'
import { blankEntity, db, deleteEntity, ENTITY_LABELS, ENTITY_TYPES, HAS_STATUS, LIFE_STATUS, newId, PICKER_TYPES, saveEntity, THREAD_STATUS, typeLabel, type Entity, type EntityType, type LifeStatus, type ThreadStatus } from '../db'
import { HistoryButton } from '../History'
import { TableRoller } from '../tables'
import { newThread, threadLinks, URGENCY, useCampaigns, useWorldSessions } from '../threads'
import { asPlayerSees, saveFileAsAsset, useAssetUrl, useVisibleEntities, useWorld } from '../hooks'
import { findBacklinks, Markdown } from '../Markdown'
import { SecretTextarea } from '../SecretTextarea'
import { CharacterOwnerBox } from '../players/Characters'
import { PlayerNotesBox } from '../players/Notes'
import { RevealedToBadge, RevealToPicker } from '../players/Secrets'
import { useViewMode } from '../viewMode'
import { LastSeen, StatusBadge } from '../status'
import { PrintButton } from '../print'
import { AskGmBox } from '../players/Questions'
import { revealAndShow, ShowButton } from '../showing'
import { CalDateInput, formatDate, toDays } from '../calendar'
import { RelationsBox } from '../relations'
import { ClocksBox } from '../clocks'

export default function EntityPage() {
  const { worldId } = useWorld()
  const { entityId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { isGM, canSeeEntity } = useViewMode()
  const stored = useLiveQuery(() => db.entities.get(entityId), [entityId])
  const editing = isGM && params.get('edit') === '1'

  if (stored === undefined) return null
  if (stored === null || stored.worldId !== worldId || stored.template && !isGM || !canSeeEntity(stored))
    return <Empty>This page doesn't exist or hasn't been revealed.</Empty>
  const entity = isGM ? stored : asPlayerSees(stored)

  return editing ? (
    <EntityEditor key={entity.id} entity={entity} onDone={() => setParams({})} />
  ) : (
    <EntityView entity={entity} onEdit={() => setParams({ edit: '1' })} />
  )
}

function EntityView({ entity: e, onEdit }: { entity: Entity; onEdit: () => void }) {
  const { worldId, world } = useWorld()
  const { isGM, canSee } = useViewMode()
  const entities = useVisibleEntities(worldId)
  const sessions = useWorldSessions(worldId)
  const image = useAssetUrl(e.imageId)
  const pins =
    useLiveQuery(
      async () => {
        const ps = (await db.pins.where({ entityId: e.id }).toArray()).filter((p) => canSee(p.visibility))
        const maps = await db.maps.bulkGet(ps.map((p) => p.mapId))
        return ps.flatMap((p, i) => (maps[i] && canSee(maps[i]!.visibility) ? [{ pin: p, map: maps[i]! }] : []))
      },
      [e.id, isGM],
    ) ?? []
  const ownMaps =
    useLiveQuery(() => db.maps.where({ locationId: e.id }).filter((m) => canSee(m.visibility)).toArray(), [e.id, isGM]) ??
    []

  const byId = new Map(entities.map((x) => [x.id, x]))
  const ancestors: Entity[] = []
  for (let p = e.parentId && byId.get(e.parentId); p && ancestors.length < 12; p = p.parentId ? byId.get(p.parentId) : undefined)
    ancestors.unshift(p)
  const inside = entities.filter((x) => x.parentId === e.id)
  const backlinks = findBacklinks(e, entities)
  const groups = ENTITY_TYPES.map((t) => [t, inside.filter((x) => x.type === t)] as const).filter(([, xs]) => xs.length)

  return (
    <div className="page entity-page">
      {ancestors.length > 0 && (
        <nav className="breadcrumbs">
          {ancestors.map((a) => (
            <span key={a.id}>
              <Link to={`/w/${worldId}/e/${a.id}`}>{a.name}</Link> ›{' '}
            </span>
          ))}
        </nav>
      )}
      <header className="page-header">
        <div>
          <div className="muted">
            {typeLabel(e, world).icon} {typeLabel(e, world).one}
            {e.type === 'item' && e.quantity != null && e.quantity !== 1 && ` · ×${e.quantity}`}
            {e.type === 'item' && e.heldBy && ` · carried by ${e.heldBy === 'party' ? 'the party' : (entities.find((x) => x.id === e.heldBy)?.name ?? 'someone')}`}
            {e.type === 'event' &&
              [formatDate(world?.calendar, e.eventWhen), e.eventDate].filter(Boolean).map((x) => ` · ${x}`)}
            {e.type === 'event' && ` · ${e.eventEra === 'campaign' ? 'during the campaign' : 'before the campaign'}`}
            {e.questStatus && ` · ${e.questStatus}`}
            {e.type === 'thread' && ` · ${THREAD_STATUS[e.threadStatus ?? 'open'].label}`}
            {e.type === 'thread' && e.threadUrgency && e.threadUrgency !== 'normal' && ` · ${URGENCY[e.threadUrgency].icon} ${URGENCY[e.threadUrgency].label}`}
            <LastSeen entity={e} sessions={sessions} worldId={worldId} />
          </div>
          <h1>
            {e.name} <VisibilityBadge value={e.visibility} /> <RevealedToBadge entity={e} world={world} entities={entities} isGM={isGM} />
          </h1>
          {e.status && (
            <p>
              <StatusBadge entity={e} showAlive />
            </p>
          )}
          {e.summary && <p className="lead">{e.summary}</p>}
        </div>
        {isGM ? (
          <div className="row">
            <PrintButton to={`/w/${worldId}/print/e/${e.id}`} />
            {!e.template &&
              (e.visibility === 'players' ? (
                <ShowButton worldId={worldId} what={{ kind: 'page', title: e.name, entityId: e.id }} />
              ) : (
                <button
                  title="Reveal this page to every player and put it on their screens"
                  onClick={() => confirm(`Reveal “${e.name}” to every player and show it? GM notes and secret passages stay hidden.`) && revealAndShow(worldId, e)}
                >
                  📺 Reveal and show
                </button>
              ))}
            <HistoryButton entity={e} />
            <button onClick={onEdit}>✏️ Edit</button>
          </div>
        ) : (
          <div className="row">
            <PrintButton to={`/w/${worldId}/print/e/${e.id}`} />
          </div>
        )}
      </header>
      {e.template && (
        <p className="notice">
          📐 This is a template <Help topic="templates" />: a starting point for new {typeLabel(e, world).many.toLowerCase()}. It’s
          GM only and doesn’t show up in lists.
        </p>
      )}

      <div className="entity-layout">
        <div className="entity-main">
          {e.type === 'table' && (
            <div className="card">
              <TableRoller tables={[e, ...entities.filter((x) => x.type === 'table' && x.id !== e.id)]} fixed={e} worldId={worldId} entities={entities} showSecrets={isGM} />
              <ol className="table-entries">
                {(e.entries ?? []).filter((x) => x.trim() && !x.trim().startsWith('#')).map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ol>
            </div>
          )}
          {e.body ? (
            <Markdown text={e.body} entities={entities} worldId={worldId} showSecrets={isGM} />
          ) : (
            <p className="muted">No description yet.</p>
          )}
          {e.playerBody && (
            <section className="player-written">
              <h2>✍️ In the player’s words</h2>
              <Markdown text={e.playerBody} entities={entities} worldId={worldId} showSecrets={false} />
            </section>
          )}
          {isGM && e.gmNotes && (
            <div className="secret">
              <strong>GM notes</strong>
              <Markdown text={e.gmNotes} entities={entities} worldId={worldId} showSecrets />
            </div>
          )}
          {!e.template && <ClocksBox entity={e} isGM={isGM} worldId={worldId} />}
          {!e.template && <RelationsBox entity={e} entities={entities} isGM={isGM} worldId={worldId} />}
          {world && <PlayerNotesBox world={world} entityId={e.id} entities={entities} />}
          {world && <AskGmBox world={world} entityId={e.id} />}
          {isGM && e.type === 'location' && <AddInside parent={e} />}
          {groups.map(([t, xs]) => (
            <section key={t}>
              <h2>
                {ENTITY_LABELS[t].icon} {ENTITY_LABELS[t].many} here
              </h2>
              <ul className="entity-list">
                {xs.map((x) => (
                  <li key={x.id}>
                    <Link to={`/w/${worldId}/e/${x.id}`}>{x.name}</Link> <VisibilityBadge value={x.visibility} />
                    {x.summary && <span className="muted"> · {x.summary}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {backlinks.length > 0 && (
            <section>
              <h2>Mentioned in</h2>
              <ul className="entity-list">
                {backlinks.map((x) => (
                  <li key={x.id}>
                    <Link to={`/w/${worldId}/e/${x.id}`}>
                      {ENTITY_LABELS[x.type].icon} {x.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside className="entity-side">
          {image && <img className="portrait" src={image} alt={e.name} />}
          {e.type === 'pc' && world && <CharacterOwnerBox entity={e} world={world} />}
          {e.type === 'quest' && isGM && <QuestThreads quest={e} entities={entities} worldId={worldId} />}
          {(ownMaps.length > 0 || pins.length > 0) && (
            <div className="side-box">
              <h3>Maps</h3>
              {ownMaps.map((m) => (
                <Link key={m.id} className="button block" to={`/w/${worldId}/maps/${m.id}`}>
                  🗺️ Open {m.name}
                </Link>
              ))}
              {pins.map(({ pin, map }) => (
                <Link key={pin.id} className="block" to={`/w/${worldId}/maps/${map.id}?pin=${pin.id}`}>
                  📍 On {map.name}
                </Link>
              ))}
            </div>
          )}
          {e.fields.length > 0 && (
            <div className="side-box">
              <h3>Details</h3>
              <dl className="fields">
                {e.fields.map((f, i) => (
                  <div key={i} className={f.gm ? 'gm-field' : undefined}>
                    <dt>
                      {f.gm && <span title="GM only">🔒 </span>}
                      {f.key}
                    </dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
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
                    🔒 {t}
                  </span>
                ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function EntityEditor({ entity, onDone }: { entity: Entity; onDone: () => void }) {
  const { worldId, world } = useWorld()
  const navigate = useNavigate()
  const [d, setD] = useState<Entity>(entity)
  const entities = useVisibleEntities(worldId)
  const image = useAssetUrl(d.imageId)
  const set = <K extends keyof Entity>(k: K, v: Entity[K]) => setD((x) => ({ ...x, [k]: v }))
  const campaigns = useCampaigns(worldId)
  const dirty = JSON.stringify(d) !== JSON.stringify(entity)

  useEffect(() => {
    if (!dirty) return
    const warn = (ev: BeforeUnloadEvent) => ev.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const save = async () => {
    // A calendar date puts the event in its place on the timeline.
    const order = d.type === 'event' && d.eventWhen && world?.calendar ? { eventOrder: toDays(world.calendar, d.eventWhen) } : {}
    const next = { ...d, ...order, name: d.name.trim() || 'Untitled', updatedAt: Date.now() }
    await saveEntity(next)
    // Renamed: links to the old name (and :::for passages, for a player character) follow it.
    if (!next.template) await renameLinks(worldId, entity, next)
    onDone()
  }
  const saveAsTemplate = async () => {
    const now = Date.now()
    const { revealedTo: _r, ...rest } = d
    const t: Entity = { ...rest, id: newId(), name: d.name.trim() || 'Untitled', template: true, visibility: 'gm', createdAt: now, updatedAt: now }
    await db.entities.add(t)
    alert(`Saved “${t.name}” as a template. Choose it next time you make a new ${typeLabel(d, world).one.toLowerCase()}. Templates are listed in World settings.`)
  }
  // Anything can sit "inside" a location, and locations can nest.
  const parents = entities.filter((x) => x.type === 'location' && x.id !== d.id)

  return (
    <div className="page">
      <form
        className="form editor"
        onSubmit={(ev) => {
          ev.preventDefault()
          save()
        }}
      >
        <header className="page-header">
          <div className="title-block">
            <input className="title-input" value={d.name} onChange={(ev) => set('name', ev.target.value)} placeholder="Name" />
            <div className="row small aliases">
              <span className="muted">
                Also called <Help topic="aliases" />
              </span>
              <TagInput tags={d.aliases ?? []} onChange={(t) => set('aliases', t.length ? t : undefined)} placeholder="Add a nickname…" />
            </div>
          </div>
          <div className="row">
            {d.template ? (
              <span className="muted small">📐 Template <Help topic="templates" /></span>
            ) : (
              <>
                <VisibilityToggle value={d.visibility} onChange={(v) => set('visibility', v)} />
                <Help topic="visibility" />
              </>
            )}
            <button type="button" onClick={onDone}>
              Cancel
            </button>
            <button className="primary">Save</button>
          </div>
        </header>
        {d.visibility === 'gm' && !d.template && world && (
          <RevealToPicker world={world} entities={entities} value={d.revealedTo ?? []} onChange={(ids) => set('revealedTo', ids.length ? ids : undefined)} />
        )}
        <div className="grid-2">
          <label>
            Type
            <select
              value={d.type === 'custom' ? `custom:${d.customType}` : d.type}
              onChange={(ev) => {
                const v = ev.target.value
                setD((x) => (v.startsWith('custom:') ? { ...x, type: 'custom', customType: v.slice(7) } : { ...x, type: v as EntityType, customType: undefined }))
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
          <small className="muted">Players see the summary, details and tags once the page is revealed (except 🔒 details and GM-only tags). Secrets go in GM notes or a :::gm block.</small>
        </label>
        <label>
          <span>
            Description <Help topic="secrets" />
          </span>
          <SecretTextarea worldId={worldId} rows={12} value={d.body} onChange={(v) => set('body', v)} />
          <small className="muted">
            Markdown. Link pages with [[Name]]. Use the buttons to hide a passage from every player, or to keep it for
            some characters only (:::for Wren and Silas). Names are suggested as you type.
          </small>
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
        <label>
          <span>
            GM notes (never shown to players) <Help topic="gmNotes" />
          </span>
          <textarea rows={5} value={d.gmNotes} onChange={(ev) => set('gmNotes', ev.target.value)} />
        </label>
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
                  onChange={(ev) => set('fields', d.fields.map((x, j) => (j === i ? { ...x, key: ev.target.value } : x)))}
                />
                <input
                  value={f.value}
                  placeholder="Value"
                  onChange={(ev) => set('fields', d.fields.map((x, j) => (j === i ? { ...x, value: ev.target.value } : x)))}
                />
                <button
                  type="button"
                  className={`ghost ${f.gm ? 'on' : ''}`}
                  title={f.gm ? 'GM only: players never see this. Click to show it to players.' : 'Players see this once the page is revealed. Click to keep it GM only.'}
                  aria-pressed={!!f.gm}
                  onClick={() => set('fields', d.fields.map((x, j) => (j === i ? { ...x, gm: !x.gm || undefined } : x)))}
                >
                  {f.gm ? '🔒' : '👁'}
                </button>
                <button type="button" className="ghost" onClick={() => set('fields', d.fields.filter((_, j) => j !== i))}>
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
        <div>
          <div className="label">Tags</div>
          <TagInput tags={d.tags} onChange={(t) => set('tags', t)} />
        </div>
        <div>
          <div className="label">
            🔒 GM-only tags <Help topic="gmTags" />
          </div>
          <TagInput tags={d.gmTags ?? []} onChange={(t) => set('gmTags', t.length ? t : undefined)} />
        </div>
        <div className="row spread">
          <div className="row">
            <button
              type="button"
              className="danger"
              onClick={async () => {
                if (!confirm(`Delete "${entity.name}"? You can bring it back from World settings → Recently deleted, on this device.`)) return
                await deleteEntity(entity.id)
                navigate(entity.template ? `/w/${worldId}/settings` : `/w/${worldId}/type/${entity.type}${entity.type === 'custom' ? `/${entity.customType}` : ''}`)
              }}
            >
              Delete
            </button>
            {!d.template && (
              <button type="button" title="Keep a copy of this page as a starting point for new ones" onClick={saveAsTemplate}>
                📐 Save as template
              </button>
            )}
          </div>
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
        navigate(`/w/${parent.worldId}/e/${child.id}`)
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
        🧵 Loose threads <Help topic="trackAsThread" />
      </h3>
      {following.map((t) => (
        <Link key={t.id} className="block" to={`/w/${worldId}/e/${t.id}`}>
          {t.name} <span className="muted small">· {t.threadStatus ?? 'open'}</span>
        </Link>
      ))}
      <button
        className="block"
        onClick={async () => {
          const t = { ...newThread(worldId, quest.name), summary: quest.summary, body: `Follows the quest [[${quest.name}]].` }
          await db.entities.add(t)
          navigate(`/w/${worldId}/e/${t.id}`)
        }}
      >
        + Track as thread
      </button>
    </div>
  )
}
