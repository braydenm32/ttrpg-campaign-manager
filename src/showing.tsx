import logo from './assets/logo.svg'
import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Help } from './help'
import { LecternPanel } from './lecternPanel'
import { db, newId, saveEntity, type Entity, type ShowBoard, type Showing, type Spot, type Spread, type World } from './db'
import { saveFileAsAsset, useAssetUrl, useBlobUrl, useVisibleEntities } from './hooks'
import { Markdown, stripSecrets } from './Markdown'
import { schedule } from './cloud/sync'
import { Ico } from './icons'
import { SquaresFour, Television } from '@phosphor-icons/react'
import { useDialog } from './components'
import { worldPath } from './paths'
import { askToReveal, useReview } from './reveal'
import { toast } from './undo'
import { offerGroupPost } from './groupPost'
import { visibleHandouts } from './counts'
import './spread.css'

/** The arranging board for showing several at once: only loaded when the GM opens it. */
const ArrangeBoard = lazy(() => import('./showBoard'))

/**
 * "Show to players": the GM puts a picture, a page or some text on every player's screen.
 * It's kept on the world (World.showing), so it reaches players with the next sync: players who
 * joined get it as a pop-up, and the Players' screen (a second window for a TV at the table) shows
 * it full size. The server only passes on a page the viewer may see, and strips secret passages
 * from text (public.player_view).
 *
 * Several at once: the GM lays handouts out on an arranging board (src/showBoard.tsx, kept in the
 * GM-only gmScreen) and shows them together. Each becomes a handout as usual, and World.spread says
 * which handouts are up and where each sits, so the server's filtering of handouts covers it too.
 */

/** The same thing shown twice is one handout. */
export const sameHandout = (a: Omit<Showing, 'id' | 'at'>, b: Omit<Showing, 'id' | 'at'>) =>
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
      w.spread = null
      w.handouts = [shown, ...(w.handouts ?? []).filter((h) => !sameHandout(h, s))].slice(0, 100)
    })
  // Don't wait for the usual pause after an edit: the table is waiting.
  schedule(200)
  // Players away from the table find it later; offer to tell the group chat.
  offerGroupPost(await db.worlds.get(worldId), shown.title.trim() ? `New handout: “${shown.title.trim()}”. It’s in the Common Room.` : 'A new handout is in the Common Room.')
  return true
}

/**
 * Reveals a page to everyone and puts it on their screens, for an NPC who just walked in. Returns
 * a function that takes it back (for Undo): the page hidden again if it was, and the handouts and
 * what's on screen as they were.
 */
export async function revealAndShow(worldId: string, page: Entity) {
  const before = await db.worlds.get(worldId)
  const wasHidden = page.visibility !== 'players'
  if (wasHidden) await db.entities.update(page.id, { visibility: 'players', updatedAt: Date.now() })
  await showToPlayers(worldId, { kind: 'page', title: page.name, entityId: page.id })
  return async () => {
    if (wasHidden) await db.entities.update(page.id, { visibility: page.visibility, updatedAt: Date.now() })
    await db.worlds
      .where('id')
      .equals(worldId)
      .modify((w) => {
        const shown = (w.handouts ?? []).find((h) => h.kind === 'page' && h.entityId === page.id)
        if (!shown) return
        w.handouts = before?.handouts ?? (w.handouts ?? []).filter((h) => h.id !== shown.id)
        if (w.showing?.id === shown.id) {
          w.showing = before?.showing ?? null
          w.spread = before?.spread ?? null
        }
      })
    schedule(200)
  }
}

/**
 * Takes a handout off the list (and off players' screens, if it's up now). With hidePage, its page
 * is hidden from players again; players it was revealed to by name keep it unless alsoNamed is set.
 * Returns a function that puts it all back (for Undo).
 */
