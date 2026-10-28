import logo from '../assets/logo.svg'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { importWorld } from '../backup'
import { Empty, Modal } from '../components'
import { Help, HELP } from '../help'
import { db, GAME_SYSTEMS, newId, worldColor, type World } from '../db'
import { useAssetUrl } from '../hooks'
import { EXAMPLE_VERSION, loadExampleWorld } from '../example/load'
import { loadSampleWorld } from '../sample'
import { AccountModal, useAuthSession } from '../cloud/auth'
import { listMyMemberships, loadMemberWorld, memberWorldId, pendingInvite } from '../cloud/players'
import { downloadCloudWorld, listCloudWorlds, type CloudWorld } from '../cloud/sync'
import { worldPath } from '../paths'

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
        <h1 className="brand-title"><img className="brand-mark" src={logo} alt="" />The Warded Atlas</h1>
        <p>
          Your worlds, maps, NPCs and sessions, all in one place. Everything is saved on this device. <Help topic="home" />
        </p>
      </header>
      <div className="row">
        <button className="primary" onClick={() => setCreating(true)}>+ New world</button>
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
                navigate(`${worldPath(await importWorld(f))}`)
              } catch (err) {
                alert(`Import failed: ${(err as Error).message}`)
              }
            }}
          />
        </label>
      </div>
      <InviteBox />
      {worlds.length === 0 && (
        <Empty>No worlds of your own yet. Create one, or open one of the example worlds to look around. A player? Paste the invite link your GM sent you above.</Empty>
      )}
      <div className="shelf">
        {!worlds.some(isSample) && (
          <ExampleBook name="The Shattered Coast" blurb="Sample world · a quick, simple first look" help={HELP.sampleWorld} load={loadSampleWorld} onOpen={(id) => navigate(`${worldPath(id)}`)} />
        )}
        {!worlds.some((w) => w.example) && (
          <ExampleBook name="Vael Ardith" blurb="Example world · a ready-to-run campaign to explore" help={HELP.exampleWorld} load={loadExampleWorld} onOpen={(id) => navigate(`${worldPath(id)}`)} />
        )}
        {worlds.map((w) => (
          <WorldBook key={w.id} world={w} onOpen={() => navigate(`${worldPath(w.id)}`)} />
        ))}
        <button className="book book-new" onClick={() => setCreating(true)}>
          + New world
        </button>
      </div>
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
                      navigate(`${worldPath(c.id)}`)
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
                      navigate(`${worldPath(await loadMemberWorld(m.cloudId))}`)
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
      <About />
      <footer className="legal-links muted small">
        <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">
          Privacy
        </a>
        <a href={`${import.meta.env.BASE_URL}terms.html`} target="_blank" rel="noreferrer">
          Terms
        </a>
        <a href={`${import.meta.env.BASE_URL}data-deletion.html`} target="_blank" rel="noreferrer">
          Delete your data
        </a>
      </footer>
      {account && <AccountModal onClose={() => setAccount(false)} />}
      {creating && <NewWorld onClose={() => setCreating(false)} onCreated={(id) => navigate(`${worldPath(id)}`)} />}
    </div>
  )
}

/** What the app is, under the shelf: the home page doubles as the public page Google's sign-in checks. */
function About() {
  return (
    <section className="about">
      <h2>What the Warded Atlas does</h2>
      <p>
        The Warded Atlas helps game masters of Dungeons &amp; Dragons and other tabletop roleplaying games keep their whole world in one place, and share just the
        right parts with their players. It is free, works in your browser or as a desktop app, and keeps working offline. No account is needed to use it;
        everything is saved on your own device.
      </p>
      <ul>
        <li><strong>Wiki pages</strong> for places, people, factions, items and lore, linked together.</li>
        <li><strong>Interactive maps</strong> with pins, regions, fog of war and a built-in map maker.</li>
        <li><strong>Sessions</strong> with prep sheets, encounters, recordings, transcripts and recaps.</li>
        <li><strong>Secrets stay secret:</strong> anything marked for the GM never reaches players, and you can reveal pages to individual players.</li>
        <li><strong>Players join your world</strong> to see what you’ve revealed, claim their characters and keep notes.</li>
      </ul>
      <h2>Why sign in?</h2>
      <p>
        Signing in is optional. An account, using your email or your Google account, lets you sync your worlds between your devices and invite players. The
        Warded Atlas only uses your sign-in to know who you are: your name and email address. It never posts anything or reads your contacts. See the{' '}
        <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">privacy policy</a> for details.
      </p>
    </section>
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
        <span>
          Got an invite link? <Help topic="joining" />
        </span>
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

/** The old sample world had no flag, only its name. */
const isSample = (w: World) => !!w.sample || w.name === 'The Shattered Coast (sample)'

/**
 * A ready-made world on the shelf: the small sample or the full example. It is only loaded the first time someone
 * opens it, and then stays on this device like any world (it syncs only if they switch sync on).
 */
function ExampleBook({ name, blurb, help, load, onOpen }: { name: string; blurb: string; help: string; load: () => Promise<string>; onOpen: (worldId: string) => void }) {
  const [loading, setLoading] = useState(false)
  return (
    <button
      className="book book-example"
      disabled={loading}
      title={help}
      onClick={async () => {
        setLoading(true)
        try {
          onOpen(await load())
        } catch (err) {
          alert(`Couldn’t open ${name}: ${(err as Error).message}`)
          setLoading(false)
        }
      }}
    >
      <img className="book-sigil" src={logo} alt="" />
      <b>{name}</b>
      <small>{loading ? 'Opening…' : blurb}</small>
    </button>
  )
}

/** A world on the shelf: a cloth-bound book in the world's colour, with its cover picture if it has one. */
function WorldBook({ world: w, onOpen }: { world: World; onOpen: () => void }) {
  const cover = useAssetUrl(w.coverId)
  return (
    <button className={`book ${cover ? 'has-picture' : ''}`} style={{ '--world': worldColor(w), '--cover': cover ? `url("${cover}")` : undefined } as CSSProperties} onClick={onOpen}>
      <img className="book-sigil" src={logo} alt="" />
      <b>{w.name}</b>
      <small>
        {w.shared?.memberOf ? 'You’re a player' : w.shared ? 'Shared with you (read only)' : w.example ? 'Example world' : isSample(w) ? 'Sample world' : w.system}
        {w.example && w.example < EXAMPLE_VERSION && ' · update in World settings'}
        {w.cloud?.enabled && ' · synced'}
      </small>
    </button>
  )
}
