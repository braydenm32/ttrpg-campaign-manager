import { useEffect, useMemo, useState } from 'react'
import { Modal } from './components'
import { Help } from './help'
import { forPlayers, hasSecrets, type Drawing } from './mapDrawing'
import type { VttParts } from './mapArt/vtt'

type Parts = VttParts & { feet: number; from: Drawing }

/** The most we'll try to draw: past this, browsers run short of memory or quietly hand back a blank picture. */
const MAX_PIXELS = 40_000_000
const MAX_SIDE = 16_000

/** What each size is good for, on battle maps (pixels to a square). */
const FOR: Record<number, string> = { 70: 'Roll20', 100: 'Foundry', 140: 'printing', 200: 'big prints' }

/** Sizes to offer: on battle maps, pixels to a square, the way virtual tabletops count; otherwise times as big. */
function sizesFor(d: Drawing, W: number, H: number) {
  const g = d.gridSize || 70
  const list =
    d.scene === 'battle'
      ? [...new Set([g, 70, 100, 140, 200])]
          .sort((a, b) => a - b)
          .map((ppg) => ({ scale: ppg / g, label: `${ppg} px a square`, note: [FOR[ppg], ppg === g && 'as drawn'].filter(Boolean).join(', ') }))
      : [1, 2, 3].map((k) => ({ scale: k, label: k === 1 ? 'As drawn' : `${k} times as big`, note: '' }))
  return list.map((s) => {
    const [w, h] = [Math.round(W * s.scale), Math.round(H * s.scale)]
    return { ...s, w, h, fits: w * h <= MAX_PIXELS && Math.max(w, h) <= MAX_SIDE }
  })
}

/** The players' copy also leaves out what stands in secret rooms (worked out by the map drawer, loaded only when needed). */
const finish = async (chosen: Drawing, drawing: Drawing, W: number, H: number) =>
  chosen === drawing ? drawing : (await import('./mapArt/classic')).playersCopy(drawing, W, H)

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Download a drawn map as a PNG, or (battle maps and dungeons) as a Universal VTT file with its walls, doors and lights. */
export function ExportMap({ name, drawing, width, height, onClose }: { name: string; drawing: Drawing; width: number; height: number; onClose: () => void }) {
  const battle = drawing.scene === 'battle'
  const sizes = sizesFor(drawing, width, height)
  const [format, setFormat] = useState<'png' | 'vtt'>('png')
  const [scale, setScale] = useState(1)
  const [grid, setGrid] = useState(drawing.grid !== 'none')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const secrets = hasSecrets(drawing)
  // a map with secrets on it goes out as the players' copy unless you ask for your own
  const [copy, setCopy] = useState<'players' | 'gm'>('players')
  const chosen = useMemo(() => (copy === 'players' ? forPlayers(drawing) : drawing), [copy, drawing])
  const [found, setParts] = useState<Parts>()
  const parts = found?.from === chosen ? found : undefined
  const size = sizes.find((s) => s.scale === scale) ?? sizes[0]

  useEffect(() => {
    if (format !== 'vtt') return
    let live = true
    Promise.all([import('./mapArt/vtt'), finish(chosen, drawing, width, height)]).then(([m, d]) => {
      if (!live) return
      const p = m.vttParts(d, width, height)
      setParts({ ...p, from: chosen, feet: Math.round((p.walls.reduce((n, w) => n + m.length(w), 0) / (d.gridSize || 70)) * 5) })
    })
    return () => {
      live = false
    }
  }, [format, chosen, drawing, width, height])

  const download = async () => {
    setBusy(true)
    setError('')
    // let the button show it's working before the drawing ties the page up
    await new Promise((r) => setTimeout(r, 30))
    try {
      const { exportMap } = await import('./mapArt/export')
      await exportMap(copy === 'gm' ? `${name} (GM)` : name, await finish(chosen, drawing, width, height), width, height, { format, scale: size.scale, grid })
      onClose()
    } catch (e) {
      console.warn('Map export failed', e)
      setError(e instanceof Error && e.message.startsWith('This device') ? e.message : 'Could not make the file at that size. Try a smaller one.')
      setBusy(false)
    }
  }

  const doors = parts?.portals.filter((p) => p.closed).length ?? 0
  const windows = parts ? parts.portals.length - doors : 0

  return (
    <Modal title="Export map" onClose={onClose}>
      <div className="form">
        {battle && (
          <div className="label">
            <span>
              What to download <Help topic="exportMap" />
            </span>
            <div className="map-kinds" role="radiogroup" aria-label="What to download">
              {(
                [
                  ['png', 'Picture (PNG)', 'To print, share, or put on any virtual tabletop'],
                  ['vtt', 'Virtual tabletop file (.dd2vtt)', 'The picture with its walls, doors and lights, for Foundry, Roll20 and others'],
                ] as const
              ).map(([k, title, note]) => (
                <button key={k} type="button" role="radio" aria-checked={format === k} className={format === k ? 'on' : ''} onClick={() => {
                    setFormat(k)
                    // tabletops draw their own grid
                    setGrid(k === 'png' && drawing.grid !== 'none')
                  }}
                >
                  <strong>{title}</strong>
                  <small>{note}</small>
                </button>
              ))}
            </div>
          </div>
        )}
        {secrets && (
          <div className="label">
            <span>Which copy</span>
            <div className="segmented">
              <button type="button" className={copy === 'players' ? 'on' : ''} onClick={() => setCopy('players')}>
                Players’ copy
              </button>
              <button type="button" className={copy === 'gm' ? 'on' : ''} onClick={() => setCopy('gm')}>
                Yours, with the secrets
              </button>
            </div>
            <span className="muted small">
              {copy === 'players' ? 'Without the secret doors, traps and anything else only you see.' : 'Keep this one to yourself: secret doors go in a tabletop file as doors players can see.'}
            </span>
          </div>
        )}
        <label>
          <span>
            Size {!battle && <Help topic="exportMap" />}
          </span>
          <select value={size.scale} onChange={(e) => setScale(Number(e.target.value))}>
            {sizes.map((s) => (
              <option key={s.scale} value={s.scale} disabled={!s.fits}>
                {s.label}
                {s.note ? ` (${s.note})` : ''}
                {s.fits ? '' : ' (too big)'}
              </option>
            ))}
          </select>
          <span className="muted small">
            {size.w} × {size.h} px
          </span>
        </label>
        {(battle || drawing.grid !== 'none') && (
          <label className="check">
            <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Show the grid{format === 'vtt' && <span className="muted small">(tabletops draw their own)</span>}
          </label>
        )}
        {format === 'vtt' && (
          <p className="muted small">
            {!parts
              ? 'Finding the walls…'
              : parts.walls.length || parts.portals.length || parts.lights.length || parts.solid
                ? `Going in the file: ${[
                    parts.feet ? `about ${parts.feet} ft of wall` : 'no walls',
                    plural(doors, 'door'),
                    windows && plural(windows, 'set of bars', 'sets of bars'),
                    parts.solid && plural(parts.solid, 'pillar or building', 'pillars and buildings'),
                    plural(parts.lights.length, 'light'),
                  ]
                    .filter(Boolean)
                    .join(', ')}.`
                : 'No walls yet: draw rooms with the Rooms tool, or walls with Line, and they’ll go in the file.'}
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <div className="row end">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" disabled={busy} onClick={download}>
            {busy ? 'Drawing it…' : 'Download'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
