import type { CSSProperties, ReactNode } from 'react'
import { WorldToday } from './calendar'
import { worldColor, type World } from './db'
import { Help, type HelpTopic } from './help'
import { useAssetUrl } from './hooks'
import { plainLinks } from './text'
import { useViewMode } from './viewMode'

/** The top of a world's Home: its cover picture (or its colour), name, description and today's date. */
export function WorldCover({ world, help = 'overview', children }: { world: World; help?: HelpTopic; children?: ReactNode }) {
  const { isGM } = useViewMode()
  const cover = useAssetUrl(world.coverId)
  return (
    <header className={`world-cover ${cover ? 'has-picture' : ''}`} style={{ '--world': worldColor(world), '--cover': cover ? `url("${cover}")` : undefined } as CSSProperties}>
      <div className="world-cover-text">
        <h1>
          {world.name} <Help topic={help} />
        </h1>
        {world.description && <p>{plainLinks(world.description)}</p>}
        <span className="world-cover-meta">{world.system}</span>
      </div>
      <div className="world-cover-side">
        <WorldToday world={world} isGM={isGM && !world.shared} />
        {children}
      </div>
    </header>
  )
}
