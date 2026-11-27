import { expect, here, open, setView, test, type Page } from './fixtures'
import { getRecord, patchRecord, putBack } from './lib/records'

/**
 * "Last time" at the top of a session's Prepare (src/lastTime.tsx), on a laptop and a phone: the
 * recap of the session before this one and the awards given at the end of it; what it says when
 * there is no earlier session, no recap or no awards; and that players never get it.
 *
 * Each test puts back what it changed (straight in the database), since tests in one worker share
 * the world.
 */

const LONG_RECAP = [
  'ZZRECAP The company walked the Ash Road to Fort Mercy and found the assessor waiting at the gate.',
  ...Array.from({ length: 14 }, (_, i) => `Paragraph ${i + 2} of the recap: they argued over the form, paid nothing, and left before the bell.`),
  ':::gm\nZZGMONLY The assessor is in the pay of the Quiet Office.\n:::',
  'ZZRECAPEND They camped under the red moon.',
].join('\n\n')

const HIGHLIGHTS = [
  { id: 'lt-a1', kind: 'award', text: 'Bravest Fool', who: 'Fennick' },
  { id: 'lt-m1', kind: 'moment', text: 'ZZMOMENT The form caught fire on its own.' },
  { id: 'lt-a2', kind: 'award', text: 'Silver Tongue', who: 'Mirrel Vosk' },
  { id: 'lt-q1', kind: 'quote', text: 'ZZQUOTE I never sign anything.', who: 'Garrick' },
]

/** Buttons, links and folds in the section that are smaller than a fingertip (44 by 44 px). */
const smallIn = (page: Page, sel: string) =>
  page.evaluate((sel) => {
    const out: string[] = []
    for (const el of document.querySelectorAll<HTMLElement>(`${sel} a[href], ${sel} button:not(.help-button), ${sel} summary`)) {
      const r = el.getBoundingClientRect()
      if (r.width && r.height && (r.width < 44 || r.height < 44)) out.push(`“${(el.textContent ?? '').trim()}” ${Math.round(r.width)}×${Math.round(r.height)}`)
    }
    return out
  }, sel)

