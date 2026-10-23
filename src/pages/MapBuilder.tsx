import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Empty } from '../components'
import { db, newId, type WorldMap } from '../db'
import { useWorld } from '../hooks'
import { renderPlayerFog } from '../fog'
import {
  BACKGROUNDS,
  drawingInnerSvg,
  LINE_STYLES,
  pathFor,
  renderDrawing,
  simplify,
  STAMPS,
  TERRAINS,
  type Background,
  type Drawing,
  type LineStyle,
  type Point,
  type Shape,
  type StampKind,
  type Terrain,
} from '../mapDrawing'
import { useViewMode } from '../viewMode'

type Tool = 'select' | 'hand' | 'area' | 'rect' | 'line' | 'stamp' | 'label' | 'erase'

const TOOLS: { id: Tool; icon: string; label: string; hint: string }[] = [
  { id: 'select', icon: '🖐', label: 'Select', hint: 'Click a shape to edit it, drag to move it' },
  { id: 'hand', icon: '✋', label: 'Pan', hint: 'Drag to move around. Scroll to zoom' },
  { id: 'area', icon: '🖌', label: 'Paint area', hint: 'Drag to paint land, forest, water…' },
  { id: 'rect', icon: '▭', label: 'Room', hint: 'Drag a rectangle (rooms, buildings, fields)' },
  { id: 'line', icon: '〰', label: 'Line', hint: 'Drag to draw roads, rivers, walls' },
  { id: 'stamp', icon: '🏰', label: 'Stamp', hint: 'Click to place a symbol' },
  { id: 'label', icon: '🔤', label: 'Label', hint: 'Click to place text' },
  { id: 'erase', icon: '🧽', label: 'Erase', hint: 'Click a shape to delete it' },
]

export default function MapBuilder() {
  const { worldId } = useWorld()
  const { mapId = '' } = useParams()
  const { isGM } = useViewMode()
  const map = useLiveQuery(() => db.maps.get(mapId), [mapId])
  if (map === undefined) return null
  if (!isGM || map === null || map.worldId !== worldId || !map.drawing) return <Empty>This map can't be drawn on.</Empty>
  return <Builder key={map.id} map={map as WorldMap & { drawing: Drawing }} />
}

