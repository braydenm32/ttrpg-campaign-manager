import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Help } from './help'
import { db, newId, type Entity, type Showing, type World } from './db'
import { saveFileAsAsset, useAssetUrl, useBlobUrl, useVisibleEntities } from './hooks'
import { Markdown, stripSecrets } from './Markdown'
import { schedule } from './cloud/sync'

/**
 * "Show to players": the GM puts a picture, a page or some text on every player's screen.
 * It's kept on the world (World.showing), so it reaches players with the next sync: players who
 * joined get it as a pop-up, and the Players' screen (a second window for a TV at the table) shows
 * it full size. The server only passes on a page the viewer may see, and strips secret passages
 * from text (public.player_view).
 */

/** The same thing shown twice is one handout. */
const sameHandout = (a: Omit<Showing, 'id' | 'at'>, b: Omit<Showing, 'id' | 'at'>) =>
  a.kind === b.kind && (a.kind === 'image' ? a.assetId === b.assetId : a.kind === 'page' ? a.entityId === b.entityId : a.text === b.text)

/** Shows something to every player, and keeps it in the world's handouts so they can read it again later. */
export async function showToPlayers(worldId: string, s: Omit<Showing, 'id' | 'at'>) {
  const shown = { ...s, id: newId(), at: Date.now() }
  await db.worlds
    .where('id')
    .equals(worldId)
    .modify((w) => {
      w.showing = shown
      w.handouts = [shown, ...(w.handouts ?? []).filter((h) => !sameHandout(h, s))].slice(0, 100)
    })
  // Don't wait for the usual pause after an edit: the table is waiting.
  schedule(200)
}

/** Reveals a page to everyone and puts it on their screens, for an NPC who just walked in. */
export async function revealAndShow(worldId: string, page: Entity) {
  if (page.visibility !== 'players') await db.entities.update(page.id, { visibility: 'players', updatedAt: Date.now() })
  await showToPlayers(worldId, { kind: 'page', title: page.name, entityId: page.id })
}

export async function removeHandout(worldId: string, id: string) {
  await db.worlds
    .where('id')
    .equals(worldId)
    .modify((w) => {
      w.handouts = (w.handouts ?? []).filter((h) => h.id !== id)
    })
}

export async function stopShowing(worldId: string) {
  await db.worlds.update(worldId, { showing: null })
  schedule(200)
}

/** What's being shown, as players see it: never a secret passage or a page they can't see. */
export function ShowingView({ showing, worldId, big }: { showing: Showing; worldId: string; big?: boolean }) {
  const entities = useVisibleEntities(worldId)
  const image = useAssetUrl(showing.kind === 'image' ? showing.assetId : undefined)
  const page = showing.kind === 'page' ? entities.find((e) => e.id === showing.entityId && e.visibility === 'players') : undefined
  const pageImage = useAssetUrl(page?.imageId)
  return (
    <div className={`showing-view ${big ? 'big' : ''}`}>
      {showing.kind === 'image' && (image ? <img src={image} alt={showing.title} /> : <p className="muted">Loading the picture…</p>)}
      {showing.kind === 'text' && (
        <Markdown text={stripSecrets(showing.text ?? '')} entities={entities} worldId={worldId} showSecrets={false} stillLinks={big} />
      )}
      {showing.kind === 'page' &&
        (page ? (
          <>
            {pageImage && <img src={pageImage} alt={page.name} />}
            {page.summary && <p className="lead">{page.summary}</p>}
            <Markdown text={page.body} entities={entities} worldId={worldId} showSecrets={false} stillLinks={big} />
          </>
        ) : (
          <p className="muted">This page isn’t revealed to players.</p>
        ))}
    </div>
  )
}

const seenKey = (worldId: string) => `codex.seenShowing.${worldId}`
const readSeen = (worldId: string) => {
  try {
    return localStorage.getItem(seenKey(worldId)) ?? ''
  } catch {
    return ''
  }
}

/** For players: pops up whatever the GM shows, once; a button brings it back. */
export function ShowingPopup({ world }: { world: World }) {
  const showing = world.showing
  const [seen, setSeen] = useState(() => readSeen(world.id))
  if (!showing) return null
  const open = seen !== showing.id
  const close = () => {
    try {
      localStorage.setItem(seenKey(world.id), showing.id)
    } catch {
      // Storage blocked: it just closes for now.
    }
    setSeen(showing.id)
  }
  if (!open)
    return (
      <button className="showing-reopen" onClick={() => setSeen('')}>
        📺 Your GM is showing: {showing.title}
      </button>
    )
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal showing-modal" role="dialog" aria-label={showing.title}>
        <header>
          <h2>📺 {showing.title}</h2>
          <button className="ghost" onClick={close} aria-label="Close">
            ×
          </button>
        </header>
        <ShowingView showing={showing} worldId={world.id} />
      </div>
    </div>
  )
}

/** For the GM: a reminder of what players can see right now, with a way to stop. */
export function ShowingBanner({ world }: { world: World }) {
  if (!world.showing) return null
  return (
    <div className="player-banner showing-banner">
      📺 Showing players: <strong>{world.showing.title}</strong>
      <Link className="button" to={`/screen/${world.id}`} target="_blank">
        Players’ screen
      </Link>
      <button onClick={() => stopShowing(world.id)}>Stop showing</button>
    </div>
  )
}

