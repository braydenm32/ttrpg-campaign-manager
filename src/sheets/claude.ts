import type { JobRequest } from '../ai/ClaudeJob'
import { QUICK_MODEL } from '../ai/claude'
import { fromOurs, type Sheet } from './parse'

/**
 * "Paste the sheet's text": for every game the app can't read itself, Claude sorts any character
 * sheet (copied from a PDF, a website, a forum post or notes) into the page's shape.
 */
export function sheetRequest(text: string, system: string): JobRequest {
  return {
    system: `You turn tabletop RPG character sheets into a page for a campaign manager. The game is ${system.trim() || 'not stated; work it out from the sheet'}.

Reply with only a JSON object, no other text, in this shape:
{"name": "the character's name", "summary": "one line, e.g. Level 5 Elf Wizard", "fields": [{"key": "Class", "value": "Wizard"}], "body": "Markdown", "gear": [{"name": "Rope", "quantity": 1, "equipped": false}]}

- fields: the key facts and numbers a GM glances at, in the order the sheet shows them: class or role, level, ancestry, ability scores or characteristics, hit points, defence or armour, speed, and the game's own key stats (sanity, stress, luck and so on). At most 20, short values.
- body: everything else as Markdown with ### headings: features and abilities, spells or powers, money, appearance, personality and backstory.
- gear: each weapon, piece of armour and item they carry, with how many and whether it's worn or in hand. Not money, not spells or abilities. Gear goes here only, not in the body. Use lists for lists. Keep the player's own words for the backstory.
- Copy what is on the sheet. Don't invent or work out anything that isn't there. Leave out anything empty.`,
    prompt: `The sheet:\n\n${text.trim()}`,
    model: QUICK_MODEL,
    effort: 'low',
    maxTokens: 4000,
    expectOut: 1500,
  }
}

/** Claude's reply (one click, or pasted back from claude.ai) as a sheet. */
export function sheetFromReply(reply: string): Sheet {
  const json = reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1)
  try {
    return fromOurs(JSON.parse(json), 'Claude, from pasted text')
  } catch (e) {
    throw new Error(
      e instanceof SyntaxError || !json
        ? 'That reply isn’t in the shape the app needs. Copy all of Claude’s answer, from the first { to the last }.'
        : (e as Error).message,
    )
  }
}
