import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapPin, MapTrifold } from '@phosphor-icons/react'
import { Modal } from './components'
import type { Entity } from './db'
import { useVisibleMaps } from './counts'
import { Help } from './help'
import { Ico } from './icons'
import { worldPath } from './paths'

/**
 * "Pin on a map…" in a page's menu: pick a map, then click where the page goes. The map opens
 * ready to place a pin linked to this page (MapView reads `?place=<page id>`).
 */
export function PinOnMapButton({ entity, className }: { entity: Entity; className?: string }) {
  const [open, setOpen] = useState(false)
  const maps = useVisibleMaps(entity.worldId)
  const navigate = useNavigate()
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <Ico as={MapPin} /> Pin on a map…
      </button>
      {open && (
        <Modal title={`Pin “${entity.name}” on a map`} onClose={() => setOpen(false)}>
          {maps.length === 0 ? (
            <p>
              This world has no maps yet. <Link to={`${worldPath(entity.worldId)}/maps`}>Add or draw one</Link> first.
            </p>
          ) : (
            <>
              <p className="small muted">
                Pick a map, then click the spot where “{entity.name}” is. <Help topic="pinOnMap" />
              </p>
              <ul className="entity-list pin-on-map-list">
                {maps.map((m) => (
                  <li key={m.id}>
                    <button type="button" className="link" onClick={() => navigate(`${worldPath(entity.worldId)}/maps/${m.id}?place=${entity.id}`)}>
                      <Ico as={MapTrifold} /> {m.name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Modal>
      )}
    </>
  )
}
