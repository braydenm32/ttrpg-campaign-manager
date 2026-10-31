import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Empty } from '../components'
import { ENTITY_LABELS, type Entity } from '../db'
import { Help } from '../help'
import { useVisibleEntities, useWorld } from '../hooks'
import { familyOf, linksOf, toneOf } from '../relations'
import { useViewMode } from '../viewMode'
import { Ico, TypeIcon } from '../icons'
import { Graph } from '@phosphor-icons/react'
import { pagePath } from '../paths'
import { useCharacterOwners } from '../players/owners'

interface Edge {
  id: string
  from: string
  to: string
  kind: string
}

type Pos = Record<string, { x: number; y: number }>

/**
 * The relationship web: every page with a link, drawn as a web you can drag about, plus a family
 * tree drawn by generation. Click someone to focus on them and the people around them.
 */
export default function RelationWeb() {
  const { worldId } = useWorld()
  const { isGM, previewAs } = useViewMode()
  const { world } = useWorld()
  const entities = useVisibleEntities(worldId)
  const { owners } = useCharacterOwners(world)
  const [params, setParams] = useSearchParams()
  const asked = params.get('focus') ?? ''
  const mode = params.get('view') === 'family' ? 'family' : 'web'
  // Each change of view or of who's in the middle is a step back can return to.
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next)
  }

  const byId = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities])
  const allEdges = useMemo(() => {
    const out: Edge[] = []
    for (const e of entities) for (const r of e.relations ?? []) if (byId.has(r.to)) out.push({ id: r.id, from: e.id, to: r.to, kind: r.kind })
    return out
  }, [entities, byId])
  // Which kinds of page to draw. A big world starts with just its people and factions, or the web is a tangle.
  const big = new Set(allEdges.flatMap((x) => [x.from, x.to])).size > 60
  const show = (params.get('show') ?? (big ? 'people' : 'all')) as keyof typeof SHOW
  const edges = useMemo(() => {
    const types = SHOW[show]?.types
    return types ? allEdges.filter((x) => types.includes(byId.get(x.from)!.type) && types.includes(byId.get(x.to)!.type)) : allEdges
  }, [allEdges, byId, show])

  // It opens on one person, not a tangle of everyone: a player's own character, else the most
  // connected player character, else the most connected page. "Everyone" is a choice (focus=all).
  const linked = useMemo(() => {
    const n = new Map<string, number>()
    for (const x of mode === 'family' ? edges.filter((x) => familyOf(x.kind)) : edges) for (const id of [x.from, x.to]) n.set(id, (n.get(id) ?? 0) + 1)
    return n
  }, [edges, mode])
  const mine = entities.find(
    (e) => e.type === 'pc' && linked.has(e.id) && (owners.get(e.id)?.mine || previewAs?.characterNames.some((n) => n.toLowerCase() === e.name.toLowerCase())),
  )
  const most = (pick: (e: Entity) => boolean) => [...linked.entries()].filter(([id]) => byId.get(id) && pick(byId.get(id)!)).sort((a, b) => b[1] - a[1])[0]?.[0]
  const focus = asked === 'all' ? '' : asked && byId.has(asked) ? asked : (mine?.id ?? (linked.size > 12 ? (most((e) => e.type === 'pc') ?? most(() => true) ?? '') : ''))

  const shownEdges = useMemo(() => {
    const list = mode === 'family' ? edges.filter((x) => familyOf(x.kind)) : edges
    if (!focus) return list
    // Around one person: everyone within two steps (the whole family, for the tree).
    const near = new Set([focus])
    for (let step = 0; step < (mode === 'family' ? 50 : 2); step++)
      for (const x of list)
        if (near.has(x.from) || near.has(x.to)) {
          near.add(x.from)
          near.add(x.to)
        }
    return list.filter((x) => near.has(x.from) && near.has(x.to))
  }, [edges, focus, mode])
  const nodeIds = useMemo(() => [...new Set(shownEdges.flatMap((x) => [x.from, x.to]))], [shownEdges])

  const focused = focus ? byId.get(focus) : undefined
  const people = entities.filter((e) => edges.some((x) => x.from === e.id || x.to === e.id))

  return (
    <div className="page wide">
      <header className="page-header">
        <h1>
          <Ico as={Graph} /> Relationship web <Help topic="relationWeb" />
        </h1>
        <div className="row wrap">
          <div className="segmented">
            <button className={mode === 'web' ? 'on' : ''} onClick={() => setParam('view', '')}>
              Web
            </button>
            <button className={mode === 'family' ? 'on' : ''} onClick={() => setParam('view', 'family')}>
              🌳 Family tree
            </button>
          </div>
          <select value={show} onChange={(e) => setParam('show', e.target.value)} aria-label="Which pages to show">
            {Object.entries(SHOW).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <select value={focus || 'all'} onChange={(e) => setParam('focus', e.target.value)} aria-label="Who’s in the middle">
            <option value="all">Everyone</option>
            {people.map((e) => (
              <option key={e.id} value={e.id}>
                Around {e.name}
              </option>
            ))}
          </select>
        </div>
      </header>
      {nodeIds.length === 0 ? (
        <Empty>
          {mode === 'family'
            ? 'No family links yet. On a character’s page, use Relationships to add “parent of”, “married to” or “sibling of”.'
            : isGM
              ? 'No links yet. Open any page and use the Relationships box to say who knows, serves, loves or hates whom.'
              : 'Your GM hasn’t shared any relationships yet.'}
        </Empty>
      ) : (
        <div className="web-layout">
          {mode === 'web' ? (
            <WebGraph key={nodeIds.join(',')} nodeIds={nodeIds} edges={shownEdges} byId={byId} focus={focus} onPick={(id) => setParam('focus', id)} />
          ) : (
            <FamilyTree nodeIds={nodeIds} edges={shownEdges} byId={byId} focus={focus} onPick={(id) => setParam('focus', id)} />
          )}
          {focused && (
            <aside className="web-side card">
              <h2>
                <Link to={`${pagePath(worldId, focused.id)}`}>
                  <TypeIcon type={focused.type} /> {focused.name}
                </Link>
              </h2>
              {focused.summary && <p className="muted">{focused.summary}</p>}
              <ul className="entity-list relation-list">
                {linksOf(focused, entities).map(({ rel, other, label }) => (
                  <li key={rel.id} className={`tone-${toneOf(rel.kind)}`}>
                    <span className="muted">{label}</span>{' '}
                    <button className="link" onClick={() => setParam('focus', other.id)}>
                      {other.name}
                    </button>
                  </li>
                ))}
              </ul>
              <button className="small" onClick={() => setParam('focus', 'all')}>
                Show everyone
              </button>
              {!asked && <p className="muted small">{mine?.id === focused.id ? 'Your character, and everyone within two links.' : 'Starting here, with everyone within two links. Pick someone else above, or click a name.'}</p>}
            </aside>
          )}
        </div>
      )}
    </div>
  )
}

