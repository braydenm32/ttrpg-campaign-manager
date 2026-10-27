import type { CalDate, Clock, Combatant, Entity, EntityType, LifeStatus, Safety, ThreadStatus, WorldCalendar } from '../db'

/**
 * The example world is written as plain data: every page, session and board has a short `key`, and
 * pages point at each other by key. The loader swaps keys for real ids and draws the pictures.
 * Inside text, link pages the usual way, by name: [[Cinderford]].
 */

/** A picture drawn when the world loads (see art/). */
export type ArtKey = string

export interface ExPage {
  key: string
  type: EntityType
  name: string
  summary?: string
  /** Markdown. :::gm … ::: for GM secrets, :::for Name … ::: for one character's player. */
  body?: string
  gmNotes?: string
  /** Revealed to every player. Pages are GM only unless this is true. */
  players?: boolean
  /** The page this one sits inside (a town in a region, an NPC in a tavern). */
  parent?: string
  tags?: string[]
  gmTags?: string[]
  fields?: Entity['fields']
  aliases?: string[]
  /** A silhouette or other drawing for the page's picture. */
  image?: ArtKey
  status?: LifeStatus
  statusKnown?: boolean
  relations?: { to: string; kind: string; note?: string; known?: boolean }[]
  clocks?: Omit<Clock, 'id'>[]
  /** Events: the age of history (an ExAge key), or `campaign` for something that happens in play. */
  age?: string | 'campaign'
  when?: CalDate
  /** Events: when, in words ("0 AW", "the night of the Battle of Cinders"). */
  date?: string
  /** Events: order within their section, smallest first. Defaults to the order written. */
  order?: number
  questStatus?: Entity['questStatus']
  threadStatus?: ThreadStatus
  threadUrgency?: Entity['threadUrgency']
  /** Loose threads: the session number that raised or tied it off. */
  raisedIn?: number
  tiedOffIn?: number
  /** Random tables: one entry per line. */
  entries?: string[]
  /** Items: a page key or 'party'. */
  heldBy?: string
  quantity?: number
  template?: boolean
}

export interface ExAge {
  key: string
  name: string
  span?: string
  summary?: string
}

export interface ExFoe {
  name: string
  count: number
  hp?: number
  ac?: string
  side: Combatant['side']
  page?: string
}

export interface ExSession {
  number: number
  title: string
  /** Revealed to players (sessions already played). */
  players?: boolean
  worldDate?: CalDate
  /** The GM's notes or outline (Markdown). */
  notes: string
  recap?: string
  /** Pages involved. */
  pages?: string[]
  prep?: {
    strongStart: string
    scenes: string[]
    clues: string[]
    encounters: { name: string; notes: string; foes: ExFoe[] }[]
  }
  lectern?: { scene?: string; sceneText: string; present?: string[] }
}

export interface ExBoard {
  name: string
  cards: { key: string; x: number; y: number; page?: string; text?: string; color?: string }[]
  strings: { from: string; to: string; label?: string }[]
}

export interface ExWorld {
  name: string
  description: string
  system: string
  color?: string
  cover?: ArtKey
  calendar: WorldCalendar
  ages: ExAge[]
  safety?: Safety
  partyCoin?: { name: string; amount: number }[]
  campaign: { name: string; description: string }
}

export interface ExampleContent {
  world: ExWorld
  pages: ExPage[]
  sessions: ExSession[]
  boards: ExBoard[]
}
