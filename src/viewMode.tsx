import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Entity, Visibility } from './db'

/**
 * The app has two lenses: the GM sees everything, players see only what the GM has revealed.
 * "Player view" is a preview of exactly what a player would see. The GM can also preview as one
 * particular player, which adds the pages and ":::for" passages revealed to them alone.
 */
type Mode = 'gm' | 'player'

/** The player the GM is previewing as: their account id and the names of the characters they play. */
export interface PreviewAs {
  userId: string
  name: string
  characterNames: string[]
}

interface ViewModeValue {
  mode: Mode
  setMode: (m: Mode) => void
  previewAs?: PreviewAs
  setPreviewAs: (p: PreviewAs | undefined) => void
}

const ViewModeContext = createContext<ViewModeValue>({
  mode: 'gm',
  setMode: () => {},
  setPreviewAs: () => {},
})

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(() => {
    try {
      return localStorage.getItem('viewMode') === 'player' ? 'player' : 'gm'
    } catch {
      return 'gm'
    }
  })
  const [previewAs, setPreviewAs] = useState<PreviewAs>()
  const setMode = (m: Mode) => {
    setModeState(m)
    if (m === 'gm') setPreviewAs(undefined)
  }
  useEffect(() => {
    try {
      localStorage.setItem('viewMode', mode)
    } catch {
      /* storage unavailable */
    }
    document.documentElement.dataset.viewMode = mode
  }, [mode])
  return (
    <ViewModeContext.Provider value={{ mode, setMode, previewAs: mode === 'player' ? previewAs : undefined, setPreviewAs }}>
      {children}
    </ViewModeContext.Provider>
  )
}

/**
 * The names a ":::for" passage is matched against: each claimed character's full name and first name.
 * Keep in step with public.viewer_names in supabase/migrations.
 */
export function characterNames(names: string[]) {
  return [...new Set(names.flatMap((n) => [n.trim(), n.trim().split(' ')[0]]).filter(Boolean).map((n) => n.toLowerCase()))]
}

export function useViewMode() {
  const { mode, setMode, previewAs, setPreviewAs } = useContext(ViewModeContext)
  const isGM = mode === 'gm'
  /** True when the current viewer may see content with this visibility. */
  const canSee = (v: Visibility | undefined) => isGM || v === 'players'
  /** Like canSee, for pages: also true for a GM-only page revealed to the player being previewed. */
  const canSeeEntity = (e: Pick<Entity, 'visibility' | 'revealedTo'>) =>
    canSee(e.visibility) || (!!previewAs && !!e.revealedTo?.includes(previewAs.userId))
  return { mode, setMode, isGM, canSee, canSeeEntity, previewAs, setPreviewAs }
}

/** Locks everything inside it to the player view (used for read-only worlds opened from a share link). */
export function ForcePlayerView({ children }: { children: ReactNode }) {
  return (
    <ViewModeContext.Provider value={{ mode: 'player', setMode: () => {}, setPreviewAs: () => {} }}>{children}</ViewModeContext.Provider>
  )
}