const SHOW: Record<string, { label: string; types?: Entity['type'][] }> = {
  people: { label: 'People and factions', types: ['npc', 'pc', 'faction', 'deity'] },
  all: { label: 'Every kind of page' },
}

const NODE_W = 150
const NODE_H = 34

/** A simple force layout: linked people pull together, everyone pushes apart. */
function layout(ids: string[], edges: Edge[]): Pos {
  const n = ids.length
  const pos: Pos = {}
  ids.forEach((id, i) => {
    const t = (i / n) * Math.PI * 2
    pos[id] = { x: Math.cos(t) * 60 * Math.sqrt(n), y: Math.sin(t) * 60 * Math.sqrt(n) }
  })
  const ideal = 190
  for (let iter = 0; iter < 300; iter++) {
    const cool = 1 - iter / 300
    const force: Record<string, { x: number; y: number }> = {}
    for (const id of ids) force[id] = { x: 0, y: 0 }
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const a = pos[ids[i]]
        const b = pos[ids[j]]
        let dx = a.x - b.x
        let dy = a.y - b.y
        let d2 = dx * dx + dy * dy
        if (d2 < 1) {
          // Two people on the same spot: nudge them apart (by index, so the layout is the same every time).
          dx = i - j
          dy = 1
          d2 = dx * dx + 1
        }
        const f = (ideal * ideal) / d2
        force[ids[i]].x += dx * f * 0.5
        force[ids[i]].y += dy * f * 0.5
        force[ids[j]].x -= dx * f * 0.5
        force[ids[j]].y -= dy * f * 0.5
      }
    for (const e of edges) {
      const a = pos[e.from]
      const b = pos[e.to]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.sqrt(dx * dx + dy * dy) || 1
      const f = (d - ideal) / d / 2
      force[e.from].x += dx * f
      force[e.from].y += dy * f
      force[e.to].x -= dx * f
      force[e.to].y -= dy * f
    }
    for (const id of ids) {
      const f = force[id]
      // A gentle pull to the middle keeps separate groups from drifting away.
      f.x -= pos[id].x * 0.01
      f.y -= pos[id].y * 0.01
      const len = Math.sqrt(f.x * f.x + f.y * f.y) || 1
      const step = Math.min(len, 30 * cool + 1)
      pos[id].x += (f.x / len) * step
      pos[id].y += (f.y / len) * step
    }
  }
  return pos
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

