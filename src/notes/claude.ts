import type { JobRequest } from '../ai/ClaudeJob'
import { MODEL } from '../ai/claude'
import { ENTITY_LABELS, type Entity, type EntityType, type LifeStatus } from '../db'
import { guessType } from '../importers'
import type { NotePhoto } from './photos'

/**
 * "Import hand-written notes": Claude reads photos or scans of the GM's notebook (or notes they've
 * typed or pasted) and sorts what's in them into pages: people, places, factions, items, quests and
 * the rest, plus a log of any sessions the notes describe. The GM looks over the list before anything
 * is added (ImportNotes.tsx), and everything arrives GM only (apply.ts).
 */

export interface NotePage {
  name: string
  type: EntityType
  summary: string
  fields: { key: string; value: string }[]
  /** What the notes say, as Markdown with [[links]] to other pages. */
  body: string
  /** What the notes mark as secret, a twist or "players don't know". Goes in GM notes. */
  secrets: string
  aliases: string[]
  /** The name of the place it's in, when the notes say. */
  in?: string
  status?: LifeStatus
  /** The name of a page already in the world that this is about, so the notes are added to it. */
  existing?: string
  /**
   * Claude's guess that the players already know this (they met, visited or were told about it at
   * the table), so the page can be shown to them. Its body then holds only what they know.
   */
  known: boolean
}

export interface NoteSession {
  title: string
  /** As written in the notes ("12 March", "Sess 4"), not worked out. */
  date: string
  notes: string
}

export interface NotesPlan {
  pages: NotePage[]
  sessions: NoteSession[]
  /**
   * For the GM to check: words Claude couldn't read for certain (and what it went with), and
   * questions about what a note means (a joke or world detail? who is "the big guy"?).
   */
  unsure: string[]
}

const TYPES = (Object.keys(ENTITY_LABELS) as EntityType[]).filter((t) => t !== 'table' && t !== 'custom')

/** What the world already has, so Claude matches names (and spells them) the way the GM does. */
function knownPages(entities: Entity[]) {
  const pages = entities.filter((e) => !e.template && e.name.trim())
  // A few thousand names at most: enough for any notebook, without sending a novel.
  return pages
    .slice(0, 3000)
    .map((e) => `${e.name} (${e.type}${e.aliases?.length ? `; also ${e.aliases.join(', ')}` : ''})`)
    .join('\n')
}

