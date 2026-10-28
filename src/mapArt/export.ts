/**
 * Exporting a drawn map: a PNG at a chosen size, with or without its grid, or a Universal VTT file
 * (.dd2vtt) with the picture and its walls, doors and lights inside.
 */
import { loadMapFonts, renderClassicOnce } from './classic'
import { vttFile } from './vtt'
import type { Drawing } from '../mapDrawing'

export interface ExportChoice {
  format: 'png' | 'vtt'
  /** How many times bigger than the map as drawn. */
  scale: number
  grid: boolean
}

export async function exportMap(name: string, d: Drawing, W: number, H: number, c: ExportChoice) {
  await loadMapFonts()
  const drawn: Drawing = { ...d, grid: c.grid ? (d.grid === 'none' ? 'square' : d.grid) : 'none' }
  const canvas = renderClassicOnce(drawn, W, H, c.scale)
  const png = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  // let the browser have the memory back straight away
  canvas.width = canvas.height = 0
  if (!png || png.size < 100) throw new Error('This device could not make a picture that big. Try a smaller size.')
  const file = c.format === 'vtt' ? await vttFile(d, W, H, png, Math.round((d.gridSize || 70) * c.scale)) : png
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = `${name.trim().replace(/[^\w-]+/g, '_') || 'map'}.${c.format === 'vtt' ? 'dd2vtt' : 'png'}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