function viewBoxOf(pos: Pos): Box {
  const xs = Object.values(pos).map((p) => p.x)
  const ys = Object.values(pos).map((p) => p.y)
  const pad = 40
  let minX = Math.min(...xs) - NODE_W / 2 - pad
  let minY = Math.min(...ys) - NODE_H / 2 - pad
  let w = Math.max(...xs) + NODE_W / 2 + pad - minX
  let h = Math.max(...ys) + NODE_H / 2 + pad - minY
  // A small web stays readable instead of being blown up to fill the box.
  if (w < 900) {
    minX -= (900 - w) / 2
    w = 900
  }
  if (h < 560) {
    minY -= (560 - h) / 2
    h = 560
  }
  return { x: minX, y: minY, w, h }
}

const boxText = (b: Box) => `${b.x} ${b.y} ${b.w} ${b.h}`

function NodeBox({ e, x, y, focus, onPointerDown }: { e: Entity; x: number; y: number; focus: boolean; onPointerDown: (ev: ReactPointerEvent) => void }) {
  const name = e.name.length > 18 ? `${e.name.slice(0, 17)}…` : e.name
  return (
    <g className={`web-node ${focus ? 'focus' : ''}`} transform={`translate(${x - NODE_W / 2} ${y - NODE_H / 2})`} onPointerDown={onPointerDown}>
      <rect width={NODE_W} height={NODE_H} rx={8} />
      <text x={NODE_W / 2} y={NODE_H / 2 + 5} textAnchor="middle">
        {ENTITY_LABELS[e.type].icon} {name}
      </text>
      <title>{e.name}</title>
    </g>
  )
}