function Builder({ map }: { map: WorldMap & { drawing: Drawing } }) {
  const { worldId } = useWorld()
  const W = map.width
  const H = map.height
  const [drawing, setDrawing] = useState<Drawing>(map.drawing)
  const [past, setPast] = useState<Drawing[]>([])
  const [future, setFuture] = useState<Drawing[]>([])
  const [tool, setTool] = useState<Tool>('area')
  const [terrain, setTerrain] = useState<Terrain>('land')
  const [lineStyle, setLineStyle] = useState<LineStyle>('road')
  const [stamp, setStamp] = useState<StampKind>('town')
  const [stampSize, setStampSize] = useState(() => Math.round(Math.max(W, H) / 24))
  const [labelText, setLabelText] = useState('')
  const [labelSize, setLabelSize] = useState(() => Math.round(Math.max(W, H) / 40))
  const [selectedId, setSelectedId] = useState<string>()
  const [view, setView] = useState({ x: 0, y: 0, w: W, h: H })
  const [draft, setDraft] = useState<Point[]>([])
  const [saved, setSaved] = useState(true)
  const [canvas, setCanvas] = useState({ w: W, h: H })
  const svgRef = useRef<SVGSVGElement>(null)
  const gesture = useRef<
    | { kind: 'pan'; client: Point; view: typeof view }
    | { kind: 'draw'; points: Point[] }
    | { kind: 'rect'; start: Point }
    | { kind: 'move'; id: string; start: Point; before: Drawing }
  >(undefined)
  const spaceDown = useRef(false)

  const commit = useCallback(
    (next: Drawing, before: Drawing = drawing) => {
      setPast((p) => [...p.slice(-80), before])
      setFuture([])
      setDrawing(next)
    },
    [drawing],
  )
  const undo = useCallback(() => {
    if (!past.length) return
    setFuture((f) => [drawing, ...f])
    setDrawing(past[past.length - 1])
    setPast((p) => p.slice(0, -1))
  }, [past, drawing])
  const redo = useCallback(() => {
    if (!future.length) return
    setPast((p) => [...p, drawing])
    setDrawing(future[0])
    setFuture((f) => f.slice(1))
  }, [future, drawing])
  const updateShape = (id: string, patch: Partial<Shape>) =>
    commit({ ...drawing, shapes: drawing.shapes.map((s) => (s.id === id ? ({ ...s, ...patch } as Shape) : s)) })
  const removeShape = useCallback(
    (id: string) => {
      commit({ ...drawing, shapes: drawing.shapes.filter((s) => s.id !== id) })
      setSelectedId(undefined)
    },
    [commit, drawing],
  )

  // A fogged map's players' picture is remade once you're done drawing (not on every stroke).
  useEffect(() => () => void renderPlayerFog(map.id).catch(() => {}), [map.id])

  // Autosave: the drawing is kept on the map, and the rendered picture replaces the map image.
  const lastSaved = useRef(map.drawing)
  useEffect(() => {
    if (drawing === lastSaved.current) return
    setSaved(false)
    const t = setTimeout(async () => {
      const svg = renderDrawing(drawing, W, H)
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      await db.transaction('rw', [db.maps, db.assets], async () => {
        await db.maps.update(map.id, { drawing })
        await db.assets.update(map.imageId, { blob, size: blob.size, mime: 'image/svg+xml', updatedAt: Date.now() })
      })
      lastSaved.current = drawing
      setSaved(true)
    }, 700)
    return () => clearTimeout(t)
  }, [drawing, map.id, map.imageId, W, H])

  useEffect(() => {
    if (saved) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [saved])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea, select')
      if (e.code === 'Space' && !typing) spaceDown.current = true
      if (typing) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        removeShape(selectedId)
      } else if (e.key === 'Escape') {
        setSelectedId(undefined)
        setDraft([])
        gesture.current = undefined
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [undo, redo, removeShape, selectedId])

  const toMap = (e: { clientX: number; clientY: number }): Point => {
    const svg = svgRef.current!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return [p.x, p.y]
  }
  // The view always matches the canvas's shape, so one screen pixel is the same distance both ways.
  const upp = view.w / canvas.w
  const unitsPerPixel = () => upp
  const fitView = useCallback(
    (cw: number, ch: number) => {
      const k = Math.max(W / cw, H / ch)
      setView({ x: (W - cw * k) / 2, y: (H - ch * k) / 2, w: cw * k, h: ch * k })
    },
    [W, H],
  )
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    let first = true
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (!width || !height) return
      setCanvas({ w: width, h: height })
      if (first) fitView(width, height)
      else setView((v) => ({ ...v, h: v.w * (height / width) }))
      first = false
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fitView])
  const shapeAt = (target: EventTarget) => (target as Element).closest?.('[data-id]')?.getAttribute('data-id') ?? undefined

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const p = toMap(e)
    const hit = shapeAt(e.target)
    if (tool === 'hand' || e.button === 1 || spaceDown.current) {
      gesture.current = { kind: 'pan', client: [e.clientX, e.clientY], view }
    } else if (tool === 'area' || tool === 'line') {
      gesture.current = { kind: 'draw', points: [p] }
      setDraft([p])
    } else if (tool === 'rect') {
      gesture.current = { kind: 'rect', start: p }
      setDraft([p, p, p, p])
    } else if (tool === 'stamp') {
      const id = newId()
      commit({ ...drawing, shapes: [...drawing.shapes, { id, kind: 'stamp', stamp, at: p, size: stampSize }] })
      return
    } else if (tool === 'label') {
      const text = labelText.trim() || prompt('Label text')?.trim()
      if (!text) return
      const id = newId()
      commit({
        ...drawing,
        shapes: [...drawing.shapes, { id, kind: 'label', text, at: p, size: labelSize, color: drawing.background === 'stone' ? '#f2efe6' : '#3a2e1c', italic: false }],
      })
      setLabelText('')
      return
    } else if (tool === 'erase') {
      if (hit) removeShape(hit)
      return
    } else if (tool === 'select') {
      setSelectedId(hit)
      if (hit) gesture.current = { kind: 'move', id: hit, start: p, before: drawing }
      if (!hit) gesture.current = { kind: 'pan', client: [e.clientX, e.clientY], view }
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g) return
    if (g.kind === 'pan') {
      const k = g.view.w / canvas.w
      setView({ ...g.view, x: g.view.x - (e.clientX - g.client[0]) * k, y: g.view.y - (e.clientY - g.client[1]) * k })
      return
    }
    const p = toMap(e)
    if (g.kind === 'draw') {
      const last = g.points[g.points.length - 1]
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 3 * unitsPerPixel()) return
      g.points.push(p)
      setDraft([...g.points])
    } else if (g.kind === 'rect') {
      const [x0, y0] = g.start
      setDraft([g.start, [p[0], y0], p, [x0, p[1]]])
    } else if (g.kind === 'move') {
      const dx = p[0] - g.start[0]
      const dy = p[1] - g.start[1]
      const shift = ([x, y]: Point): Point => [x + dx, y + dy]
      setDrawing({
        ...g.before,
        shapes: g.before.shapes.map((s) => {
          if (s.id !== g.id) return s
          if (s.kind === 'area' || s.kind === 'line') return { ...s, points: s.points.map(shift) }
          return { ...s, at: shift(s.at) }
        }),
      })
    }
  }

  const onPointerUp = () => {
    const g = gesture.current
    gesture.current = undefined
    if (!g) return
    if (g.kind === 'draw') {
      const pts = simplify(g.points, 1.5 * unitsPerPixel())
      setDraft([])
      if (tool === 'area' && pts.length >= 3)
        commit({ ...drawing, shapes: [...drawing.shapes, { id: newId(), kind: 'area', terrain, points: pts, smooth: true }] })
      if (tool === 'line' && pts.length >= 2)
        commit({ ...drawing, shapes: [...drawing.shapes, { id: newId(), kind: 'line', style: lineStyle, points: pts, smooth: lineStyle !== 'wall' }] })
    } else if (g.kind === 'rect') {
      const pts = draft
      setDraft([])
      const big = pts.length === 4 && Math.abs(pts[2][0] - pts[0][0]) > 5 && Math.abs(pts[2][1] - pts[0][1]) > 5
      if (big) commit({ ...drawing, shapes: [...drawing.shapes, { id: newId(), kind: 'area', terrain, points: pts, smooth: false }] })
    } else if (g.kind === 'move') {
      if (drawing !== g.before) commit(drawing, g.before)
    }
  }

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const [mx, my] = toMap(e)
    const k = Math.exp(e.deltaY * 0.0015)
    const w = Math.min(W * 3, Math.max(W / 20, view.w * k))
    const ratio = w / view.w
    setView({ x: mx - (mx - view.x) * ratio, y: my - (my - view.y) * ratio, w, h: view.h * ratio })
  }

  const fit = () => fitView(canvas.w, canvas.h)
  const html = useMemo(() => drawingInnerSvg(drawing, W, H), [drawing, W, H])
  const selected = drawing.shapes.find((s) => s.id === selectedId)
  const draftPath =
    draft.length > 1 ? pathFor(draft, tool !== 'line', tool === 'area' || (tool === 'line' && lineStyle !== 'wall')) : ''

  return (
    <div className="map-page builder">
      <div className="map-toolbar">
        <Link to={`/w/${worldId}/maps/${map.id}`}>← Done</Link>
        <strong>{map.name}</strong>
        <span className="muted small">{saved ? 'Saved' : 'Saving…'}</span>
        <div className="row">
          <button onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)">
            ↶ Undo
          </button>
          <button onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)">
            ↷ Redo
          </button>
          <button onClick={fit}>⤢ Fit</button>
        </div>
      </div>
      <div className="map-body">
        <div className="builder-tools">
          {TOOLS.map((t) => (
            <button key={t.id} className={tool === t.id ? 'on' : ''} title={t.hint} onClick={() => setTool(t.id)}>
              <span className="tool-icon">{t.icon}</span>
              <span className="tool-label">{t.label}</span>
            </button>
          ))}
        </div>
        <svg
          ref={svgRef}
          className={`builder-canvas tool-${tool}`}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          preserveAspectRatio="none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          <g dangerouslySetInnerHTML={{ __html: html }} />
          {selectedId && <style>{`[data-id="${selectedId}"] { filter: drop-shadow(0 0 4px #ffd36b) drop-shadow(0 0 2px #ffd36b); }`}</style>}
          <rect width={W} height={H} fill="none" stroke="#000" strokeOpacity={0.4} strokeWidth={2 * upp} pointerEvents="none" />
          {draftPath && (
            <path
              d={draftPath}
              fill={tool === 'line' ? 'none' : 'rgba(224,179,84,.25)'}
              stroke="#e0b354"
              strokeWidth={2 * upp}
              strokeDasharray={`${6 * upp} ${4 * upp}`}
              pointerEvents="none"
            />
          )}
        </svg>
        <aside className="map-panel builder-panel">
          <div className="small muted">
            Map builder <Help topic="mapBuilder" />
          </div>
          {selected ? (
            <ShapeProps shape={selected} onChange={(patch) => updateShape(selected.id, patch)} onDelete={() => removeShape(selected.id)} onClose={() => setSelectedId(undefined)} />
          ) : (
            <ToolOptions
              tool={tool}
              {...{ terrain, setTerrain, lineStyle, setLineStyle, stamp, setStamp, stampSize, setStampSize, labelText, setLabelText, labelSize, setLabelSize }}
            />
          )}
          <details className="map-settings">
            <summary>Map settings</summary>
            <div className="form">
              <label>
                Background
                <select value={drawing.background} onChange={(e) => commit({ ...drawing, background: e.target.value as Background })}>
                  {Object.entries(BACKGROUNDS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Grid
                <select value={drawing.grid} onChange={(e) => commit({ ...drawing, grid: e.target.value as Drawing['grid'] })}>
                  <option value="none">None</option>
                  <option value="square">Squares</option>
                  <option value="hex">Hexes</option>
                </select>
              </label>
              {drawing.grid !== 'none' && (
                <label>
                  Grid size: {drawing.gridSize}px
                  <input
                    type="range"
                    min={20}
                    max={200}
                    step={5}
                    value={drawing.gridSize}
                    onChange={(e) => commit({ ...drawing, gridSize: Number(e.target.value) })}
                  />
                </label>
              )}
              <p className="muted small">
                {W} × {H} px. Pins and regions are added on the map itself, after you press Done.
              </p>
            </div>
          </details>
        </aside>
      </div>
    </div>
  )
}

