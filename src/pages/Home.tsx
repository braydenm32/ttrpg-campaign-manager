import logo from '../assets/logo.svg'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { importWorld } from '../backup'
import { Empty, Modal } from '../components'
import { Help } from '../help'
import { db, GAME_SYSTEMS, newId } from '../db'
import { loadSampleWorld } from '../sample'
import { AccountModal, useAuthSession } from '../cloud/auth'
import { listMyMemberships, loadMemberWorld, memberWorldId, pendingInvite } from '../cloud/players'
import { downloadCloudWorld, listCloudWorlds, type CloudWorld } from '../cloud/sync'

export default function Home() {
  const worlds = useLiveQuery(() => db.worlds.orderBy('updatedAt').reverse().toArray()) ?? []
  const [creating, setCreating] = useState(false)
  const [account, setAccount] = useState(false)
  const { user } = useAuthSession()
  const [cloudWorlds, setCloudWorlds] = useState<CloudWorld[]>([])
  const [memberships, setMemberships] = useState<{ cloudId: string; name: string }[]>([])
  const [downloading, setDownloading] = useState('')
  const navigate = useNavigate()
  const localIds = new Set(worlds.map((w) => w.id))
  const notHere = user ? cloudWorlds.filter((c) => !localIds.has(c.id)) : []
  const joinedNotHere = user ? memberships.filter((m) => !localIds.has(memberWorldId(m.cloudId))) : []

  useEffect(() => {
    if (!user) return
    // Back from confirming an email address in the middle of accepting an invite: carry on.
    const invite = pendingInvite.get()
    if (invite) {
      navigate(`/join/${invite}`)
      return
    }
    listCloudWorlds().then(setCloudWorlds, () => setCloudWorlds([]))
    listMyMemberships().then(setMemberships, () => setMemberships([]))
  }, [user, navigate])

  return (
    <div className="home">
      <header className="home-header">
        <button className="account-button" onClick={() => setAccount(true)}>
          {user ? `☁️ ${user.email || user.user_metadata?.full_name || 'Signed in'}` : '☁️ Sign in to sync'}
        </button>
        <h1 className="brand-title"><img className="brand-mark" src={logo} alt="" />Campaign Codex</h1>
        <p>
          Your worlds, maps, NPCs and sessions, all in one place. Everything is saved on this device. <Help topic="home" />
        </p>
      </header>
      <div className="row">
        <button className="primary" onClick={() => setCreating(true)}>+ New world</button>
        <button onClick={async () => navigate(`/w/${await loadSampleWorld()}`)}>Load sample world</button>
        <label className="button">
          Import backup…
          <input
            type="file"
            accept="application/json,.json,application/zip,.zip"
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
      <InviteBox />
      {worlds.length === 0 ? (
        <Empty>No worlds yet. Create one, or load the sample world to look around. A player? Paste the invite link your GM sent you above.</Empty>
      ) : (
        <div className="card-grid">
          {worlds.map((w) => (
            <button key={w.id} className="card world-card" onClick={() => navigate(`/w/${w.id}`)}>
              <h3>{w.name}</h3>
              <div className="muted">
                {w.shared?.memberOf ? '🎭 You’re a player' : w.shared ? '📜 Shared with you (read only)' : w.system}
                {w.cloud?.enabled && ' · ☁️ synced'}
              </div>
              <p>{w.description}</p>
            </button>
          ))}
        </div>
      )}
      {notHere.length > 0 && (
        <section>
          <h2>In your cloud, not on this device</h2>
          <div className="card-grid">
            {notHere.map((c) => (
              <div key={c.id} className="card">
                <h3>{c.name || 'Untitled world'}</h3>
                <button
                  className="primary"
                  disabled={!!downloading}
                  onClick={async () => {
                    setDownloading(c.id)
                    try {
                      await downloadCloudWorld(c)
                      navigate(`/w/${c.id}`)
                    } catch (err) {
                      alert(`Download failed: ${(err as Error).message}`)
                    } finally {
                      setDownloading('')
                    }
                  }}
                >
                  {downloading === c.id ? 'Downloading…' : '⬇ Open on this device'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      {joinedNotHere.length > 0 && (
        <section>
          <h2>Worlds you play in, not on this device</h2>
          <div className="card-grid">
            {joinedNotHere.map((m) => (
              <div key={m.cloudId} className="card">
                <h3>{m.name || 'A world'}</h3>
                <button
                  className="primary"
                  disabled={!!downloading}
                  onClick={async () => {
                    setDownloading(m.cloudId)
                    try {
                      navigate(`/w/${await loadMemberWorld(m.cloudId)}`)
                    } catch (err) {
                      alert((err as Error).message)
                    } finally {
                      setDownloading('')
                    }
                  }}
                >
                  {downloading === m.cloudId ? 'Opening…' : '🎭 Open on this device'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      <footer className="legal-links muted small">
        <a href="privacy.html" target="_blank" rel="noreferrer">
          Privacy
        </a>
        <a href="terms.html" target="_blank" rel="noreferrer">
          Terms
        </a>
        <a href="data-deletion.html" target="_blank" rel="noreferrer">
          Delete your data
        </a>
      </footer>
      {account && <AccountModal onClose={() => setAccount(false)} />}
      {creating && <NewWorld onClose={() => setCreating(false)} onCreated={(id) => navigate(`/w/${id}`)} />}
    </div>
  )
}

/** For players: paste the invite or wiki link the GM sent, in case it opened in the wrong place. */
function InviteBox() {
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  return (
    <form
      className="invite-box row wrap"
      onSubmit={(e) => {
        e.preventDefault()
        const m = link.match(/#?\/?(join|shared)\/([A-Za-z0-9_-]{16,})(\?[^\s]*)?/)
        if (!m) return setError('That doesn’t look like an invite or wiki link. It should have /join/ or /shared/ in it.')
        navigate(`/${m[1]}/${m[2]}${m[3] ?? ''}`)
      }}
    >
      <label>
        Got an invite link? <Help topic="joining" />
        <input value={link} onChange={(e) => (setLink(e.target.value), setError(''))} placeholder="Paste the link your GM sent you" />
      </label>
      <button disabled={!link.trim()}>Open</button>
      {error && <p className="error small">{error}</p>}
    </form>
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
