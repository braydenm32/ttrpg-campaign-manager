import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Empty, TagInput, VisibilityBadge, VisibilityToggle } from '../components'
import { blankEntity, db, deleteEntity, ENTITY_LABELS, ENTITY_TYPES, THREAD_STATUS, type Entity, type EntityType, type ThreadStatus } from '../db'
import { URGENCY, useWorldSessions } from '../threads'
import { saveFileAsAsset, useAssetUrl, useVisibleEntities, useWorld } from '../hooks'
import { findBacklinks, Markdown } from '../Markdown'
import { SecretTextarea } from '../SecretTextarea'
import { CharacterOwnerBox } from '../players/Characters'
import { PlayerNotesBox } from '../players/Notes'
import { RevealedToBadge, RevealToPicker } from '../players/Secrets'
import { useViewMode } from '../viewMode'

export default function EntityPage() {
  const { worldId } = useWorld()
  const { entityId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { isGM, canSee } = useViewMode()
  const entity = useLiveQuery(() => db.entities.get(entityId), [entityId])
  const editing = isGM && params.get('edit') === '1'

  if (entity === undefined) return null
  if (entity === null || entity.worldId !== worldId || !canSee(entity.visibility))
    return <Empty>This page doesn't exist or hasn't been revealed.</Empty>

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
            {ENTITY_LABELS[e.type].icon} {ENTITY_LABELS[e.type].one}
            {e.type === 'event' && e.eventDate && ` · ${e.eventDate}`}
            {e.type === 'event' && ` · ${e.eventEra === 'campaign' ? 'during the campaign' : 'before the campaign'}`}
            {e.questStatus && ` · ${e.questStatus}`}
            {e.type === 'thread' && ` · ${THREAD_STATUS[e.threadStatus ?? 'open'].label}`}
            {e.type === 'thread' && e.threadUrgency && e.threadUrgency !== 'normal' && ` · ${URGENCY[e.threadUrgency].icon} ${URGENCY[e.threadUrgency].label}`}
          </div>
          <h1>
            {e.name} <VisibilityBadge value={e.visibility} /> <RevealedToBadge entity={e} world={world} entities={entities} isGM={isGM} />
          </h1>
          {e.summary && <p className="lead">{e.summary}</p>}
        </div>
        {isGM && <button onClick={onEdit}>✏️ Edit</button>}
      </header>

      <div className="entity-layout">
        <div className="entity-main">
          {e.body ? (
            <Markdown text={e.body} entities={entities} worldId={worldId} showSecrets={isGM} />
          ) : (
            <p className="muted">No description yet.</p>
          )}
          {isGM && e.gmNotes && (
            <div className="secret">
              <strong>GM notes</strong>
              <Markdown text={e.gmNotes} entities={entities} worldId={worldId} showSecrets />
            </div>
          )}
          {world && <PlayerNotesBox world={world} entityId={e.id} entities={entities} />}
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
                  <div key={i}>
                    <dt>{f.key}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {e.tags.length > 0 && (
            <div className="tags">
              {e.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
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
  const dirty = JSON.stringify(d) !== JSON.stringify(entity)

  useEffect(() => {
    if (!dirty) return
    const warn = (ev: BeforeUnloadEvent) => ev.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const save = async () => {
    await db.entities.put({ ...d, name: d.name.trim() || 'Untitled', updatedAt: Date.now() })
    onDone()
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
          <input className="title-input" value={d.name} onChange={(ev) => set('name', ev.target.value)} placeholder="Name" />
          <div className="row">
            <VisibilityToggle value={d.visibility} onChange={(v) => set('visibility', v)} />
            <Help topic="visibility" />
            <button type="button" onClick={onDone}>
              Cancel
            </button>
            <button className="primary">Save</button>
          </div>
        </header>
        {d.visibility === 'gm' && world && (
          <RevealToPicker world={world} entities={entities} value={d.revealedTo ?? []} onChange={(ids) => set('revealedTo', ids.length ? ids : undefined)} />
        )}
        <div className="grid-2">
          <label>
            Type
            <select value={d.type} onChange={(ev) => set('type', ev.target.value as EntityType)}>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ENTITY_LABELS[t].one}
                </option>
              ))}
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
              <label>
                In-world date
                <input value={d.eventDate ?? ''} onChange={(ev) => set('eventDate', ev.target.value)} placeholder="e.g. 1492 DR, Year of Three Ships" />
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
        <label>
          Summary
          <input value={d.summary} onChange={(ev) => set('summary', ev.target.value)} placeholder="One line shown in lists and on map pins" />
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
              <div key={i} className="row field-row">
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
        <div className="row spread">
          <button
            type="button"
            className="danger"
            onClick={async () => {
              if (!confirm(`Delete "${entity.name}"? This can't be undone.`)) return
              await deleteEntity(entity.id)
              navigate(`/w/${worldId}/type/${entity.type}`)
            }}
          >
            Delete
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
        navigate(`/w/${parent.worldId}/e/${child.id}`)
      }}
    >
      <input value={name} onChange={(ev) => setName(ev.target.value)} placeholder={`Add a place inside ${parent.name}, e.g. a district or building`} />
      <button disabled={!name.trim()}>+ Add place inside</button>
    </form>
  )
}
