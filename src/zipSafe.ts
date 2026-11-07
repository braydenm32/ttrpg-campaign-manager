import { Inflate, strFromU8, Unzip, UnzipInflate } from 'fflate'

/**
 * Opening ZIP files that come into the app (world backups, Obsidian, Kanka and World Anvil
 * exports, map packs) without trusting what they say about themselves. A ZIP made to harm the app
 * can claim sizes it doesn't have, hold a file that unpacks to a thousand times its size (a "zip
 * bomb"), point many files at the same bytes, or send a reader round in circles; any of these would
 * freeze or crash the tab, worst on a phone. So:
 *  - the list of files at the end of a ZIP is read once, checking every entry lies inside the file
 *    and that no two overlap;
 *  - nothing unpacks past the limits for that kind of file: how big one packed file may grow, how
 *    much all of them may come to together, and how many times smaller than itself it may be
 *    packed (no real picture, note or backup comes near that);
 *  - unpacking stops the moment a file gives more than it said it would.
 * Anything wrong gives the same plain message, TOO_BIG_OR_DAMAGED (the reason goes to the console).
 */

export const TOO_BIG_OR_DAMAGED = 'This file is too big or damaged to open.'

/** A ZIP that couldn't be opened safely. */
export class ZipError extends Error {
  /** What was wrong, for the console. */
  reason: string
  constructor(reason: string) {
    super(TOO_BIG_OR_DAMAGED)
    this.name = 'ZipError'
    this.reason = reason
  }
}

export interface ZipLimits {
  /** The most one packed (deflated) file may unpack to, in bytes. Files stored as they are can't grow. */
  file: number
  /** The most everything unpacked from one ZIP may come to. */
  total: number
  /** The most times smaller than itself a file over a megabyte may be packed. */
  ratio: number
  /** The most files in one ZIP. */
  count: number
}

const MB = 1024 * 1024
/** World backups: world.json (the world's text, packed) and every picture, recording and map piece (stored as they are). */
export const BACKUP_ZIP: ZipLimits = { file: 512 * MB, total: 4096 * MB, ratio: 200, count: 200_000 }
/** Obsidian, Kanka and World Anvil exports: notes, JSON and pictures. */
export const IMPORT_ZIP: ZipLimits = { file: 100 * MB, total: 1024 * MB, ratio: 200, count: 100_000 }
/** Map packs: pictures (already compressed, so they hardly shrink in a ZIP) and the pack's index. */
export const PACK_ZIP: ZipLimits = { file: 256 * MB, total: 4096 * MB, ratio: 100, count: 200_000 }

/** Small files are never too tightly packed: a page of spaces is fine. */
const RATIO_FLOOR = MB
/** Packed data is unpacked this much at a time, so one step can't grow past a few tens of MB before the limits are checked. */
const STEP = 32 * 1024

const b2 = (d: Uint8Array, at: number) => d[at] | (d[at + 1] << 8)
const b4 = (d: Uint8Array, at: number) => (d[at] | (d[at + 1] << 8) | (d[at + 2] << 16) | (d[at + 3] << 24)) >>> 0
const b8 = (d: Uint8Array, at: number) => b4(d, at) + b4(d, at + 4) * 2 ** 32

export interface ZipEntry {
  name: string
  /** Its size packed, and unpacked, as the ZIP says. */
  size: number
  originalSize: number
  /** 0: stored as it is; 8: deflated. The only two the app reads. */
  compression: number
  flags: number
  /** Where its own header starts, and the furthest its bytes may reach (where the next entry, or the list, starts). */
  offset: number
  end: number
}

export interface Zip {
  entries: ZipEntry[]
  /** A file's bytes by its name (undefined if the ZIP has none of that name). */
  file(name: string): Uint8Array<ArrayBuffer> | undefined
  /** One entry's bytes. A stored file's are a view of the ZIP's own, so they mustn't be changed. */
  read(entry: ZipEntry): Uint8Array<ArrayBuffer>
}

/**
 * The files in a ZIP held in memory, ready to read one at a time. Throws a ZipError if it isn't a
 * ZIP, is damaged, or holds more files than the limits allow; reading a file checks its size.
 */
