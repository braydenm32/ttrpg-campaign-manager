import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Entity } from './db'
import { Empty, Modal } from './components'
import { Help } from './help'
import { Thumb, useShowablePictures } from './showing'

const PAGE = 48

/**
 * "Use an existing image": pick a picture already in the world's Files (uploaded on another page,
 * as a handout, a map, the example's portraits) for a page, instead of uploading it again.
 * Pictures players can never be sent (the clean copy of a fogged map) are left out. Pictures whose
 * name matches the page come first. Drawn in a portal so its buttons and search box sit outside
 * the editor's form (Enter or a tap can't save the page).
 */
export function ImagePicker({
  worldId,
  entities,
  pageName,
  current,
  onPick,
  onClose,
}: {
  worldId: string
  entities: Entity[]
  pageName: string
  current?: string
  onPick: (assetId: string) => void
  onClose: () => void
}) {
  const pictures = useShowablePictures(worldId, entities)
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const needle = q.trim().toLowerCase()
  const own = pageName.trim().toLowerCase()
  const matches = (p: (typeof pictures)[number]) =>
    !needle || [p.name, p.asset.name, ...p.asset.tags].some((s) => s.toLowerCase().includes(needle))
  const mine = (p: (typeof pictures)[number]) => Number(!!own && (p.name.toLowerCase().includes(own) || p.asset.tags.some((t) => t.toLowerCase() === own)))
  const found = pictures.filter(matches).sort((a, b) => mine(b) - mine(a))
  return createPortal(
    <Modal title="Use an existing image" onClose={onClose}>
      <div className="image-picker">
        <p className="muted small">
          Pick a picture already in this world’s Files. It isn’t copied: the same picture can be on several pages. <Help topic="existingImage" />
        </p>
        {pictures.length > 0 && (
          <input
            className="search"
            type="search"
            placeholder="Find a picture by name or tag…"
            aria-label="Find a picture"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setLimit(PAGE)
            }}
          />
        )}
        {pictures.length === 0 ? (
          <Empty>No pictures in this world yet. Upload one on a page, or in More › Files, and it can be used here after.</Empty>
        ) : found.length === 0 ? (
          <Empty>No picture’s name or tag has “{q.trim()}” in it.</Empty>
        ) : (
          <div className="show-thumbs image-picker-grid">
            {found.slice(0, limit).map(({ asset, name }) => (
              <Thumb
                key={asset.id}
                asset={asset}
                name={name}
                verb="Use"
                on={asset.id === current}
                onClick={() => {
                  onPick(asset.id)
                  onClose()
                }}
              />
            ))}
          </div>
        )}
        {found.length > limit && (
          <button type="button" className="ghost show-all" onClick={() => setLimit(limit + PAGE)}>
            Show more ({found.length - limit} left)
          </button>
        )}
      </div>
    </Modal>,
    document.body,
  )
}
