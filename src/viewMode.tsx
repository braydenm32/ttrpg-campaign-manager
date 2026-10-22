import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Visibility } from './db'

/**
 * The app has two lenses: the GM sees everything, players see only what the GM has revealed.
 * "Player view" is a preview of exactly what a player would see.
 */
type Mode = 'gm' | 'player'

const ViewModeContext = createContext<{ mode: Mode; setMode: (m: Mode) => void }>({
  mode: 'gm',
  setMode: () => {},
})

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    try {
      return localStorage.getItem('viewMode') === 'player' ? 'player' : 'gm'
    } catch {
      return 'gm'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('viewMode', mode)
    } catch {
      /* storage unavailable */
    }
    document.documentElement.dataset.viewMode = mode
  }, [mode])
  return <ViewModeContext.Provider value={{ mode, setMode }}>{children}</ViewModeContext.Provider>
}

export function useViewMode() {
  const { mode, setMode } = useContext(ViewModeContext)
  const isGM = mode === 'gm'
  /** True when the current viewer may see content with this visibility. */
  const canSee = (v: Visibility | undefined) => isGM || v === 'players'
  return { mode, setMode, isGM, canSee }
}

/** Locks everything inside it to the player view (used for read-only worlds opened from a share link). */
export function ForcePlayerView({ children }: { children: ReactNode }) {
  return <ViewModeContext.Provider value={{ mode: 'player', setMode: () => {} }}>{children}</ViewModeContext.Provider>
}
