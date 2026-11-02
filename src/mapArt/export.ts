/**
 * Exporting a drawn map: a PNG at a chosen size, with or without its grid, or a Universal VTT file
 * (.dd2vtt) with the picture and its walls, doors and lights inside.
 */
import { loadMapFonts, renderClassicOnce } from './classic'
import { vttFile } from './vtt'
import type { Drawing } from '../mapDrawing'
import type { KeyEntry } from '../mapKey'

export interface ExportChoice {
  format: 'png' | 'vtt'
  /** How many times bigger than the map as drawn. */
  scale: number
  grid: boolean
  /** Numbers to put on the picture, with the key written below it (PNG only). */
  key?: KeyEntry[]
}

/**
 * The picture with each key number in a round badge where its pin is, and the key (number, name,
 * one line) written underneath on a parchment strip, so the map can be run from paper.
 */
export function withKey(art: HTMLCanvasElement, key: KeyEntry[], scale: number) {
  const W = art.width
  const pad = Math.round(24 * Math.max(1, W / 1600))
  const font = Math.round(18 * Math.max(1, W / 1600))
  const line = Math.round(font * 1.45)
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = `${font}px Georgia, serif`
  // Each entry wraps to the width of the picture.
  const rows: { n: number; text: string; first: boolean }[] = []
  for (const k of key) {
    const words = `${k.title}${k.line ? ` — ${k.line}` : ''}`.split(' ')
    let cur = ''
    let first = true
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w
      if (measure.measureText(next).width > W - pad * 2 - font * 2.4 && cur) {
        rows.push({ n: k.n, text: cur, first })
        cur = w
        first = false
      } else cur = next
    }
    rows.push({ n: k.n, text: cur, first })
  }
  const keyH = rows.length ? pad * 2 + font * 1.6 + rows.length * line : 0
  const out = document.createElement('canvas')
  out.width = W
  out.height = art.height + Math.ceil(keyH)
  const g = out.getContext('2d')!
  g.drawImage(art, 0, 0)
  // The numbers, on the picture.
  const r = Math.round(font * 0.85)
  for (const k of key) {
    if (!k.at) continue
    const [x, y] = [k.at[0] * scale, k.at[1] * scale]
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fillStyle = '#fbf7ee'
    g.fill()
    g.lineWidth = Math.max(2, r / 6)
    g.strokeStyle = '#2b2420'
    g.stroke()
    g.fillStyle = '#2b2420'
    g.font = `bold ${Math.round(font * (k.n > 99 ? 0.7 : 0.9))}px Georgia, serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(String(k.n), x, y + 1)
  }
  if (!rows.length) return out
  // The key, below.
  g.fillStyle = '#f4ecd8'
  g.fillRect(0, art.height, W, keyH)
  g.fillStyle = '#2b2420'
  g.textAlign = 'left'
  g.textBaseline = 'top'
  g.font = `bold ${Math.round(font * 1.15)}px Georgia, serif`
  g.fillText('Key', pad, art.height + pad)
  rows.forEach((row, i) => {
    const y = art.height + pad + font * 1.6 + i * line
    if (row.first) {
      g.font = `bold ${font}px Georgia, serif`
      g.fillText(`${row.n}.`, pad, y)
    }
    g.font = `${font}px Georgia, serif`
    g.fillText(row.text, pad + font * 2.4, y)
  })
  return out
}

export async function exportMap(name: string, d: Drawing, W: number, H: number, c: ExportChoice) {
  await loadMapFonts()
  const drawn: Drawing = { ...d, grid: c.grid ? (d.grid === 'none' ? 'square' : d.grid) : 'none' }
  const drawnArt = renderClassicOnce(drawn, W, H, c.scale)
  const canvas = c.key?.length && c.format === 'png' ? withKey(drawnArt, c.key, c.scale) : drawnArt
  const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  // let the browser have the memory back straight away
  canvas.width = canvas.height = 0
  drawnArt.width = drawnArt.height = 0
  if (!png || png.size < 100) throw new Error('This device could not make a picture that big. Try a smaller size.')
  const file = c.format === 'vtt' ? await vttFile(d, W, H, png, Math.round((d.gridSize || 70) * c.scale)) : png
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = `${name.trim().replace(/[^\w-]+/g, '_') || 'map'}.${c.format === 'vtt' ? 'dd2vtt' : 'png'}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
