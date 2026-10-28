import type { ExampleContent } from '../types'
import { describeProblems, parseExampleFiles } from '../parse'
import { MAPS } from '../maps'

/**
 * The whole example world, read from the Markdown files in worlds/vael-ardith (one file per page,
 * session and board; see docs/EDITING.md). The build checks the same files first, so a mistake
 * stops the build rather than reaching anyone's copy.
 */
const files = import.meta.glob<string>('/worlds/vael-ardith/**/*.md', { query: '?raw', import: 'default', eager: true })
const read = parseExampleFiles(Object.fromEntries(Object.entries(files).map(([path, text]) => [path.replace('/worlds/vael-ardith/', ''), text])))
const errors = read.problems.filter((p) => p.level === 'error')
if (errors.length) throw new Error(`The example world has mistakes:\n${describeProblems(errors)}`)

export const EXAMPLE: ExampleContent = { ...read.content, maps: MAPS }