export async function removeHandout(worldId: string, id: string, hidePage?: string, alsoNamed = false) {
  const before = await db.worlds.get(worldId)
  const page = hidePage ? await db.entities.get(hidePage) : undefined
  await db.worlds
    .where('id')
    .equals(worldId)
    .modify((w) => {
      w.handouts = (w.handouts ?? []).filter((h) => h.id !== id)
      if (w.showing?.id === id) w.showing = null
      // Taken off the table too, if it's one of several up now.
      if (w.spread?.items.some((i) => i.handoutId === id)) {
        const items = w.spread.items.filter((i) => i.handoutId !== id)
        w.spread = items.length ? { ...w.spread, items } : null
      }
    })
  if (page) await saveEntity({ ...page, visibility: 'gm', ...(alsoNamed ? { revealedTo: undefined } : {}), updatedAt: Date.now() })
  schedule(200)
  return async () => {
    if (page) await db.entities.update(page.id, { visibility: page.visibility, revealedTo: page.revealedTo, updatedAt: Date.now() })
    const was = before?.handouts?.find((h) => h.id === id)
    await db.worlds
      .where('id')
      .equals(worldId)
      .modify((w) => {
        if (was && !(w.handouts ?? []).some((h) => h.id === id)) w.handouts = [...(w.handouts ?? []), was].sort((a, b) => b.at - a.at)
        if (before?.showing?.id === id && !w.showing) w.showing = before.showing
        if (before?.spread?.items.some((i) => i.handoutId === id) && (!w.spread || w.spread.id === before.spread.id)) w.spread = before.spread
      })
    schedule(200)
  }
}

export async function stopShowing(worldId: string) {
  await db.worlds.update(worldId, { showing: null, spread: null })
  schedule(200)
}

/** "“A”, “B” and “C”", for a note about several handouts. */
export function titlesInWords(titles: string[]) {
  const q = titles.map((t) => `“${t.trim() || 'Untitled'}”`)
  return q.length > 1 ? `${q.slice(0, -1).join(', ')} and ${q[q.length - 1]}` : (q[0] ?? '')
}

/**
 * Shows everything on the GM's arranging board at once, laid out as arranged. Each one becomes a
 * handout (the same thing shown before keeps its handout), pages in `reveal` are revealed first,
 * and a map picture players mustn't see goes as their copy or not at all. Returns the spread's id
 * and a function that takes it all back (for Undo), or undefined when there was nothing to show.
 */
export async function showSpread(worldId: string, board: ShowBoard, reveal: Entity[] = []) {
  const before = await db.worlds.get(worldId)
  const instead = await unshowableImages(worldId)
  const blocked: string[] = []
  const items: { what: Omit<Showing, 'id' | 'at'>; spot: Spot & { noTitle?: boolean } }[] = []
  for (const it of board.items) {
    const what: Omit<Showing, 'id' | 'at'> = { kind: it.kind, title: it.title, assetId: it.assetId, entityId: it.entityId, text: it.text }
    if (what.kind === 'image' && what.assetId && instead.has(what.assetId)) {
      const safe = instead.get(what.assetId)
      if (!safe) {
        blocked.push(what.title)
        continue
      }
      what.assetId = safe
    }
    if (what.kind === 'page' && !(what.entityId && (await db.entities.get(what.entityId)))) continue
    items.push({ what, spot: { x: it.x, y: it.y, w: it.w, h: it.h, ...(it.noTitle ? { noTitle: true } : {}) } })
  }
  if (blocked.length)
    alert(`${titlesInWords(blocked)} ${blocked.length > 1 ? 'are full pictures of fogged maps' : 'is the full picture of a fogged map'}, so players can’t be shown ${blocked.length > 1 ? 'them' : 'it'}. Open the map once so the app can make the fogged copy, then put that on the board.`)
  if (!items.length) return undefined
  const revealed: Entity[] = []
  for (const p of reveal) {
    const now = await db.entities.get(p.id)
    if (!now || now.visibility === 'players') continue
    revealed.push(now)
    await db.entities.update(p.id, { visibility: 'players', updatedAt: Date.now() })
  }
  const at = Date.now()
  const spread: Spread = { id: newId(), at, ...(board.title?.trim() ? { title: board.title.trim() } : {}), items: [] }
  await db.worlds
    .where('id')
    .equals(worldId)
    .modify((w) => {
      const old = w.handouts ?? []
      // Newest first, in the board's order; one shown before keeps its handout, so players aren't told it's new.
      const fresh: Showing[] = items.map(({ what }, i) => ({ ...what, id: old.find((h) => sameHandout(h, what))?.id ?? newId(), at: at - i }))
      w.handouts = [...fresh, ...old.filter((h) => !fresh.some((f) => f.id === h.id || sameHandout(f, h)))].slice(0, 100)
      spread.items = items.map(({ spot }, i) => ({ ...spot, handoutId: fresh[i].id }))
      w.spread = spread
      w.showing = null
    })
  schedule(200)
  offerGroupPost(await db.worlds.get(worldId), `New handouts: ${titlesInWords(items.map((i) => i.what.title))}. They’re in the Common Room.`)
  const undo = async () => {
    for (const p of revealed) await db.entities.update(p.id, { visibility: p.visibility, updatedAt: Date.now() })
    await db.worlds
      .where('id')
      .equals(worldId)
      .modify((w) => {
        if (w.spread?.id !== spread.id) return
        w.handouts = before?.handouts ?? []
        w.spread = before?.spread ?? null
        w.showing = before?.showing ?? null
      })
    schedule(200)
  }
  return { id: spread.id, undo }
}

