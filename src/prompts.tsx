import { useState } from 'react'
import { Lightbulb, Lock } from '@phosphor-icons/react'
import { blankEntity, type Entity, type EntityType } from './db'
import { Help } from './help'
import { Ico } from './icons'

/**
 * Questions for a blank page ("What does she want? What is she afraid of?"), a few for each kind of
 * page. Answering one adds it to the description under the question as a heading, so a new GM never
 * faces an empty box with nothing to go on. The questions in GM_PROMPTS ask for a secret, so their
 * answers go into GM notes instead, which players never see.
 */
export const PROMPTS: Partial<Record<EntityType, string[]>> = {
  npc: [
    'What do they want most right now?',
    'What are they afraid of?',
    'What secret are they keeping?',
    'How do they talk? A phrase they always use',
    'What can they offer the party?',
    'What would make them an enemy?',
    'Who do they owe, and who owes them?',
  ],
  pc: ['What do they want?', 'Who do they love, and who do they miss?', 'What are they running from?', 'What would they never do?', 'What’s unfinished from before the story began?'],
  location: [
    'What do you notice first: a smell, a sound, a sight?',
    'Who runs it, and who really runs it?',
    'What trouble is brewing here?',
    'What rumour is going round?',
    'What can the party get here that they can’t get elsewhere?',
    'What’s hidden here?',
  ],
  shop: ['Who keeps the shop, and what are they like?', 'What’s the best thing for sale, and what does it cost?', 'What can’t you buy here, and who can get it?', 'What does the shopkeeper want to hear about?', 'What’s for sale that shouldn’t be?'],
  faction: ['What is their goal?', 'How do they get what they want?', 'Who leads them, and who wants to?', 'What is their weakness?', 'Who are their enemies?', 'What do they offer someone who joins?', 'What happens if no one stops them?'],
  item: ['What does it look like, and how does it feel to hold?', 'Who made it, and why?', 'What does it do?', 'Who else wants it?', 'What’s the catch?'],
  quest: ['Who asked, and what do they really want?', 'What happens if the party says no?', 'Where does it start?', 'What stands in the way?', 'What’s the twist?', 'What is it worth?'],
  event: ['What happened, in one sentence?', 'Who was there?', 'Who won, and who lost?', 'What changed because of it?', 'What do people get wrong about it?'],
  deity: ['What do they ask of their faithful?', 'What are they the god of?', 'How do they show their favour, or their anger?', 'Who are their enemies in heaven?', 'Where is their greatest temple?'],
  lore: ['What is it, in one sentence?', 'Who knows about it?', 'What do most people believe, and what is the truth?', 'How could the party find out more?', 'How could it matter to the party?'],
  thread: ['What started it?', 'Who is it waiting on?', 'What happens if it’s left alone?', 'How could it come back?'],
}

/** Questions whose answer is a secret: answers go into GM notes, never into the description players read. */
export const GM_PROMPTS = new Set([
  'What secret are they keeping?',
  'What’s for sale that shouldn’t be?',
  'What is their weakness?',
  'What’s the catch?',
  'What’s the twist?',
  'What do people get wrong about it?',
  'What do most people believe, and what is the truth?',
  'What’s hidden here?',
])

/** Adds a question and its answer, as a heading and text, to the end of a piece of writing. */
const appendAnswer = (text: string, question: string, answer: string) => `${text.trimEnd()}${text.trim() ? '\n\n' : ''}### ${question}\n${answer}\n`

/** "Prompts" by the Description box: pick a question, answer it, and it's added to the page. */
export function PagePrompts({
  type,
  body,
  onChange,
  gmNotes,
  onGmNotesChange,
  revealed,
}: {
  type: EntityType
  body: string
  onChange: (body: string) => void
  gmNotes: string
  onGmNotesChange: (gmNotes: string) => void
  /** The page is one players can read already. */
  revealed: boolean
}) {
  const questions = PROMPTS[type]
  const [open, setOpen] = useState(false)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  if (!questions) return null
  const add = (i: number) => {
    const text = (answers[i] ?? '').trim()
    if (!text) return
    if (GM_PROMPTS.has(questions[i])) onGmNotesChange(appendAnswer(gmNotes, questions[i], text))
    else onChange(appendAnswer(body, questions[i], text))
    setAnswers((a) => ({ ...a, [i]: '' }))
  }
  return (
    <div className="page-prompts">
      <button type="button" className="small" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Ico as={Lightbulb} /> {open ? 'Close prompts' : 'Prompts'}
      </button>
      <Help topic="pagePrompts" />
      {open && (
        <ol className="page-prompts-list">
          {questions.map((q, i) => (
            <li key={q}>
              <label>
                <span>{q}</span>
                {GM_PROMPTS.has(q) ? (
                  <small className="muted">
                    <Ico as={Lock} /> Goes into GM notes: players never see it
                  </small>
                ) : (
                  <small className="muted">{revealed ? 'Goes into the description, which players can read' : 'Goes into the description: players read it once the page is revealed'}</small>
                )}
                <span className="row">
                  <input
                    value={answers[i] ?? ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        add(i)
                      }
                    }}
                  />
                  <button type="button" className="small" disabled={!(answers[i] ?? '').trim()} onClick={() => add(i)}>
                    Add
                  </button>
                </span>
              </label>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/**
 * Ready-made templates offered while a world has none: a person, a town and a quest, each with its
 * questions as headings. Headings that ask for a secret ("Their secret", "The twist") go in GM notes,
 * so what is written under them never reaches players.
 */
export function starterTemplates(worldId: string): Entity[] {
  const headed = (headings: string[]) => headings.map((h) => `### ${h}\n`).join('\n')
  const make = (type: EntityType, name: string, summary: string, headings: string[], fields: { key: string; value: string }[] = [], secretHeadings: string[] = []): Entity => ({
    ...blankEntity(worldId, type, name),
    summary,
    body: headed(headings),
    gmNotes: headed(secretHeadings),
    fields,
    template: true,
  })
  return [
    make('npc', 'Person to meet', 'Who they are in one line', ['What they want', 'What they’re afraid of', 'How they talk', 'What they can offer the party'], [
      { key: 'Role', value: '' },
      { key: 'Where to find them', value: '' },
    ], ['Their secret']),
    make('location', 'Town', 'A town in one line', ['First impressions', 'Who runs it', 'Trouble brewing', 'Rumours', 'Places to go (inn, market, temple)'], [
      { key: 'Population', value: '' },
      { key: 'Ruled by', value: '' },
    ]),
    make('quest', 'Quest', 'The job in one line', ['Who asked, and why', 'Where it starts', 'What stands in the way', 'The reward'], [], ['The twist']),
  ]
}
