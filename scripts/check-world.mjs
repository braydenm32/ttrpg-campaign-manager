// Checks the example world's Markdown files for mistakes: `npm run check`.
// The build runs the same check (see vite.config.ts), so this is for checking before you commit.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runnerImport } from 'vite'
import { describeProblems, parseExampleFiles } from '../src/example/parse.ts'

const EXAMPLE_FOLDER = 'worlds/vael-ardith'
const root = join(import.meta.dirname, '..', EXAMPLE_FOLDER)
const files = Object.fromEntries(
  readdirSync(root, { recursive: true })
    .map((p) => String(p).replaceAll('\\', '/'))
    .filter((p) => p.endsWith('.md'))
    .map((p) => [p, readFileSync(join(root, p), 'utf8')]),
)
// The maps are code that points at pages by key, so they're checked too. Vite loads them, as the app does.
const { module: maps } = await runnerImport(join(import.meta.dirname, '../src/example/maps/index.ts'), { configFile: false, logLevel: 'silent' })
const { content, problems } = parseExampleFiles(files, maps.MAPS)
const errors = problems.filter((p) => p.level === 'error').length
const warnings = problems.length - errors
if (problems.length) console.log(describeProblems(problems, `${EXAMPLE_FOLDER}/`) + '\n')
console.log(`${content.pages.length} pages, ${content.sessions.length} sessions, ${content.boards.length} boards.`)
console.log(errors ? `✗ ${errors} mistake${errors === 1 ? '' : 's'} to fix${warnings ? `, and ${warnings} warning${warnings === 1 ? '' : 's'}` : ''}.` : warnings ? `✓ No mistakes. ${warnings} warning${warnings === 1 ? '' : 's'} worth a look.` : '✓ All good.')
process.exit(errors ? 1 : 0)
