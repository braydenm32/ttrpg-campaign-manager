import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowsOutSimple, Copy, FileText, Image as ImageIcon, Lock, Plus, Scroll, SquaresFour, Television, Trash } from '@phosphor-icons/react'
import { newId, type BoardItem, type Entity, type ShowBoard, type Showing, type World } from './db'
import { useDialog } from './components'
import { Help } from './help'
import { saveFileAsAsset, useVisibleEntities } from './hooks'
import { Ico } from './icons'
import { stripSecrets } from './Markdown'
import { worldPath } from './paths'
import { useReview } from './reveal'
import { A_PICTURE, PicturePicker, pictureName, putUpBoard, sameHandout, SpreadPiece, stopShowing, useShowablePictures } from './showing'
import { blankBoard, boardInHand, deleteShowBoard, freeName, saveShowBoard, showBoardsOf } from './showBoards'
import { toast } from './undo'

/**
 * Show several at once: the GM's arranging board. A 16:9 preview of the players' screen where
 * pictures, pages and texts are dropped in, dragged about and resized; nothing reaches players
 * until Show. A world has as many boards as the GM likes, each named ("Crime scene", "The letters"),
 * kept in the world's GM screen (World.gmScreen.showBoards), which the server never sends to
 * players, so they can be set up in prep and put up with one tap at the table (ShowBoards).
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

type Tray = 'image' | 'page' | 'text' | 'handouts'
/** The same tabs as the Lectern's Show players, with Handouts (shown before) in place of Several. */
const TRAY_TABS: [Tray, string][] = [
  ['image', 'Pictures'],
  ['page', 'Pages'],
  ['text', 'Text'],
  ['handouts', 'Handouts'],
]

