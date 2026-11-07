import logo from './assets/logo.svg'
import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Help } from './help'
import { LecternPanel } from './lecternPanel'
import { db, newId, saveEntity, type Asset, type Entity, type ShowBoard, type Showing, type Spot, type Spread, type World, type WorldMap } from './db'
import { saveFileAsAsset, useAssetUrl, useBlobUrl, useVisibleEntities } from './hooks'
import { Markdown, stripSecrets } from './Markdown'
import { schedule } from './cloud/sync'
import { useRecordingOnThisDevice } from './cloud/table'
import { Ico } from './icons'
import { ArrowSquareOut, Lock, Scroll, SquaresFour, Television } from '@phosphor-icons/react'
import { Modal, useDialog } from './components'
import { worldPath } from './paths'
import { askToReveal, useReview } from './reveal'
import { saveFailed, toast } from './undo'
import { offerGroupPost } from './groupPost'
import { saveShowBoard, showBoardsOf } from './showBoards'
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
  return unshowableIn(await db.maps.where({ worldId }).toArray())
}

function unshowableIn(maps: WorldMap[]) {
  const instead = new Map<string, string | undefined>()
  for (const m of maps) {
    if (m.fog?.on) {
      instead.set(m.imageId, m.fog.imageId)
      if (m.playerImageId) instead.set(m.playerImageId, m.fog.imageId)
    } else if (m.playerImageId) instead.set(m.imageId, m.playerImageId)
  }
  return instead
}

/** What a shown picture is called when it belongs to a page or map players can't see. */
export const A_PICTURE = 'A picture'

/** What players would see a picture called, and the name of the GM-only page or map it belongs to, if any (that name they mustn't see). */
export interface PictureTitle {
  title: string
  secret?: string
  /** It belongs to no page players can't see, but its file is named after one ("sister-vey.png"). */
  byFile?: boolean
}

const mapPictures = (m: Pick<WorldMap, 'imageId' | 'playerImageId' | 'fog'>) => [m.imageId, m.playerImageId, m.fog?.imageId]
const seenByPlayers = (e: Entity) => e.visibility === 'players' && !e.template
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
/** A name's words, any case, whatever is between them ("sister-vey_2.png": sister, vey, 2, png). */
const wordsOf = (s: string) => s.normalize('NFKC').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)

/**
 * Names pictures for players, given all of a world's pages and maps. A picture is called after a
 * page players can see that uses it; one that belongs only to pages or maps players can't see is
 * "A picture" (its file is usually named after that page too, so neither name will do), for the GM
 * to call something else before showing. Anything else goes by its file's name, unless that name
 * has a page's or map's name in it that players aren't told (an old portrait, "Sister Vey 2.png").
 */
export function pictureTitles(pages: Entity[], maps: WorldMap[]) {
  const pagesOf = new Map<string, Entity[]>()
  for (const e of pages) if (e.imageId) pagesOf.set(e.imageId, [...(pagesOf.get(e.imageId) ?? []), e])
  const hiddenMap = new Map<string, string>()
  for (const m of maps) if (m.visibility !== 'players') for (const id of mapPictures(m)) if (id) hiddenMap.set(id, m.name)
  // Names players aren't told: of pages and maps they can't see, unless something they can see is called that too.
  const known = [...pages.filter(seenByPlayers).map((e) => e.name), ...maps.filter((m) => m.visibility === 'players').map((m) => m.name)]
  const secrets = [...pages.filter((e) => !seenByPlayers(e)).map((e) => e.name), ...maps.filter((m) => m.visibility !== 'players').map((m) => m.name)]
    .filter((n) => n.trim() && !known.some((k) => sameName(k, n)))
    .map((name) => ({ name, words: wordsOf(name) }))
  // A file "named after" one: its whole name, word for word (a short one like "Ash" only as the file's whole name, not in "ash-tree.png").
  const namedAfter = (file: string) => {
    const words = wordsOf(file)
    return secrets.find((s) => sameName(file, s.name) || (s.name.trim().length >= 4 && s.words.length > 0 && words.some((_, i) => s.words.every((w, j) => words[i + j] === w))))?.name
  }
  return (asset: Pick<Asset, 'id' | 'name'>): PictureTitle => {
    const users = pagesOf.get(asset.id) ?? []
    const seen = users.find(seenByPlayers)
    if (seen) return { title: seen.name }
    const secret = users[0]?.name ?? hiddenMap.get(asset.id)
    if (secret !== undefined) return { title: A_PICTURE, secret }
    const file = pictureName(asset.name)
    const after = file ? namedAfter(file) : undefined
    return after !== undefined ? { title: A_PICTURE, secret: after, byFile: true } : { title: file || A_PICTURE }
  }
}

