import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Help } from './help'
import { LecternPanel } from './lecternPanel'
import { db, newId, type Entity, type Showing, type World } from './db'
import { saveFileAsAsset, useAssetUrl, useBlobUrl, useVisibleEntities } from './hooks'
import { Markdown, stripSecrets } from './Markdown'
import { schedule } from './cloud/sync'
import { Ico } from './icons'
import { Television } from '@phosphor-icons/react'
import { useDialog } from './components'
import { worldPath } from './paths'

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

/**
 * Map pictures players must never be shown, each with the picture to show instead (once there is
 * one): the clean picture of a fogged map would show everything under the fog, and so would its
 * players' copy; the GM's copy of a map with secrets on it shows the secrets. Keep in step with
 * "fogged" in public.player_view, which never sends these.
 */
export async function unshowableImages(worldId: string) {
  const instead = new Map<string, string | undefined>()
  for (const m of await db.maps.where({ worldId }).toArray()) {
    if (m.fog?.on) {
      instead.set(m.imageId, m.fog.imageId)
      if (m.playerImageId) instead.set(m.playerImageId, m.fog.imageId)
    } else if (m.playerImageId) instead.set(m.imageId, m.playerImageId)
  }
  return instead
}

/**
 * Shows something to every player, and keeps it in the world's handouts so they can read it again
 * later. A map picture players mustn't see is swapped for their copy, or not shown at all (false).
 */
export async function showToPlayers(worldId: string, what: Omit<Showing, 'id' | 'at'>) {
  let s = what
  const instead = s.kind === 'image' && s.assetId ? await unshowableImages(worldId) : undefined
  if (instead?.has(s.assetId!)) {
    const safe = instead.get(s.assetId!)
    if (!safe) {
      alert('This is the full picture of a fogged map, so players can’t be shown it. Open the map once so the app can make the fogged copy, then show that.')
      return false
    }
    s = { ...s, assetId: safe }
  }
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
  return true
}

/** Reveals a page to everyone and puts it on their screens, for an NPC who just walked in. */
export async function revealAndShow(worldId: string, page: Entity) {
  if (page.visibility !== 'players') await db.entities.update(page.id, { visibility: 'players', updatedAt: Date.now() })
  await showToPlayers(worldId, { kind: 'page', title: page.name, entityId: page.id })
}

/** Takes a handout off the list (and off players' screens, if it's up now). With hidePage, its page is made GM only again. */
export async function removeHandout(worldId: string, id: string, hidePage?: string) {
  await db.worlds
    .where('id')
    .equals(worldId)
    .modify((w) => {
      w.handouts = (w.handouts ?? []).filter((h) => h.id !== id)
      if (w.showing?.id === id) w.showing = null
    })
  if (hidePage) await db.entities.update(hidePage, { visibility: 'gm', updatedAt: Date.now() })
  schedule(200)
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
  // A picture that never arrives says so, rather than "Loading" forever.
  const [slow, setSlow] = useState<string>()
  useEffect(() => {
    if (showing.kind !== 'image' || image) return
    const t = setTimeout(() => setSlow(showing.id), 8000)
    return () => clearTimeout(t)
  }, [showing.kind, showing.id, image])
  return (
    <div className={`showing-view ${big ? 'big' : ''}`}>
      {showing.kind === 'image' &&
        (image ? (
          <img src={image} alt={showing.title} />
        ) : (
          <p className="muted">{slow === showing.id ? 'This picture hasn’t reached this device. Ask your GM to show it again.' : 'Loading the picture…'}</p>
        ))}
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
  return <ShowingPopupInner world={world} showing={showing} seen={seen} setSeen={setSeen} />
}

function ShowingPopupInner({ world, showing, seen, setSeen }: { world: World; showing: Showing; seen: string; setSeen: (id: string) => void }) {
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
        <Ico as={Television} /> Your GM is showing: {showing.title}
      </button>
    )
  return <ShowingModal showing={showing} worldId={world.id} close={close} />
}