/** One of several handouts up now, with where it sits. */
export type SpreadItem = Spread['items'][number] & { handout: Showing }

/**
 * The handouts up now (World.spread) that players get, each with its spot: as public.player_view
 * sends them, so the players' screen on the GM's own device shows no more than a player's phone.
 */
export function useSpreadItems(world: World | null | undefined): SpreadItem[] {
  const worldId = world?.id ?? ''
  const entities = useVisibleEntities(worldId)
  const maps = useLiveQuery(() => db.maps.where({ worldId }).toArray(), [worldId]) ?? []
  if (!world?.spread) return []
  const forAll = entities.filter((e) => e.visibility === 'players')
  const shown = new Map(visibleHandouts(world, forAll, false, maps).map((h) => [h.id, h]))
  return world.spread.items.flatMap((i) => {
    const handout = shown.get(i.handoutId)
    return handout ? [{ ...i, handout }] : []
  })
}

/** Reading order for a list: top to bottom, then left to right (things roughly level count as one row). */
export const readingOrder = <T extends Spot>(items: T[]) => [...items].sort((a, b) => Math.round(a.y / 12) - Math.round(b.y / 12) || a.x - b.x)

/** One handout on the table: a picture with its name under it, or a page or text as a sheet of paper. */
export function SpreadPiece({ showing, worldId, noTitle, preview }: { showing: Showing; worldId: string; noTitle?: boolean; preview?: boolean }) {
  return (
    <>
      <ShowingView showing={showing} worldId={worldId} big preview={preview} />
      {!noTitle && <div className="spread-name">{showing.title}</div>}
    </>
  )
}

/**
 * Several handouts at once. On the players' screen (big) they sit as the GM arranged them, on a
 * 16:9 table that scales to the window, text and all; on a phone or in the Common Room they're a
 * list, one under another, in reading order.
 */
export function SpreadView({ items, worldId, big }: { items: SpreadItem[]; worldId: string; big?: boolean }) {
  if (big)
    return (
      <div className="spread-stage">
        {items.map((i, n) => (
          <div key={i.handoutId} className={`spread-item kind-${i.handout.kind} ${i.noTitle ? 'no-name' : ''}`} style={{ left: `${i.x}%`, top: `${i.y}%`, width: `${i.w}%`, height: `${i.h}%`, zIndex: n + 1 }}>
            <SpreadPiece showing={i.handout} worldId={worldId} noTitle={i.noTitle} />
          </div>
        ))}
      </div>
    )
  return (
    <ul className="spread-list">
      {readingOrder(items).map((i) => (
        <li key={i.handoutId} className="handout-paper">
          <div className="handout-title">{i.handout.title}</div>
          <ShowingView showing={i.handout} worldId={worldId} />
        </li>
      ))}
    </ul>
  )
}

