import { Link } from 'react-router-dom'
import type { Entity, World } from './db'
import { Help } from './help'
import { TypeIcon } from './icons'
import { pagePath } from './paths'
import { useRecentPages } from './recent'

/** The Desk's short row of pages opened lately on this device (see recent.ts). Nothing until a page has been opened. */
export function RecentlyOpenedRow({ world, entities }: { world: World; entities: Entity[] }) {
  const recent = useRecentPages(world.id, entities, 6)
  if (!recent.length) return null
  return (
    <nav className="recently-opened small" aria-label="Recently opened">
      <span className="muted">
        Recently opened <Help topic="recentPages" />
      </span>
      {recent.map((e) => (
        <Link key={e.id} to={pagePath(world.id, e.id)}>
          <TypeIcon type={e.type} custom={world.customTypes?.find((c) => c.id === e.customType)} size="1em" /> {e.name}
        </Link>
      ))}
    </nav>
  )
}