function ShowingModal({ showing, worldId, close }: { showing: Showing; worldId: string; close: () => void }) {
  const ref = useDialog(close)
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal showing-modal" role="dialog" aria-modal="true" aria-label={showing.title} ref={ref} tabIndex={-1}>
        <header>
          <h2><Ico as={Television} /> {showing.title}</h2>
          <button className="ghost" onClick={close} aria-label="Close">
            ×
          </button>
        </header>
        <ShowingView showing={showing} worldId={worldId} />
      </div>
    </div>
  )
}

/** For the GM: a reminder of what players can see right now, with a way to stop. */
export function ShowingBanner({ world }: { world: World }) {
  if (!world.showing) return null
  return (
    <div className="player-banner showing-banner">
      <Ico as={Television} /> Showing players: <strong>{world.showing.title}</strong>
      <Link className="button" to={`/screen${worldPath(world.id).slice(2)}`} target="_blank">
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
      <Ico as={Television} /> Show players
    </button>
  )
}

/** The Lectern's panel: pick a picture or a page (revealing it if need be), or type something, and show it. */
export function ShowPanel({ world, sceneText }: { world: World; sceneText?: string }) {
  const entities = useVisibleEntities(world.id)
  const images = useLiveQuery(async () => {
    // Not a map picture players mustn't see: their own copy is in the list anyway.
    const fogged = await unshowableImages(world.id)
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
    <LecternPanel id="show" sectionId="lectern-show" name="Show players" keywords="handout picture screen tv reveal" title={<><Ico as={Television} /> Show players <Help topic="showPlayers" /></>}>
      {/* Always the same height, so the pictures below don't jump when something is shown. */}
      <div className={`row small show-status ${world.showing ? 'on' : ''}`} role="status">
        {world.showing ? (
          <>
            <span className="grow-text-line">
              Showing <strong>{world.showing.title}</strong>
            </span>
            <button onClick={() => stopShowing(world.id)}>Stop</button>
          </>
        ) : (
          <span className="muted">Nothing on players’ screens.</span>
        )}
      </div>
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
            <Thumb
              key={a.id}
              asset={a}
              on={world.showing?.kind === 'image' && world.showing.assetId === a.id}
              onClick={() => showToPlayers(world.id, { kind: 'image', title: a.name.replace(/\.[^.]+$/, ''), assetId: a.id })}
            />
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
      <Link className="small" to={`/screen${worldPath(world.id).slice(2)}`} target="_blank">
        Open the players’ screen (for a TV) ↗
      </Link>{' '}
      <Help topic="playersScreen" />
      {!!world.handouts?.length && (
        <>
          {' · '}
          <Link className="small" to={`${worldPath(world.id)}/handouts`}>
            Handouts ({world.handouts.length})
          </Link>
        </>
      )}
    </LecternPanel>
  )
}

/** A picture to show, with its name under it (and marked while it's on players' screens). */
function Thumb({ asset, onClick, on }: { asset: Parameters<typeof useBlobUrl>[0]; onClick: () => void; on?: boolean }) {
  const url = useBlobUrl(asset)
  const name = asset?.name.replace(/\.[^.]+$/, '') ?? ''
  return (
    <button className={`show-thumb named ${on ? 'on' : ''}`} title={`Show ${name}`} aria-pressed={on} onClick={onClick}>
      <span className="thumb-img">{url && <img src={url} alt="" />}</span>
      <span className="thumb-name">{name}</span>
    </button>
  )
}

/** The players' screen: a full window showing only what's being shown. Opened from the Lectern for a TV. */
export function PlayersScreen({ world }: { world: World }) {
  const showing = world.showing
  const entities = useVisibleEntities(world.id)
  // A page hidden again since it was shown keeps its name to itself too.
  const hiddenPage = showing?.kind === 'page' && !entities.some((e) => e.id === showing.entityId && e.visibility === 'players')
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
          {!hiddenPage && <h1>{showing.title}</h1>}
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
