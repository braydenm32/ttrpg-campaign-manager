import { expect, open, setView, test, type Page } from './fixtures'
import { allText } from './lib/checks'
import { getRecord, putBack } from './lib/records'

/**
 * The party's reputation (src/reputation.tsx), on a laptop and a phone: the GM raises the reach with
 * a reason and the history shows it, newest first; a place note left GM only never reaches the
 * player view while one marked for players does (on the Reputation screen and the Party tab), and
 * the same for the reasons; a character's own fame on their page; and a reputation change suggested
 * in a recap pasted back from Claude is only made once the GM adds it.
 *
 * Each test removes the reputation it made (straight in the database), since tests in one worker
 * share the world.
 */

const partyRow = (worldId: string) => `rep-party-${worldId}`

async function change(page: Page, button: string, reason: string, playersSeeWhy = false) {
  await page.getByRole('button', { name: button, exact: true }).first().click()
  const form = page.locator('form.rep-change')
  await form.getByLabel('What happened?').fill(reason)
  if (playersSeeWhy) await form.getByLabel('Players can see why').check()
  await form.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(form).toHaveCount(0)
}

async function addNote(page: Page, place: string, text: string, forPlayers: boolean) {
  await page.getByRole('button', { name: '+ Note on a place' }).click()
  const form = page.locator('form.rep-add-note')
  await form.getByLabel('Place', { exact: true }).fill(place)
  await form.getByLabel('How they see the party').fill(text)
  if (forPlayers) await form.getByLabel('Players can see this').check()
  await form.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(form).toHaveCount(0)
}

test('the GM raises the reach with a reason; players see only the notes and reasons marked for them', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  try {
    await open(page, `${w}/reputation`)
    await expect(page.getByRole('heading', { level: 1, name: /Reputation/ })).toBeVisible()
    await expect(page.locator('.rep-reach')).toHaveText('Not known yet')

    // Up one level, with a reason players may read.
    await change(page, 'Spread further', 'Saved the mayor’s daughter', true)
    await expect(page.locator('.rep-reach')).toHaveText('Town')
    const history = page.locator('.rep-history > li')
    await expect(history).toHaveCount(1)
    await expect(history.first()).toContainText('Word spread to Town')
    await expect(history.first()).toContainText('Saved the mayor’s daughter')

    // A turn toward infamy whose reason stays with the GM: newest first.
    await change(page, 'Toward infamy', 'REP-GM-REASON burned the toll house')
    await expect(history).toHaveCount(2)
    await expect(history.first()).toContainText('Talk turned toward infamy (Leaning infamous)')
    await expect(history.first()).toContainText('REP-GM-REASON')
    await expect(history.nth(1)).toContainText('Saved the mayor’s daughter')

    // Two notes on places: one for the GM alone, one for the players.
    await addNote(page, 'REP-GM-PLACE Court', 'REP-GM-NOTE wanted for questioning', false)
    await addNote(page, 'Cinderford', 'Owe us a debt', true)
    await expect(page.locator('.rep-notes > li')).toHaveCount(2)
    await expect(page.locator('.rep-notes > li.gm-only')).toContainText('GM only')

    // The player view: the reach, the lean, the note and the reason marked for players, and nothing else.
    await setView(page, world, 'player')
    await open(page, `${w}/reputation`)
    await expect(page.locator('.rep-reach')).toHaveText('Town')
    await expect(page.locator('.rep-page')).toContainText('Leaning infamous')
    await expect(page.locator('.rep-page')).toContainText('Owe us a debt')
    await expect(page.locator('.rep-page')).toContainText('Saved the mayor’s daughter')
    let text = await allText(page)
    expect(text).not.toContain('REP-GM-NOTE')
    expect(text).not.toContain('REP-GM-REASON')
    expect(text).not.toContain('REP-GM-PLACE')
    await expect(page.getByRole('button', { name: 'Spread further' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '+ Note on a place' })).toHaveCount(0)

    // The Party tab has it too.
    await open(page, `${w}?tab=party`)
    const card = page.getByRole('region', { name: 'The party’s reputation' })
    await expect(card).toContainText('Known as far as Town')
    await expect(card).toContainText('Owe us a debt')
    text = await allText(page)
    expect(text).not.toContain('REP-GM-NOTE')
    expect(text).not.toContain('REP-GM-REASON')
  } finally {
    await putBack(page, 'reputation', [[partyRow(world.id), null]])
  }
})

