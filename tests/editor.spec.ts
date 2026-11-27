import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Node as PMNode } from 'prosemirror-model'
import { Transform } from 'prosemirror-transform'
import { parseLoose, parseMarkdown, schema, secretLines, serializeMarkdown, shapeOf, stripSids } from '../src/editor/markdownDoc'
import { parseExampleFiles } from '../src/example/parse'
import { splitSecrets } from '../src/secretText'
import { expect, open, setView, test, type Page } from './fixtures'
import { allText } from './lib/checks'
import { getRecord, putBack } from './lib/records'

/**
 * The formatted page editor (src/editor, src/TextEditor.tsx). A page is still saved as the same
 * Markdown text, so the first tests have no browser in them: they read text into the editor's
 * document and write it out again.
 *  - Every page of the Vael Ardith example (description and GM notes) and every session text comes
 *    back byte for byte, and so does the trickiest syntax src/Markdown.tsx knows.
 *  - Editing one block leaves every other character of the page as it was.
 *  - What players are sent never changes by accident: after any edit, the app's own splitSecrets
 *    reads each line as being in the passage the editor showed it in, and nothing typed can open or
 *    close a ":::gm" passage.
 * Then, in the browser on a laptop and a phone: the toolbar formats text, a GM-only block is added,
 * the page saves as the expected Markdown, and the player view doesn't show the block.
 */

/** What players may be sent of a text: src/Markdown.tsx stripSecrets, from the same splitSecrets. */
const playersGet = (text: string) =>
  splitSecrets(text)
    .filter((seg) => seg.kind === 'text' || seg.kind === 'foryou')
    .map((seg) => seg.body)
    .join('\n')

/** The passages a text has, in order ("" for ordinary text), without their words. */
const passages = (text: string) => {
  const out: string[] = []
  for (const [tag] of secretLines(text)) if (out.at(-1) !== tag) out.push(tag)
  return out.join(' | ')
}

const shape = (doc: PMNode) => JSON.stringify(shapeOf(doc))
const A_PICTURE = '123e4567-e89b-12d3-a456-426614174000'

