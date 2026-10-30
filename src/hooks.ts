import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { db, type Asset, type Entity } from './db'
import { resolveWorld, usePathsVersion } from './paths'
import { useViewMode } from './viewMode'

/** Object URL for a stored asset, revoked automatically. */
export function useAssetUrl(assetId: string | undefined) {
  const asset = useLiveQuery(() => (assetId ? db.assets.get(assetId) : undefined), [assetId])
  return useBlobUrl(asset)
}

export function useBlobUrl(asset: Asset | undefined) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!asset) return setUrl(undefined)
    const u = URL.createObjectURL(asset.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [asset])
  return url
}

export function useWorld() {
  const { worldId: param = '' } = useParams()
  usePathsVersion()
  const worldId = resolveWorld(param)
  // null once we know the world isn't on this device (undefined means still loading).
  const world = useLiveQuery(async () => (await db.worlds.get(worldId)) ?? null, [worldId])
  return { worldId, world }
}

/** All entities in the world the current viewer is allowed to see (templates aren't real pages, so they're left out). */
export function useVisibleEntities(worldId: string) {
  const { isGM, previewAs } = useViewMode()
  const as = previewAs?.userId
  return (
    useLiveQuery(
      async () => {
        const list = await db.entities
          .where({ worldId })
          .filter((e) => !e.template && (isGM || e.visibility === 'players' || (!!as && !!e.revealedTo?.includes(as))))
          .sortBy('name')
        if (isGM) return list
        // Like the server's copy: a place or carrier the player can't see isn't named.
        const seen = new Set(list.map((e) => e.id))
        return list.map(asPlayerSees).map((e) => ({
          ...e,
          parentId: e.parentId && seen.has(e.parentId) ? e.parentId : undefined,
          heldBy: e.heldBy && (e.heldBy === 'party' || seen.has(e.heldBy)) ? e.heldBy : undefined,
        }))
      },
      [worldId, isGM, as],
    ) ?? []
  )
}

/**
 * A page as a player's copy has it, for the GM's player preview: GM notes gone, a page revealed to
 * one player flagged as theirs, and a status, links and clocks the players don't know left out. The server does the
 * same in public.player_view; player copies already arrive this way.
 */
export function asPlayerSees(e: Entity): Entity {
  return {
    ...e,
    gmNotes: '',
    secretForYou: e.secretForYou || e.visibility !== 'players',
    visibility: 'players',
    status: e.statusKnown ? e.status : undefined,
    // Links and clocks players haven't been told about (links to pages they can't see drop out where they're shown).
    relations: e.relations?.filter((r) => r.known),
    clocks: e.clocks?.filter((c) => c.known),
    objectives: e.objectives?.filter((o) => o.known),
    rewards: e.rewards?.filter((r) => r.known),
    fields: e.fields.filter((f) => !f.gm),
    aliases: undefined,
    gmTags: undefined,
  }
}

/**
 * Pages that start a tree of places: no parent, a parent that isn't there, or (for old bad data where
 * places sit inside each other in a loop) the first of the loop, so nothing drops out of the lists.
 */
export function treeRoots(entities: Entity[]): Set<string> {
  const byId = new Map(entities.map((e) => [e.id, e]))
  const roots = new Set<string>()
  for (const e of entities) {
    if (!e.parentId || !byId.has(e.parentId)) {
      roots.add(e.id)
      continue
    }
    // Walk up: if we come back round to this page it's in a loop, and the lowest id of the loop is its root.
    let low = e.id
    let p: Entity | undefined = byId.get(e.parentId)
    for (let n = 0; p && p.id !== e.id && n < entities.length; n++) {
      if (p.id < low) low = p.id
      p = p.parentId ? byId.get(p.parentId) : undefined
    }
    if (p && p.id === e.id && low === e.id) roots.add(e.id)
  }
  return roots
}

/** The world's page templates (GM only). */
export function useTemplates(worldId: string) {
  return useLiveQuery(() => db.entities.where({ worldId }).filter((e) => !!e.template).sortBy('name'), [worldId]) ?? []
}

export async function saveFileAsAsset(worldId: string, file: File | Blob, name: string, tags: string[] = []) {
  const id = crypto.randomUUID()
  await db.assets.add({
    id,
    worldId,
    name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    blob: file,
    tags,
    visibility: 'gm',
    createdAt: Date.now(),
  })
  return id
}

export function imageSize(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    img.src = url
  })
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
