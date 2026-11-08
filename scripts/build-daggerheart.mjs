#!/usr/bin/env node
/**
 * Builds public/rules/daggerheart.json, the Daggerheart rules that "Look it up" searches inside the
 * app (no other website is asked).
 *
 * The text is the Daggerheart System Reference Document 1.0, which Darrington Press publishes as
 * Public Game Content under the Darrington Press Community Gaming License (DPCGL). It is read from
 * the Markdown copy at https://github.com/seansbox/daggerheart-srd (one file per adversary, weapon,
 * card…, and the core rules in its README). To update it:
 *
 *   git clone --depth 1 https://github.com/seansbox/daggerheart-srd.git /tmp/daggerheart-srd
 *   node scripts/build-daggerheart.mjs /tmp/daggerheart-srd
 *
 * The JSON is committed, so building the app never needs the internet.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const src = process.argv[2]
if (!src) {
  console.error('Usage: node scripts/build-daggerheart.mjs <path to a checkout of seansbox/daggerheart-srd>')
  process.exit(1)
}

/** Each folder, what one of its entries is called, and the page type it becomes. */
const FOLDERS = {
  adversaries: ['Adversary', 'npc'],
  environments: ['Environment', 'location'],
  classes: ['Class', 'lore'],
  subclasses: ['Subclass', 'lore'],
  domains: ['Domain', 'lore'],
  abilities: ['Domain card', 'lore'],
  ancestries: ['Ancestry', 'lore'],
  communities: ['Community', 'lore'],
  beastforms: ['Beastform', 'lore'],
  weapons: ['Weapon', 'item'],
  armor: ['Armor', 'item'],
  items: ['Item', 'item'],
  consumables: ['Consumable', 'item'],
}

/** Links to other files of the SRD, or to its own headings, as plain words. */
const unlink = (md) => md.replace(/\[([^\]]+)\]\((?:[^)]*\.md|#[^)]*)\)/g, '$1')
const titleCase = (s) =>
  s
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-z])/g, (_, a, b) => a + b.toUpperCase())
    .replace(/\b(And|Of|The|A|An|To|In|On|For)\b/g, (w, _, i) => (i === 0 ? w : w.toLowerCase()))
    .replace(/\bGm\b/g, 'GM')

/** "- **Difficulty:** 14 | **HP:** 8" and "- **DOMAINS -** Grace & Codex" lines as details. */
function fieldsOf(md) {
  const out = []
  for (const line of md.split('\n')) {
    if (!line.startsWith('- **')) continue
    for (const part of line.slice(2).split(/\s+\|\s+(?=\*\*)/)) {
      const m = part.match(/^\*\*([^*]+?)\s*[-:]?\s*\*\*\s*[-:]?\s*(.+)$/)
      if (!m) continue
      const key = m[1].replace(/[:\s-]+$/, '').trim()
      const value = unlink(m[2])
        .replace(/\*\*|_/g, '')
        .trim()
      if (key && value && value.length <= 120 && !out.some((f) => f.key.toLowerCase() === key.toLowerCase()))
        // "STARTING EVASION" as "Starting Evasion", but "HP" and "ATK" stay as they are.
        out.push({
          key: key === key.toUpperCase() && key.length > 3 ? titleCase(key) : key,
          value,
        })
    }
  }
  return out.slice(0, 12)
}

const entries = []
for (const [folder, [kind, type]] of Object.entries(FOLDERS)) {
  for (const file of readdirSync(join(src, folder))
    .filter((f) => f.endsWith('.md'))
    .sort()) {
    const md = readFileSync(join(src, folder, file), 'utf8')
      .replace(/\r\n?/g, '\n')
      .trim()
    const title = md.match(/^# (.+)$/m)?.[1]?.trim() || file.replace(/\.md$/, '')
    const body = unlink(md.replace(/^# .+\n+/, '')).trim()
    entries.push({ t: title, k: kind, y: type, b: body, f: fieldsOf(body) })
  }
}

// The core rules: the README's chapters, split at their sections. The chapters that only list what's
// in the folders above (Core Materials, the card reference) and the contents are left out.
const readme = readFileSync(join(src, 'README.md'), 'utf8').replace(/\r\n?/g, '\n')
const SKIP = /^(CONTENTS|CORE MATERIALS|APPENDIX)$/
for (const chapter of readme.split(/^## /m).slice(1)) {
  const [head, ...rest] = chapter.split('\n')
  if (SKIP.test(head.trim())) continue
  const text = rest.join('\n')
  const parts = text.split(/^### /m)
  const intro = parts[0].trim()
  if (intro)
    entries.push({
      t: titleCase(head.trim()),
      k: 'Rules',
      y: 'lore',
      b: unlink(intro),
      f: [],
    })
  for (const part of parts.slice(1)) {
    const [h, ...b] = part.split('\n')
    entries.push({
      t: titleCase(h.trim()),
      k: `Rules: ${titleCase(head.trim())}`,
      y: 'lore',
      b: unlink(b.join('\n').trim()),
      f: [],
    })
  }
}

let commit = ''
try {
  commit = execFileSync('git', ['-C', src, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
} catch {
  // Not a git checkout: the copy's version is unknown.
}

const out = {
  name: 'Daggerheart SRD 1.0',
  credit:
    'This work includes materials from the Daggerheart System Reference Document 1.0, © Critical Role, LLC. under the terms of the Darrington Press Community Gaming (DPCGL) License. More information can be found at https://www.daggerheart.com/. There are minor modifications to format and structure. No previous modifications by others.',
  from: `https://github.com/seansbox/daggerheart-srd${commit ? `/tree/${commit}` : ''}`,
  entries,
}
mkdirSync(join(import.meta.dirname, '..', 'public', 'rules'), {
  recursive: true,
})
const file = join(import.meta.dirname, '..', 'public', 'rules', 'daggerheart.json')
writeFileSync(file, JSON.stringify(out))
console.log(`Wrote ${entries.length} entries to ${file}`)
