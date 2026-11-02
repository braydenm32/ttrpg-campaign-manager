import { useNavigate } from 'react-router-dom'
import { blankEntity, fromTemplate, newId, typeLabel, type Entity, type EntityType, type World } from './db'
import { useMenu } from './components'
import { Ico } from './icons'
import { HELP } from './help'
import { Copy } from '@phosphor-icons/react'
import { useTemplates } from './hooks'
import { openNewPage } from './pendingPages'

/** Opens the editor on a new page (blank, or from a template). It's only added to the world once saved. */
export function useCreatePage(world: World | null | undefined) {
  const navigate = useNavigate()
  return async (type: EntityType, customType?: string, template?: Entity) => {
    if (!world) return
    const label = typeLabel({ type, customType }, world)
    const e = template ? fromTemplate(template) : { ...blankEntity(world.id, type, `New ${label.one}`), ...(customType ? { customType } : {}) }
    openNewPage(navigate, e)
  }
}

/**
 * "+ New …" for one page type. When the world has templates of that type, a menu offers them
 * alongside a blank page.
 */
export function NewPageButton({ world, type, customType, className = 'primary' }: { world: World; type: EntityType; customType?: string; className?: string }) {
  const create = useCreatePage(world)
  const templates = useTemplates(world.id).filter((t) => t.type === type && (type !== 'custom' || t.customType === customType))
  const menu = useMenu()
  const label = typeLabel({ type, customType }, world)
  if (!templates.length)
    return (
      <button className={className} onClick={() => create(type, customType)}>
        + New {label.one}
      </button>
    )
  return (
    <span className="menu-wrap" {...menu.wrapProps}>
      <button className={className} {...menu.buttonProps}>
        + New {label.one} ▾
      </button>
      {menu.open && (
        <span className="menu" {...menu.menuProps}>
          <button role="menuitem" onClick={() => create(type, customType)}>Blank page</button>
          {templates.map((t) => (
            <button key={t.id} role="menuitem" onClick={() => create(type, customType, t)}>
              From template: {t.name}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}

/**
 * A copy of a page to start the next one from (three similar guards, a second tavern). Everything
 * the GM wrote comes along; what belongs to the original alone doesn't: who it was revealed to, a
 * player's own text, nicknames (two pages can't answer to one name), inspiration and a reveal date.
 * The copy starts GM only and waits in the editor like any new page, so Cancel leaves nothing behind.
 */
export function duplicateOf(e: Entity): Entity {
  const c = structuredClone(e)
  const now = Date.now()
  const fresh = <T extends { id: string }>(list?: T[]) => list?.map((x) => ({ ...x, id: newId() }))
  const copy: Entity = {
    ...c,
    id: newId(),
    name: `${e.name} (copy)`,
    visibility: 'gm',
    createdAt: now,
    updatedAt: now,
    clocks: fresh(c.clocks)?.map((k) => ({ ...k, filled: 0 })),
    objectives: fresh(c.objectives),
    rewards: fresh(c.rewards),
    relations: fresh(c.relations),
  }
  const drop = ['revealedTo', 'secretForYou', 'playerBody', 'aliases', 'inspiration', 'revealAt']
  for (const k of drop) delete (copy as unknown as Record<string, unknown>)[k]
  for (const k of ['clocks', 'objectives', 'rewards', 'relations'] as const) if (copy[k] === undefined) delete copy[k]
  return copy
}

/** "Duplicate" on a page's menu: opens the editor on a copy, not saved until Save. */
export function DuplicateButton({ entity, className = 'ghost' }: { entity: Entity; className?: string }) {
  const navigate = useNavigate()
  return (
    <button className={className} title={HELP.duplicate} onClick={() => openNewPage(navigate, duplicateOf(entity))}>
      <Ico as={Copy} /> Duplicate
    </button>
  )
}
