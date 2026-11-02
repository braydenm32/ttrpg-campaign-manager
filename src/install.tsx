import { useEffect, useState, useSyncExternalStore } from 'react'
import { Help } from './help'
import { Ico } from './icons'
import { DeviceMobile, X } from '@phosphor-icons/react'

/**
 * "Keep this on your phone": players open the Common Room between sessions, so it's worth a place on
 * their home screen. Android and desktop Chrome offer a real install prompt (beforeinstallprompt), kept
 * here when it comes; iPhones have none, so the card says where Safari's Add to Home Screen is. The card
 * is gone for good once dismissed on this device, and never shows inside the installed app itself.
 */

interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPrompt | null = null
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Kept for the card's button instead of the browser's own mini bar.
    e.preventDefault()
    deferred = e as InstallPrompt
    changed()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    changed()
  })
}

/** Running as the installed app (home-screen icon), or inside the desktop app. */
export function isInstalled() {
  if (typeof window === 'undefined') return false
  if ('__TAURI_INTERNALS__' in window) return true
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone
  return !!standalone || window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: minimal-ui)').matches
}

/**
 * The world opened last on this device, for the installed app's shortcuts: "Common Room" opens
 * /?open=room and "The Lectern" /?open=session, and the home page sends them on to that world.
 */
const LAST = 'atlas.lastWorld'
export function rememberLastWorld(worldId?: string) {
  if (!worldId) return
  try {
    localStorage.setItem(LAST, worldId)
  } catch {
    // A private window: the shortcuts open the shelf instead.
  }
}
export function lastWorld() {
  try {
    return localStorage.getItem(LAST) ?? undefined
  } catch {
    return undefined
  }
}

const KEY = 'atlas.installCard.hidden'
const isApple = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isPhone = () => window.matchMedia?.('(pointer: coarse)').matches

/** The card. `place` only changes its wording a little: just after joining it says "now you're in". */
export function InstallCard({ place = 'room' }: { place?: 'room' | 'joined' }) {
  const prompt = useSyncExternalStore(subscribe, () => deferred)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })
  const [installed, setInstalled] = useState(isInstalled)
  useEffect(() => {
    const mq = window.matchMedia?.('(display-mode: standalone)')
    const on = () => setInstalled(isInstalled())
    mq?.addEventListener?.('change', on)
    return () => mq?.removeEventListener?.('change', on)
  }, [])
  // Laptops only see it when the browser can install the app; phones always, with the steps.
  if (hidden || installed || (!prompt && !isPhone())) return null
  const hide = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      // A private window: hidden until the next visit.
    }
    setHidden(true)
  }
  const apple = isApple()
  return (
    <section className="card install-card" aria-labelledby="install-title">
      <button className="ghost small install-close" aria-label="Don’t show this again" title="Don’t show this again" onClick={hide}>
        <Ico as={X} />
      </button>
      <h2 id="install-title">
        <Ico as={DeviceMobile} /> Keep this on your phone <Help topic="installApp" />
      </h2>
      <p className="muted small">
        {place === 'joined' ? 'You’re in. ' : ''}Add the Warded Atlas to your home screen and the Common Room opens like an app, ready between sessions and at the table.
      </p>
      {prompt ? (
        <div className="row wrap">
          <button
            className="primary"
            onClick={async () => {
              await prompt.prompt()
              const { outcome } = await prompt.userChoice
              deferred = null
              changed()
              if (outcome === 'accepted') setInstalled(true)
            }}
          >
            Add to home screen
          </button>
          <button className="ghost" onClick={hide}>Not now</button>
        </div>
      ) : (
        <ul className="install-steps small">
          <li className={apple ? 'here' : undefined}>
            <b>iPhone or iPad:</b> in Safari, tap Share (the square with an arrow), then <b>Add to Home Screen</b>.
          </li>
          <li className={!apple ? 'here' : undefined}>
            <b>Android:</b> in Chrome, tap the ⋮ menu, then <b>Add to home screen</b> (or <b>Install app</b>).
          </li>
        </ul>
      )}
    </section>
  )
}