function WebGraph({ nodeIds, edges, byId, focus, onPick }: { nodeIds: string[]; edges: Edge[]; byId: Map<string, Entity>; focus: string; onPick: (id: string) => void }) {
  const initial = useMemo(() => layout(nodeIds, edges), [nodeIds, edges])
  const [pos, setPos] = useState<Pos>(initial)
  const full = useMemo(() => viewBoxOf(initial), [initial])
  // A big web opens zoomed in on its middle so names stay readable. The mouse wheel or the buttons zoom; dragging the background pans.
  const [box, setBox] = useState(() => zoomBox(full, Math.max(1, full.w / READABLE_W)))
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ id: string; moved: boolean } | null>(null)
  const pan = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      const m = el.getScreenCTM()?.inverse()
      const at = m ? new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m) : undefined
      setBox((b) => zoomBox(b, ev.deltaY > 0 ? 1 / 1.15 : 1.15, at && { x: at.x, y: at.y }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const toSvg = (ev: { clientX: number; clientY: number }) => {
    const m = svg.current!.getScreenCTM()!.inverse()
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m)
    return { x: p.x, y: p.y }
  }
  // Pairs linked both ways are drawn as two curves so both labels show.
  const seen = new Set<string>()
  return (
    <div className="web-wrap">
      <div className="web-zoom">
        <button className="small" aria-label="Zoom in" onClick={() => setBox((b) => zoomBox(b, 1.3))}>
          +
        </button>
        <button className="small" aria-label="Zoom out" onClick={() => setBox((b) => zoomBox(b, 1 / 1.3))}>
          −
        </button>
        <button className="small" onClick={() => setBox(full)}>
          Fit
        </button>
      </div>
      <svg
        ref={svg}
        className="web-graph"
        viewBox={boxText(box)}
        onPointerDown={(ev) => {
          if (drag.current) return
          ;(ev.currentTarget as Element).setPointerCapture?.(ev.pointerId)
          pan.current = toSvg(ev)
        }}
        onPointerMove={(ev) => {
          if (pan.current) {
            const p = toSvg(ev)
            const start = pan.current
            setBox((b) => ({ ...b, x: b.x - (p.x - start.x), y: b.y - (p.y - start.y) }))
            return
          }
          if (!drag.current) return
          drag.current.moved = true
          const p = toSvg(ev)
          setPos((old) => ({ ...old, [drag.current!.id]: p }))
        }}
        onPointerUp={() => {
          pan.current = null
          if (drag.current && !drag.current.moved) onPick(drag.current.id)
          drag.current = null
        }}
        onPointerLeave={() => {
          pan.current = null
          drag.current = null
        }}
      >
        {edges.map((e) => {
          const a = pos[e.from]
          const b = pos[e.to]
          if (!a || !b) return null
          const pair = [e.from, e.to].sort().join(':')
          const bend = seen.has(pair) ? 40 : 0
          seen.add(pair)
          const mx = (a.x + b.x) / 2
          const my = (a.y + b.y) / 2
          const dx = b.x - a.x
          const dy = b.y - a.y
          const len = Math.sqrt(dx * dx + dy * dy) || 1
          const cx = mx - (dy / len) * bend
          const cy = my + (dx / len) * bend
          return (
            <g key={e.id} className={`web-edge tone-${toneOf(e.kind)}`}>
              <path d={`M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`} markerEnd="url(#web-arrow)" />
              <text x={(mx + cx) / 2} y={(my + cy) / 2 - 4} textAnchor="middle">
                {e.kind}
              </text>
            </g>
          )
        })}
        <defs>
          <marker id="web-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="web-arrow" />
          </marker>
        </defs>
        {nodeIds.map((id) => {
          const e = byId.get(id)
          const p = pos[id]
          if (!e || !p) return null
          return (
            <NodeBox
              key={id}
              e={e}
              x={p.x}
              y={p.y}
              focus={id === focus}
              onPointerDown={(ev) => {
                ;(ev.target as Element).setPointerCapture?.(ev.pointerId)
                drag.current = { id, moved: false }
              }}
            />
          )
        })}
      </svg>
    </div>
  )
}

/** How wide a slice of the web to show at first: about six names across. */
const READABLE_W = 1100

/** The view box scaled by `k` (above 1 zooms in) around a point, or around its middle. */
function zoomBox(b: Box, k: number, at?: { x: number; y: number }): Box {
  const cx = at?.x ?? b.x + b.w / 2
  const cy = at?.y ?? b.y + b.h / 2
  const w = Math.min(20000, Math.max(300, b.w / k))
  const h = (b.h * w) / b.w
  return { x: cx - ((cx - b.x) * w) / b.w, y: cy - ((cy - b.y) * h) / b.h, w, h }
}