/** The same for one picture, read from this device's copy of the world. */
export async function pictureTitleOf(worldId: string, assetId: string): Promise<PictureTitle> {
  const [asset, pages, maps] = await Promise.all([db.assets.get(assetId), db.entities.where({ worldId }).toArray(), db.maps.where({ worldId }).toArray()])
  return pictureTitles(pages, maps)(asset ?? { id: assetId, name: '' })
}

/**
 * A picture's heading as it goes out: never the name of a page or map players can't see that uses
 * the picture ("A picture" instead), nor a file name that's after one, whichever way it's shown (an
 * older handout or board too). If players should know that name, the GM reveals the page.
 */
async function headingForPlayers(worldId: string, assetIds: string[], title: string) {
  if (!title.trim()) return title
  const ids = new Set(assetIds)
  const [pages, maps, assets] = await Promise.all([db.entities.where({ worldId }).toArray(), db.maps.where({ worldId }).toArray(), db.assets.bulkGet([...ids])])
  const users = pages.filter((e) => !!e.imageId && ids.has(e.imageId))
  const known = users.filter(seenByPlayers).map((e) => e.name)
  const secret = [
    ...users.filter((e) => !seenByPlayers(e)).map((e) => e.name),
    ...maps.filter((m) => m.visibility !== 'players' && mapPictures(m).some((id) => !!id && ids.has(id))).map((m) => m.name),
  ]
  if (secret.some((n) => sameName(n, title)) && !known.some((n) => sameName(n, title))) return A_PICTURE
  // Still called by its file's name, and that's after a page or map players can't see.
  const titleOf = pictureTitles(pages, maps)
  return assets.some((a) => !!a && sameName(title, pictureName(a.name)) && titleOf(a).byFile) ? A_PICTURE : title
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
  if (s.kind === 'image' && what.assetId) s = { ...s, title: await headingForPlayers(worldId, [what.assetId, s.assetId!], s.title) }
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
    if (what.kind === 'image' && it.assetId) what.title = await headingForPlayers(worldId, [it.assetId, what.assetId!], what.title)
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

/**
 * Puts a board up on players' screens: pages on it not revealed yet get the usual review first, then
 * everything goes up as arranged, with Undo. Returns the spread's id, or undefined if nothing went up.
 */
export async function putUpBoard(worldId: string, board: ShowBoard, entities: Entity[], ask: Parameters<typeof askToReveal>[0]) {
  const byId = new Map(entities.map((e) => [e.id, e]))
  // A page deleted since it went on the board just drops off.
  const items = board.items.filter((i) => i.kind !== 'page' || (!!i.entityId && byId.has(i.entityId)))
  if (!items.length) return undefined
  const hidden = items.flatMap((i) => {
    const e = i.kind === 'page' ? byId.get(i.entityId!) : undefined
    return e && e.visibility !== 'players' ? [e] : []
  })
  if (hidden.length) {
    const one = hidden.length === 1
    const ok = await askToReveal(ask, hidden, {
      title: one ? `Reveal “${hidden[0].name}” to players and show it with the rest?` : `Reveal ${hidden.length} pages to players and show them with the rest?`,
      note: `Every player can read ${one ? 'it' : 'them'} from now on, and ${one ? 'it goes' : 'they go'} on their screens.`,
      confirm: 'Reveal and show',
    })
    if (!ok) return undefined
  }
  const done = await showSpread(worldId, { ...board, items }, hidden)
  if (!done) return undefined
  await saveShowBoard(worldId, { ...board, shown: done.id, changed: undefined })
  toast(`${titlesInWords(items.map((i) => i.title))} ${items.length > 1 ? 'are' : 'is'} on the players’ screens.`, done.undo, hidden.length ? 'Undo (and hide again)' : undefined)
  return done.id
}

/**
 * The GM's boards, each ready to go up with one tap, and the way to the arranging screen (to make
 * or change one). On the Lectern and in Handouts.
 */
export function ShowBoards({ world, sceneIds, newBoard }: { world: World; sceneIds?: string[]; /** "+ New board" opens an empty board (the Lectern's tab). */ newBoard?: boolean }) {
  const entities = useVisibleEntities(world.id)
  const { ask, dialog } = useReview()
  // Which board the arranging screen opens on: one picked here, or (null) the board in hand.
  const [open, setOpen] = useState<string | null>()
  const [fresh, setFresh] = useState(false)
  const boards = showBoardsOf(world).filter((b) => b.items.length)
  return (
    <div className="show-boards">
      {boards.length > 0 && (
        <ul className="show-board-list" aria-label="Boards ready to show">
          {boards.map((b) => {
            const live = !!world.spread && world.spread.id === b.shown
            return (
              <li key={b.id} className={live ? 'on' : ''}>
                <button
                  className="show-board-go"
                  disabled={live && !b.changed}
                  aria-pressed={live}
                  title={live ? (b.changed ? 'Show the changes on players’ screens' : 'On players’ screens now') : `Put all ${b.items.length} on players’ screens`}
                  onClick={() => putUpBoard(world.id, b, entities, ask)}
                >
                  <Ico as={Television} /> <span className="grow-text-line">{b.name}</span>
                  <span className="muted small">{live ? (b.changed ? 'update' : 'showing') : b.items.length}</span>
                </button>
                <button className="ghost small" onClick={() => setOpen(b.id)} aria-label={`Arrange ${b.name}`}>
                  Arrange
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {newBoard ? (
        <button
          type="button"
          className="show-several new-board"
          onClick={() => {
            setFresh(true)
            setOpen(null)
          }}
        >
          + New board
        </button>
      ) : (
        <button type="button" className="show-several" onClick={() => setOpen(null)} title="Lay out several pictures, pages and texts, then show them all at once">
          <Ico as={SquaresFour} /> {boards.length ? 'Boards for showing several…' : 'Show several at once…'}
        </button>
      )}
      {open !== undefined && (
        <Suspense fallback={null}>
          <ArrangeBoard
            world={world}
            sceneIds={sceneIds}
            boardId={open ?? undefined}
            fresh={fresh && open === null}
            onClose={() => {
              setOpen(undefined)
              setFresh(false)
            }}
          />
        </Suspense>
      )}
      {dialog}
    </div>
  )
}

/**
 * A one-click "show this" button, for pages and pictures. A picture goes out called what players
 * may know it as (pictureTitles), asking first when it belongs to a page or map they can't see.
 */
export function ShowButton({ worldId, what, disabled }: { worldId: string; what: Omit<Showing, 'id' | 'at'>; disabled?: string }) {
  const { askTitle, dialog } = usePictureTitle()
  const show = async () => {
    if (what.kind !== 'image' || !what.assetId) return void showToPlayers(worldId, what)
    const title = await askTitle(await pictureTitleOf(worldId, what.assetId))
    if (title !== null) await showToPlayers(worldId, { ...what, title })
  }
  return (
    <>
      <button type="button" title={disabled || 'Put this on every player’s screen'} disabled={!!disabled} onClick={show}>
        <Ico as={Television} /> Show players
      </button>
      {dialog}
    </>
  )
}

/**
 * Before showing the picture of a page or map players can't see: asks what players should see it
 * called ("A picture" to start with), since its own name would give the secret away. `askTitle`
 * answers with the title, or null for Cancel; any other picture's title comes straight back.
 */
export function usePictureTitle() {
  const [open, setOpen] = useState<{ pic: PictureTitle; done: (title: string | null) => void }>()
  const askTitle = (pic: PictureTitle) =>
    pic.secret === undefined
      ? Promise.resolve(pic.title)
      : new Promise<string | null>((resolve) =>
          setOpen({
            pic,
            done: (title) => {
              setOpen(undefined)
              resolve(title)
            },
          }),
        )
  const dialog = open ? <PictureTitleDialog pic={open.pic} onDone={open.done} /> : null
  return { askTitle, dialog }
}

function PictureTitleDialog({ pic, onDone }: { pic: PictureTitle; onDone: (title: string | null) => void }) {
  const [title, setTitle] = useState(pic.title)
  // Its own name would give it away: reveal the page for that.
  const givesAway = !!pic.secret && sameName(title, pic.secret)
  return (
    <Modal title="Show this picture?" onClose={() => onDone(null)}>
      <form
        className="form review-step"
        onSubmit={(e) => {
          e.preventDefault()
          if (!givesAway) onDone(title.trim() || A_PICTURE)
        }}
      >
        <p className="small">
          {pic.byFile ? 'Its file is named after' : 'It’s the picture of'} “{pic.secret}”, which players can’t see, so they aren’t told that name. <Help topic="pictureTitle" />
        </p>
        <label>
          What players see it called
          <input autoFocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} onFocus={(e) => e.target.select()} aria-invalid={givesAway} />
        </label>
        {givesAway && (
          <p className="error small" role="alert">
            That’s the name players don’t know yet. To show it, reveal the page first.
          </p>
        )}
        <div className="row end wrap review-step-buttons">
          <button type="button" onClick={() => onDone(null)}>
            Cancel
          </button>
          <button className="primary" disabled={givesAway}>
            <Ico as={Television} /> Show players
          </button>
        </div>
      </form>
    </Modal>
  )
}

type ShowTab = 'image' | 'page' | 'text' | 'boards'
const SHOW_TABS: [ShowTab, string][] = [
  ['image', 'Pictures'],
  ['page', 'Pages'],
  ['text', 'Text'],
  ['boards', 'Several'],
]
/** Pictures listed before "Show all". */
const FIRST_PICTURES = 8

/**
 * The Lectern's panel: what's on players' screens (with Stop) at the top, then tabs to pick a
 * picture (this scene's first, with a search), a page (revealing it if need be), some text, or a
 * board of several at once. The players' TV screen opens from the button in the heading.
 */
export function ShowPanel({ world, sceneText, sceneIds = [] }: { world: World; sceneText?: string; sceneIds?: string[] }) {
  const entities = useVisibleEntities(world.id)
  const pictures = useShowablePictures(world.id, entities, sceneIds)
  const [tab, setTab] = useState<ShowTab>('image')
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const revealed = entities.filter((e) => e.visibility === 'players')
  const hidden = entities.filter((e) => e.visibility !== 'players' && !e.template)
  const { ask, dialog } = useReview()
  const { askTitle, dialog: titleDialog } = usePictureTitle()
  // The picture of a page players can't see goes out under a name they may know (asked first).
  const showPicture = async (p: Showable) => {
    const title = await askTitle(p)
    if (title !== null) await showToPlayers(world.id, { kind: 'image', title, assetId: p.asset.id })
  }
  // A page players can't see yet gets the same review as on the page itself, then is revealed and shown (with Undo).
  const showPage = async (p: Entity) => {
    if (p.visibility === 'players') return void showToPlayers(world.id, { kind: 'page', title: p.name, entityId: p.id })
    const ok = await askToReveal(ask, [p], { title: `Reveal “${p.name}” to players and show it?`, note: 'Every player can read it from now on, and it goes on their screens.', confirm: 'Reveal and show' })
    if (!ok) return
    const undo = await revealAndShow(world.id, p)
    toast(`“${p.name}” is revealed and on the players’ screens.`, undo, 'Hide it again')
  }
  const live = !!(world.showing || world.spread)
  return (
    <LecternPanel
      id="show"
      sectionId="lectern-show"
      name="Show players"
      keywords="handout picture screen tv reveal several board"
      title={<><Ico as={Television} /> Show players <Help topic="showPlayers" /></>}
      extra={
        <>
          {/* Nothing up needs no words on screen (no Stop strip says it); a screen reader still hears it. */}
          <span className={live ? 'show-live on' : 'sr-only'} role="status">
            {live ? 'Live' : 'Nothing on screen'}
          </span>
          <Link
            className="button show-tv"
            to={`/screen${worldPath(world.id).slice(2)}`}
            target="_blank"
            aria-label="Open the players’ screen (for a TV)"
            title="Open the players’ screen, for a TV or second monitor at the table"
          >
            <Ico as={ArrowSquareOut} />
          </Link>
        </>
      }
    >
      {live && <NowShowing world={world} />}
      <div className="show-tabs" role="tablist" aria-label="What to show">
        {SHOW_TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} title={k === 'boards' ? 'Several at once: boards laid out ahead of time' : undefined} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'image' && (
        <PicturePicker
          pictures={pictures}
          isOn={(id) => world.showing?.kind === 'image' && world.showing.assetId === id}
          onPick={(p) => void showPicture(p)}
          uploadTitle="Upload a picture and show it"
          onUpload={async (f) => {
            let id: string
            try {
              id = await saveFileAsAsset(world.id, f, f.name, ['handout'])
            } catch (err) {
              return saveFailed(`“${f.name}”`, err)
            }
            // Called by its file's name, unless that's after a page players can't see: then asked first.
            const title = await askTitle(await pictureTitleOf(world.id, id))
            if (title !== null) await showToPlayers(world.id, { kind: 'image', title, assetId: id })
          }}
        />
      )}
      {tab === 'page' && (
        <select
          value=""
          aria-label="Pick a page to show"
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
      {tab === 'text' && (
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
      {tab === 'boards' && (
        <div className="show-boards-tab">
          <p className="muted small">
            Lay out a few pictures, pages and notes ahead of time, then put the whole board up with one tap. <Help topic="showSeveral" />
          </p>
          <ShowBoards world={world} sceneIds={sceneIds} newBoard />
        </div>
      )}
      {dialog}
      {titleDialog}
      {!!world.handouts?.length && (
        <div className="show-foot small">
          <Link to={`${worldPath(world.id)}/handouts`}>Handouts ({world.handouts.length})</Link>
          <span className="muted">Everything you’ve shown, to show again</span>
        </div>
      )}
    </LecternPanel>
  )
}

type Showable = ReturnType<typeof useShowablePictures>[number]

/**
 * Picking a picture, the same in the Lectern's Show players and on the arranging board: a search and
 * Upload, this scene's pictures first, then the first few of the rest with "Show all".
 */
export function PicturePicker({
  pictures,
  isOn,
  onPick,
  onUpload,
  verb = 'Show',
  uploadTitle,
}: {
  pictures: Showable[]
  isOn: (assetId: string) => boolean
  /** The picture picked, with what players would see it called (title) and the name they mustn't (secret). */
  onPick: (picture: Showable) => void
  onUpload: (file: File) => Promise<void>
  /** What a tap does, for each picture's tip ("Show Jeb", "Add Jeb"). */
  verb?: string
  uploadTitle: string
}) {
  const [find, setFind] = useState('')
  const [all, setAll] = useState(false)
  const needle = find.trim().toLowerCase()
  const found = needle ? pictures.filter(({ asset, name }) => [name, asset.name, ...asset.tags].some((x) => x.toLowerCase().includes(needle))) : pictures
  const scene = needle ? [] : found.filter((p) => p.first)
  const rest = needle ? found : found.filter((p) => !p.first)
  const listed = all || needle ? rest : rest.slice(0, FIRST_PICTURES)
  const thumb = (p: Showable) => <Thumb key={p.asset.id} asset={p.asset} name={p.name} verb={verb} on={isOn(p.asset.id)} secret={p.secret !== undefined} onClick={() => onPick(p)} />
  return (
    <div className="show-pictures">
      <div className="row show-find">
        <input type="search" className="search" placeholder="Find a picture…" aria-label="Find a picture" value={find} onChange={(e) => setFind(e.target.value)} />
        <label className="button" title={uploadTitle}>
          + Upload
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              await onUpload(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      {pictures.length === 0 ? (
        <p className="muted small">No pictures in this world yet. Upload one here, or in More › Files.</p>
      ) : found.length === 0 ? (
        <p className="muted small">No picture’s name or tag has “{find.trim()}” in it.</p>
      ) : (
        <>
          {scene.length > 0 && (
            <>
              <h3 className="show-group">This scene</h3>
              <div className="show-thumbs show-pics">{scene.map(thumb)}</div>
            </>
          )}
          {rest.length > 0 && (
            <>
              <h3 className="show-group">{needle ? `Found · ${rest.length}` : `${scene.length ? 'All pictures' : 'Pictures'} · ${rest.length}`}</h3>
              <div className="show-thumbs show-pics">{listed.map(thumb)}</div>
            </>
          )}
          {listed.length < rest.length && (
            <button type="button" className="show-all-pics" onClick={() => setAll(true)}>
              Show all {rest.length}
            </button>
          )}
        </>
      )}
    </div>
  )
}

/** What's on players' screens now, with a big Stop: a picture's thumbnail, else an icon. */
function NowShowing({ world }: { world: World }) {
  const showing = world.spread ? undefined : world.showing
  const entities = useVisibleEntities(world.id)
  const page = showing?.kind === 'page' ? entities.find((e) => e.id === showing.entityId) : undefined
  const picture = useAssetUrl(showing?.kind === 'image' ? showing.assetId : page?.imageId)
  const what = world.spread ? spreadTitle(world.spread, world.spread.items.length) : showing?.title
  return (
    <div className="now-showing" role="status">
      <span className="now-showing-pic" aria-hidden="true">
        {picture ? <img src={picture} alt="" /> : <Ico as={world.spread ? SquaresFour : showing?.kind === 'text' ? Scroll : Television} />}
      </span>
      <span className="now-showing-what">
        <span className="muted small">On players’ screens</span>
        <strong>{what || 'Untitled'}</strong>
      </span>
      <button type="button" className="primary" onClick={() => stopShowing(world.id)}>
        Stop
      </button>
    </div>
  )
}

/**
 * The pictures the GM can show, named, newest first, with pictures of this scene's pages first.
 * Never a map picture players mustn't see (their own copy is in the list anyway) or a fog layer.
 * Each has the GM's name for it (name), what players would see it called (title) and, for the
 * picture of a page or map players can't see, that page's or map's name (secret).
 */
export function useShowablePictures(worldId: string, entities: Entity[], sceneIds: string[] = []) {
  const found = useLiveQuery(async () => {
    const maps = await db.maps.where({ worldId }).toArray()
    const fogged = unshowableIn(maps)
    const [images, pages] = await Promise.all([
      db.assets
        .where({ worldId })
        .filter((a) => a.mime.startsWith('image/') && !a.tags.includes('fog') && !fogged.has(a.id))
        .reverse()
        .sortBy('createdAt'),
      // Every page, hidden and template ones too, so none of their names slips out (by a picture, or a file named after one).
      db.entities.where({ worldId }).toArray(),
    ])
    return { images, titleOf: pictureTitles(pages, maps) }
  }, [worldId])
  // A picture is named for the page it belongs to ("Jeb Marrowick"), not its file key ("sil:npc-jeb-marrowick").
  const pageOf = new Map(entities.filter((e) => e.imageId).map((e) => [e.imageId!, e]))
  const inScene = new Set(sceneIds)
  return (found?.images ?? [])
    .map((a) => ({ asset: a, name: pictureName(a.name, pageOf.get(a.id)?.name), ...found!.titleOf(a), first: inScene.has(pageOf.get(a.id)?.id ?? '') }))
    .sort((a, b) => Number(b.first) - Number(a.first))
}

/**
 * What to call a picture: its page's name when a page uses it, else its file name without the
 * ending; a bare key from an older copy of the example world ("sil:npc-jeb-marrowick") reads as words.
 */
export function pictureName(fileName: string, pageName?: string) {
  if (pageName) return pageName
  const key = fileName.match(/^[a-z]+:(.+)$/)
  if (!key) return fileName.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() || fileName
  const words = key[1].replace(/^(npc|loc|f|h|i|item)-/, '').replace(/[-_]+/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** A picture to show, with its name under it (and marked while it's on players' screens). */
export function Thumb({
  asset,
  name,
  onClick,
  on,
  verb = 'Show',
  secret,
}: {
  asset: Parameters<typeof useBlobUrl>[0]
  name: string
  onClick: () => void
  on?: boolean
  /** What a tap does, for its tip ("Show Jeb", "Use Jeb"). */
  verb?: string
  /** The picture of a page or map players can't see: marked with a lock, as players aren't told its name. */
  secret?: boolean
}) {
  const url = useBlobUrl(asset)
  return (
    <button type="button" className={`show-thumb named ${on ? 'on' : ''}`} title={`${verb} ${name}${secret ? ' (players aren’t told its name)' : ''}`} aria-pressed={on} onClick={onClick}>
      <span className="thumb-img">{url && <img src={url} alt="" loading="lazy" />}</span>
      <span className="thumb-name">
        {secret && <Ico as={Lock} />}
        {secret && <span className="sr-only">Hidden from players: </span>}
        {name}
      </span>
    </button>
  )
}

/** "This session is being recorded", for players: on the players' screen and in the Common Room while the GM's app records. */
export function BeingRecorded({ help }: { help?: boolean }) {
  return (
    <p className="recording-bar being-recorded" role="status">
      <span className="rec-dot" aria-hidden="true" /> This session is being recorded {help && <Help topic="beingRecorded" />}
    </p>
  )
}

/** The players' screen: a full window showing only what's being shown. Opened from the Lectern for a TV. */
export function PlayersScreen({ world }: { world: World }) {
  const showing = world.showing
  const entities = useVisibleEntities(world.id)
  const items = useSpreadItems(world)
  // A page hidden again since it was shown keeps its name to itself too.
  const hiddenPage = showing?.kind === 'page' && !entities.some((e) => e.id === showing.entityId && e.visibility === 'players')
  // The table is told while this device records the session (the GM's own windows don't say it).
  const recording = useRecordingOnThisDevice(world.id)
  // Keep the screen awake while it's up, where the browser allows it.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request('screen').then((l) => (lock = l), () => {})
    return () => void lock?.release()
  }, [])
  return (
    <div className={`players-screen world-bare ${items.length ? 'with-spread' : ''}`}>
      {recording && <BeingRecorded />}
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
