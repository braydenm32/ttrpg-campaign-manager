import { expect, here, open, test, type Page } from './fixtures'
import { patchRecord, putBack, type Row } from './lib/records'

/**
 * The players' Common Room (src/pages/CommonRoom.tsx), on a laptop and a phone, in the player view:
 * Now answers when the party plays next, what happened last time and what it's doing, in that
 * order and on the first screen, and changes with the stage (before, during and after a game
 * night); "Leads" is one list wherever it shows; Table rules is a tap away; previewing as one
 * character shows them on Me; the purse shows once, on Party.
 *
 * Each test puts back what it changed (straight in the database), since tests in one worker share
 * the world.
 */

test.use({ view: 'player' })

const answers = (page: Page) => page.getByRole('region', { name: 'Next session and last time' })
const doing = (page: Page) => page.locator('.room-doing')
const day = (n: number) => {
  const d = new Date(Date.now() + n * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const RECAP = 'The muster bell rang for pay that never came, and the drowned walked out of the ford.\n\n:::gm\nROOM-TEST-GM-SECRET: the Seventh sent them.\n:::\n\nThey ended the night in the Last Candle.'

test('Now answers next session, last time and what we’re doing first, and changes after a game night', async ({ page, world, device }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  const campaign = world.dump.campaigns[0]
  await open(page, w)
  await expect(page.getByRole('heading', { level: 1, name: /Before next session/ })).toBeVisible()
  // Nothing booked and no recap revealed in the example: it says so rather than showing an empty box.
  await expect(answers(page)).toContainText('Next session')
  await expect(answers(page)).toContainText('Not set yet')
  await expect(answers(page)).toContainText('Last time')
  await expect(answers(page)).toContainText('Nothing yet')
  // What we're doing: the leads under way first, three of them, and a way to the rest.
  await expect(doing(page).locator('.lead-row')).toHaveCount(3)
  await expect(doing(page).locator('.lead-row').first()).toContainText('Active')
  await expect(doing(page).getByRole('link', { name: /^All \d+ leads$/ })).toBeVisible()
  // In that order, and on a phone all on the first screen (above the bottom bar).
  const a = (await answers(page).boundingBox())!
  const d = (await doing(page).getByRole('heading').boundingBox())!
  expect(a.y).toBeLessThan(d.y)
  if (device === 'phone') expect(d.y + d.height).toBeLessThan(844 - 64)
  // The purse is on Party, not here.
  await expect(page.locator('.common-room')).not.toContainText('Purse')

  // A recap revealed ten days ago and a date booked in three days: the recap stays first until the next game.
  const at = new Date(Date.now() + 3 * 86_400_000)
  at.setHours(19, 0, 0, 0)
  const before = {
    session: await patchRecord(page, 'sessions', s1.id, { visibility: 'players', recap: RECAP, date: day(-10) }),
    campaign: await patchRecord(page, 'campaigns', campaign.id, { booked: { id: 'room-test', at: at.toISOString().slice(0, 16), utc: at.toISOString(), note: 'Bring snacks' } }),
  }
  try {
    await open(page, w)
    await expect(page.getByRole('heading', { level: 1, name: /After the game/ })).toBeVisible()
    await expect(answers(page)).toContainText('in 3 days')
    await expect(answers(page)).toContainText('Bring snacks')
    await expect(page.locator('.room-recap')).toContainText('The muster bell rang')
    await expect(page.locator('body')).not.toContainText('ROOM-TEST-GM-SECRET')

    // The next game is later today: getting ready comes first, with last time just under it.
    const soon = new Date(Date.now() + 12 * 3_600_000)
    await patchRecord(page, 'campaigns', campaign.id, { booked: { id: 'room-test', at: soon.toISOString().slice(0, 16), utc: soon.toISOString() } })
    await open(page, w)
    await expect(page.getByRole('heading', { level: 1, name: /Before next session/ })).toBeVisible()
    await expect(answers(page)).toContainText(`Session 1: ${s1.title}`)
    await expect(answers(page)).toContainText('The muster bell rang')
    await expect(answers(page).getByRole('link', { name: 'Read it all' })).toHaveAttribute('href', new RegExp(`/s/${s1.id}$`))
    await expect(page.locator('body')).not.toContainText('ROOM-TEST-GM-SECRET')

    // Played yesterday, nothing booked: the recap comes first.
    await patchRecord(page, 'sessions', s1.id, { date: day(-1) })
    await patchRecord(page, 'campaigns', campaign.id, { booked: undefined })
    await open(page, w)
    await expect(page.getByRole('heading', { level: 1, name: /After the game/ })).toBeVisible()
    const recap = page.locator('.room-recap')
    await expect(recap).toContainText('They ended the night in the Last Candle')
    expect((await recap.boundingBox())!.y).toBeLessThan((await answers(page).boundingBox())!.y)
    await expect(page.locator('body')).not.toContainText('ROOM-TEST-GM-SECRET')
  } finally {
    await putBack(page, 'sessions', [[s1.id, before.session]])
    await putBack(page, 'campaigns', [[campaign.id, before.campaign]])
  }
})

test('while the GM runs a session live, the scene, dice and a word to the GM come first', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  await open(page, w)
  // The GM's own world, synced and live with session 1 (nothing is sent: the tests run offline).
  const was = await patchRecord(page, 'worlds', world.id, { cloud: { enabled: true } })
  await page.evaluate(([id, sid]) => sessionStorage.setItem(`codex.liveSession.${id}`, sid), [world.id, s1.id])
  try {
    await open(page, w)
    await expect(page.getByRole('heading', { level: 1, name: /Playing now/ })).toBeVisible()
    const live = page.locator('.room-live')
    await expect(live).toContainText(`Session ${s1.number}`)
    await expect(page.getByRole('heading', { name: 'Dice' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Tell your GM' })).toBeVisible()
    expect((await live.boundingBox())!.y).toBeLessThan((await answers(page).boundingBox())!.y)
    // Dice: a quick die rolls at once; Roll waits for something typed.
    await expect(page.getByRole('button', { name: 'Roll', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'd20', exact: true }).click()
    await expect(page.locator('.table-rolls li').first()).toBeVisible()
  } finally {
    await page.evaluate((id) => {
      sessionStorage.removeItem(`codex.liveSession.${id}`)
      localStorage.removeItem(`codex.room.liveSeen.${id}`)
    }, world.id)
    await putBack(page, 'worlds', [[world.id, was]])
  }
})

test('“Leads” is one list: Now, the Leads tab and the leads page agree, and Back steps back', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  await open(page, `${w}?tab=leads`)
  const names = async () => page.locator('.leads-view > .lead-list .lead-name').allTextContents()
  // The list fills in once the world has loaded, so wait for it rather than reading it at once.
  await expect.poll(async () => (await names()).length).toBeGreaterThan(3)
  const tab = await names()
  await open(page, `${w}/threads`)
  await expect.poll(names).toEqual(tab)
  // Now's card says how many there are and leads to the same list; Back comes back to Now.
  await open(page, w)
  await expect(doing(page).locator('.lead-name')).toHaveText(tab.slice(0, 3))
  await doing(page).getByRole('link', { name: `All ${tab.length} leads` }).click()
  await expect.poll(() => here(page)).toBe(`${w}?tab=leads`)
  await page.goBack()
  await expect.poll(() => here(page)).toBe(w)
})

test('Table rules: from the foot of Now and from the frame', async ({ page, world, device }) => {
  const w = `/w/${world.slug}`
  await open(page, w)
  await page.getByRole('navigation', { name: 'More in the Common Room' }).getByRole('link', { name: 'Table rules' }).click()
  await expect.poll(() => here(page)).toBe(`${w}/safety`)
  await expect(page.getByRole('heading', { level: 1, name: /Table rules/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Lines/ })).toBeVisible()
  await page.goBack()
  await expect.poll(() => here(page)).toBe(w)
  const areas = page.getByRole('navigation', { name: 'Areas' })
  if (device === 'phone') {
    // On a phone: The World › More › Table rules.
    await areas.getByRole('link', { name: /World/ }).click()
    await page.getByRole('navigation', { name: 'The World', exact: true }).getByRole('link', { name: 'More' }).click()
    await page.locator('main').getByRole('link', { name: /Table rules/ }).click()
  } else {
    await areas.getByRole('link', { name: 'Table rules' }).click()
  }
  await expect.poll(() => here(page)).toBe(`${w}/safety`)
})

test('Me: previewing as one character shows them, and nothing GM-only', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  await open(page, `${w}?tab=me`)
  await expect(page.locator('.common-room')).toContainText('Previewing as every player')
  await page.locator('.preview-as select').selectOption({ label: 'Varra Nine-Knuckles' })
  await expect(page.locator('.room-me')).toContainText('Varra Nine-Knuckles')
  await expect(page.locator('.room-me .number-tiles')).toContainText('Level')
  await expect(page.getByRole('heading', { name: 'Only you know' })).toBeVisible()
  // Her GM-only details (armour, hit points) stay out.
  await expect(page.locator('body')).not.toContainText('chain mail')
  // Now's You card is her too.
  await page.getByRole('navigation', { name: /Areas|Common Room/ }).getByRole('link', { name: 'Now', exact: true }).first().click()
  await expect(page.locator('.room-side')).toContainText('Varra Nine-Knuckles')
})

test('Party: everyone in it, and the purse', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  await open(page, `${w}?tab=party`)
  await expect(page.getByRole('heading', { level: 1, name: /The party/ })).toBeVisible()
  const pcs = world.dump.entities.filter((e) => e.type === 'pc' && e.visibility === 'players' && !e.template)
  await expect(page.locator('.party-list > li')).toHaveCount(pcs.length)
  const coin = ((world.world.partyCoin as Row[] | undefined) ?? []).find((c) => Number(c.amount) > 0)
  if (coin) await expect(page.locator('.party-shared')).toContainText(`${coin.amount} ${coin.name}`)
})
