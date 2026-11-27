import type { CSSProperties, ReactNode } from 'react'
import { WorldToday } from './calendar'
import { worldColor, type World } from './db'
import { Help, type HelpTopic } from './help'
import { useAssetUrl } from './hooks'
import { plainLinks } from './text'
import { useViewMode } from './viewMode'

/**
 * The top of a world's front page: its cover picture (or its colour), name, description and today's
 * date. `compact` is the Desk's slim band, with the date's controls folded away under the date.
 * `system` is the game to name, when it isn't the world's default (the Desk gives the game being played).
 */
export function WorldCover({ world, help = 'overview', compact = false, system, children }: { world: World; help?: HelpTopic; compact?: boolean; system?: string; children?: ReactNode }) {
  const { isGM } = useViewMode()
  const cover = useAssetUrl(world.coverId)
  return (
    <header className={`world-cover ${cover ? 'has-picture' : ''} ${compact ? 'compact' : ''}`} style={{ '--world': worldColor(world), '--cover': cover ? `url("${cover}")` : undefined } as CSSProperties}>
      <div className="world-cover-text">
        <h1>
          {world.name} <Help topic={help} />
        </h1>
        {world.description && <p>{plainLinks(world.description)}</p>}
        <span className="world-cover-meta">{system || world.system}</span>
      </div>
      <div className="world-cover-side">
        <WorldToday world={world} isGM={isGM && !world.shared} folded={compact} />
        {children}
      </div>
    </header>
  )
}
