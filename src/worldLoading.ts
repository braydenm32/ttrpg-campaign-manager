/**
 * A world opens as soon as its pages are saved; its pictures and maps then arrive in the
 * background (drawn, downloaded or unpacked from a backup). This keeps count of how far that has
 * got, for the note at the top of the world's screens.
 */
export interface WorldLoading {
  worldId: string
  /** Drawing (the example and sample worlds), downloading (from the cloud or a GM), unpacking (a backup). */
  what: 'drawing' | 'downloading' | 'unpacking'
  done: number
  total: number
}

const jobs = new Map<string, WorldLoading>()
const listeners = new Set<() => void>()
const tell = () => listeners.forEach((l) => l())

export const worldLoading = {
  get: (worldId: string) => jobs.get(worldId),
  busy: (worldId: string) => jobs.has(worldId),
  subscribe: (l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  set(job: WorldLoading) {
    jobs.set(job.worldId, job)
    tell()
  },
  clear(worldId: string) {
    if (jobs.delete(worldId)) tell()
  },
}

// Unpacking a backup can't carry on after the tab closes (the file isn't kept), so the browser asks first.
if (typeof window !== 'undefined')
  window.addEventListener('beforeunload', (e) => {
    if ([...jobs.values()].some((j) => j.what === 'unpacking')) e.preventDefault()
  })

/**
 * Runs `step` for each item, in order, keeping the count for the note and pausing between items
 * so the page stays responsive. Stops early if `step` returns false (the world was deleted, say).
 */
export async function loadInBackground<T>(worldId: string, what: WorldLoading['what'], items: T[], step: (item: T) => Promise<boolean | void>) {
  if (!items.length) return
  let done = 0
  worldLoading.set({ worldId, what, done, total: items.length })
  try {
    for (const item of items) {
      if ((await step(item)) === false) return
      worldLoading.set({ worldId, what, done: ++done, total: items.length })
      await new Promise((r) => setTimeout(r, 0))
    }
  } finally {
    worldLoading.clear(worldId)
  }
}
