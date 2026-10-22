import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { db, type Asset } from './db'
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
  const { worldId = '' } = useParams()
  // null once we know the world isn't on this device (undefined means still loading).
  const world = useLiveQuery(async () => (await db.worlds.get(worldId)) ?? null, [worldId])
  return { worldId, world }
}

/** All entities in the world the current viewer is allowed to see (templates aren't real pages, so they're left out). */
export function useVisibleEntities(worldId: string) {
  const { isGM } = useViewMode()
  return (
    useLiveQuery(
      () =>
        db.entities
          .where({ worldId })
          .filter((e) => !e.template && (isGM || e.visibility === 'players'))
          .sortBy('name'),
      [worldId, isGM],
    ) ?? []
  )
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