function ToolOptions(p: {
  tool: Tool
  terrain: Terrain
  setTerrain: (t: Terrain) => void
  lineStyle: LineStyle
  setLineStyle: (s: LineStyle) => void
  stamp: StampKind
  setStamp: (s: StampKind) => void
  stampSize: number
  setStampSize: (n: number) => void
  labelText: string
  setLabelText: (s: string) => void
  labelSize: number
  setLabelSize: (n: number) => void
}) {
  const hint = TOOLS.find((t) => t.id === p.tool)?.hint
  return (
    <div className="form">
      <h2>{TOOLS.find((t) => t.id === p.tool)?.label}</h2>
      <p className="muted small">{hint}. Hold Space and drag to pan from any tool.</p>
      {(p.tool === 'area' || p.tool === 'rect') && (
        <div className="swatch-grid">
          {(Object.keys(TERRAINS) as Terrain[]).map((t) => (
            <button key={t} className={p.terrain === t ? 'on' : ''} onClick={() => p.setTerrain(t)}>
              <TerrainChip terrain={t} /> {TERRAINS[t].label}
            </button>
          ))}
        </div>
      )}
      {p.tool === 'line' && (
        <div className="swatch-grid">
          {(Object.keys(LINE_STYLES) as LineStyle[]).map((s) => (
            <button key={s} className={p.lineStyle === s ? 'on' : ''} onClick={() => p.setLineStyle(s)}>
              <svg width="34" height="12" aria-hidden>
                <path d="M2 6 H32" stroke={LINE_STYLES[s].color} strokeWidth={Math.min(6, LINE_STYLES[s].width)} strokeDasharray={LINE_STYLES[s].dash ? '6 4' : undefined} />
              </svg>
              {LINE_STYLES[s].label}
            </button>
          ))}
        </div>
      )}
      {p.tool === 'stamp' && (
        <>
          <div className="stamp-grid">
            {(Object.keys(STAMPS) as StampKind[]).map((s) => (
              <button key={s} className={p.stamp === s ? 'on' : ''} onClick={() => p.setStamp(s)} title={STAMPS[s]}>
                <StampPreview stamp={s} />
                <span>{STAMPS[s]}</span>
              </button>
            ))}
          </div>
          <label>
            Size: {p.stampSize}px
            <input type="range" min={20} max={300} value={p.stampSize} onChange={(e) => p.setStampSize(Number(e.target.value))} />
          </label>
        </>
      )}
      {p.tool === 'label' && (
        <>
          <label>
            Text
            <input value={p.labelText} onChange={(e) => p.setLabelText(e.target.value)} placeholder="Type, then click the map" />
          </label>
          <label>
            Size: {p.labelSize}px
            <input type="range" min={12} max={160} value={p.labelSize} onChange={(e) => p.setLabelSize(Number(e.target.value))} />
          </label>
        </>
      )}
    </div>
  )
}