export function openZip(data: Uint8Array<ArrayBuffer>, limits: ZipLimits): Zip {
  const len = data.length
  // The end record is the last thing in the file, followed only by a comment of up to 64 KB.
  let eocd = -1
  for (let at = len - 22; at >= 0 && at >= len - 22 - 0xffff; at--)
    if (b4(data, at) === 0x06054b50) {
      eocd = at
      break
    }
  if (eocd < 0) throw new ZipError('no end record: not a ZIP, or cut short')
  let count = b2(data, eocd + 10)
  let listAt = b4(data, eocd + 16)
  let listEnd = eocd
  // ZIP64: a locator just before the end record points at a bigger one, with bigger numbers.
  if (eocd >= 20 && b4(data, eocd - 20) === 0x07064b50) {
    const z = b8(data, eocd - 12)
    if (z + 56 <= eocd - 20 && b4(data, z) === 0x06064b50) {
      count = b8(data, z + 32)
      listAt = b8(data, z + 48)
      listEnd = z
    } else if (count === 0xffff || listAt === 0xffffffff) throw new ZipError('ZIP64 end record missing')
    // Otherwise those four bytes were only the end of the last file, looking like a locator.
  }
  if (count > limits.count) throw new ZipError(`${count} files`)
  // Each entry in the list takes at least 46 bytes, so the count can't be more than fit in it.
  if (listAt > listEnd || count * 46 > listEnd - listAt) throw new ZipError('the list of files is outside the file')

  const entries: ZipEntry[] = []
  let p = listAt
  for (let i = 0; i < count; i++) {
    if (p + 46 > listEnd || b4(data, p) !== 0x02014b50) throw new ZipError('damaged list of files')
    const flags = b2(data, p + 8)
    const nameLen = b2(data, p + 28)
    const extraAt = p + 46 + nameLen
    const extraEnd = extraAt + b2(data, p + 30)
    const next = extraEnd + b2(data, p + 32)
    if (next > listEnd) throw new ZipError('damaged list of files')
    let size = b4(data, p + 20)
    let originalSize = b4(data, p + 24)
    let offset = b4(data, p + 42)
    const big = [originalSize, size, offset].filter((n) => n === 0xffffffff).length
    if (big) {
      // ZIP64: the numbers too big for the list are in an extra field (id 1), in that order.
      let q = extraAt
      while (q + 4 <= extraEnd && b2(data, q) !== 1) q += 4 + b2(data, q + 2)
      if (q + 4 > extraEnd || b2(data, q + 2) < 8 * big || q + 4 + b2(data, q + 2) > extraEnd) throw new ZipError('ZIP64 sizes missing')
      let f = q + 4
      if (originalSize === 0xffffffff) {
        originalSize = b8(data, f)
        f += 8
      }
      if (size === 0xffffffff) {
        size = b8(data, f)
        f += 8
      }
      if (offset === 0xffffffff) offset = b8(data, f)
    }
    entries.push({
      name: strFromU8(data.subarray(p + 46, p + 46 + nameLen), !(flags & 2048)),
      size,
      originalSize,
      compression: b2(data, p + 10),
      flags,
      offset,
      end: listAt,
    })
    p = next
  }
  // Every file's bytes come before the list, and run into no other file's (several names for the
  // same bytes is how some zip bombs grow).
  const inOrder = [...entries].sort((a, b) => a.offset - b.offset)
  for (const [k, e] of inOrder.entries()) {
    e.end = inOrder[k + 1]?.offset ?? listAt
    if (e.offset + 30 + e.size > e.end) throw new ZipError(`${e.name} overlaps another file`)
  }

  const byName = new Map(entries.map((e) => [e.name, e]))
  let unpacked = 0
  const read = (e: ZipEntry): Uint8Array<ArrayBuffer> => {
    if (e.flags & 1) throw new ZipError(`${e.name} is encrypted`)
    if (e.compression === 8 && e.originalSize > limits.file) throw new ZipError(`${e.name} unpacks to ${e.originalSize} bytes`)
    if (e.compression === 8 && e.originalSize > RATIO_FLOOR && e.originalSize > e.size * limits.ratio)
      throw new ZipError(`${e.name} is packed ${Math.round(e.originalSize / Math.max(1, e.size))} times smaller than it unpacks to`)
    if ((unpacked += e.originalSize) > limits.total) throw new ZipError(`more than ${limits.total} bytes unpacked`)
    if (e.offset + 30 > e.end || b4(data, e.offset) !== 0x04034b50) throw new ZipError(`${e.name}: damaged`)
    const start = e.offset + 30 + b2(data, e.offset + 26) + b2(data, e.offset + 28)
    if (start + e.size > e.end) throw new ZipError(`${e.name} runs into the next file`)
    const packed = data.subarray(start, start + e.size)
    if (e.compression === 0) {
      if (e.size !== e.originalSize) throw new ZipError(`${e.name}: its sizes don't match`)
      return packed
    }
    if (e.compression === 8) return inflateWithin(packed, e.originalSize, e.name)
    throw new ZipError(`${e.name} is packed a way the app can't read (method ${e.compression})`)
  }
  return {
    entries,
    file: (name) => {
      const e = byName.get(name)
      return e && read(e)
    },
    read,
  }
}

