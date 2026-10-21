import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { importWorld } from '../backup'
import { Empty, Modal } from '../components'
import { db, GAME_SYSTEMS, newId } from '../db'
import { loadSampleWorld } from '../sample'

export default function Home() {
  const worlds = useLiveQuery(() => db.worlds.orderBy('updatedAt').reverse().toArray()) ?? []
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="home">
      <header className="home-header">
        <h1>⚔️ Campaign Codex</h1>
        <p>Your worlds, maps, NPCs and sessions, all in one place. Everything is saved on this device.</p>
      </header>
      <div className="row">
        <button className="primary" onClick={() => setCreating(true)}>+ New world</button>
        <button onClick={async () => navigate(`/w/${await loadSampleWorld()}`)}>Load sample world</button>
        <label className="button">
          Import backup…
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                navigate(`/w/${await importWorld(f)}`)
              } catch (err) {
                alert(`Import failed: ${(err as Error).message}`)
              }
            }}
          />
        </label>
      </div>
      {worlds.length === 0 ? (
        <Empty>No worlds yet. Create one, or load the sample world to look around.</Empty>
      ) : (
        <div className="card-grid">
          {worlds.map((w) => (
            <button key={w.id} className="card world-card" onClick={() => navigate(`/w/${w.id}`)}>
              <h3>{w.name}</h3>
              <div className="muted">{w.system}</div>
              <p>{w.description}</p>
            </button>
          ))}
        </div>
      )}
      {creating && <NewWorld onClose={() => setCreating(false)} onCreated={(id) => navigate(`/w/${id}`)} />}
    </div>
  )
}

function NewWorld({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [system, setSystem] = useState(GAME_SYSTEMS[0])
  const [description, setDescription] = useState('')
  return (
    <Modal title="New world" onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          const id = newId()
          const now = Date.now()
          await db.worlds.add({ id, name: name.trim(), system, description, createdAt: now, updatedAt: now })
          onCreated(id)
        }}
      >
        <label>
          Name
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Shattered Coast" />
        </label>
        <label>
          Game system
          <select value={system} onChange={(e) => setSystem(e.target.value)}>
            {GAME_SYSTEMS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Description
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="row end">
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!name.trim()}>Create world</button>
        </div>
      </form>
    </Modal>
  )
}