function ShapeProps({ shape, onChange, onDelete, onClose }: { shape: Shape; onChange: (p: Partial<Shape>) => void; onDelete: () => void; onClose: () => void }) {
  return (
    <div className="form">
      <header>
        <h2>
          {shape.kind === 'area' ? 'Area' : shape.kind === 'line' ? 'Line' : shape.kind === 'stamp' ? STAMPS[shape.stamp] : 'Label'}
        </h2>
        <button className="ghost" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      {shape.kind === 'area' && (
        <>
          <label>
            Terrain
            <select value={shape.terrain} onChange={(e) => onChange({ terrain: e.target.value as Terrain })}>
              {Object.entries(TERRAINS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={shape.smooth} onChange={(e) => onChange({ smooth: e.target.checked })} /> Smooth edges
          </label>
        </>
      )}
      {shape.kind === 'line' && (
        <label>
          Style
          <select value={shape.style} onChange={(e) => onChange({ style: e.target.value as LineStyle })}>
            {Object.entries(LINE_STYLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {shape.kind === 'stamp' && (
        <>
          <label>
            Symbol
            <select value={shape.stamp} onChange={(e) => onChange({ stamp: e.target.value as StampKind })}>
              {Object.entries(STAMPS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Size: {shape.size}px
            <input type="range" min={20} max={300} value={shape.size} onChange={(e) => onChange({ size: Number(e.target.value) })} />
          </label>
        </>
      )}
      {shape.kind === 'label' && (
        <>
          <label>
            Text
            <input value={shape.text} onChange={(e) => onChange({ text: e.target.value })} />
          </label>
          <label>
            Size: {shape.size}px
            <input type="range" min={12} max={160} value={shape.size} onChange={(e) => onChange({ size: Number(e.target.value) })} />
          </label>
          <div className="row">
            <input type="color" value={shape.color} onChange={(e) => onChange({ color: e.target.value })} aria-label="Colour" />
            <label className="check">
              <input type="checkbox" checked={shape.italic} onChange={(e) => onChange({ italic: e.target.checked })} /> Italic
            </label>
          </div>
        </>
      )}
      <p className="muted small">Drag the shape on the map to move it. Press Delete to remove it.</p>
      <button className="danger" onClick={onDelete}>
        Delete
      </button>
    </div>
  )
}

function TerrainChip({ terrain }: { terrain: Terrain }) {
  const html = useMemo(() => drawingInnerSvg({ background: 'parchment', grid: 'none', gridSize: 70, shapes: [{ id: 'x', kind: 'area', terrain, points: [[0, 0], [60, 0], [60, 60], [0, 60]], smooth: false }] }, 60, 60), [terrain])
  return <svg className="chip" viewBox="0 0 60 60" width="22" height="22" aria-hidden dangerouslySetInnerHTML={{ __html: html }} />
}

function StampPreview({ stamp }: { stamp: StampKind }) {
  const html = useMemo(() => drawingInnerSvg({ background: 'parchment', grid: 'none', gridSize: 70, shapes: [{ id: 'x', kind: 'stamp', stamp, at: [50, 50], size: 90 }] }, 100, 100), [stamp])
  return <svg viewBox="0 0 100 100" width="40" height="40" aria-hidden dangerouslySetInnerHTML={{ __html: html }} />
}
