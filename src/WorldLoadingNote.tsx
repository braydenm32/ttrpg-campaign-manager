import { useCallback, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { Help } from './help'
import { worldLoading } from './worldLoading'
import './desk.css'

const SAY = {
  drawing: 'Drawing this world’s maps and pictures',
  downloading: 'Downloading this world’s pictures and maps',
  unpacking: 'Unpacking this backup’s pictures and maps',
}
const SHORT = { drawing: 'Drawing maps', downloading: 'Downloading pictures', unpacking: 'Unpacking' }

/**
 * While a world's pictures and maps are still arriving, a small chip in the top bar says how far
 * it's got (a ring that fills, and the count). Pressing it says more; a backup being unpacked also
 * asks you to keep the tab open.
 */
export function WorldLoadingNote({ worldId }: { worldId: string }) {
  const job = useSyncExternalStore(
    worldLoading.subscribe,
    useCallback(() => worldLoading.get(worldId), [worldId]),
  )
  const [open, setOpen] = useState(false)
  if (!job) return null
  const sentence = `${SAY[job.what]}… ${job.done} of ${job.total}.`
  const more = job.what === 'unpacking' ? 'Keep this tab open until it’s done; look around meanwhile.' : 'Look around meanwhile: each one appears as soon as it’s ready.'
  return (
    <span className="loading-chip" role="status" data-world-loading={job.what}>
      <button className="ghost" aria-expanded={open} title={`${sentence} ${more}`} onClick={() => setOpen(!open)}>
        <span className="loading-ring" style={{ '--done': job.total ? job.done / job.total : 0 } as CSSProperties} aria-hidden="true" />
        <span className="loading-label">
          {SHORT[job.what]} {job.done}/{job.total}
        </span>
        <span className="sr-only">{sentence}</span>
      </button>
      {open && (
        <span className="loading-chip-note">
          {sentence} {more} <Help topic="worldLoading" />
        </span>
      )}
    </span>
  )
}
