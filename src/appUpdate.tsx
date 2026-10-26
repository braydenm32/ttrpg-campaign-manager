import { useSyncExternalStore } from 'react'
import { db } from './db'

/**
 * Keeping the app safe on this device:
 *  - A new version of the web app waits until you choose to reload, instead of reloading by itself
 *    (which could cut off a recording or an edit in the middle of a session).
 *  - The browser is asked to keep this site's data, so it isn't cleared to save space (Safari, for
 *    one, clears sites you haven't opened for a week unless asked).
 */

let reload: (() => void) | undefined
const listeners = new Set<() => void>()
const updateStore = {
  get: () => !!reload,
  subscribe: (l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}

/** Registers the offline worker for the web version. The desktop app bundles its files, so it doesn't need this. */
export function startOffline() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || '__TAURI_INTERNALS__' in window) return
  import('virtual:pwa-register').then(({ registerSW }) => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        reload = () => update(true)
        listeners.forEach((l) => l())
      },
    })
  })
}

/** Asks the browser to keep this site's data, once there's something worth keeping. */
export async function keepData() {
  try {
    if (!navigator.storage?.persist || (await navigator.storage.persisted())) return
    if ((await db.worlds.count()) > 0) await navigator.storage.persist()
  } catch {
    // Not supported here: the backup reminder still helps.
  }
}

// The first world made on this device is the moment to ask.
db.worlds.hook('creating', () => void setTimeout(keepData, 500))

/** Whether the browser has promised to keep this site's data (undefined while checking or unknown). */
export async function dataIsKept(): Promise<boolean | undefined> {
  try {
    return navigator.storage?.persisted ? await navigator.storage.persisted() : undefined
  } catch {
    return undefined
  }
}

/** "A new version is ready": shown until you reload. */
export function UpdateBanner() {
  const ready = useSyncExternalStore(updateStore.subscribe, updateStore.get)
  if (!ready) return null
  return (
    <div className="update-banner" role="status">
      <span>✨ A new version of the Warded Atlas is ready.</span>
      <button className="small primary" onClick={() => reload?.()}>
        Reload now
      </button>
      <span className="muted small">or carry on: it updates next time you open the app.</span>
    </div>
  )
}