/** Boxes in the section that scroll up and down on their own (a scroll inside the scroll). */
const scrollersIn = (page: Page, sel: string) =>
  page.evaluate(
    (sel) =>
      [...document.querySelectorAll(`${sel}, ${sel} *`)].filter((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 4).map((el) => el.className),
    sel,
  )

test('Prepare shows last session’s recap and its awards, with who won them', async ({ page, world, device }) => {
  const w = `/w/${world.slug}`
  const s2 = world.session(2)
  const s3 = world.session(3)
  await open(page, `${w}/s/${s3.id}?tab=prep`)
  const before = await patchRecord(page, 'sessions', s2.id, { recap: LONG_RECAP, highlights: HIGHLIGHTS, playedAt: Date.now(), startedAt: Date.now() - 1000, date: '2026-11-20' })
  try {
    await open(page, `${w}/s/${s3.id}?tab=prep`)
    const box = page.locator('#last-time')
    await expect(box.getByRole('heading', { name: 'Last time', level: 2 })).toBeVisible()
    await expect(box).toContainText(`#2 ${s2.title}`)
    // It comes before the plan, and a long recap is folded so the plan isn't pushed far down.
    const top = (sel: string) => page.locator(sel).evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
    expect(await top('#last-time')).toBeLessThan(await top('#plan'))
    const folded = (await box.boundingBox())!.height
    expect(folded).toBeLessThan(520)

    // The recap, as the GM wrote it (this screen is the GM's, so a GM-only passage in it shows).
    await expect(box.getByRole('heading', { name: 'Recap', level: 3 })).toBeVisible()
    const recap = box.locator('.last-recap')
    await expect(recap).toContainText('ZZRECAP The company walked the Ash Road')
    await expect(recap).toContainText('ZZGMONLY')
    const more = box.getByRole('button', { name: 'Show all of the recap' })
    await expect(more).toBeVisible()
    expect(await scrollersIn(page, '#last-time')).toEqual([])
    if (device === 'phone') expect(await smallIn(page, '#last-time')).toEqual([])
    await more.click()
    await expect(box.getByRole('button', { name: 'Show less of the recap' })).toBeVisible()
    expect((await box.boundingBox())!.height).toBeGreaterThan(folded + 200)
    await expect(box.getByText('ZZRECAPEND They camped under the red moon.')).toBeVisible()
    expect(await scrollersIn(page, '#last-time')).toEqual([])

    // The awards, each with its winner, under their own heading.
    await expect(box.getByRole('heading', { name: 'Awards', level: 3 })).toBeVisible()
    const awards = box.locator('.last-awards li')
    await expect(awards).toHaveCount(2)
    await expect(awards.nth(0)).toHaveText(/Bravest Fool\s+—\s+Fennick/)
    await expect(awards.nth(1)).toHaveText(/Silver Tongue\s+—\s+Mirrel Vosk/)
    await expect(box).not.toContainText('No awards were given last time.')
    // Moments and quotes are folded underneath, not mixed in with the awards.
    await expect(box.locator('.last-awards')).not.toContainText('ZZMOMENT')
    const others = box.locator('details.last-others')
    await expect(others.locator('summary')).toHaveText('Moments and quotes (2)')
    await expect(box.getByText('ZZQUOTE I never sign anything.')).toBeHidden()
    await others.locator('summary').click()
    await expect(box.getByText('ZZQUOTE I never sign anything.')).toBeVisible()
    if (device === 'phone') expect(await smallIn(page, '#last-time')).toEqual([])

    // On a phone the row of jump buttons has it first.
    if (device === 'phone') await expect(page.locator('.jump-row.phone-only button').first()).toHaveText('Last time')

    // "Open #2" goes to that session.
    const link = box.getByRole('link', { name: 'Open #2' })
    await link.click()
    await expect.poll(() => here(page)).toBe(`${w}/s/${s2.id}`)
    await expect(page.locator('.session-strip [data-stage]')).toHaveAttribute('data-stage', 'played')
  } finally {
    await putBack(page, 'sessions', [[s2.id, before]])
  }
})

test('Last time says so when there is no earlier session, no recap or no awards', async ({ page, world, device }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  const s2 = world.session(2)
  await open(page, `${w}/s/${s1.id}?tab=prep`)
  const before = await getRecord(page, 'sessions', s1.id)
  try {
    // The first session of the campaign has no last time.
    const box = page.locator('#last-time')
    await expect(box).toContainText('This is the first session, so there is no last time yet.')
    await expect(box.getByRole('link')).toHaveCount(0)
    await expect(box.getByRole('heading', { name: 'Awards' })).toHaveCount(0)

    // The one before hasn't been played: one line says so.
    await open(page, `${w}/s/${s2.id}?tab=prep`)
    await expect(box).toContainText(`#1 ${s1.title} has not been played yet. Its recap and awards will show here once it has.`)
    await expect(box.getByRole('link', { name: 'Open #1' })).toHaveAttribute('href', `${w}/s/${s1.id}`)

    // Played, with no recap written and no awards given: both say so, with the way to its Wrap up.
    await patchRecord(page, 'sessions', s1.id, { startedAt: Date.now() - 1000, playedAt: Date.now() })
    await open(page, `${w}/s/${s2.id}?tab=prep`)
    await expect(box).toContainText(`#1 ${s1.title} has no recap yet.`)
    await expect(box).toContainText('No awards were given last time.')
    const write = box.getByRole('link', { name: 'Write it in #1’s Wrap up' })
    await expect(write).toHaveAttribute('href', `${w}/s/${s1.id}?tab=recap`)
    if (device === 'phone') expect(await smallIn(page, '#last-time')).toEqual([])
    await expect(box.getByRole('heading', { name: 'What happened (your notes)' })).toHaveCount(0)

    // Still no recap, but the GM wrote down what happened: those notes show instead.
    await patchRecord(page, 'sessions', s1.id, { happened: 'ZZHAPPENED The paymaster never came.' })
    await open(page, `${w}/s/${s2.id}?tab=prep`)
    await expect(box).toContainText(`#1 ${s1.title} has no recap yet.`)
    await expect(box.getByRole('heading', { name: 'What happened (your notes)' })).toBeVisible()
    await expect(box.locator('.last-recap')).toHaveText('ZZHAPPENED The paymaster never came.')

    // A short recap shows whole, with nothing to unfold; moments alone are not awards.
    await patchRecord(page, 'sessions', s1.id, { recap: 'ZZSHORT The company mustered and was paid.', highlights: [HIGHLIGHTS[1]] })
    await open(page, `${w}/s/${s2.id}?tab=prep`)
    await expect(box.locator('.last-recap')).toHaveText('ZZSHORT The company mustered and was paid.')
    await expect(box.getByRole('heading', { name: 'What happened (your notes)' })).toHaveCount(0)
    await expect(box.getByRole('button', { name: /of the recap/ })).toHaveCount(0)
    await expect(box).toContainText('No awards were given last time.')
    await expect(box.locator('details.last-others summary')).toHaveText('Moments and quotes (1)')

    // The link goes to the recap in that session's Wrap up.
    await patchRecord(page, 'sessions', s1.id, { recap: '' })
    await open(page, `${w}/s/${s2.id}?tab=prep`)
    await write.click()
    await expect.poll(() => here(page)).toBe(`${w}/s/${s1.id}?tab=recap`)
    await expect(page.getByRole('heading', { name: /The players’ recap/ })).toBeVisible()
  } finally {
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

test('players never get Last time: a revealed session opens as its recap, with nothing of the GM’s', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const s2 = world.session(2)
  const s3 = world.session(3)
  const campaign = world.dump.campaigns.find((c) => c.id === s3.campaignId)!
  await open(page, `${w}/s/${s3.id}?tab=prep`)
  const before2 = await patchRecord(page, 'sessions', s2.id, { recap: LONG_RECAP, highlights: HIGHLIGHTS, notes: 'ZZGMPLAN the plan', happened: 'ZZGMHAPPENED what the GM wrote', playedAt: Date.now(), visibility: 'players' })
  const before3 = await patchRecord(page, 'sessions', s3.id, { recap: 'ZZTHREE What players read of session three.', visibility: 'players' })
  const beforeCampaign = await patchRecord(page, 'campaigns', campaign.id, { visibility: 'players' })
  try {
    // The GM has it on Prepare…
    await open(page, `${w}/s/${s3.id}?tab=prep`)
    await expect(page.locator('#last-time')).toContainText('ZZGMONLY')

    // …and a player opening the same address gets session three's own recap, and no Last time.
    const player = await page.context().newPage()
    await setView(player, world, 'player')
    await open(player, `${w}/s/${s3.id}?tab=prep`)
    await expect(player.locator('main')).toContainText('ZZTHREE What players read of session three.')
    await expect(player.locator('#last-time')).toHaveCount(0)
    await expect(player.getByRole('heading', { name: 'Last time' })).toHaveCount(0)
    const text = await player.locator('body').innerText()
    for (const gm of ['ZZGMONLY', 'ZZGMPLAN', 'ZZGMHAPPENED', 'ZZRECAP', 'Bravest Fool', 'Show all of the recap']) expect(text, gm).not.toContain(gm)
    // Session two itself, revealed, shows them its recap without the GM-only passage.
    await open(player, `${w}/s/${s2.id}`)
    await expect(player.locator('main')).toContainText('ZZRECAP The company walked the Ash Road')
    await expect(player.locator('body')).not.toContainText('ZZGMONLY')
    await expect(player.locator('body')).not.toContainText('ZZGMPLAN')
    await player.close()
  } finally {
    await page.evaluate((key) => localStorage.setItem(key, 'gm'), `viewMode.${world.id}`)
    await putBack(page, 'sessions', [
      [s2.id, before2],
      [s3.id, before3],
    ])
    await putBack(page, 'campaigns', [[campaign.id, beforeCampaign]])
  }
})
