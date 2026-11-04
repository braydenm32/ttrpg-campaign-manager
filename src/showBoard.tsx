import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowsOutSimple, Lock, SquaresFour, Television, Trash } from '@phosphor-icons/react'
import { db, newId, type BoardItem, type Entity, type ShowBoard, type Showing, type World } from './db'
import { useDialog } from './components'
import { Help } from './help'
import { saveFileAsAsset, useVisibleEntities } from './hooks'
import { Ico } from './icons'
import { stripSecrets } from './Markdown'
import { worldPath } from './paths'
import { askToReveal, useReview } from './reveal'
import { sameHandout, showSpread, SpreadPiece, stopShowing, Thumb, titlesInWords, useShowablePictures } from './showing'
import { toast } from './undo'

/**
 * Show several at once: the GM's arranging board. A 16:9 preview of the players' screen where
 * pictures, pages and texts are dropped in, dragged about and resized; nothing reaches players
 * until Show. The board is kept in the world's GM screen (World.gmScreen.board), which the server
 * never sends to players, so it can be filled in during prep and is still there at the table.
 */

const MIN = 8
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round = (v: number) => Math.round(v * 2) / 2

/** Columns for n things on a 16:9 screen, so each gets a roughly square space. */
const COLUMNS = [1, 1, 2, 3, 2, 3, 3, 4, 4, 3]
const columnsFor = (n: number) => COLUMNS[n] ?? Math.ceil(Math.sqrt(n * 1.8))

/** Lines everything up in a grid, in board order, the last row centred. */
function tidy(items: BoardItem[]): BoardItem[] {
  const n = items.length
  if (!n) return items
  const cols = columnsFor(n)
  const rows = Math.ceil(n / cols)
  const gap = 2
  const w = (100 - gap * (cols + 1)) / cols
  const h = (100 - gap * (rows + 1)) / rows
  return items.map((it, i) => {
    const row = Math.floor(i / cols)
    const inRow = row === rows - 1 ? n - row * cols : cols
    const shift = ((cols - inRow) * (w + gap)) / 2
    return { ...it, x: round(gap + (i % cols) * (w + gap) + shift), y: round(gap + row * (h + gap)), w: round(w), h: round(h) }
  })
}

/** Where a new thing goes on a board the GM has arranged by hand: a little down and right of the last one. */
function nextSpot(items: BoardItem[]) {
  const k = items.length % 6
  return { x: 30 + k * 4, y: 22 + k * 4, w: 34, h: 46 }
}

function saveBoard(worldId: string, board: ShowBoard) {
  return db.worlds
    .where('id')
    .equals(worldId)
    .modify((w) => {
      w.gmScreen = { pages: [], rolls: [], ...w.gmScreen, board }
      w.updatedAt = Date.now()
    })
}

type Tray = 'image' | 'page' | 'text' | 'handouts'

