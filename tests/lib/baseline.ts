import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TestInfo } from '@playwright/test'

/**
 * Today's app already has some problems the tests look for (pages wider than a phone, buttons
 * smaller than a fingertip…). tests/baseline.json records them, so a test fails only on a problem
 * that is NEW. Each test also writes what it found to test-results/baseline-parts/, and the
 * teardown (tests/teardown.ts) prints a summary from those, and rewrites baseline.json when asked:
 *
 *   npm test -- -u           (or: UPDATE_BASELINE=1 npm test)
 *
 * Rewrite it after fixing problems (so they can't come back) or when a change knowingly adds one.
 */

export interface Found {
  /** Problems, each a short stable string: "sideways scroll", "page error: …", "leak: …". */
  problems: string[]
  /** Phone only: how many buttons and links are smaller than 44×44 px. */
  smallTargets?: number
  /** A few of them, to help find them (not compared). */
  smallExamples?: string[]
}

export const BASELINE_FILE = join(import.meta.dirname, '..', 'baseline.json')
export const PARTS_DIR = join(import.meta.dirname, '..', '..', 'test-results', 'baseline-parts')

export function readBaseline(): Record<string, Found> {
  try {
    return JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))
  } catch {
    return {}
  }
}

export const updating = (info: { config: { updateSnapshots: string } }) =>
  !!process.env.UPDATE_BASELINE || info.config.updateSnapshots === 'all' || info.config.updateSnapshots === 'changed'

/** A file-safe name for one result. */
const partName = (key: string) => `${key.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 150)}_${hash(key)}.json`
function hash(s: string) {
  let h = 0
  for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0
  return (h >>> 0).toString(36)
}

/**
 * Records what a check found and returns what's new compared with the baseline: problems not in
 * it, and more small tap targets than it allows.
 */
export function compare(key: string, found: Found, info: TestInfo) {
  mkdirSync(PARTS_DIR, { recursive: true })
  writeFileSync(join(PARTS_DIR, partName(key)), JSON.stringify({ key, found }))
  const known = readBaseline()[key] ?? { problems: [] }
  const fresh = found.problems.filter((p) => !known.problems.includes(p))
  const moreTargets = (found.smallTargets ?? 0) > (known.smallTargets ?? 0)
  if (known.problems.length || known.smallTargets)
    info.annotations.push({ type: 'known problems', description: [...known.problems, known.smallTargets ? `${known.smallTargets} small tap targets` : ''].filter(Boolean).join('; ') })
  const messages = [...fresh]
  if (moreTargets)
    messages.push(
      `${found.smallTargets} tap targets smaller than 44×44 px (the baseline allows ${known.smallTargets ?? 0}), e.g. ${(found.smallExamples ?? []).join(', ')}`,
    )
  return updating(info) ? [] : messages
}