/** Unpacks deflated bytes into the size the ZIP says, stopping as soon as they give more. */
function inflateWithin(packed: Uint8Array<ArrayBuffer>, size: number, name: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(size)
  let at = 0
  const inflate = new Inflate((chunk) => {
    if (at + chunk.length > size) throw new ZipError(`${name} unpacks to more than it says`)
    out.set(chunk, at)
    at += chunk.length
  })
  try {
    for (let i = 0; i === 0 || i < packed.length; i += STEP) inflate.push(packed.subarray(i, i + STEP), i + STEP >= packed.length)
  } catch (err) {
    throw err instanceof ZipError ? err : new ZipError(`${name}: ${(err as Error)?.message}`)
  }
  // Less than it said: what there is (as other readers do).
  return at === size ? out : out.slice(0, at)
}

/**
 * The files in a ZIP that `keep` picks, read from the file a slice at a time (so a ZIP of hundreds
 * of MB isn't held in memory twice), each as a Blob of the type `type` gives. Counts what really
 * unpacks, and stops with a ZipError past the limits or on a damaged ZIP.
 */
export async function unzipBlobs(file: Blob, keep: (name: string) => boolean, type: (name: string) => string, limits: ZipLimits): Promise<[string, Blob][]> {
  const out: [string, Blob][] = []
  let failed: unknown
  let total = 0
  let count = 0
  const un = new Unzip((f) => {
    if (failed || !keep(f.name)) return
    if (++count > limits.count) return void (failed = new ZipError(`more than ${limits.count} files`))
    // What it says it unpacks to, when it says (checked again below, as it really unpacks).
    if (f.compression !== 0 && f.originalSize !== undefined && f.size !== undefined && (f.originalSize > limits.file || (f.originalSize > RATIO_FLOOR && f.originalSize > f.size * limits.ratio)))
      return void (failed = new ZipError(`${f.name} unpacks to ${f.originalSize} bytes`))
    let chunks: Uint8Array<ArrayBuffer>[] = []
    let got = 0
    f.ondata = (err, chunk, final) => {
      if (failed) return
      if (err) return void (failed = err)
      got += chunk.length
      total += chunk.length
      // f.size (the packed size) is unknown when the ZIP only says it after the bytes.
      const grew = f.compression !== 0 && (got > limits.file || (got > RATIO_FLOOR && f.size !== undefined && got > f.size * limits.ratio))
      if (grew || total > limits.total) {
        chunks = []
        return void (failed = new ZipError(`${f.name} unpacks to too much`))
      }
      chunks.push(chunk as Uint8Array<ArrayBuffer>)
      if (final) out.push([f.name, new Blob(chunks, { type: type(f.name) })])
    }
    f.start()
  })
  un.register(UnzipInflate)
  const reader = file.stream().getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      for (let i = 0; i < value.length && !failed; i += STEP) un.push(value.subarray(i, i + STEP))
      if (failed) break
    }
    if (!failed) un.push(new Uint8Array(0), true)
  } catch (err) {
    failed ??= err
  }
  if (failed) {
    void reader.cancel().catch(() => {})
    throw failed instanceof ZipError ? failed : new ZipError(String((failed as Error)?.message ?? failed))
  }
  return out
}