export default function ArrangeBoard({
  world,
  onClose,
  sceneIds = [],
  boardId,
  fresh,
}: {
  world: World
  onClose: () => void
  sceneIds?: string[]
  boardId?: string
  /** Open on a new, empty board (the Lectern's "+ New board"). */
  fresh?: boolean
}) {
  const ref = useDialog(onClose)
  const entities = useVisibleEntities(world.id)
  const pictures = useShowablePictures(world.id, entities, sceneIds)
  const saved = showBoardsOf(world)
  // The board open now: the one asked for, else the one in hand, else a new one (kept once something goes on it).
  const [board, setBoard] = useState<ShowBoard>(() => (fresh ? blankBoard(saved) : (saved.find((b) => b.id === boardId) ?? boardInHand(saved, world) ?? blankBoard(saved))))
  const boards = saved.some((b) => b.id === board.id) ? saved.map((b) => (b.id === board.id ? board : b)) : [...saved, board]
  const nameBox = useRef<HTMLInputElement>(null)
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
    const b = { ...next, at: Date.now(), changed: next.shown ? true : undefined }
    setBoard(b)
    void saveShowBoard(world.id, b)
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
  // A picture's name on the players' screen, typed in place (kept when the box is left).
  const retitle = (key: string, title: string) => setBoard({ ...board, items: board.items.map((i) => (i.key === key ? { ...i, title } : i)) })
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
      const b = { ...latest.current, at: Date.now(), auto: false, changed: latest.current.shown ? true : undefined, items: latest.current.items.map((i) => (i.key === d.key ? { ...i, ...to } : i)) }
      setBoard(b)
      void saveShowBoard(worldId, b)
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
    const id = await putUpBoard(world.id, latest.current, entities, ask)
    if (id) setBoard((b) => ({ ...b, shown: id, changed: undefined }))
  }

  // The boards themselves: switch, start a new one, copy or delete this one, rename it.
  const switchTo = (b: ShowBoard) => {
    setBoard(b)
    setPicked(undefined)
  }
  const startNew = () => {
    const b = blankBoard(boards)
    void saveShowBoard(world.id, b)
    switchTo(b)
    setTimeout(() => nameBox.current?.select(), 0)
  }
  const copy = () => {
    const b: ShowBoard = { ...board, id: newId(), name: freeName(boards, `${board.name} (copy)`), at: Date.now(), shown: undefined, changed: undefined, items: board.items.map((i) => ({ ...i, key: newId() })) }
    void saveShowBoard(world.id, b)
    switchTo(b)
    toast(`Copied to “${b.name}”.`)
  }
  const remove_ = async () => {
    const gone = board
    const undo = await deleteShowBoard(world.id, gone.id)
    const rest = boards.filter((b) => b.id !== gone.id)
    switchTo(rest[0] ?? blankBoard(rest))
    toast(`“${gone.name}” is deleted.`, async () => {
      await undo()
      switchTo(gone)
    })
  }
  const rename = (name: string) => setBoard({ ...board, name })
  const keepName = () => commit({ ...board, name: board.name.trim() || freeName(boards.filter((b) => b.id !== board.id), 'Board') })

  const sel = items.find((i) => i.key === picked)
  // The selected picture belongs to a page or map players can't see: that name doesn't go out (showSpread).
  const selSecret = sel?.kind === 'image' ? pictures.find((p) => p.asset.id === sel.assetId)?.secret : undefined
  const givesAway = !!sel && selSecret !== undefined && sel.title.trim().toLowerCase() === selSecret.trim().toLowerCase()
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
        <div className="board-bar" role="group" aria-label="Boards">
          <div className="board-tabs">
            {boards.map((b) => {
              const up = !!world.spread && world.spread.id === b.shown
              return (
                <button key={b.id} className={`chip ${b.id === board.id ? 'on' : ''}`} aria-pressed={b.id === board.id} onClick={() => switchTo(b)} title={up ? 'On players’ screens now' : undefined}>
                  {up && <Ico as={Television} />} {b.name} <span className="muted">· {b.items.length}</span>
                </button>
              )
            })}
            <button className="chip" onClick={startNew}>
              <Ico as={Plus} /> New board
            </button>
          </div>
          <div className="row wrap board-name">
            <input ref={nameBox} value={board.name} onChange={(e) => rename(e.target.value)} onBlur={keepName} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} aria-label="This board’s name (only you see it)" placeholder="Name, e.g. Crime scene" />
            <button className="small" onClick={copy} disabled={!board.items.length}>
              <Ico as={Copy} /> Copy
            </button>
            <button className="small ghost" onClick={remove_} disabled={!saved.some((b) => b.id === board.id)}>
              <Ico as={Trash} /> Delete
            </button>
          </div>
        </div>
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
                  {sel.kind === 'image' ? (
                    <input
                      className="grow-text-line"
                      value={sel.title}
                      maxLength={120}
                      onChange={(e) => retitle(sel.key, e.target.value)}
                      onBlur={() => commit(board)}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      aria-label="What players see this picture called"
                      title={givesAway ? `Players aren’t told that name: it goes out as “${A_PICTURE}” unless you reveal the page first` : 'What players see this picture called'}
                      aria-invalid={givesAway || undefined}
                    />
                  ) : (
                    <strong className="grow-text-line">{sel.title}</strong>
                  )}
                  {givesAway && (
                    <span className="small error" role="status">
                      Players aren’t told that name, so it goes out as “{A_PICTURE}”.
                    </span>
                  )}
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
            <div className="show-tabs" role="tablist" aria-label="What to add">
              {TRAY_TABS.map(([k, label]) => (
                <button key={k} type="button" role="tab" aria-selected={tray === k} className={tray === k ? 'on' : ''} title={k === 'handouts' ? 'Everything you’ve shown before, to add again' : undefined} onClick={() => setTray(k)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="arrange-tray-body" role="tabpanel">
              {tray === 'image' && (
                <PicturePicker
                  pictures={pictures}
                  verb="Add"
                  isOn={(id) => board.items.some((i) => i.kind === 'image' && i.assetId === id)}
                  // Called what players may know it as: "A picture" for one whose page or map they can't see.
                  onPick={(p) => add({ kind: 'image', title: p.title, assetId: p.asset.id })}
                  uploadTitle="Upload a picture and add it to the board"
                  onUpload={async (f) => {
                    const id = await saveFileAsAsset(world.id, f, f.name, ['handout'])
                    add({ kind: 'image', title: pictureName(f.name), assetId: id })
                  }}
                />
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
                  <>
                    <h3 className="show-group">Shown before · {earlier.length}</h3>
                    <ul className="arrange-earlier">
                      {earlier.map((h) => {
                        const on = board.items.some((i) => sameHandout(i, h))
                        return (
                          <li key={h.id}>
                            <button type="button" className={on ? 'on' : ''} aria-pressed={on} title={`Add ${h.title}`} onClick={() => add({ kind: h.kind, title: h.title, assetId: h.assetId, entityId: h.entityId, text: h.text })}>
                              <Ico as={{ image: ImageIcon, page: FileText, text: Scroll }[h.kind]} />
                              <span>{h.title}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="muted small">Nothing shown yet. Everything you show players is kept here, to add again.</p>
                ))}
            </div>
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
