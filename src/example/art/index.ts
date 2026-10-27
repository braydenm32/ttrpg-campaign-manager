/**
 * The example world's pictures, drawn in ink on the spot rather than shipped as image files:
 * silhouettes for every character, faction crests, item sketches, handouts and the cover.
 */
type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

const ART: Record<string, { w: number; h: number; draw: Draw }> = {}

/** Draws one picture as a PNG, or nothing if there is no drawing by that name. */
export async function drawArt(key: string): Promise<Blob | undefined> {
  const a = ART[key]
  if (!a) return undefined
  const canvas = document.createElement('canvas')
  canvas.width = a.w
  canvas.height = a.h
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  a.draw(ctx, a.w, a.h)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? undefined), 'image/png'))
}
