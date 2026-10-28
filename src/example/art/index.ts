/**
 * The example world's pictures, drawn in ink on the spot rather than shipped as image files:
 * silhouettes for every character, faction crests, holy symbols, item sketches, handouts and the
 * cover. Keys arrive by prefix (`sil:`, `crest:`, `holy:`, `item:`, `handout:`) or as `cover`.
 */
import type { ExPage } from '../types'
import { drawCover } from './cover'
import { drawCrest } from './crests'
import { drawHandout } from './handouts'
import { drawHoly } from './holy'
import { toPng, type Ctx } from './ink'
import { drawItem } from './items'
import { drawSilhouette } from './silhouettes'

type Draw = (ctx: Ctx, w: number, h: number) => void | Promise<void>

/** Finds the drawing for a key: its size and a function that draws it, or nothing. */
function pick(key: string, page?: ExPage): { w: number; h: number; draw: Draw } | undefined {
  const i = key.indexOf(':')
  const family = i < 0 ? key : key.slice(0, i)
  const name = i < 0 ? '' : key.slice(i + 1)
  switch (family) {
    case 'sil':
      return { w: 640, h: 480, draw: (ctx, w, h) => drawSilhouette(ctx, w, h, name, page) }
    case 'crest': {
      const d = drawCrest(name)
      return d && { w: 512, h: 512, draw: d }
    }
    case 'holy': {
      const d = drawHoly(name)
      return d && { w: 512, h: 512, draw: d }
    }
    case 'item': {
      const d = drawItem(name)
      return d && { w: 512, h: 512, draw: d }
    }
    case 'handout': {
      const d = drawHandout(name)
      return d && { w: 900, h: 1200, draw: d }
    }
    case 'cover':
      return { w: 1600, h: 900, draw: drawCover }
    default:
      return undefined
  }
}

/**
 * Draws one picture as a PNG, or nothing if there is no drawing by that name. `page` is the page
 * the picture belongs to, so a silhouette can follow its Ancestry and Role fields.
 */
export async function drawArt(key: string, page?: ExPage): Promise<Blob | undefined> {
  const a = pick(key, page)
  if (!a) return undefined
  const canvas = document.createElement('canvas')
  canvas.width = a.w
  canvas.height = a.h
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  await a.draw(ctx, a.w, a.h)
  return toPng(canvas)
}
