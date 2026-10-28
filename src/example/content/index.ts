import type { ExampleContent } from '../types'
import { WORLD } from './world'
import { LORE } from './lore'
import { HISTORY } from './history'
import { PLACES } from './places'
import { PEOPLE } from './people'
import { FACTIONS } from './factions'
import { ITEMS } from './items'
import { TABLES } from './tables'
import { BOARDS, CAMPAIGN_PAGES, SESSIONS } from './campaign'

/** The whole example world. Each file owns one part; pages refer to each other by key. */
export const EXAMPLE: ExampleContent = {
  world: WORLD,
  pages: [...CAMPAIGN_PAGES, ...PLACES, ...PEOPLE, ...FACTIONS, ...LORE, ...HISTORY, ...ITEMS, ...TABLES],
  sessions: SESSIONS,
  boards: BOARDS,
}