/** Markdown the app gives a meaning to (src/Markdown.tsx, src/secretText.ts), and the awkward edges of each. */
const TRICKY = [
  '',
  '\n',
  '\n\n\n',
  'one line',
  'one line\n',
  '\n\nblank lines before and after\n\n\n',
  // Secret passages, in every spelling splitSecrets accepts.
  'A\n\n:::gm\nsecret\n:::\n\nB',
  ':::gm\nsecret\n:::',
  ':::gm\nnever closed\n\nstill secret',
  ':::gm',
  ':::gm\n',
  ':::GM\nupper\n:::\n::: gm\nspaced\n:::\n   :::gm\n indented\n   :::\n',
  ':::gm The innkeeper is a spy\nmore\n:::\nafter',
  ':::gm::: one line secret :::\nafter',
  ':::gm one line :::\nvisible',
  ':::for Wren and Silas\nfor two\n:::\n',
  ':::for Wren::: just a line :::\nvisible',
  ':::for\nnobody\n:::',
  ':::for Wren, Silas & Brannoch :::\nthree\n:::',
  ':::foryou\nyours\n:::\n:::foryouLegacy text:::\nend',
  ':::gm\nouter\n:::for Wren\ninner\n:::\nouter again\n:::\nvisible',
  ':::for Wren\nouter\n:::gm\ninner gm\n:::\n:::for Silas\nlayered\n:::\n:::\nvisible',
  ':::\nstray closer\n:::\n',
  'text\n:::gm\ntight\n:::\ntext after',
  '- item\n  :::gm\n  secret in list\n  :::\n- next',
  '```\ncode\n:::gm\nsecret in code\n:::\n```\n',
  '\\:::gm\nnot a secret\n\\:::\n',
  'A\r\n\r\n:::gm\r\nsecret\r\n:::\r\n\r\nB\r\n',
  'A\r:::gm\rsecret\r:::\rB',
  ':::gm\n- [[List]] in secret\n- two\n\n> quote in secret\n\n| t | u |\n|---|---|\n| 1 | 2 |\n:::\n',
  // Ordinary Markdown.
  '# H1\n## H2\n### H3 ###\nSetext\n===\n\nSetext 2\n---\n',
  'para one\nsoft wrapped\n\npara two  \nhard break\\\nagain',
  '*em* _em_ **strong** __strong__ ***both*** ~~strike~~ `code` ``co`de``',
  '- a\n- b\n  - c\n  - d\n- e\n\n* star\n* star\n\n+ plus\n\n1. one\n2. two\n\n3) three\n4) four\n',
  '- loose\n\n- list\n\n  second para\n\n- end',
  '- [x] done\n- [ ] not\n- plain',
  '> quote\n> more\n>\n> second\n\n> > nested\n',
  '| a | b |\n|---|:-:|\n| 1 | **2** |\n| [[P|q]] | x \\| y |\n',
  'a | b\n--- | ---\n1 | 2',
  '---\n\n***\n\n___\n',
  '```js\nconst a = `x`\n```\n\n    indented code\n\n~~~\ntilde\n~~~\n',
  'text\n# heading tight\ntext tight\n- list tight\n> quote tight\n---\n',
  'A\n\n\n\n\nB\n\n\n',
  '1. a\n1. b\n1. c',
  '10. ten\n11. eleven',
  '- \n- empty item above',
  '#\n\n# \n\n####### seven',
  'a\\\nb',
  // The app's own things.
  '[[Page]] [[Page|label]] **[[Bold Page]]** [[A|b]]text[[C]]',
  `![a picture](asset:${A_PICTURE}) ![web](https://pictures.example/castle.png "title") ![](asset:${A_PICTURE})`,
  'roll:1d8+3 and `roll:2d6` and {{Blackwood encounters}}',
  // Links, HTML and things the formatted view can only keep as typed.
  '[link](https://x.example) [t](<https://x.example/a b> "ti\\"tle") <https://auto.example> https://bare.example/x_y [ref][r] [r]\n\n[r]: https://ref.example',
  '<div class="x">html</div>\n\n<details><summary>s</summary>\n\nbody\n\n</details>\n\ninline <u>html</u> here',
  '<form action="https://evil.example/steal"><input type="password"></form>\n\n<style>.app-header { display: none }</style>',
  '<!-- comment -->\n\ntext',
  'entities &amp; &lt; &mdash; &#8212; &unknownthing; AT&T',
  'escapes \\* \\_ \\# \\[x\\] \\\\ 2 * 3 * 4 snake_case_name _',
  '1986\\. A year\n\n\\# not heading\n\n\\- not list\n\n\\> not quote',
  'tab\tin text\n\n\tindented by tab\n',
  'trailing spaces   \n\n   leading spaces\n',
  'Line with \uE000 private use',
  '[^1] footnote\n\n[^1]: the note',
  'Term\n: definition?',
  '*unclosed em and **unclosed strong',
]

/** Every long text of the example world: each page's description and GM notes, each session's texts. */
function exampleTexts(): { where: string; text: string }[] {
  const root = join(import.meta.dirname, '../worlds/vael-ardith')
  const files = Object.fromEntries(
    readdirSync(root, { recursive: true })
      .map((p) => String(p).replaceAll('\\', '/'))
      .filter((p) => p.endsWith('.md'))
      .map((p) => [p, readFileSync(join(root, p), 'utf8')]),
  )
  const { content } = parseExampleFiles(files, [])
  const out: { where: string; text: string }[] = []
  for (const p of content.pages) {
    out.push({ where: `${p.name}: description`, text: p.body ?? '' })
    out.push({ where: `${p.name}: GM notes`, text: p.gmNotes ?? '' })
  }
  for (const s of content.sessions) for (const [k, v] of Object.entries(s)) if (typeof v === 'string') out.push({ where: `session ${s.number}: ${k}`, text: v })
  return out
}

