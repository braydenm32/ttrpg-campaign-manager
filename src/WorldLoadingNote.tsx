import { useCallback, useSyncExternalStore } from 'react'
import { worldLoading } from './worldLoading'

const SAY = {
  drawing: 'Drawing this world’s maps and pictures',
  downloading: 'Downloading this world’s pictures and maps',
  unpacking: 'Unpacking this backup’s pictures and maps',
}

/** While a world's pictures and maps are still arriving, says how far it's got. */
export function WorldLoadingNote({ worldId }: { worldId: string }) {
  const job = useSyncExternalStore(
    worldLoading.subscribe,
    useCallback(() => worldLoading.get(worldId), [worldId]),
  )
  if (!job) return null
  return (
    <div className="player-banner" role="status">
      {SAY[job.what]}… {job.done} of {job.total}.{' '}
      {job.what === 'unpacking' ? 'Keep this tab open until it’s done; look around meanwhile.' : 'Look around meanwhile: each one appears as soon as it’s ready.'}
    </div>
  )
}
