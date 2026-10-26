import { binBoard } from '../bin'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DraftText, Empty } from '../components'
import { db, ENTITY_LABELS, newId, type Board, type BoardCard } from '../db'
import { Help } from '../help'
import { useVisibleEntities, useWorld } from '../hooks'
import { StatusBadge } from '../status'
import { useViewMode } from '../viewMode'

const W = 2400
const H = 1600
const CARD_W = 190
/** Where the string is tied on a card: the pin at its top. */
const pinOf = (c: { x: number; y: number }) => ({ x: c.x + CARD_W / 2, y: c.y + 8 })
const NOTE_COLORS = ['#f6e27a', '#f4a6a6', '#a6d4f4', '#b6e3a8']

/**
 * A corkboard: pin pages and note cards anywhere, drag them about, and tie string between them.
 * GM-only; saved and synced like everything else.
 */
export default function BoardView() {
  const { worldId } = useWorld()
  const { boardId = '' } = useParams()
  const { isGM } = useViewMode()
  const board = useLiveQuery(() => db.boards.get(boardId), [boardId])
  if (board === undefined) return null
  if (!isGM) return <Empty>Corkboards are a GM tool. Switch back to the GM view to use them.</Empty>
  if (board === null || board.worldId !== worldId) return <Empty>Board not found.</Empty>
  return <BoardEditor board={board} worldId={worldId} />
}

