import { useSyncExternalStore } from 'react'

/**
 * Dark ("candlelit", the default) or light ("parchment"), or follow the device. The choice is per
 * device and lives in localStorage, like the help-tips switch; it isn't synced or put in backups.
 */
export type ThemeChoice = 'system' | 'dark' | 'light'

const KEY = 'theme'
const listeners = new Set<() => void>()

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'system' || v === 'light' ? v : 'dark'
  } catch {
    return 'dark'
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
    localStorage.setItem(KEY, choice)
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
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={choice === v}
            tabIndex={choice === v ? 0 : -1}
            className={choice === v ? 'on' : ''}
            onClick={() => setTheme(v)}
            onKeyDown={(e) => {
              // A radio group is one Tab stop; the arrow keys move the choice.
              const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
              if (!step) return
              e.preventDefault()
              const at = options.findIndex(([x]) => x === v)
              const next = options[(at + step + options.length) % options.length][0]
              setTheme(next)
              ;(e.currentTarget.parentElement?.querySelectorAll('button')[options.findIndex(([x]) => x === next)] as HTMLElement | undefined)?.focus()
            }}
          >
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