export default function ArrangeBoard({ world, onClose, sceneIds = [] }: { world: World; onClose: () => void; sceneIds?: string[] }) {
  const ref = useDialog(onClose)
  const entities = useVisibleEntities(world.id)
  const pictures = useShowablePictures(world.id, entities, sceneIds)
  const [board, setBoard] = useState<ShowBoard>(() => world.gmScreen?.board ?? { items: [], auto: true })
  const [picked, setPicked] = useState<string>()
  const [tray, setTray] = useState<Tray>('image')
  const [text, setText] = useState('')
  const [textTitle, setTextTitle] = useState('')
  const { ask, dialog } = useReview()
  const stage = useRef<HTMLDivElement>(null)
  const latest = useRef(board)
  useLayoutEffect(() => {
    latest.current = board
  })
  const worldId = world.id

  const byId = new Map(entities.map((e) => [e.id, e]))
  // A page deleted since it went on the board just drops off.
  const items = board.items.filter((i) => i.kind !== 'page' || (i.entityId && byId.has(i.entityId)))
  const hiddenPages = items.flatMap((i) => {
    const e = i.kind === 'page' ? byId.get(i.entityId!) : undefined
    return e && e.visibility !== 'players' ? [e] : []
  })
  const live = !!world.spread && world.spread.id === board.shown
  const status = live
    ? board.changed
      ? 'Changed since you showed it: players still see the last version until you update.'
      : 'This is on the players’ screens now.'
    : items.length
      ? 'Players can’t see this yet. Arrange it, then press Show.'
      : 'Add pictures, pages or text from the list, then arrange them.'

  /** Keeps a change: on screen now, and in the world (so it syncs to the GM's other devices). */
  const commit = (next: ShowBoard) => {
    const b = { ...next, changed: next.shown ? true : undefined }
    setBoard(b)
    void saveBoard(world.id, b)
  }
  const change = (fn: (items: BoardItem[]) => BoardItem[], manual = false) => {
    const auto = manual ? false : (board.auto ?? true)
    const next = fn(board.items)
    commit({ ...board, auto, items: auto ? tidy(next) : next })
  }

  const add = (what: Omit<Showing, 'id' | 'at'>) => {
    const there = board.items.find((i) => sameHandout(i, what))
    if (there) {
      setPicked(there.key)
      toast(`“${there.title}” is on the board already.`)
      return
    }
    const key = newId()
    change((list) => [...list, { ...what, key, ...nextSpot(list) }])
    setPicked(key)
  }
  const remove = (key: string) => {
    const before = latest.current
    change((list) => list.filter((i) => i.key !== key))
    setPicked(undefined)
    const gone = before.items.find((i) => i.key === key)
    if (gone) toast(`“${gone.title}” is off the board.`, () => commit(before))
  }
  // Neither moves anything, so a tidy board stays tidy.
  const toFront = (key: string) => commit({ ...board, items: [...board.items.filter((i) => i.key !== key), ...board.items.filter((i) => i.key === key)] })
  const toggleName = (key: string) => commit({ ...board, items: board.items.map((i) => (i.key === key ? { ...i, noTitle: !i.noTitle || undefined } : i)) })
  const clear = () => {
    const before = latest.current
    commit({ ...board, items: [], auto: true })
    setPicked(undefined)
    toast('The board is empty.', () => commit(before))
  }

  // Dragging: moves (or, from the corner, resizes) the thing in percent of the board, on screen only until let go.
  const drag = useRef<{ key: string; mode: 'move' | 'size'; sx: number; sy: number; from: BoardItem; rect: DOMRect; to?: Partial<BoardItem> }>(undefined)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d) return
      const dx = ((e.clientX - d.sx) / d.rect.width) * 100
      const dy = ((e.clientY - d.sy) / d.rect.height) * 100
      const f = d.from
      const spot =
        d.mode === 'move'
          ? { x: round(clamp(f.x + dx, 0, 100 - f.w)), y: round(clamp(f.y + dy, 0, 100 - f.h)) }
          : { w: round(clamp(f.w + dx, MIN, 100 - f.x)), h: round(clamp(f.h + dy, MIN, 100 - f.y)) }
      d.to = spot
      setBoard((b) => ({ ...b, items: b.items.map((i) => (i.key === d.key ? { ...i, ...spot } : i)) }))
    }
    const up = () => {
      const d = drag.current
      if (!d) return
      drag.current = undefined
      const to = d.to
      if (!to || Object.entries(to).every(([k, v]) => d.from[k as keyof BoardItem] === v)) return
      const b = { ...latest.current, auto: false, changed: latest.current.shown ? true : undefined, items: latest.current.items.map((i) => (i.key === d.key ? { ...i, ...to } : i)) }
      setBoard(b)
      void saveBoard(worldId, b)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [worldId])
  const start = (it: BoardItem, mode: 'move' | 'size') => (e: ReactPointerEvent) => {
    if (e.button !== 0 || !stage.current) return
    e.preventDefault()
    e.stopPropagation()
    setPicked(it.key)
    ;(e.currentTarget as HTMLElement).closest<HTMLElement>('.spread-item')?.focus({ preventScroll: true })
    drag.current = { key: it.key, mode, sx: e.clientX, sy: e.clientY, from: it, rect: stage.current.getBoundingClientRect() }
  }
  // The keyboard does the same: arrows move, Shift for bigger steps, + and - resize, Delete takes it off.
  const onKey = (it: BoardItem) => (e: KeyboardEvent) => {
    const step = e.shiftKey ? 5 : 1
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (arrows[e.key]) {
      e.preventDefault()
      const [dx, dy] = arrows[e.key]
      change((list) => list.map((i) => (i.key === it.key ? { ...i, x: clamp(i.x + dx, 0, 100 - i.w), y: clamp(i.y + dy, 0, 100 - i.h) } : i)), true)
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      e.preventDefault()
      const by = e.key === '-' ? -step : step
      change((list) => list.map((i) => (i.key === it.key ? { ...i, w: clamp(i.w + by, MIN, 100 - i.x), h: clamp(i.h + by, MIN, 100 - i.y) } : i)), true)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      remove(it.key)
    }
  }

  const show = async () => {
    if (!items.length) return
    if (hiddenPages.length) {
      const one = hiddenPages.length === 1
      const ok = await askToReveal(ask, hiddenPages, {
        title: one ? `Reveal “${hiddenPages[0].name}” to players and show it with the rest?` : `Reveal ${hiddenPages.length} pages to players and show them with the rest?`,
        note: `Every player can read ${one ? 'it' : 'them'} from now on, and ${one ? 'it goes' : 'they go'} on their screens.`,
        confirm: 'Reveal and show',
      })
      if (!ok) return
    }
    const done = await showSpread(world.id, { ...board, items }, hiddenPages)
    if (!done) return
    const b = { ...latest.current, shown: done.id, changed: undefined }
    setBoard(b)
    await saveBoard(world.id, b)
    toast(
      `${titlesInWords(items.map((i) => i.title))} ${items.length > 1 ? 'are' : 'is'} on the players’ screens.`,
      async () => {
        await done.undo()
        commit({ ...latest.current, shown: undefined })
      },
      hiddenPages.length ? 'Undo (and hide again)' : undefined,
    )
  }

  const sel = items.find((i) => i.key === picked)
  const revealed = entities.filter((e) => e.visibility === 'players' && !e.template)
  const hidden = entities.filter((e) => e.visibility !== 'players' && !e.template)
  const earlier = (world.handouts ?? []).filter((h, i, all) => all.findIndex((x) => sameHandout(x, h)) === i)

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal arrange-modal" role="dialog" aria-modal="true" aria-label="Show several at once" ref={ref} tabIndex={-1}>
        <header>
          <h2>
            <Ico as={SquaresFour} /> Show several at once <Help topic="showSeveral" />
          </h2>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p className={`small arrange-status ${live && !board.changed ? 'on' : ''}`} role="status">
          {status}
        </p>
        <div className="arrange-body">
          <div className="arrange-main">
            <div className="arrange-frame">
              <div className="spread-stage editing" ref={stage} onPointerDown={(e) => e.target === e.currentTarget && setPicked(undefined)}>
                {items.length === 0 && <p className="arrange-empty muted">The players’ screen. Things you add appear here.</p>}
                {items.map((it, n) => {
                  const page = it.kind === 'page' ? byId.get(it.entityId!) : undefined
                  return (
                    <div
                      key={it.key}
                      className={`spread-item kind-${it.kind} ${it.noTitle ? 'no-name' : ''} ${picked === it.key ? 'picked' : ''}`}
                      style={{ left: `${it.x}%`, top: `${it.y}%`, width: `${it.w}%`, height: `${it.h}%`, zIndex: n + 1 }}
                      role="button"
                      tabIndex={0}
                      aria-pressed={picked === it.key}
                      aria-label={`${it.title}. Drag to move it, or use the arrow keys; + and − resize it.`}
                      onPointerDown={start(it, 'move')}
                      onFocus={() => setPicked(it.key)}
                      onKeyDown={onKey(it)}
                    >
                      <SpreadPiece showing={{ ...it, id: it.key, at: 0 }} worldId={world.id} noTitle={it.noTitle} preview />
                      {page && page.visibility !== 'players' && (
                        <span className="spread-lock" title="Not revealed yet: it’s revealed when you show the board">
                          <Ico as={Lock} /> revealed on Show
                        </span>
                      )}
                      <span className="spread-resize" onPointerDown={start(it, 'size')} title="Drag to resize" aria-hidden="true">
                        <Ico as={ArrowsOutSimple} />
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="row wrap arrange-tools">
              {sel ? (
                <>
                  <strong className="grow-text-line">{sel.title}</strong>
                  <button className="small" onClick={() => toFront(sel.key)} disabled={items[items.length - 1]?.key === sel.key}>
                    Bring to front
                  </button>
                  <button className="small" onClick={() => toggleName(sel.key)} aria-pressed={!sel.noTitle}>
                    {sel.noTitle ? 'Show its name' : 'Hide its name'}
                  </button>
                  <button className="small ghost" onClick={() => remove(sel.key)}>
                    <Ico as={Trash} /> Take off
                  </button>
                </>
              ) : (
                <span className="muted small grow-text-line">{items.length ? 'Drag to move, drag a corner to resize, tap one for more.' : ''}</span>
              )}
              {items.length > 1 && (
                <button className="small" onClick={() => commit({ ...board, items: tidy(board.items), auto: true })} title="Line everything up in a grid">
                  Tidy up
                </button>
              )}
              {items.length > 0 && (
                <button className="small ghost" onClick={clear}>
                  Clear
                </button>
              )}
            </div>
          </div>
          <aside className="arrange-tray" aria-label="Add to the board">
            <div className="segmented">
              {(['image', 'page', 'text', 'handouts'] as const).map((k) => (
                <button key={k} className={tray === k ? 'on' : ''} onClick={() => setTray(k)}>
                  {{ image: '🖼️ Picture', page: '📄 Page', text: '📝 Text', handouts: '🗂️ Shown before' }[k]}
                </button>
              ))}
            </div>
            {tray === 'image' && (
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
                      add({ kind: 'image', title: f.name.replace(/\.[^.]+$/, ''), assetId: id })
                      e.target.value = ''
                    }}
                  />
                </label>
                {pictures.slice(0, 40).map(({ asset: a, name }) => (
                  <Thumb key={a.id} asset={a} name={name} on={board.items.some((i) => i.kind === 'image' && i.assetId === a.id)} onClick={() => add({ kind: 'image', title: name, assetId: a.id })} />
                ))}
              </div>
            )}
            {tray === 'page' && (
              <select
                value=""
                aria-label="Add a page"
                onChange={(e) => {
                  const p = entities.find((x) => x.id === e.target.value)
                  if (p) add({ kind: 'page', title: p.name, entityId: p.id })
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
                  <optgroup label="Not revealed yet (revealed when you show)">
                    {hidden.map((p: Entity) => (
                      <option key={p.id} value={p.id}>
                        🔒 {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
            {tray === 'text' && (
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!text.trim()) return
                  add({ kind: 'text', title: textTitle.trim() || 'From your GM', text: stripSecrets(text) })
                  setText('')
                  setTextTitle('')
                }}
              >
                <input value={textTitle} onChange={(e) => setTextTitle(e.target.value)} placeholder="Title, e.g. The ransom note" aria-label="Title" />
                <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="What the players read. Links like [[Page name]] work." aria-label="Text" />
                <button className="primary" disabled={!text.trim()}>
                  Add to the board
                </button>
              </form>
            )}
            {tray === 'handouts' &&
              (earlier.length ? (
                <ul className="arrange-earlier">
                  {earlier.map((h) => (
                    <li key={h.id}>
                      <button className="link" onClick={() => add({ kind: h.kind, title: h.title, assetId: h.assetId, entityId: h.entityId, text: h.text })}>
                        {{ image: '🖼️', page: '📄', text: '📝' }[h.kind]} {h.title}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">Nothing shown yet.</p>
              ))}
          </aside>
        </div>
        <footer className="row wrap arrange-foot">
          <input
            className="arrange-heading"
            value={board.title ?? ''}
            onChange={(e) => setBoard({ ...board, title: e.target.value })}
            onBlur={() => commit(board)}
            placeholder="Heading on the screen (optional)"
            aria-label="Heading on the players’ screen (optional)"
          />
          <button className="primary" onClick={show} disabled={!items.length || (live && !board.changed)}>
            <Ico as={Television} /> {live ? 'Update players’ screen' : items.length > 1 ? `Show all ${items.length}` : 'Show players'}
          </button>
          {(world.spread || world.showing) && <button onClick={() => stopShowing(world.id)}>Stop showing</button>}
          <Link className="small" to={`/screen${worldPath(world.id).slice(2)}`} target="_blank">
            Players’ screen ↗
          </Link>
        </footer>
        {dialog}
      </div>
    </div>
  )
}
