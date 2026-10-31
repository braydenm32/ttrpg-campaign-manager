import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FullConfig } from '@playwright/test'
import { BASELINE_FILE, PARTS_DIR, readBaseline, updating, type Found } from './lib/baseline'

/**
 * After all tests: prints a short summary of the known problems (tests/baseline.json) that are
 * still there, and any that are gone. With `npm test -- -u` (or UPDATE_BASELINE=1) it rewrites
 * the baseline from what this run found.
 */
export default async function teardown(config: FullConfig) {
  if (!existsSync(PARTS_DIR)) return
  const results = new Map<string, Found>()
  for (const f of readdirSync(PARTS_DIR)) {
    const { key, found } = JSON.parse(readFileSync(join(PARTS_DIR, f), 'utf8')) as { key: string; found: Found }
    results.set(key, found)
  }
  const baseline = readBaseline()

  const kinds = new Map<string, number>()
  const gone: string[] = []
  let small = 0
  const worst: [string, number, number][] = []
  for (const [key, found] of results) {
    for (const p of found.problems) {
      const kind = p.replace(/:.*/, '')
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1)
    }
    small += found.smallTargets ?? 0
    worst.push([key, found.problems.length, found.smallTargets ?? 0])
    for (const p of baseline[key]?.problems ?? []) if (!found.problems.includes(p)) gone.push(`${key}: ${p}`)
    const before = baseline[key]?.smallTargets ?? 0
    if ((found.smallTargets ?? 0) < before) gone.push(`${key}: small tap targets ${before} → ${found.smallTargets ?? 0}`)
  }

  const lines = [`\nProblems found in this run (${results.size} screens checked; the known ones are in tests/baseline.json):`]
  for (const [kind, n] of [...kinds].sort((a, b) => b[1] - a[1])) lines.push(`  ${n} × ${kind}`)
  if (small) lines.push(`  ${small} tap targets under 44×44 px on the phone`)
  const most = worst.filter(([, p]) => p).sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (most.length) lines.push('  Most problems:', ...most.map(([k, p]) => `    ${k}: ${p}`))
  const tiny = worst.filter(([, , s]) => s).sort((a, b) => b[2] - a[2]).slice(0, 5)
  if (tiny.length) lines.push('  Most small tap targets:', ...tiny.map(([k, , s]) => `    ${k}: ${s}`))
  if (gone.length && !updating({ config })) {
    lines.push(`  Fixed since the baseline (${gone.length}); run \`npm test -- -u\` to lock that in:`)
    lines.push(...gone.slice(0, 10).map((g) => `    ${g}`))
    if (gone.length > 10) lines.push(`    …and ${gone.length - 10} more`)
  }

  if (updating({ config })) {
    const next: Record<string, Found> = { ...baseline }
    for (const [key, found] of results) {
      if (found.problems.length || found.smallTargets) next[key] = { problems: [...found.problems].sort(), ...(found.smallTargets ? { smallTargets: found.smallTargets } : {}) }
      else delete next[key]
    }
    const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)))
    writeFileSync(BASELINE_FILE, `${JSON.stringify(sorted, null, 2)}\n`)
    lines.push(`  Rewrote tests/baseline.json (${Object.keys(sorted).length} screens with known problems).`)
  }
  console.log(lines.join('\n'))
}
