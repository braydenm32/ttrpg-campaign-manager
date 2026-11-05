/**
 * The Warded Atlas pack: map pieces that come with the app, for every GM. Its pictures live on
 * Cloudflare R2 at PACK_URL (made by scripts/build-pack.py from the pack's index, uploaded by
 * scripts/upload-pack.py), next to manifest.json, the list of its pieces. The list is kept on this
 * device like a GM's own pack, so the picker works offline; pictures download when a piece is
 * picked and are kept, just as for the GM's own packs. Until the pack is online, nothing shows.
 */
import { db, type PackPiece } from '../db'

export const BUILTIN_PACK = 'warded-atlas'
/** Where the pack is online. VITE_PACK_URL can point the app somewhere else (a test, a local copy). */
export const PACK_URL = ((import.meta.env.VITE_PACK_URL as string | undefined) ?? 'https://packs.wardedatlas.com').replace(/\/$/, '')

export interface PackManifest {
  format: 'warded-atlas-pack'
  id: string
  name: string
  /** Goes up whenever the pack changes. */
  version: number
  pieces: Omit<PackPiece, 'packId' | 'updatedAt' | 'owner' | 'pending'>[]
}

/** Where one picture of a built-in piece is. */
export const builtinFileUrl = (pieceId: string, rev: number, version: number, kind: 'full' | 'thumb', ext: string) => `${PACK_URL}/${pieceId}/${rev}-${version}-${kind}.${ext}`

const CHECKED = 'packs.builtin.checked'
let loading: Promise<boolean> | undefined

/**
 * Brings the built-in pack's list onto this device, or refreshes it (at most every few hours).
 * Pieces it no longer has stay, hidden, for maps that use them.
 */
export function loadBuiltinPack(force = false): Promise<boolean> {
  loading ??= (async () => {
    try {
      const last = Number(localStorage.getItem(CHECKED)) || 0
      if (!force && Date.now() - last < 6 * 3600_000 && (await db.packs.get(BUILTIN_PACK))) return true
    } catch {
      // no storage: just check
    }
    try {
      const res = await fetch(`${PACK_URL}/manifest.json`, { cache: 'no-cache' })
      if (!res.ok) return false
      const m = (await res.json()) as PackManifest
      if (m.format !== 'warded-atlas-pack' || m.id !== BUILTIN_PACK || !Array.isArray(m.pieces)) return false
      const now = Date.now()
      await db.transaction('rw', [db.packs, db.packPieces], async () => {
        const had = await db.packs.get(BUILTIN_PACK)
        await db.packs.put({ id: BUILTIN_PACK, name: m.name || 'Warded Atlas pack', builtin: true, createdAt: had?.createdAt ?? now, updatedAt: now })
        const before = new Map((await db.packPieces.where({ packId: BUILTIN_PACK }).toArray()).map((p) => [p.id, p]))
        for (const x of m.pieces) {
          const old = before.get(x.id)
          before.delete(x.id)
          // a piece with new pictures keeps the old ones listed, for maps drawn with them
          const older = old && old.rev !== x.rev ? { ...(old.older ?? {}), [old.rev]: old.versions } : old?.older
          await db.packPieces.put({ ...x, packId: BUILTIN_PACK, updatedAt: now, ...(older ? { older } : {}) })
        }
        for (const gone of before.values()) if (!gone.hidden) await db.packPieces.update(gone.id, { hidden: true })
      })
      try {
        localStorage.setItem(CHECKED, String(Date.now()))
      } catch {
        // fine
      }
      return true
    } catch {
      // offline, or the pack isn't online yet
      return false
    } finally {
      loading = undefined
    }
  })()
  return loading
}
