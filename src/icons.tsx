import type { Icon as PhosphorIcon, IconProps } from '@phosphor-icons/react'
import {
  BeerStein,
  Books,
  CastleTurret,
  Compass,
  DiceFive,
  File,
  FlagBanner,
  Key,
  Scroll,
  Shield,
  Sparkle,
  Spiral,
  User,
} from '@phosphor-icons/react'
import type { CustomType, EntityType } from './db'

/**
 * One set of thin line icons for the whole app, so nothing depends on how a phone draws emoji.
 * Custom page types keep the emoji the GM typed for them.
 */
export const TYPE_ICONS: Record<EntityType, PhosphorIcon> = {
  location: CastleTurret,
  npc: User,
  pc: Shield,
  faction: FlagBanner,
  item: Key,
  event: Scroll,
  quest: Compass,
  shop: BeerStein,
  deity: Sparkle,
  lore: Books,
  thread: Spiral,
  table: DiceFive,
  custom: File,
}

/** The icon for a page type: a line icon for built-in types, the GM's own emoji for custom ones. */
export function TypeIcon({ type, custom, size = '1.1em' }: { type: EntityType; custom?: CustomType; size?: number | string }) {
  if (type === 'custom' && custom?.icon) return <span className="emoji-icon" aria-hidden="true">{custom.icon}</span>
  const I = TYPE_ICONS[type]
  return <I className="icon" size={size} aria-hidden="true" />
}

/** A Phosphor icon at the app's usual size and weight. */
export function Ico({ as: I, size = '1.1em', ...rest }: { as: PhosphorIcon } & IconProps) {
  return <I className="icon" size={size} aria-hidden="true" {...rest} />
}

/** A page's type icon, including the world's custom types. */
export function PageIcon({ page, world, size }: { page: { type: EntityType; customType?: string }; world?: { customTypes?: CustomType[] } | null; size?: number | string }) {
  return <TypeIcon type={page.type} custom={page.type === 'custom' ? world?.customTypes?.find((c) => c.id === page.customType) : undefined} size={size} />
}
