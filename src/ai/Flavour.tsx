import { ChatTeardropText, Sparkle } from '@phosphor-icons/react'
import { db, type Entity, type World } from '../db'
import { Help } from '../help'
import { Ico } from '../icons'
import { Markdown } from '../Markdown'
import { QUICK_MODEL } from './claude'
import { ClaudeJob } from './ClaudeJob'
import { useKept } from './kept'
import { toast } from '../undo'
import { MARKUP_NOTE, indexLine, pageText, worldHeader } from './worldText'

/**
 * Small Claude jobs for colour: flavour for a generated tavern, shop or person that fits the world,
 * and lines an NPC might say, in their own voice.
 */

/** A few pages around where something will go, so new things fit in. */
function nearby(world: World, entities: Entity[], parentId?: string) {
  const byId = new Map(entities.map((e) => [e.id, e]))
  const parent = parentId ? byId.get(parentId) : undefined
  const around = parent ? entities.filter((e) => e.id === parent.id || e.parentId === parent.id || e.id === parent.parentId) : []
  const factions = entities.filter((e) => e.type === 'faction').slice(0, 20)
  return [...new Set([...around, ...factions])].map((e) => indexLine(e, world, byId)).join('\n')
}

export function GeneratorFlavour({ world, entities, preview, parentId, onUse }: { world: World; entities: Entity[]; preview: string; parentId?: string; onUse: (text: string) => void }) {
  // Kept outside the panel, so it's still here after a look at another page (see kept.ts).
  const [flavour, setFlavour] = useKept(`flavour:${world.id}`, '')
  const parent = entities.find((e) => e.id === parentId)
  const build = () => ({
    system: `You add colour to things a tabletop roleplaying game master rolled up on random tables, so they feel like they belong in the GM's world. Keep the names and facts you're given. Match the world's tone.

Write:
1. One short paragraph a GM could read aloud: what you see, hear and smell.
2. "Rumours" with 2 or 3 bullets: things overheard here, each one tied to a person, place or faction already in the world where it fits.
3. "Secret" with one line only the GM knows.

Keep it under 200 words. Use Markdown with those two bold labels. Write the name of any existing page exactly as listed inside double square brackets like [[Name]].

${worldHeader(world)}
${MARKUP_NOTE}${parent ? `\n\nIt will go in:\n${pageText(parent, world, entities)}` : ''}

Some of the world around it:
${nearby(world, entities, parentId)}`,
    prompt: `What I rolled:\n\n${preview}`,
    model: QUICK_MODEL,
    effort: 'low' as const,
    expectOut: 500,
  })
  return (
    <div className="flavour">
      <h3>
        <Ico as={Sparkle} /> Flavour with Claude <Help topic="flavour" />
      </h3>
      {flavour ? (
        <div className="card">
          <Markdown text={flavour} entities={entities} worldId={world.id} showSecrets />
          <div className="row">
            <button
              className="primary"
              onClick={() => {
                onUse(flavour)
                setFlavour('')
              }}
            >
              Keep it
            </button>
            <button
              className="ghost"
              onClick={() => {
                const was = flavour
                setFlavour('')
                toast('Flavour thrown away.', () => setFlavour(was))
              }}
            >
              Throw it away
            </button>
          </div>
        </div>
      ) : (
        <ClaudeJob worldId={world.id} jobId={`flavour:${world.id}`} jobTitle="Flavour for what you rolled" label="Add flavour" build={build} priceKey={preview + parentId} onResult={setFlavour} />
      )}
    </div>
  )
}

/**
 * Turns the "Secret" part of flavour into a GM-only passage before it's saved: everything from the
 * line that starts it ("**Secret:**", "- **Secret**", "3. Secret (GM only):", "### Secret"...) to
 * the end, since it's asked for last and may run over several lines.
 */
export const keepSecretsSecret = (text: string) => {
  const at = text.search(/^[ \t]*(?:[-*+][ \t]+|\d+[.)][ \t]*|#{1,6}[ \t]*)?[*_]{0,2}Secrets?\b[ \t]*(?:[*_]{1,2}|:|\(|$)/im)
  return at < 0 ? text : `${text.slice(0, at)}:::gm\n${text.slice(at).trim()}\n:::`
}

/** On an NPC's page: a few lines they might say, for the GM to read out in character. */
export function NpcLines({ world, entity, entities }: { world: World; entity: Entity; entities: Entity[] }) {
  const kept = `npcLines:${entity.id}`
  const [situation, setSituation] = useKept(`${kept}:situation`, '')
  const [lines, setLines] = useKept<string[]>(kept, [])
  const [open, setOpen] = useKept(`${kept}:open`, false)
  const build = () => ({
    system: `You help a tabletop roleplaying game master improvise. Write lines one of their characters might say out loud at the table, in that character's own voice: their manner of speech, what they want and what they know. Never have them give away a secret they would keep, unless the situation forces it.

Write 4 different lines as bullets, each one or two sentences, from friendly to guarded or from calm to heated. Only the spoken words in quotes, then an optional short stage direction in italics. Nothing else.

${worldHeader(world)}
${MARKUP_NOTE}

The character:
${pageText(entity, world, entities)}`,
    prompt: situation.trim() ? `The situation: ${situation.trim()}` : 'The party has just walked up to them.',
    model: QUICK_MODEL,
    effort: 'low' as const,
    expectOut: 300,
  })
  const keep = () =>
    db.entities.update(entity.id, {
      gmNotes: `${entity.gmNotes.trim()}${entity.gmNotes.trim() ? '\n\n' : ''}**Lines${situation.trim() ? ` (${situation.trim()})` : ''}:**\n${lines.map((l) => `- ${l}`).join('\n')}`,
    })
  if (!open)
    return (
      <button className="small npc-lines-open" onClick={() => setOpen(true)}>
        <Ico as={ChatTeardropText} /> Lines in character
      </button>
    )
  return (
    <section className="card npc-lines">
      <h3>
        <Ico as={ChatTeardropText} /> What would {entity.name} say? <Help topic="npcLines" />
      </h3>
      <input value={situation} onChange={(e) => setSituation(e.target.value)} placeholder="What’s happening? e.g. The party asks about the missing oil" aria-label="What’s happening" />
      <ClaudeJob
        worldId={world.id}
        jobId={kept}
        jobTitle={`Lines for ${entity.name}`}
        label="Give me lines"
        build={build}
        priceKey={situation + entity.updatedAt}
        onResult={(text) => setLines(text.split('\n').filter((l) => /^\s*[-*]\s+/.test(l)).map((l) => l.replace(/^\s*[-*]\s+/, '').trim()))}
      />
      {lines.length > 0 && (
        <>
          <ul className="npc-line-list">
            {lines.map((l, i) => (
              <li key={i}>
                <Markdown text={l} entities={entities} worldId={world.id} showSecrets />
              </li>
            ))}
          </ul>
          <div className="row">
            <button
              onClick={async () => {
                await keep()
                setLines([])
              }}
            >
              Keep in GM notes
            </button>
            <button
              className="ghost"
              onClick={() => {
                const was = lines
                setLines([])
                toast(`Lines for ${entity.name} cleared.`, () => setLines(was))
              }}
            >
              Clear
            </button>
          </div>
        </>
      )}
    </section>
  )
}
