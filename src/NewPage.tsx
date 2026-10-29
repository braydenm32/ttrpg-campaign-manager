import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { blankEntity, db, fromTemplate, typeLabel, type Entity, type EntityType, type World } from './db'
import { useTemplates } from './hooks'
import { pagePath } from './paths'

/** Makes a new page (blank, or from a template) and opens it for editing. `new=1` lets Cancel take back a page nobody wrote on. */
export function useCreatePage(world: World | null | undefined) {
  const navigate = useNavigate()
  return async (type: EntityType, customType?: string, template?: Entity) => {
    if (!world) return
    const label = typeLabel({ type, customType }, world)
    const e = template ? fromTemplate(template) : { ...blankEntity(world.id, type, `New ${label.one}`), ...(customType ? { customType } : {}) }
    await db.entities.add(e)
    navigate(`${pagePath(world.id, e.id)}?edit=1&new=1`)
  }
}

/**
 * "+ New …" for one page type. When the world has templates of that type, a menu offers them
 * alongside a blank page.
 */
export function NewPageButton({ world, type, customType, className = 'primary' }: { world: World; type: EntityType; customType?: string; className?: string }) {
  const create = useCreatePage(world)
  const templates = useTemplates(world.id).filter((t) => t.type === type && (type !== 'custom' || t.customType === customType))
  const [open, setOpen] = useState(false)
  const label = typeLabel({ type, customType }, world)
  if (!templates.length)
    return (
      <button className={className} onClick={() => create(type, customType)}>
        + New {label.one}
      </button>
    )
  return (
    <span className="menu-wrap">
      <button className={className} aria-expanded={open} onClick={() => setOpen(!open)}>
        + New {label.one} ▾
      </button>
      {open && (
        <span className="menu" onMouseLeave={() => setOpen(false)}>
          <button onClick={() => create(type, customType)}>Blank page</button>
          {templates.map((t) => (
            <button key={t.id} onClick={() => create(type, customType, t)}>
              From template: {t.name}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}