/** A one-click "show this" button, for pages and pictures. */
export function ShowButton({ worldId, what, disabled }: { worldId: string; what: Omit<Showing, 'id' | 'at'>; disabled?: string }) {
  return (
    <button
      type="button"
      title={disabled || 'Put this on every player’s screen'}
      disabled={!!disabled}
      onClick={() => showToPlayers(worldId, what)}
    >
      📺 Show players
    </button>
  )
}

/** The Lectern's panel: pick a picture or a page (revealing it if need be), or type something, and show it. */
export function ShowPanel({ world, sceneText }: { world: World; sceneText?: string }) {
  const entities = useVisibleEntities(world.id)
  const images = useLiveQuery(async () => {
    // The clean picture of a fogged map would show players everything under the fog.
    const fogged = new Set((await db.maps.where({ worldId: world.id }).toArray()).filter((m) => m.fog?.on).map((m) => m.imageId))
    return db.assets
      .where({ worldId: world.id })
      .filter((a) => a.mime.startsWith('image/') && !a.tags.includes('fog') && !fogged.has(a.id))
      .reverse()
      .sortBy('createdAt')
  }, [world.id])
  const [kind, setKind] = useState<'image' | 'page' | 'text'>('image')
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const revealed = entities.filter((e) => e.visibility === 'players')
  const hidden = entities.filter((e) => e.visibility !== 'players' && !e.template)
  return (
    <section className="card lectern-panel">
      <h2>
        📺 Show players <Help topic="showPlayers" />
      </h2>
      {world.showing ? (
        <div className="row wrap small">
          <span>
            Showing <strong>{world.showing.title}</strong>
          </span>
          <button onClick={() => stopShowing(world.id)}>Stop</button>
        </div>
      ) : (
        <p className="muted small">Nothing on players’ screens.</p>
      )}
      <div className="segmented">
        {(['image', 'page', 'text'] as const).map((k) => (
          <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
            {{ image: '🖼️ Picture', page: '📄 Page', text: '📝 Text' }[k]}
          </button>
        ))}
      </div>
      {kind === 'image' && (
        <div className="show-thumbs">
          <label className="button small">
            + Upload
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const id = await saveFileAsAsset(world.id, f, f.name, ['handout'])
                await showToPlayers(world.id, { kind: 'image', title: f.name.replace(/\.[^.]+$/, ''), assetId: id })
                e.target.value = ''
              }}
            />
          </label>
          {(images ?? []).slice(0, 30).map((a) => (
            <Thumb key={a.id} asset={a} onClick={() => showToPlayers(world.id, { kind: 'image', title: a.name.replace(/\.[^.]+$/, ''), assetId: a.id })} />
          ))}
        </div>
      )}
      {kind === 'page' && (
        <select
          value=""
          onChange={(e) => {
            const p = entities.find((x) => x.id === e.target.value)
            if (!p) return
            if (p.visibility === 'players') showToPlayers(world.id, { kind: 'page', title: p.name, entityId: p.id })
            else if (confirm(`Reveal “${p.name}” to every player and show it? GM notes and secret passages stay hidden.`)) revealAndShow(world.id, p)
          }}
        >
          <option value="">Pick a page…</option>
          {revealed.length > 0 && (
            <optgroup label="Revealed">
              {revealed.map((p: Entity) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
          {hidden.length > 0 && (
            <optgroup label="Not revealed yet (reveal and show)">
              {hidden.map((p: Entity) => (
                <option key={p.id} value={p.id}>
                  🔒 {p.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      )}
      {kind === 'text' && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim()) return
            showToPlayers(world.id, { kind: 'text', title: title.trim() || 'From your GM', text })
          }}
        >
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. A letter sealed in red wax" />
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="What the players read. Markdown works." />
          <div className="row wrap">
            <button className="primary" disabled={!text.trim()}>
              Show
            </button>
            {sceneText?.trim() && (
              <button type="button" onClick={() => setText(stripSecrets(sceneText))}>
                Use the scene text
              </button>
            )}
          </div>
        </form>
      )}
      <Link className="small" to={`/screen/${world.id}`} target="_blank">
        Open the players’ screen (for a TV) ↗
      </Link>{' '}
      <Help topic="playersScreen" />
      {!!world.handouts?.length && (
        <>
          {' · '}
          <Link className="small" to={`/w/${world.id}/handouts`}>
            Handouts ({world.handouts.length})
          </Link>
        </>
      )}
    </section>
  )
}

function Thumb({ asset, onClick }: { asset: Parameters<typeof useBlobUrl>[0]; onClick: () => void }) {
  const url = useBlobUrl(asset)
  return (
    <button className="show-thumb" title={`Show ${asset?.name}`} onClick={onClick}>
      {url && <img src={url} alt={asset?.name} />}
    </button>
  )
}

/** The players' screen: a full window showing only what's being shown. Opened from the Lectern for a TV. */
export function PlayersScreen({ world }: { world: World }) {
  const showing = world.showing
  // Keep the screen awake while it's up, where the browser allows it.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request('screen').then((l) => (lock = l), () => {})
    return () => void lock?.release()
  }, [])
  return (
    <div className="players-screen">
      {showing ? (
        <>
          <h1>{showing.title}</h1>
          <ShowingView showing={showing} worldId={world.id} big />
        </>
      ) : (
        <div className="players-screen-idle">
          <h1>{world.name}</h1>
          <p className="muted">Waiting for the GM…</p>
        </div>
      )}
    </div>
  )
}
