/**
 * Which of a pack piece's pictures a map draws: pieces imported with a pack index have a picture for
 * each design, look (colour or ink), climate and condition, and the map picks the one that fits.
 */
import type { PackVersion } from '../db'
import type { Drawing } from '../mapDrawing'

/** How many designs a set of pictures has (what the version picker shows, at most 8). */
export function designsOf(versions: PackVersion[]) {
  if (!versions.some((v) => v.d !== undefined)) return Math.max(1, Math.min(8, versions.length))
  return Math.max(1, Math.min(8, Math.max(...versions.map((v) => (v.d ?? 0) + 1))))
}

/** What a map looks like, as far as picking a pack picture goes. */
export interface PackLook {
  mode: 'colour' | 'ink'
  biome: string
}
// (as LOOKS in mapArt/classic.ts: only the coloured look is in colour; kept here so this stays small)
export const lookOf = (d: Pick<Drawing, 'look' | 'biome'> | undefined): PackLook => ({ mode: d?.look === 'colour' ? 'colour' : 'ink', biome: d?.biome ?? 'temperate' })

/**
 * Which picture to draw for one design of a piece, on a map with this look, in this condition.
 * Pictures without tags (uploaded one by one) are simply the designs in order. Otherwise the
 * condition must match (else intact), then the look (colour or ink), then the climate.
 */
export function pictureFor(versions: PackVersion[], design: number, look: PackLook, state?: string) {
  const n = designsOf(versions)
  const d = ((design % n) + n) % n
  if (!versions.some((v) => v.d !== undefined)) return d
  let best = -1
  let score = -1
  versions.forEach((v, i) => {
    if ((v.d ?? 0) !== d) return
    const st = v.state ?? 'intact'
    const sc =
      (st === (state || 'intact') ? 100 : st === 'intact' ? 50 : 0) +
      (v.mode === look.mode ? 20 : !v.mode ? 10 : 0) +
      (v.biome === look.biome ? 4 : v.biome === 'temperate' || v.biome === 'neutral' || !v.biome ? 2 : 0)
    if (sc > score) {
      score = sc
      best = i
    }
  })
  return best < 0 ? 0 : best
}