/** What's being shown, as players see it: never a secret passage or a page they can't see. */
export function ShowingView({ showing, worldId, big, preview }: { showing: Showing; worldId: string; big?: boolean; preview?: boolean }) {
  const entities = useVisibleEntities(worldId)
  const image = useAssetUrl(showing.kind === 'image' ? showing.assetId : undefined)
  // preview: the GM's arranging board, showing a page not revealed yet as players will see it once it is.
  const page = showing.kind === 'page' ? entities.find((e) => e.id === showing.entityId && (preview || e.visibility === 'players')) : undefined
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

/** "3 handouts": what several at once are called when the GM gave them no heading. */
export const spreadTitle = (spread: Pick<Spread, 'title'>, count: number) => spread.title?.trim() || `${count} handouts`

/** For players: pops up whatever the GM shows, once; a button brings it back. */
export function ShowingPopup({ world }: { world: World }) {
  const [seen, setSeen] = useState(() => readSeen(world.id))
  const items = useSpreadItems(world)
  const showing = world.showing
  // Several at once: seen once its handouts were, so moving them about on the TV doesn't pop it up again.
  const now = world.spread
    ? items.length
      ? { key: `spread:${items.map((i) => i.handoutId).sort().join(',')}`, title: spreadTitle(world.spread, items.length), body: <SpreadView items={items} worldId={world.id} /> }
      : undefined
    : showing
      ? { key: showing.id, title: showing.title, body: <ShowingView showing={showing} worldId={world.id} /> }
      : undefined
  if (!now) return null
  const close = () => {
    try {
      localStorage.setItem(seenKey(world.id), now.key)
    } catch {
      // Storage blocked: it just closes for now.
    }
    setSeen(now.key)
  }
  if (seen === now.key)
    return (
      <button className="showing-reopen" onClick={() => setSeen('')}>
        <Ico as={Television} /> Your GM is showing: {now.title}
      </button>
    )
  return (
    <ShowingModal title={now.title} close={close}>
      {now.body}
    </ShowingModal>
  )
}

function ShowingModal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useDialog(close)
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal showing-modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <header>
          <h2><Ico as={Television} /> {title}</h2>
          <button className="ghost" onClick={close} aria-label="Close">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

/** For the GM: a reminder of what players can see right now, with a way to stop. */
export function ShowingBanner({ world }: { world: World }) {
  const what = world.spread ? spreadTitle(world.spread, world.spread.items.length) : world.showing?.title
  if (!world.showing && !world.spread) return null
  return (
    <div className="player-banner showing-banner">
      <Ico as={Television} /> Showing players: <strong>{what}</strong>
      <Link className="button" to={`/screen${worldPath(world.id).slice(2)}`} target="_blank">
        Players’ screen
      </Link>
      <button onClick={() => stopShowing(world.id)}>Stop showing</button>
    </div>
  )
}

/** Opens the arranging board, for showing several handouts at once (saying how many wait on it). */
export function ShowSeveralButton({ world, sceneIds, className = '' }: { world: World; sceneIds?: string[]; className?: string }) {
  const [open, setOpen] = useState(false)
  const count = world.gmScreen?.board?.items.length ?? 0
  return (
    <>
      <button type="button" className={`show-several ${className}`} onClick={() => setOpen(true)} title="Lay out several pictures, pages and texts, then show them all at once">
        <Ico as={SquaresFour} /> Show several at once…{count > 0 && <span className="muted"> ({count} on the board)</span>}
      </button>
      {open && (
        <Suspense fallback={null}>
          <ArrangeBoard world={world} sceneIds={sceneIds} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
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
export function ShowPanel({ world, sceneText, sceneIds = [] }: { world: World; sceneText?: string; sceneIds?: string[] }) {
  const entities = useVisibleEntities(world.id)
  const shown = useShowablePictures(world.id, entities, sceneIds)
  const [kind, setKind] = useState<'image' | 'page' | 'text'>('image')
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const revealed = entities.filter((e) => e.visibility === 'players')
  const hidden = entities.filter((e) => e.visibility !== 'players' && !e.template)
  const { ask, dialog } = useReview()
  // A page players can't see yet gets the same review as on the page itself, then is revealed and shown (with Undo).
  const showPage = async (p: Entity) => {
    if (p.visibility === 'players') return void showToPlayers(world.id, { kind: 'page', title: p.name, entityId: p.id })
    const ok = await askToReveal(ask, [p], { title: `Reveal “${p.name}” to players and show it?`, note: 'Every player can read it from now on, and it goes on their screens.', confirm: 'Reveal and show' })
    if (!ok) return
    const undo = await revealAndShow(world.id, p)
    toast(`“${p.name}” is revealed and on the players’ screens.`, undo, 'Hide it again')
  }
  return (
    <LecternPanel id="show" sectionId="lectern-show" name="Show players" keywords="handout picture screen tv reveal" title={<><Ico as={Television} /> Show players <Help topic="showPlayers" /></>}>
      {/* Always the same height, so the pictures below don't jump when something is shown. */}
      <div className={`row small show-status ${world.showing || world.spread ? 'on' : ''}`} role="status">
        {world.showing || world.spread ? (
          <>
            <span className="grow-text-line">
              Showing <strong>{world.spread ? spreadTitle(world.spread, world.spread.items.length) : world.showing?.title}</strong>
            </span>
            <button onClick={() => stopShowing(world.id)}>Stop</button>
          </>
        ) : (
          <span className="muted">Nothing on players’ screens.</span>
        )}
      </div>
      <ShowSeveralButton world={world} sceneIds={sceneIds} />
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
          {shown.slice(0, 30).map(({ asset: a, name }) => (
            <Thumb
              key={a.id}
              asset={a}
              name={name}
              on={world.showing?.kind === 'image' && world.showing.assetId === a.id}
              onClick={() => showToPlayers(world.id, { kind: 'image', title: name, assetId: a.id })}
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
            void showPage(p)
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
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="What the players read. Links like [[Page name]] work." />
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
      {dialog}
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

/**
 * The pictures the GM can show, named, newest first, with pictures of this scene's pages first.
 * Never a map picture players mustn't see (their own copy is in the list anyway) or a fog layer.
 */
export function useShowablePictures(worldId: string, entities: Entity[], sceneIds: string[] = []) {
  const images = useLiveQuery(async () => {
    const fogged = await unshowableImages(worldId)
    return db.assets
      .where({ worldId })
      .filter((a) => a.mime.startsWith('image/') && !a.tags.includes('fog') && !fogged.has(a.id))
      .reverse()
      .sortBy('createdAt')
  }, [worldId])
  // A picture is named for the page it belongs to ("Jeb Marrowick"), not its file key ("sil:npc-jeb-marrowick").
  const pageOf = new Map(entities.filter((e) => e.imageId).map((e) => [e.imageId!, e]))
  const inScene = new Set(sceneIds)
  return (images ?? [])
    .map((a) => ({ asset: a, name: pictureName(a.name, pageOf.get(a.id)?.name), first: inScene.has(pageOf.get(a.id)?.id ?? '') }))
    .sort((a, b) => Number(b.first) - Number(a.first))
}

/**
 * What to call a picture: its page's name when a page uses it, else its file name without the
 * ending; a bare key from an older copy of the example world ("sil:npc-jeb-marrowick") reads as words.
 */
function pictureName(fileName: string, pageName?: string) {
  if (pageName) return pageName
  const key = fileName.match(/^[a-z]+:(.+)$/)
  if (!key) return fileName.replace(/\.[^.]+$/, '')
  const words = key[1].replace(/^(npc|loc|f|h|i|item)-/, '').replace(/[-_]+/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** A picture to show, with its name under it (and marked while it's on players' screens). */
export function Thumb({ asset, name, onClick, on }: { asset: Parameters<typeof useBlobUrl>[0]; name: string; onClick: () => void; on?: boolean }) {
  const url = useBlobUrl(asset)
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
  const items = useSpreadItems(world)
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
    <div className={`players-screen world-bare ${items.length ? 'with-spread' : ''}`}>
      {items.length ? (
        <>
          {world.spread?.title && <h1>{world.spread.title}</h1>}
          <SpreadView items={items} worldId={world.id} big />
        </>
      ) : showing ? (
        <>
          {!hiddenPage && <h1>{showing.title}</h1>}
          <ShowingView showing={showing} worldId={world.id} big />
        </>
      ) : (
        <div className="players-screen-idle" role="status">
          <img src={logo} alt="" />
          <h1>{world.name}</h1>
          <p className="muted">Nothing on screen yet. What your GM shows the table appears here.</p>
        </div>
      )}
    </div>
  )
}