test.describe('the text itself (no browser)', () => {
  test.skip(({ device }) => device !== 'laptop', 'the same on every device')

  test('every page of the example world, opened and saved without typing, is the same text byte for byte', () => {
    const texts = exampleTexts()
    // 370 pages and more: if the example is ever read differently, this says so.
    expect(texts.length).toBeGreaterThan(700)
    let plainBlocks = 0
    for (const { where, text } of texts) {
      const { doc, sources } = parseMarkdown(text)
      const out = serializeMarkdown(doc, sources)
      expect(out.safe, where).toBe(true)
      expect(out.text, where).toBe(text)
      doc.descendants((n) => {
        if (n.type === schema.nodes.raw_block) plainBlocks++
      })
      // Written afresh (as if every block had been edited) it still says the same thing, to the same people.
      const fresh = serializeMarkdown(stripSids(doc), null)
      expect(fresh.safe, where).toBe(true)
      expect(shape(parseLoose(fresh.text)), where).toBe(shape(doc))
      expect(passages(fresh.text), where).toBe(passages(text))
    }
    // The example is all Markdown the formatted view can show: nothing in it falls back to a plain block.
    expect(plainBlocks).toBe(0)
  })

  test('the trickiest syntax comes back byte for byte, and what players are sent is the same', () => {
    for (const text of TRICKY) {
      const where = JSON.stringify(text)
      const { doc, sources } = parseMarkdown(text)
      const out = serializeMarkdown(doc, sources)
      expect(out.safe, where).toBe(true)
      expect(out.text, where).toBe(text)
      expect(playersGet(out.text), where).toBe(playersGet(text))
      // Written afresh, every line is still in the passage it was in, and the document reads back the same.
      const fresh = serializeMarkdown(stripSids(doc), null)
      expect(fresh.safe, where).toBe(true)
      expect(passages(fresh.text), where).toBe(passages(text))
      expect(shape(parseLoose(fresh.text)), where).toBe(shape(doc))
    }
  })

  test('editing one block leaves every other character as it was, and keeps every secret', () => {
    const texts = [...TRICKY, ...exampleTexts().filter((_t, i) => i % 12 === 0).map((t) => t.text)]
    let edits = 0
    for (const text of texts) {
      const { doc, sources } = parseMarkdown(text)
      const blocks: [number, PMNode][] = []
      doc.descendants((node, pos) => {
        if (node.isTextblock) blocks.push([pos, node])
      })
      for (const [pos, node] of blocks) {
        const $pos = doc.resolve(pos + 1)
        // The block of the text (or of a passage) this one sits in: only its own source may change.
        let depth = 1
        while (depth < $pos.depth && $pos.node(depth).type === schema.nodes.secret) depth++
        const own = sources.byId.get($pos.node(depth).attrs.sid)?.body.length ?? 0
        for (const what of ['type', 'split', 'delete'] as const) {
          const tr = new Transform(doc)
          if (what === 'type') tr.insert(pos + 1, schema.text('ZQX'))
          else if (what === 'split') {
            if (node.content.size < 2 || node.type.spec.code || $pos.node($pos.depth - 1).type === schema.nodes.table_row) continue
            tr.split(pos + 1 + Math.floor(node.content.size / 2))
          } else {
            if (!['doc', 'secret'].includes(doc.resolve(pos).parent.type.name)) continue
            tr.delete(pos, pos + node.nodeSize)
          }
          const where = `${what} at ${pos} in ${JSON.stringify(text.slice(0, 80))}`
          const out = serializeMarkdown(tr.doc, sources)
          edits++
          expect(out.safe, where).toBe(true)
          // The same passages, in the same order (typing into an empty one gives it its first line).
          if (what !== 'delete' && node.content.size) expect(passages(out.text), where).toBe(passages(text))
          // What was typed is never sent to anyone the block it was typed in is hidden from.
          if (what === 'type' && /\/(gm|for:)/.test(secretLines(out.text).find((l) => l[1].includes('ZQX'))?.[0] ?? '')) expect(playersGet(out.text), where).not.toContain('ZQX')
          // Shown and saved agree (a plain block is Markdown as typed, so typing in it may change what it is).
          if (node.type !== schema.nodes.raw_block) expect(shape(parseLoose(out.text)), where).toBe(shape(tr.doc))
          // Local: only the block's own source text changed. (Taking away what stood between two lists
          // rewrites the second one's bullets, so that they stay two lists.)
          let a = 0
          while (a < text.length && text[a] === out.text[a]) a++
          let b = 0
          while (b < text.length - a && text[text.length - 1 - b] === out.text[out.text.length - 1 - b]) b++
          const listsMet = what === 'delete' && /^[*] /m.test(out.text.slice(a)) && !/^[*] /m.test(text.slice(a))
          if (!listsMet) expect(text.length - a - b, where).toBeLessThanOrEqual(own + 8)
        }
      }
    }
    expect(edits).toBeGreaterThan(1000)
  })

  test('bold and italics that touch a letter, or hold other formatting, are saved so that they read back', () => {
    const { strong, em, strike } = schema.marks
    const t = (text: string, ...marks: (typeof strong)[]) => schema.text(text, marks.map((m) => m.create()))
    const page = schema.nodes.wikilink.create({ target: 'Ford Street' })
    const lines = [
      // Markdown would read "word*(aside)*" as stars: the letter beside them is written as a code.
      [t('word'), t('(an aside)', em), t(' and on')],
      [t('"Quoted."', strong), t('then a letter')],
      [t('struck'), t('. Then this', strike), t('too')],
      // Italics inside bold, ending on a bracket: written with "_" so that the bold still closes.
      [t('What he read. The last line: ', strong), t('lamp (1)', strong, em), t('. One, like a chair.', strong)],
      [t('How his ', strong), t('secret p', strong, em), t('ays off.', strong)],
      [t('all three', strong, em, strike), t(' and '), page, t('after a page link', em)],
    ]
    for (const line of lines) {
      const doc = schema.nodes.doc.create(null, [schema.nodes.paragraph.create(null, line)])
      const out = serializeMarkdown(doc, null)
      expect(shape(parseLoose(out.text)), out.text).toBe(shape(doc))
    }
    expect(serializeMarkdown(schema.nodes.doc.create(null, [schema.nodes.paragraph.create(null, lines[0])]), null).text).toBe('wor&#x64;*(an aside)* and on')
  })

  test('nothing typed can open or close a GM-only passage', () => {
    const N = schema.nodes
    const p = (text: string) => N.paragraph.create(null, text ? schema.text(text) : null)
    const gm = (...kids: PMNode[]) => N.secret.create({ kind: 'gm' }, kids)
    const SECRET = 'The innkeeper is a spy'
    const docs: PMNode[] = [
      // A line of ":::" typed inside a passage would have closed it early.
      N.doc.create(null, [p('Before'), gm(p(':::'), p(SECRET)), p('After')]),
      N.doc.create(null, [gm(p(SECRET), p('  :::  '), p(SECRET)), p('After')]),
      // The same inside a list, a quote, code and a plain block.
      N.doc.create(null, [gm(N.bullet_list.create(null, [N.list_item.create(null, [p(':::')]), N.list_item.create(null, [p(SECRET)])]), p(SECRET))]),
      N.doc.create(null, [gm(N.code_block.create(null, schema.text(`x\n:::\n${SECRET}`)), p(SECRET))]),
      N.doc.create(null, [gm(N.raw_block.create(null, schema.text(`<div>\n:::\n${SECRET}\n</div>`)), p(SECRET))]),
      // A passage inside a passage, and typed openers that mustn't swallow or move anything.
      N.doc.create(null, [gm(p(':::for Wren'), p(SECRET), p(':::')), p('After')]),
      N.doc.create(null, [p(':::gm'), p('Shown to everyone'), p(':::'), gm(p(SECRET))]),
      N.doc.create(null, [p(':::gm::: looks like a one-line secret :::'), gm(p(SECRET))]),
      N.doc.create(null, [N.secret.create({ kind: 'for', names: 'Wren::: x :::\n:::gm' }, [p(SECRET)]), p('After')]),
      N.doc.create(null, [N.secret.create({ kind: 'for', names: 'Wren' }, [gm(p(SECRET)), p('For Wren')]), p('After')]),
    ]
    for (const doc of docs) {
      const out = serializeMarkdown(doc, null)
      const where = JSON.stringify(out.text)
      expect(out.safe, where).toBe(true)
      expect(playersGet(out.text), where).not.toContain(SECRET)
      // The server strips a ":::for" passage for everyone it doesn't name, and a ":::gm" one inside it for all.
      for (const [tag, line] of secretLines(out.text)) if (line.includes(SECRET)) expect(tag, where).toMatch(/\/(gm|for:)/)
      expect(playersGet(out.text), where).toContain(doc.lastChild!.type === N.paragraph ? doc.lastChild!.textContent : '')
    }
    // "Shown to everyone" stayed shown: the typed ":::gm" above it is plain words, not a marker.
    expect(playersGet(serializeMarkdown(docs[6], null).text)).toContain('Shown to everyone')
  })
})

