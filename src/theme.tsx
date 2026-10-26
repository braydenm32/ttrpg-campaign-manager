import { useSyncExternalStore } from 'react'

/**
 * Dark ("candlelit") or light ("parchment"), or follow the device. The choice is per device and
 * lives in localStorage, like the help-tips switch; it isn't synced or put in backups.
 */
export type ThemeChoice = 'system' | 'dark' | 'light'

const KEY = 'theme'
const listeners = new Set<() => void>()

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' || v === 'light' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** Puts the choice on <html> so the CSS can follow it, and colours the phone's status bar to match. */
export function applyTheme(choice = read()) {
  const root = document.documentElement
  if (choice === 'system') delete root.dataset.theme
  else root.dataset.theme = choice
  const light = choice === 'light' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f3ecdd' : '#16141a')
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    // Private windows can refuse storage; the choice then lasts until the page is closed.
  }
  applyTheme(choice)
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function ThemePicker() {
  const choice = useSyncExternalStore(subscribe, read)
  const options: [ThemeChoice, string][] = [
    ['system', 'Match this device'],
    ['dark', 'Candlelit (dark)'],
    ['light', 'Parchment (light)'],
  ]
  return (
    <div className="theme-picker">
      <span className="label">Look</span>
      <div className="segmented" role="radiogroup" aria-label="Look">
        {options.map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={choice === v} className={choice === v ? 'on' : ''} onClick={() => setTheme(v)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Keeps the status-bar colour right when the device switches between light and dark. */
export function watchSystemTheme() {
  applyTheme()
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => applyTheme())
}
