import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Help, HelpTipsToggle } from '../help'
import { RecentlyDeleted } from '../History'
import { AiSettingsSection } from '../ai/AiSettingsSection'
import { exportWorld } from '../backup'
import { db, deleteWorld, GAME_SYSTEMS, newId, typeLabel, type CustomType, type World } from '../db'
import { useTemplates, useWorld } from '../hooks'
import CloudSettings from './CloudSettings'
import { CalendarEditor } from '../calendar'
import { DiscordSettings } from '../discord'
import { ImportPages } from '../ImportPages'

export default function WorldSettings() {
  const { worldId, world } = useWorld()
  const navigate = useNavigate()
  if (!world) return null
  const update = (patch: Partial<World>) => db.worlds.update(worldId, { ...patch, updatedAt: Date.now() })

  return (
    <div className="page">
      <header className="page-header">
        <h1>⚙️ World settings</h1>
      </header>
      <HelpTipsToggle />
      <div className="form">
        <label>
          Name
          <input value={world.name} onChange={(e) => update({ name: e.target.value })} />
        </label>
        <label>
          Default game system
          <select value={world.system} onChange={(e) => update({ system: e.target.value })}>
            {GAME_SYSTEMS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Description
          <textarea rows={4} value={world.description} onChange={(e) => update({ description: e.target.value })} />
        </label>
      </div>

      <CalendarEditor world={world} />

      <CustomTypes world={world} update={update} />

      <Templates world={world} />

      <CloudSettings world={world} />

      <DiscordSettings worldId={worldId} />

      <AiSettingsSection />

      <section>
        <h2>
          Backup <Help topic="backup" />
        </h2>
        <p className="muted">
          A backup is a single file with the whole world in it, including uploaded files. Keep one even if sync is on; you can
          import it from the home screen on any device.
        </p>
        <button onClick={() => exportWorld(worldId)}>⬇ Download backup</button>
      </section>

      <ImportPages worldId={worldId} />

      <RecentlyDeleted />

      <section>
        <h2>Danger zone</h2>
        <button
          className="danger"
          onClick={async () => {
            if (prompt(`Type the world's name to delete it forever: ${world.name}`) !== world.name) return
            await deleteWorld(worldId)
            navigate('/')
          }}
        >
          Delete this world
        </button>
      </section>
    </div>
  )
}

function CustomTypes({ world, update }: { world: World; update: (patch: Partial<World>) => unknown }) {
  const types = world.customTypes ?? []
  const [draft, setDraft] = useState<Omit<CustomType, 'id'>>({ one: '', many: '', icon: '📄' })
  const counts = useLiveQuery(() => db.entities.where({ worldId: world.id }).filter((e) => e.type === 'custom').toArray(), [world.id]) ?? []
  const set = (next: CustomType[]) => update({ customTypes: next })
  return (
    <section>
      <h2>
        🧩 Your own page types <Help topic="customTypes" />
      </h2>
      {types.length > 0 && (
        <ul className="custom-types">
          {types.map((c, i) => {
            const n = counts.filter((e) => e.customType === c.id).length
            const change = (patch: Partial<CustomType>) => set(types.map((x, j) => (j === i ? { ...x, ...patch } : x)))
            return (
              <li key={c.id} className="row">
                <input className="icon-input" value={c.icon} onChange={(e) => change({ icon: e.target.value })} aria-label="Icon" />
                <input value={c.one} onChange={(e) => change({ one: e.target.value })} aria-label="Name for one" />
                <input value={c.many} onChange={(e) => change({ many: e.target.value })} aria-label="Name for several" />
                <Link className="small" to={`/w/${world.id}/type/custom/${c.id}`}>
                  {n} page{n === 1 ? '' : 's'}
                </Link>
                <button
                  className="ghost small"
                  title={n ? 'Move or delete its pages first' : 'Remove this type'}
                  disabled={n > 0}
                  onClick={() => set(types.filter((x) => x.id !== c.id))}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <form
        className="row wrap"
        onSubmit={(e) => {
          e.preventDefault()
          const one = draft.one.trim()
          if (!one) return
          set([...types, { id: newId(), one, many: draft.many.trim() || `${one}s`, icon: draft.icon.trim() || '📄' }])
          setDraft({ one: '', many: '', icon: '📄' })
        }}
      >
        <input className="icon-input" value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} aria-label="Icon" />
        <input value={draft.one} onChange={(e) => setDraft({ ...draft, one: e.target.value })} placeholder="Name, e.g. Ship" />
        <input value={draft.many} onChange={(e) => setDraft({ ...draft, many: e.target.value })} placeholder={draft.one ? `${draft.one}s` : 'Plural, e.g. Ships'} />
        <button disabled={!draft.one.trim()}>+ Add type</button>
      </form>
    </section>
  )
}

function Templates({ world }: { world: World }) {
  const templates = useTemplates(world.id)
  return (
    <section>
      <h2>
        📐 Templates <Help topic="templates" />
      </h2>
      {templates.length === 0 ? (
        <p className="muted">No templates yet. Open any page, edit it, and choose “Save as template”.</p>
      ) : (
        <ul className="entity-list">
          {templates.map((t) => (
            <li key={t.id}>
              <Link to={`/w/${world.id}/e/${t.id}`}>
                {typeLabel(t, world).icon} {t.name}
              </Link>{' '}
              <span className="muted small">· for new {typeLabel(t, world).many.toLowerCase()}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