const press = (device: string, target: ReturnType<Page['locator']>) => (device === 'phone' ? target.tap() : target.click())

/** The description's text as Markdown: a look at the plain box, and back. */
async function markdownOf(page: Page) {
  const field = page.locator('.text-field').first()
  await field.getByRole('button', { name: 'Markdown', exact: true }).click()
  const value = await field.locator('textarea').inputValue()
  await field.getByRole('button', { name: 'Formatted', exact: true }).click()
  await expect(field.locator('.pm-text')).toBeVisible()
  return value
}

test('the toolbar formats text and adds a GM-only block; the page saves as Markdown and players don’t get the block', async ({ page, world, device, atlas }) => {
  const place = world.page('Ford Street')
  const address = `/w/${world.slug}/p/${world.pageSlug('Ford Street')}`
  await open(page, `${address}?edit=1`)
  const original = await getRecord(page, 'entities', place.id)
  expect(original?.visibility).toBe('players')
  try {
    const field = page.locator('.text-field').first()
    const text = field.locator('.pm-text')
    await expect(text).toBeVisible()
    // The page's own GM-only passages are marked boxes.
    await expect(text.locator('.pm-secret.gm').first()).toContainText('GM only')
    await press(device, text.locator(':scope > *').last())
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Enter')
    await field.getByLabel('Kind of text').selectOption('2')
    await page.keyboard.type('Editor test heading')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Plain then ')
    await press(device, field.getByRole('button', { name: 'Bold' }))
    await page.keyboard.type('bold words')
    await press(device, field.getByRole('button', { name: 'Bold' }))
    await page.keyboard.type(' then ')
    // The usual keys work too.
    if (device === 'phone') await press(device, field.getByRole('button', { name: 'Italic' }))
    else await page.keyboard.press('Control+i')
    await page.keyboard.type('italic')
    if (device === 'phone') await press(device, field.getByRole('button', { name: 'Italic' }))
    else await page.keyboard.press('Control+i')
    await page.keyboard.type('.')
    await page.keyboard.press('Enter')
    await press(device, field.getByRole('button', { name: 'Bulleted list' }))
    await page.keyboard.type('first thing')
    await page.keyboard.press('Enter')
    await page.keyboard.type('second thing')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await press(device, field.getByRole('button', { name: 'GM-only passage' }))
    await page.keyboard.type('Editor test secret the players must not read.')
    await expect(text.locator('.pm-secret.gm').last()).toContainText('Editor test secret')
    // On a phone every button of the toolbar is big enough for a finger.
    if (device === 'phone') {
      const small = await field.locator('.pm-toolbar :is(button, select, label.button), .text-editor-modes button').evaluateAll((els) =>
        els.filter((el) => !(el as HTMLButtonElement).disabled && !el.classList.contains('help-button') && (el.getBoundingClientRect().width < 44 || el.getBoundingClientRect().height < 44)).map((el) => el.getAttribute('aria-label') ?? el.textContent),
      )
      expect(small).toEqual([])
      expect(await page.evaluate(() => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth)).toBeLessThanOrEqual(1)
    }
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    const added = ['## Editor test heading', '', 'Plain then **bold words** then *italic*.', '', '- first thing', '- second thing', '', ':::gm', 'Editor test secret the players must not read.', ':::'].join('\n')
    const was = String(original!.body)
    await expect.poll(async () => String((await getRecord(page, 'entities', place.id))?.body)).toBe(`${was.replace(/\n+$/, '')}\n\n${added}${was.endsWith('\n') ? '\n' : ''}`)
    expect((await getRecord(page, 'entities', place.id))?.gmNotes).toBe(original!.gmNotes)

    // The GM's page shows the block; a player's doesn't have it anywhere.
    await open(page, address)
    await expect(page.locator('.entity-prose .markdown .secret', { hasText: 'Editor test secret' })).toBeVisible()
    const player = await atlas.context.newPage()
    try {
      await setView(player, world, 'player')
      await open(player, address)
      await expect(player.locator('.entity-prose .markdown').getByRole('heading', { name: 'Editor test heading' })).toBeVisible()
      await expect(player.locator('.entity-prose .markdown strong', { hasText: 'bold words' })).toBeVisible()
      expect(await allText(player)).not.toContain('Editor test secret')
    } finally {
      await player.close()
    }
  } finally {
    await putBack(page, 'entities', [[place.id, original]])
    await page.evaluate((key) => localStorage.setItem(key, 'gm'), `viewMode.${world.id}`)
  }
})