test('a character’s own fame: one line on their page, the history folded away', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const pc = world.page('Varra Nine-Knuckles')
  try {
    await open(page, `${w}/p/${world.pageSlug('Varra Nine-Knuckles')}`)
    const fame = page.locator('.rep-char')
    await expect(fame).toContainText('Not known yet')
    await fame.getByRole('button', { name: 'Change' }).click()
    await change(page, 'Spread further', 'REP-PC-REASON won the pit fight')
    await expect(fame).toContainText('Known as far as Town')
    // The history is folded: one tap opens it.
    await expect(fame.locator('.rep-history')).toHaveCount(0)
    await fame.getByRole('button', { name: 'History (1)' }).click()
    await expect(fame.locator('.rep-history')).toContainText('REP-PC-REASON')

    // Players see the line (on the page and the Party tab), not the GM-only reason.
    await setView(page, world, 'player')
    await open(page, `${w}/p/${world.pageSlug('Varra Nine-Knuckles')}`)
    await expect(page.locator('.rep-char')).toContainText('Known as far as Town')
    // No Change button, and no history to open (its one reason is the GM's).
    await expect(page.locator('.rep-char').getByRole('button', { name: /Change|History/ })).toHaveCount(0)
    expect(await allText(page)).not.toContain('REP-PC-REASON')
    await open(page, `${w}?tab=party`)
    await expect(page.locator('.party-list')).toContainText('Known as far as Town')
  } finally {
    await putBack(page, 'reputation', [[`rep-${pc.id}`, null]])
  }
})

test('a reputation change from a pasted recap is made only when the GM adds it', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  const before = await (async () => {
    await open(page, `${w}/s/${s1.id}?tab=notes`)
    return getRecord(page, 'sessions', s1.id)
  })()
  try {
    await page.getByRole('button', { name: 'Paste a reply' }).click()
    await page.getByPlaceholder('Paste Claude’s reply here').fill(
      [
        '## GM summary',
        '- They pulled the mayor’s daughter out of the ford.',
        '',
        '## Player recap',
        'You pulled the mayor’s daughter out of the ford.',
        '',
        '## World updates',
        '```json',
        '[{"kind":"reputation","who":"party","reach":"up","lean":"fame","reason":"Pulled the mayor’s daughter out of the ford"}]',
        '```',
      ].join('\n'),
    )
    await page.getByRole('button', { name: 'Check the draft' }).click()
    const review = page.locator('.world-updates')
    await expect(review.getByRole('heading', { name: 'Reputation' })).toBeVisible()
    await expect(review).toContainText('The party’s reputation: word spreads further, toward fame (Pulled the mayor’s daughter out of the ford)')

    // Nothing has changed yet.
    expect(await getRecord(page, 'reputation', partyRow(world.id))).toBeUndefined()
    await review.getByRole('button', { name: /^Add 1 change/ }).click()
    await expect(review).toContainText('1 change made to the world')

    await open(page, `${w}/reputation`)
    await expect(page.locator('.rep-reach')).toHaveText('Town')
    await expect(page.locator('.rep-page')).toContainText('Leaning famous')
    const line = page.locator('.rep-history > li').first()
    await expect(line).toContainText('Pulled the mayor’s daughter out of the ford')
    await expect(line).toContainText(`Session #1`)
  } finally {
    await putBack(page, 'reputation', [[partyRow(world.id), null]])
    if (before) await putBack(page, 'sessions', [[s1.id, before]])
  }
})