function BoardEditor({ board, worldId }: { board: Board; worldId: string }) {
  const navigate = useNavigate()
  const entities = useVisibleEntities(worldId)
  const byId = new Map(entities.map((e) => [e.id, e]))
  const wrap = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; x: number; y: number }>()
  const [connectFrom, setConnectFrom] = useState<string>()
  const [selected, setSelected] = useState<string>()
  const [note, setNote] = useState('')

  /** Changes the board atomically, starting from what's saved. */
  const edit = (fn: (b: Board) => void) =>
    db.boards
      .where('id')
      .equals(board.id)
      .modify((b) => {
        fn(b)
        b.updatedAt = Date.now()
      })

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConnectFrom(undefined)
        setSelected(undefined)
      }
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])

  // Cards being dragged follow the pointer here and are saved when let go.
  const cards = board.cards.map((c) => (drag?.id === c.id ? { ...c, x: drag.x, y: drag.y } : c))
  const cardById = new Map(cards.map((c) => [c.id, c]))

  /** Somewhere in view to put a new card, in a loose grid so new cards don't land on each other. */
  const spot = () => {
    const el = wrap.current
    const n = board.cards.length % 12
    const x = (el ? el.scrollLeft + 40 : 40) + (n % 4) * (CARD_W + 40)
    const y = (el ? el.scrollTop + 40 : 40) + Math.floor(n / 4) * 160
    return { x: Math.round(Math.max(0, Math.min(W - CARD_W, x))), y: Math.round(Math.max(0, Math.min(H - 120, y))) }
  }
  const addCard = (c: Omit<BoardCard, 'id' | 'x' | 'y'>) => edit((b) => void b.cards.push({ id: newId(), ...spot(), ...c }))

  const startDrag = (ev: ReactPointerEvent, c: BoardCard) => {
    if ((ev.target as HTMLElement).closest('button, a, textarea, input, select')) return
    if (connectFrom) return
    ev.currentTarget.setPointerCapture(ev.pointerId)
    setDrag({ id: c.id, dx: ev.clientX - c.x, dy: ev.clientY - c.y, x: c.x, y: c.y })
  }
  const moveDrag = (ev: ReactPointerEvent) => {
    if (!drag) return
    const x = Math.max(0, Math.min(W - CARD_W, ev.clientX - drag.dx))
    const y = Math.max(0, Math.min(H - 60, ev.clientY - drag.dy))
    setDrag({ ...drag, x, y })
  }
  const endDrag = () => {
    if (!drag) return
    const { id, x, y } = drag
    setDrag(undefined)
    edit((b) => {
      const c = b.cards.find((k) => k.id === id)
      if (c) Object.assign(c, { x: Math.round(x), y: Math.round(y) })
    })
  }
  const clickCard = (c: BoardCard) => {
    if (!connectFrom) return
    if (connectFrom !== c.id && !board.strings.some((s) => (s.from === connectFrom && s.to === c.id) || (s.to === connectFrom && s.from === c.id)))
      edit((b) => void b.strings.push({ id: newId(), from: connectFrom, to: c.id }))
    setConnectFrom(undefined)
  }

  const onBoard = new Set(board.cards.map((c) => c.entityId).filter(Boolean))
  const string = board.strings.find((s) => s.id === selected)

  return (
    <div className="page wide board-page">
      <header className="page-header">
        <div>
          <Link to={`/w/${worldId}/boards`}>← Corkboards</Link>
          <h1 className="row">
            📌 <DraftText className="title-input" value={board.name} onCommit={(v) => edit((b) => void (b.name = v))} /> <Help topic="boards" />
          </h1>
        </div>
        <button
          className="danger"
          onClick={async () => {
            if (!confirm(`Delete the board “${board.name}”? The pages on it are kept.`)) return
            await binBoard(board.id)
            navigate(`/w/${worldId}/boards`)
          }}
        >
          Delete board
        </button>
      </header>
      <div className="row wrap board-toolbar">
        <select
          value=""
          onChange={(e) => {
            const id = e.target.value
            if (id) addCard({ entityId: id })
          }}
        >
          <option value="">+ Pin a page…</option>
          {entities
            .filter((e) => !onBoard.has(e.id))
            .map((e) => (
              <option key={e.id} value={e.id}>
                {ENTITY_LABELS[e.type].icon} {e.name}
              </option>
            ))}
        </select>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            if (!note.trim()) return
            addCard({ text: note.trim(), color: NOTE_COLORS[0] })
            setNote('')
          }}
        >
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note card, e.g. ‘Who sent the letter?’" />
          <button disabled={!note.trim()}>+ Note</button>
        </form>
        {connectFrom && (
          <span className="notice small">
            🧶 Now click the card to tie the string to. <button className="link" onClick={() => setConnectFrom(undefined)}>Cancel</button>
          </span>
        )}
        {string && (
          <span className="row small string-edit">
            🧶 String:
            <DraftText value={string.label ?? ''} placeholder="Label, e.g. ‘owes money to’" onCommit={(v) => edit((b) => void (b.strings.find((s) => s.id === string.id)!.label = v || undefined))} />
            <button className="danger" onClick={() => (edit((b) => void (b.strings = b.strings.filter((s) => s.id !== string.id))), setSelected(undefined))}>
              Cut string
            </button>
          </span>
        )}
      </div>
      <div className="board-wrap" ref={wrap}>
        <div className={`board ${connectFrom ? 'connecting' : ''}`} style={{ width: W, height: H }} onClick={(e) => e.target === e.currentTarget && setSelected(undefined)}>
          <svg className="board-strings" width={W} height={H}>
            {board.strings.map((s) => {
              const a = cardById.get(s.from)
              const b = cardById.get(s.to)
              if (!a || !b) return null
              const p = pinOf(a)
              const q = pinOf(b)
              // A little sag, like real string.
              const mx = (p.x + q.x) / 2
              const my = (p.y + q.y) / 2 + Math.min(60, Math.hypot(q.x - p.x, q.y - p.y) / 8)
              const d = `M${p.x},${p.y} Q${mx},${my} ${q.x},${q.y}`
              return (
                <g key={s.id} className={`board-string ${selected === s.id ? 'selected' : ''}`} onClick={() => setSelected(s.id)}>
                  <path d={d} className="hit" />
                  <path d={d} className="line" />
                  {s.label && (
                    <text x={mx} y={(p.y + q.y) / 2 + Math.min(60, Math.hypot(q.x - p.x, q.y - p.y) / 8) / 2 - 6} textAnchor="middle">
                      {s.label}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
          {cards.map((c) => {
            const page = c.entityId ? byId.get(c.entityId) : undefined
            return (
              <div
                key={c.id}
                className={`board-card ${page ? 'page-card' : 'note-card'} ${connectFrom === c.id ? 'connect-from' : ''} ${drag?.id === c.id ? 'dragging' : ''}`}
                style={{ left: c.x, top: c.y, width: CARD_W, background: page ? undefined : c.color }}
                onPointerDown={(ev) => startDrag(ev, c)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onClick={() => clickCard(c)}
              >
                <span className="board-pin" />
                <div className="board-card-tools">
                  <button className="ghost" title="Tie string to another card" onClick={() => setConnectFrom(connectFrom === c.id ? undefined : c.id)}>
                    🧶
                  </button>
                  {!page && c.entityId === undefined && (
                    <button
                      className="ghost"
                      title="Change colour"
                      onClick={() =>
                        edit((b) => {
                          const k = b.cards.find((x) => x.id === c.id)
                          if (k) k.color = NOTE_COLORS[(NOTE_COLORS.indexOf(k.color ?? '') + 1) % NOTE_COLORS.length]
                        })
                      }
                    >
                      🎨
                    </button>
                  )}
                  <button
                    className="ghost"
                    title="Take off the board"
                    onClick={() =>
                      edit((b) => {
                        b.cards = b.cards.filter((x) => x.id !== c.id)
                        b.strings = b.strings.filter((s) => s.from !== c.id && s.to !== c.id)
                      })
                    }
                  >
                    ✕
                  </button>
                </div>
                {page ? (
                  <>
                    <Link to={`/w/${worldId}/e/${page.id}`}>
                      <strong>
                        {ENTITY_LABELS[page.type].icon} {page.name}
                      </strong>
                    </Link>
                    <StatusBadge entity={page} />
                    {page.summary && <div className="small muted">{page.summary}</div>}
                  </>
                ) : c.entityId ? (
                  <em className="muted small">A page that’s been deleted</em>
                ) : (
                  <DraftText
                    multiline
                    rows={3}
                    value={c.text ?? ''}
                    onCommit={(v) =>
                      edit((b) => {
                        const k = b.cards.find((x) => x.id === c.id)
                        if (k) k.text = v
                      })
                    }
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
