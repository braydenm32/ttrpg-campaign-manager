import { useNavigate } from 'react-router-dom'
import { AiSettingsSection } from '../ai/AiSettingsSection'
import { exportWorld } from '../backup'
import { db, deleteWorld, GAME_SYSTEMS, type World } from '../db'
import { useWorld } from '../hooks'
import CloudSettings from './CloudSettings'

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

      <CloudSettings world={world} />

      <AiSettingsSection />

      <section>
        <h2>Backup</h2>
        <p className="muted">
          A backup is a single file with the whole world in it, including uploaded files. Keep one even if sync is on; you can
          import it from the home screen on any device.
        </p>
        <button onClick={() => exportWorld(worldId)}>⬇ Download backup</button>
      </section>

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
