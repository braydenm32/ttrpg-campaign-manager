import { expect, go, here, open, test, type Page } from './fixtures'
import { readDatabase } from './lib/world'
import { getRecord, patchRecord, putBack } from './lib/records'

/**
 * The GM's Session area (Prepare → Play → Wrap up), on a laptop and a phone: a session moves
 * through its stages and the next one comes up on the Desk; changing the scene at the Lectern
 * replaces the read-aloud text and who's here; Undo brings back a removed scene; and nothing typed
 * in the page editor is lost by leaving, while a new page left untouched leaves nothing behind.
 *
 * Each test puts back what it changed (straight in the database), since tests in one worker share
 * the world.
 */

const toast = (page: Page) => page.locator('.undo-toast')

test('a session moves Prepare → Play → Wrap up, then the next one is up on the Desk', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  const s2 = world.session(2)
  await open(page, `${w}/s/${s1.id}?tab=prep`)
  const before = await getRecord(page, 'sessions', s1.id)
  try {
    const strip = page.locator('.session-strip')
    await expect(strip.locator('[data-stage]')).toHaveAttribute('data-stage', 'preparing')
    await strip.getByRole('button', { name: 'Start playing' }).click()

    await expect.poll(() => here(page)).toBe(`${w}/s/${s1.id}/lectern`)
    await expect(page.getByRole('heading', { name: /The Lectern/ })).toBeVisible()
    await expect(page.locator('.lectern-strip [data-stage]')).toHaveAttribute('data-stage', 'playing')
    // On a phone “Wrap up” sits at the foot of the page, away from a thumb.
    await page.getByRole('button', { name: 'Wrap up' }).click()

    await expect.poll(() => here(page)).toBe(`${w}/s/${s1.id}?end=1`)
    await expect(page.locator('.session-strip [data-stage]')).toHaveAttribute('data-stage', 'playing')
    await page.getByRole('button', { name: 'Mark as played' }).first().click()
    await expect(toast(page)).toContainText('#1 marked played')
    await expect(page.locator('.session-strip [data-stage]')).toHaveAttribute('data-stage', 'played')
    await expect(page.locator('#finish')).toContainText(`Next up: #2 ${s2.title}`)

    await open(page, w)
    const card = page.locator('.next-sessions')
    await expect(card).toContainText(`#2 ${s2.title}`)
    await expect(card.locator('[data-stage]').first()).not.toHaveAttribute('data-stage', 'played')
  } finally {
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

test('typing the recap does not mark a session played; "Not played yet" takes the mark back, with Undo', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  await open(page, `${w}/s/${s1.id}?tab=prep`)
  const before = await getRecord(page, 'sessions', s1.id)
  try {
    await page.locator('.session-strip').getByRole('button', { name: 'Start playing' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/s/${s1.id}/lectern`)
    await open(page, `${w}/s/${s1.id}?end=1`)

    // One typed letter in the recap leaves it Playing, with "Mark as played" still to press.
    await page.getByPlaceholder('What the players get to read').fill('The company mustered.')
    await expect.poll(async () => (await getRecord(page, 'sessions', s1.id))?.recap).toBe('The company mustered.')
    await expect(page.locator('.session-strip [data-stage]')).toHaveAttribute('data-stage', 'playing')
    await page.getByRole('button', { name: 'Mark as played' }).first().click()
    await expect(toast(page)).toContainText('#1 marked played')
    await expect(page.locator('.session-strip [data-stage]')).toHaveAttribute('data-stage', 'played')
    await expect(page.locator('#finish')).toContainText(`Next up: #2 ${world.session(2).title}`)

    // "Not played yet" works even with a recap, and Undo marks it played again.
    await page.locator('#finish').getByRole('button', { name: 'Not played yet' }).click()
    await expect(page.locator('.session-strip [data-stage]')).toHaveAttribute('data-stage', 'playing')
    await expect(toast(page)).toContainText('not played yet')
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect(page.locator('.session-strip [data-stage]')).toHaveAttribute('data-stage', 'played')
  } finally {
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

test('changing the scene at the Lectern replaces the read-aloud text and who’s here, with Undo', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  const before = await (async () => {
    await open(page, `${w}/s/${s1.id}/lectern`)
    return getRecord(page, 'sessions', s1.id)
  })()
  try {
    const scene = page.locator('#lectern-scene')
    const present = page.locator('#lectern-present')
    // On a phone Who's here starts folded.
    const unfold = present.getByRole('button', { name: /^Open Who/ })
    if (await unfold.count()) await unfold.click()
    const text = scene.getByRole('textbox', { name: 'Read-aloud text' })
    await text.fill('The old room, read aloud.')
    await expect(present).toContainText('Ilse Marrow')

    const elsewhere = world.dump.entities.find((e) => e.type === 'location' && e.name !== 'Lantern Hill' && !e.template)!
    await scene.getByLabel('Where is the party?').selectOption(elsewhere.id)
    await expect(text).toHaveValue('')
    await expect(present).not.toContainText('Ilse Marrow')

    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect(text).toHaveValue('The old room, read aloud.')
    await expect(present).toContainText('Ilse Marrow')

    // "Next scene" goes through the planned scenes in order.
    await scene.getByRole('button', { name: 'First scene' }).click()
    await expect(scene.locator('h2')).toContainText('Scene 1 of')
    await expect(text).toHaveValue('')
    await scene.getByRole('button', { name: 'Next scene' }).click()
    await expect(scene.locator('h2')).toContainText('Scene 2 of')
  } finally {
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

test('starting a scene that reveals a page asks first, and Undo takes all of it back', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  const secret = world.dump.entities.find((e) => e.type === 'npc' && e.visibility === 'gm' && !e.template && !(e as { revealedTo?: string[] }).revealedTo?.length)!
  const newcomer = world.dump.entities.find((e) => e.type === 'npc' && e.id !== secret.id && !e.template && !s1.entityIds.includes(e.id))!
  await open(page, `${w}/s/${s1.id}/lectern`)
  const before = await getRecord(page, 'sessions', s1.id)
  const pageBefore = await getRecord(page, 'entities', secret.id)
  const worldBefore = await getRecord(page, 'worlds', world.id)
  type Prep = { scenes: Record<string, unknown>[]; encounters: unknown[] }
  type Lect = { combat?: { combatants: unknown[] } }
  const prep = before!.prep as Prep
  // The first planned scene brings a fight, someone new, reveals a GM-only page and shows it.
  await putBack(page, 'sessions', [
    [
      s1.id,
      {
        ...before!,
        startedAt: undefined,
        prep: {
          ...prep,
          encounters: [...prep.encounters, { id: 'test-fight', name: 'Test fight', notes: '', foes: [{ id: 'f1', name: 'Test goblin', count: 2, side: 'foe' }] }],
          scenes: prep.scenes.map((x, i) => (i === 0 ? { ...x, done: false, encounterId: 'test-fight', presentIds: [newcomer.id], revealIds: [secret.id], show: { kind: 'page', entityId: secret.id } } : x)),
        },
      },
    ],
  ])
  try {
    await open(page, `${w}/s/${s1.id}/lectern`)
    const scene = page.locator('#lectern-scene')
    const fighters = ((before!.lectern as Lect | undefined)?.combat?.combatants ?? []).length

    // The same review as on the page: what players get, and Cancel changes nothing.
    await scene.getByRole('button', { name: 'First scene' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(`Starting this scene reveals “${secret.name}” to players`)
    await expect(dialog).toContainText('Players will see')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(scene.locator('h2')).not.toContainText('Scene 1 of')
    expect((await getRecord(page, 'entities', secret.id))?.visibility).toBe('gm')

    await scene.getByRole('button', { name: 'First scene' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Start the scene' }).click()
    await expect(scene.locator('h2')).toContainText('Scene 1 of')
    await expect.poll(async () => (await getRecord(page, 'entities', secret.id))?.visibility).toBe('players')
    const started = (await getRecord(page, 'sessions', s1.id))!
    expect(((started.lectern as Lect).combat?.combatants ?? []).length).toBe(fighters + 2)
    expect(started.entityIds).toContain(newcomer.id)
    expect(started.startedAt).toBeTruthy()
    expect(((await getRecord(page, 'worlds', world.id)) as { showing?: { entityId?: string } }).showing?.entityId).toBe(secret.id)

    // Undo: the page is hidden again, off players' screens, and the fight, the newcomer and the start time are gone.
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect.poll(async () => (await getRecord(page, 'entities', secret.id))?.visibility).toBe('gm')
    await expect.poll(async () => ((await getRecord(page, 'worlds', world.id)) as { showing?: { id?: string } | null }).showing?.id ?? null).toBe(
      (worldBefore as { showing?: { id?: string } | null }).showing?.id ?? null,
    )
    const undone = (await getRecord(page, 'sessions', s1.id))!
    expect(((undone.lectern as Lect).combat?.combatants ?? []).length).toBe(fighters)
    expect(undone.entityIds).not.toContain(newcomer.id)
    expect(undone.startedAt).toBeFalsy()
    await expect(scene.locator('h2')).not.toContainText('Scene 1 of')
  } finally {
    await putBack(page, 'sessions', [[s1.id, before]])
    await putBack(page, 'entities', [[secret.id, pageBefore]])
    await putBack(page, 'worlds', [[world.id, worldBefore]])
  }
})

test('Undo brings back a scene removed on Prepare, in its place', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  await open(page, `${w}/s/${s1.id}?tab=prep`)
  const before = await getRecord(page, 'sessions', s1.id)
  try {
    const first = page.getByRole('textbox', { name: 'Scene 1', exact: true })
    const was = await first.inputValue()
    expect(was).not.toBe('')
    await page.getByRole('button', { name: 'Remove scene 1', exact: true }).click()
    await expect(first).not.toHaveValue(was)
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect(first).toHaveValue(was)
  } finally {
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

test('nothing typed in the page editor is lost by leaving, and an untouched new page leaves nothing', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const npc = world.page('Ilse Marrow')
  await open(page, `${w}/p/${world.pageSlug('Ilse Marrow')}?edit=1`)
  const original = await getRecord(page, 'entities', npc.id)
  const made: string[] = []
  try {
    // Typed, then away by a link or Back: saved, with Undo.
    await page.getByPlaceholder('One line shown in lists and on map pins').fill('Typed and never saved')
    await go(page, `${w}/maps`)
    await expect(toast(page)).toContainText('Saved your changes to “Ilse Marrow”')
    await expect.poll(async () => (await getRecord(page, 'entities', npc.id))?.summary).toBe('Typed and never saved')
    await toast(page).getByRole('button', { name: 'Undo' }).click()
    await expect.poll(async () => (await getRecord(page, 'entities', npc.id))?.summary).toBe(original?.summary)

    // A new page is only added once there's something in it.
    const count = async () => (await readDatabase(page)).entities.length
    const pages = await count()
    const newNpc = async () => {
      await open(page, `${w}/npcs`)
      await page.getByRole('button', { name: /^\+ New NPC/ }).first().click()
      const blank = page.getByRole('menuitem', { name: 'Blank page' })
      if (await blank.isVisible()) await blank.click()
      await expect.poll(() => here(page)).toMatch(/\?edit=1&new=1$/)
      return page.getByPlaceholder('Name this npc')
    }
    await expect(await newNpc()).toBeVisible()
    expect(await count()).toBe(pages)
    await go(page, `${w}/maps`)
    expect(await count()).toBe(pages)

    // Cancel takes it back too (and ?new=1 still works).
    await newNpc()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect.poll(() => here(page)).toBe(`${w}/npcs`)
    expect(await count()).toBe(pages)

    // Written in and left: kept.
    await (await newNpc()).fill('Session test NPC')
    const id = here(page).match(/\/p\/([^?]+)/)![1]
    made.push(id)
    await go(page, `${w}/maps`)
    await expect(toast(page)).toContainText('Saved your changes to “Session test NPC”')
    await expect.poll(count).toBe(pages + 1)
  } finally {
    await putBack(page, 'entities', [[npc.id, original], ...made.map((id): [string, null] => [id, null])])
  }
})

test('a fight runs from one-line fighters: quick HP, Defeated folds into Down, conditions count down', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  await open(page, `${w}/s/${s1.id}/lectern`)
  const before = await getRecord(page, 'sessions', s1.id)
  try {
    const panel = page.locator('#lectern-initiative')
    await panel.getByRole('button', { name: /Add the party/ }).click()
    const rows = panel.locator('.combatant')
    await expect(rows.first()).toBeVisible()
    const count = await rows.count()
    expect(count).toBeGreaterThan(1)
    // Each fighter is one line; the details are closed until the name is tapped.
    await expect(panel.locator('.fighter-details')).toHaveCount(0)

    // Quick damage right on the line.
    const first = rows.first()
    const hp = first.locator('.hp-compact')
    const name = (await first.locator('.combatant-name').first().textContent())!.replace(/^▶\s*/, '').trim()
    const was = await hp.textContent()
    await first.getByRole('button', { name: /Damage .* by 5/ }).click()
    await expect(hp).not.toHaveText(was!)

    // A condition with a number counts down at the end of their turn and says when it runs out.
    await first.getByRole('button', { name: new RegExp(name) }).first().click()
    await first.getByLabel(/Add a condition to/).selectOption('__custom')
    await first.getByLabel(/Condition for/).fill('Burning 1')
    await first.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(first.locator('.tag', { hasText: 'Burning 1' })).toBeVisible()
    await panel.getByRole('button', { name: 'Start combat ▶' }).click()
    await panel.getByRole('button', { name: 'Next turn ▶' }).click()
    await expect(toast(page)).toContainText('Burning')
    await expect(panel.locator('.tag', { hasText: 'Burning' })).toHaveCount(0)

    if (process.env.SHOTS_DIR) await panel.screenshot({ path: `${process.env.SHOTS_DIR}/fighters.png` })

    // Defeated: the fighter leaves the order for a folded Down list, and can come back.
    await first.getByRole('button', { name: 'Defeated' }).click()
    await expect(toast(page)).toContainText('is down')
    await expect(rows).toHaveCount(count - 1)
    await panel.getByText(/Down \(1\)/).click()
    await panel.getByRole('button', { name: 'Back in' }).click()
    await expect(rows).toHaveCount(count)
  } finally {
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

test('on the Lectern: Wrap up sits at the foot on a phone, Record opens the consent note, the Strong start stays', async ({ page, world, device }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  await open(page, `${w}/s/${s1.id}/lectern`)
  const before = await getRecord(page, 'sessions', s1.id)
  try {
    await patchRecord(page, 'sessions', s1.id, { startedAt: Date.now() - 1000 })
    await open(page, `${w}/s/${s1.id}/lectern`)
    const top = page.locator('.lectern-strip .wrap-up-top')
    const foot = page.locator('.wrap-up-foot')
    if (device === 'phone') {
      await expect(top).toBeHidden()
      await expect(foot.getByRole('button', { name: 'Wrap up' })).toBeVisible()
      // The scene comes before the quick note, and Who's here starts folded.
      const scene = await page.locator('#lectern-scene').boundingBox()
      const note = await page.locator('.quick-note').boundingBox()
      expect(scene!.y).toBeLessThan(note!.y)
    } else {
      await expect(top).toBeVisible()
      await expect(foot).toBeHidden()
    }

    if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/lectern-${device}.png` })

    // The Record chip opens the Recording panel with its reminder to ask everyone first.
    await page.locator('.record-chip').click()
    await expect(page.locator('#lectern-recording')).toContainText('Ask everyone at the table before you record')

    // After “First scene” the Strong start is still there, folded, until scene 2.
    const scene = page.locator('#lectern-scene')
    await scene.getByRole('button', { name: 'First scene' }).click()
    await expect(scene.locator('h2')).toContainText('Scene 1 of')
    await expect(scene.locator('details.strong-start')).toBeVisible()
    await scene.getByRole('button', { name: 'Next scene' }).click()
    await expect(scene.locator('details.strong-start')).toHaveCount(0)
  } finally {
    await putBack(page, 'sessions', [[s1.id, before]])
  }
})

test('the Lectern’s party leaves out a dead character, with a way to show them', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  const pcs = world.dump.entities.filter((e) => {
    const x = e as { status?: string; campaignId?: string }
    return e.type === 'pc' && !e.template && (x.status ?? 'alive') === 'alive' && (!x.campaignId || x.campaignId === s1.campaignId)
  })
  const dead = pcs[0]
  await open(page, `${w}/s/${s1.id}/lectern`)
  const before = await getRecord(page, 'entities', dead.id)
  try {
    await patchRecord(page, 'entities', dead.id, { status: 'dead', statusKnown: true })
    await open(page, `${w}/s/${s1.id}/lectern`)
    const party = page.locator('#lectern-party')
    const unfold = party.getByRole('button', { name: /^Open The party/ })
    if (await unfold.count()) await unfold.click()
    const rows = party.locator('tbody tr')
    await expect(rows.first()).toBeVisible()
    await expect(party.locator('tbody')).not.toContainText(dead.name)
    const show = party.getByRole('button', { name: `Show 1 not playing (${dead.name}, dead)` })
    await show.click()
    await expect(party.locator('tbody')).toContainText(dead.name)
    await party.getByRole('button', { name: 'Hide the 1 not playing' }).click()
    await expect(party.locator('tbody')).not.toContainText(dead.name)
    // The character's page still has them, as ever.
    await open(page, `${w}/p/${world.pageSlug(dead.name)}`)
    await expect(page.locator('h1')).toContainText(dead.name)
  } finally {
    await putBack(page, 'entities', [[dead.id, before]])
  }
})