test('saving without typing changes nothing, a GM-only block can’t be opened by Backspace, and the Markdown box is still there', async ({ page, world, device }) => {
  const npc = world.page('Sabe Hallows')
  const address = `/w/${world.slug}/p/${world.pageSlug('Sabe Hallows')}`
  await open(page, `${address}?edit=1`)
  const original = await getRecord(page, 'entities', npc.id)
  const was = String(original!.body)
  expect(was).toContain(':::gm')
  try {
    const field = page.locator('.text-field').first()
    const text = field.locator('.pm-text')
    await expect(text).toBeVisible()
    await press(device, text.locator(':scope > p').first())
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page).not.toHaveURL(/edit=1/)
    const saved = await getRecord(page, 'entities', npc.id)
    expect(saved?.body).toBe(was)
    expect(saved?.gmNotes).toBe(original!.gmNotes)

    await open(page, `${address}?edit=1`)
    await expect(text).toBeVisible()
    const inside = text.locator('.pm-secret.gm .pm-secret-body p').first()
    /** Puts the selection from a place in the paragraph before the block to a place inside the block. */
    const select = (from: number | null, to: number) =>
      page.evaluate(
        ({ from, to }) => {
          const secret = document.querySelector('.text-field .pm-secret.gm .pm-secret-body p')!
          const before = document.querySelector('.text-field .pm-secret.gm')!.previousElementSibling!
          const first = (el: Element) => document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode()!
          const range = document.createRange()
          if (from === null) range.setStart(first(secret), to)
          else range.setStart(first(before), from)
          range.setEnd(first(secret), to)
          const sel = getSelection()!
          sel.removeAllRanges()
          sel.addRange(range)
        },
        { from, to },
      ).then(() => page.waitForTimeout(150))
    // Backspace at the very start of the block: nothing leaves it, nothing changes.
    await press(device, inside)
    await select(null, 0)
    for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace')
    expect(await markdownOf(page)).toBe(was)
    // Typing over a selection that crosses the block's edge is refused, and says why.
    await press(device, inside)
    await select(2, 6)
    await page.keyboard.type('X')
    await expect(page.locator('.undo-toast')).toContainText('into or out of a GM-only block')
    expect(await markdownOf(page)).toBe(was)
    // Deleting it takes the selected words and leaves each side where it was: the block still opens on its own line.
    await press(device, inside)
    await select(2, 6)
    await page.keyboard.press('Delete')
    const cut = await markdownOf(page)
    expect(cut).not.toBe(was)
    expect(playersGet(cut)).not.toContain(playersGetSecretWord(was))
    expect(passages(cut)).toBe(passages(was))
    // "Show to players" on the block is the way to open one on purpose, and Undo puts it back.
    await text.locator('.pm-secret.gm').first().getByRole('button', { name: 'Show to players' }).click()
    await expect(text.locator('.pm-secret')).toHaveCount(0)
    await press(device, field.getByRole('button', { name: 'Undo' }))
    await expect(text.locator('.pm-secret.gm')).toHaveCount(1)

    // The Markdown box is the old text box, and the choice is remembered on the device.
    await field.getByRole('button', { name: 'Markdown', exact: true }).click()
    await expect(field.locator('textarea')).toHaveValue(cut)
    await expect(field.getByRole('button', { name: 'GM-only passage' })).toBeVisible()
    await page.reload()
    await expect(page.locator('.text-field').first().locator('textarea')).toBeVisible()
    await expect(page.locator('.text-field .pm-text')).toHaveCount(0)
  } finally {
    await page.evaluate(() => {
      localStorage.removeItem('editor.mode')
      for (const k of Object.keys(localStorage)) if (k.startsWith('codex.draft.')) localStorage.removeItem(k)
    })
    await putBack(page, 'entities', [[npc.id, original]])
  }
})

/** A word of a text's first GM-only passage that isn't in what players get (to look for a leak). */
function playersGetSecretWord(text: string) {
  const open = playersGet(text)
  const secret = splitSecrets(text).find((seg) => seg.kind === 'gm')?.body ?? ''
  return (secret.match(/[A-Za-z]{6,}/g) ?? []).find((w) => !open.includes(w)) ?? '\u0000'
}
