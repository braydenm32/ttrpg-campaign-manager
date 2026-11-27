import { expect, open, setView, test } from './fixtures'
import { getRecord, putBack } from './lib/records'

/**
 * The in-game time on Date and time (the date in the top bar; it used to lead the Clocks page), on a laptop and a phone: set to a time, sent to reach another
 * time in so long (it works out the speed), an alarm that stays the GM's, shown on the players' TV
 * screen and in their Common Room, and passing midnight moves the world's date on. Puts back what it changed.
 */

type Clock = { secs: number; rate: number; running: boolean; until?: number; alarm?: { secs: number; label?: string }; shown?: boolean; look?: string }
type Cal = { today?: { year: number; month: number; day: number } }

test('the in-game time is set, runs to a time, keeps its alarm to the GM, shows on players’ screens and moves the date on at midnight', async ({ page, world }) => {
  await open(page, `/w/${world.slug}/date`)
  const before = await getRecord(page, 'worlds', world.id)
  const clock = async () => ((await getRecord(page, 'worlds', world.id))!.gmScreen as { gameClock?: Clock } | undefined)?.gameClock
  try {
    const card = page.locator('.game-clock')
    await expect(card.getByRole('heading', { name: /In-game time/ })).toBeVisible()

    // Digital, set to 15:00.
    await card.getByRole('button', { name: 'Digital 24-hour' }).click()
    await card.getByLabel('Set the time to').fill('15:00')
    await card.getByRole('button', { name: 'Set', exact: true }).click()
    await expect(card.locator('.game-clock-now .game-digital')).toHaveText('15:00')

    // Reach 21:00 in 1 h 30 min: six game hours in an hour and a half is four times real time.
    await card.getByLabel('Reach this game time').fill('21:00')
    await card.getByLabel('Real hours').fill('1')
    await card.getByLabel('Real minutes').fill('30')
    await card.getByRole('button', { name: 'Go', exact: true }).click()
    await expect(card.locator('.game-heading')).toContainText('Heading for 21:00')
    await expect.poll(async () => (await clock())?.rate).toBeCloseTo(4, 3)
    const c = (await clock())!
    expect(c.running).toBe(true)
    expect(c.until! - 21 * 3600).toBe(0)

    // An alarm, for the GM alone.
    await card.getByLabel('Alarm at').fill('20:00')
    await card.getByLabel('What happens at the alarm').fill('The ritual completes')
    await card.getByRole('button', { name: 'Set alarm' }).click()
    await expect(card.locator('.game-alarm')).toContainText('The ritual completes')
    expect((await getRecord(page, 'worlds', world.id))!.gameTime ?? null).toBeNull()

    // Shown: players get the clock but not the alarm.
    await card.getByRole('button', { name: 'Show players' }).click()
    await expect.poll(async () => !!(await getRecord(page, 'worlds', world.id))!.gameTime).toBe(true)
    const shown = (await getRecord(page, 'worlds', world.id))!.gameTime as Record<string, unknown>
    expect(shown.alarm).toBeUndefined()
    expect(JSON.stringify(shown)).not.toContain('ritual')

    const tv = await page.context().newPage()
    await open(tv, `/screen/${world.slug}`)
    await expect(tv.locator('.players-screen .game-time .game-digital')).toHaveText(/^1[5-9]:\d\d$/)
    await expect(tv.locator('body')).not.toContainText('ritual')
    await tv.close()

    const player = await page.context().newPage()
    await setView(player, world, 'player')
    await open(player, `/w/${world.slug}`)
    await expect(player.locator('.game-time-bar .game-digital')).toHaveText(/^1[5-9]:\d\d$/)
    await expect(player.locator('body')).not.toContainText('ritual')
    await player.close()
    await page.evaluate((key) => localStorage.setItem(key, 'gm'), `viewMode.${world.id}`)

    // Stopped at 23:55, then ten minutes on: past midnight, the world's date moves on a day.
    await card.getByRole('button', { name: 'Pause' }).click()
    await card.getByLabel('Set the time to').fill('23:55')
    await card.getByRole('button', { name: 'Set', exact: true }).click()
    await expect(card.locator('.game-clock-now .game-digital')).toHaveText('23:55')
    const dayBefore = ((await getRecord(page, 'worlds', world.id))!.calendar as Cal).today!
    await card.getByRole('button', { name: '+10 min' }).click()
    await expect(card.locator('.game-clock-now .game-digital')).toHaveText('00:05')
    await expect.poll(async () => ((await getRecord(page, 'worlds', world.id))!.calendar as Cal).today).not.toEqual(dayBefore)
    expect((await clock())!.secs).toBe(5 * 60)

    // Hidden again: players' copy goes.
    await card.getByRole('button', { name: 'Stop showing' }).click()
    await expect.poll(async () => (await getRecord(page, 'worlds', world.id))!.gameTime ?? null).toBeNull()
  } finally {
    await putBack(page, 'worlds', [[world.id, before]])
  }
})