/** Family tree: generations in rows, partners side by side, children under their parents. */
function FamilyTree({ nodeIds, edges, byId, focus, onPick }: { nodeIds: string[]; edges: Edge[]; byId: Map<string, Entity>; focus: string; onPick: (id: string) => void }) {
  const { pos, parentLinks, partnerLinks } = useMemo(() => {
    const parentsOf = new Map<string, Set<string>>()
    const partners: [string, string][] = []
    const same = new Map<string, string[]>()
    const addSame = (a: string, b: string) => {
      same.set(a, [...(same.get(a) ?? []), b])
      same.set(b, [...(same.get(b) ?? []), a])
    }
    for (const e of edges) {
      const fam = familyOf(e.kind)
      if (fam === 'parent') {
        const [parent, child] = e.kind === 'child of' ? [e.to, e.from] : [e.from, e.to]
        parentsOf.set(child, (parentsOf.get(child) ?? new Set()).add(parent))
      } else if (fam === 'partner') {
        partners.push([e.from, e.to])
        addSame(e.from, e.to)
      } else if (fam === 'sibling') addSame(e.from, e.to)
    }
    const childrenOf = new Map<string, string[]>()
    for (const [child, ps] of parentsOf) for (const p of ps) childrenOf.set(p, [...(childrenOf.get(p) ?? []), child])

    // Generations: walk out from each family's eldest, parents a row up and children a row down.
    const gen = new Map<string, number>()
    const roots = [...nodeIds].sort((a, b) => (parentsOf.has(a) ? 1 : 0) - (parentsOf.has(b) ? 1 : 0))
    for (const root of roots) {
      if (gen.has(root)) continue
      gen.set(root, 0)
      const queue = [root]
      while (queue.length) {
        const id = queue.shift()!
        const g = gen.get(id)!
        const visit = (other: string, at: number) => {
          if (!gen.has(other)) {
            gen.set(other, at)
            queue.push(other)
          }
        }
        for (const c of childrenOf.get(id) ?? []) visit(c, g + 1)
        for (const p of parentsOf.get(id) ?? []) visit(p, g - 1)
        for (const s of same.get(id) ?? []) visit(s, g)
      }
    }
    const minGen = Math.min(...gen.values())
    const rows = new Map<number, string[]>()
    for (const id of nodeIds) {
      const g = (gen.get(id) ?? 0) - minGen
      rows.set(g, [...(rows.get(g) ?? []), id])
    }
    const order = new Map<string, number>()
    const pos: Pos = {}
    const gapX = NODE_W + 30
    for (const g of [...rows.keys()].sort((a, b) => a - b)) {
      let row = rows.get(g)!
      // Under their parents where possible.
      const score = (id: string) => {
        const ps = [...(parentsOf.get(id) ?? [])].filter((p) => order.has(p))
        return ps.length ? ps.reduce((n, p) => n + order.get(p)!, 0) / ps.length : Number.MAX_SAFE_INTEGER / 2
      }
      row = [...row].sort((a, b) => score(a) - score(b))
      // Partners next to each other.
      const placed: string[] = []
      for (const id of row) {
        if (placed.includes(id)) continue
        placed.push(id)
        for (const s of same.get(id) ?? []) if (row.includes(s) && !placed.includes(s) && partners.some(([a, b]) => (a === id && b === s) || (a === s && b === id))) placed.push(s)
      }
      placed.forEach((id, i) => {
        order.set(id, i)
        pos[id] = { x: (i - (placed.length - 1) / 2) * gapX, y: g * 110 }
      })
    }
    const parentLinks = [...parentsOf].flatMap(([child, ps]) => {
      const list = [...ps].filter((p) => pos[p])
      return pos[child] && list.length ? [{ child, parents: list }] : []
    })
    const partnerLinks = partners.filter(([a, b]) => pos[a] && pos[b])
    return { pos, parentLinks, partnerLinks }
  }, [nodeIds, edges])

  return (
    <svg className="web-graph family" viewBox={boxText(viewBoxOf(pos))}>
      {partnerLinks.map(([a, b]) => (
        <line key={`${a}-${b}`} className="family-partner" x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y} />
      ))}
      {parentLinks.map(({ child, parents }) => {
        const top = { x: parents.reduce((n, p) => n + pos[p].x, 0) / parents.length, y: pos[parents[0]].y + NODE_H / 2 }
        const c = pos[child]
        const midY = (top.y + c.y - NODE_H / 2) / 2
        return (
          <path
            key={child}
            className="family-line"
            d={`M${top.x},${parents.length > 1 ? pos[parents[0]].y : top.y} V${midY} H${c.x} V${c.y - NODE_H / 2}`}
          />
        )
      })}
      {nodeIds.map((id) => {
        const e = byId.get(id)
        const p = pos[id]
        if (!e || !p) return null
        return <NodeBox key={id} e={e} x={p.x} y={p.y} focus={id === focus} onPointerDown={() => onPick(id)} />
      })}
    </svg>
  )
}
