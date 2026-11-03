/**
 * Photos and scans of hand-written notes, made ready to send to Claude: shrunk so the long side is at
 * most LONG_SIDE pixels (enough to read handwriting, small enough to send quickly) and turned into
 * JPEG. PDFs (from a scanner app) go as they are.
 */

export interface NotePhoto {
  name: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'
  /** The file as base64, without the "data:" start. */
  data: string
  /** A small picture to show in the list (an object URL), not for PDFs. */
  preview?: string
  /** Roughly what Claude counts it as, for the price on the button. */
  tokens: number
}

const LONG_SIDE = 2400
/** Claude takes at most 5 MB a picture and 32 MB a request; PDFs are capped lower to leave room. */
const MAX_PDF = 20 * 1024 * 1024
export const MAX_PHOTOS = 20

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

export async function readNotePhoto(file: File): Promise<NotePhoto> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size > MAX_PDF) throw new Error(`${file.name} is too big (over 20 MB). Split it into smaller PDFs, or take photos instead.`)
    // About 1,500 tokens a scanned page, guessed from the size: a phone scan is roughly 300 KB a page.
    return { name: file.name, mediaType: 'application/pdf', data: await toBase64(file), tokens: Math.max(1, Math.round(file.size / 300_000)) * 1500 }
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(`Couldn’t open ${file.name}. Use a JPEG or PNG photo (on an iPhone, Settings, Camera, Formats, “Most Compatible”), or a PDF.`)
  }
  const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`Couldn’t read ${file.name}.`))), 'image/jpeg', 0.85))
  return { name: file.name, mediaType: 'image/jpeg', data: await toBase64(blob), preview: URL.createObjectURL(blob), tokens: Math.ceil((w * h) / 750) }
}