export function notesRequest({
  worldName,
  system,
  entities,
  photos,
  text,
  hints,
}: {
  worldName: string
  system: string
  entities: Entity[]
  photos: NotePhoto[]
  text: string
  hints: string
}): JobRequest {
  const known = knownPages(entities)
  const what = [photos.length && `${photos.length === 1 ? 'a photo' : `${photos.length} photos`} of my hand-written notes`, text.trim() && 'some notes I typed']
    .filter(Boolean)
    .join(' and ')
  return {
    system: `You turn a game master's own notes for a tabletop RPG world into pages for their campaign manager. The world is called “${worldName}”${system.trim() ? ` and the game is ${system.trim()}` : ''}. The notes may be hand-written (photos or scans, often messy, with arrows, crossings-out, margin notes and abbreviations) or typed.

Read everything carefully. Then reply with only a JSON object, no other text, in this shape:
{"pages": [{"name": "Mira Thornwood", "type": "npc", "summary": "Innkeeper of the Gilded Goose", "fields": [{"key": "Role", "value": "Innkeeper"}], "body": "Markdown", "secrets": "Markdown", "aliases": ["Old Mira"], "in": "Millbrook", "status": "alive", "existing": "", "known": true}],
 "sessions": [{"title": "The bridge at Millbrook", "date": "12 March", "notes": "Markdown"}],
 "unsure": ["Photo 2, the tavern's name: “Gilded Goose” or “Gilded Gorse”?", "Photo 3: is “the big guy” Gorrak, or someone new?", "Photo 1: the frog in a crown in the margin: a table joke, or a real character?"]}

- pages: one for each person, place, group, item, quest, god, event or piece of lore the notes say something about. type is one of: ${TYPES.join(', ')} (npc for anyone who isn't a player's character, pc for the players' characters, shop for shops, inns and taverns, thread for a loose end or mystery still to resolve, lore for anything else). Skip things only mentioned in passing with nothing said about them.
- name: the full name as the notes give it. summary: one short line. fields: a few short facts a GM glances at (role, race, age, ruler, population, price), at most 8.
- body: everything the notes say about it, in tidy Markdown: short paragraphs and lists, ### headings if it's long. Keep the GM's own words and details. Don't invent anything or fill gaps, and don't pad. Link other pages by name in double square brackets, like [[Millbrook]], using the exact name of a page in your reply or in the world already.
- secrets: anything the notes mark as secret, hidden, a twist, “players don't know” or for the GM only. Leave it out of body. Empty if none.
- aliases: other names, titles or nicknames the notes use. in: the name of the place it's in, if the notes say. status (people only): alive, dead, missing or captured, only if the notes say.
- known: true when the notes show the players already know about it: the party met, visited, fought, found or was told about it at the table (in a session log, “party met…”, “PCs learned…”). Otherwise false, and if you can't tell, false. A known page is shown to the players, so its summary, fields and body hold only what the players saw or learned; everything they haven't found out yet goes in secrets.
- existing: when the page is about something already in the world (listed below), its exact name there, so these notes are added to that page. Otherwise empty. Use the world's spelling for names it already has.
- sessions: if the notes log what happened at the table (a session, a game night, a dated entry of what the party did), one for each, with what happened as Markdown. Use the date and title as written; leave date empty if there isn't one. The people and places in a session log get pages too.
- unsure: every word, name or number you couldn't read for certain, saying which photo and what you went with; and a short question for each note that needs interpretation: an abbreviation, an arrow or line joining two things, a name that could be two people, a “?” the GM left, or anything you can't tell is world content or a joke. Use your best reading in the pages, and say in the question what you went with.
- GMs' notes are full of memes, jokes, doodles, things players said at the table, shopping lists and random tidbits. Leave out what's clearly not about the world. A funny moment from play can go in the session's notes. When you can't tell, leave it out and ask in unsure.
- Leave out anything crossed out, unless the notes say it still matters.
${hints.trim() ? `\nWhat the GM says about these notes:\n${hints.trim()}\n` : ''}
Pages already in the world (name (type)):
${known || '(none yet)'}`,
    prompt: `Here ${photos.length === 1 && !text.trim() ? 'is' : 'are'} ${what}. Turn ${photos.length === 1 && !text.trim() ? 'it' : 'them'} into pages.${
      photos.length > 1 ? ` The photos are in order: ${photos.map((p, i) => `photo ${i + 1} is ${p.name}`).join(', ')}.` : ''
    }${text.trim() ? `\n\nThe typed notes:\n\n${text.trim()}` : ''}`,
    model: MODEL,
    effort: 'medium',
    maxTokens: 32000,
    expectOut: Math.min(30000, 1500 + photos.length * 2000 + Math.ceil(text.length / 3)),
    attachments: photos.map(({ name, mediaType, data, tokens }) => ({ name, mediaType, data, tokens })),
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const STATUSES = ['alive', 'dead', 'missing', 'captured']

/** Claude's reply (one click, or pasted back from claude.ai) as pages to look over. */
export function notesFromReply(reply: string): NotesPlan {
  const json = reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1)
  let o: Record<string, unknown>
  try {
    o = JSON.parse(json)
  } catch {
    throw new Error('That reply isn’t in the shape the app needs. Copy all of Claude’s answer, from the first { to the last }.')
  }
  const list = (v: unknown) => (Array.isArray(v) ? v : []).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
  const pages: NotePage[] = list(o.pages)
    .map((p) => {
      const t = str(p.type).toLowerCase()
      const type: EntityType = (TYPES as string[]).includes(t) ? (t as EntityType) : guessType(t)
      const status = str(p.status).toLowerCase()
      return {
        name: str(p.name),
        type,
        summary: str(p.summary),
        fields: list(p.fields)
          .map((f) => ({ key: str(f.key), value: str(f.value) }))
          .filter((f) => f.key && f.value),
        body: str(p.body),
        secrets: str(p.secrets),
        aliases: (Array.isArray(p.aliases) ? p.aliases : []).map(str).filter(Boolean),
        in: str(p.in) || undefined,
        status: type === 'npc' || type === 'pc' ? (STATUSES.includes(status) ? (status as LifeStatus) : undefined) : undefined,
        existing: str(p.existing) || undefined,
        known: p.known === true || p.known === 'true',
      }
    })
    .filter((p) => p.name)
  const sessions = list(o.sessions)
    .map((s) => ({ title: str(s.title), date: str(s.date), notes: str(s.notes) }))
    .filter((s) => s.notes)
  const unsure = (Array.isArray(o.unsure) ? o.unsure : []).map(str).filter(Boolean)
  if (!pages.length && !sessions.length) throw new Error('Claude didn’t find any pages in those notes. Check the photos are clear and the right way up, then try again.')
  return { pages, sessions, unsure }
}
