import type { Browser, Page, WebSocketRoute } from '@playwright/test'
import { expect, open, test, type Device } from './fixtures'
import { fakeCloud, putRows, type CloudState } from './lib/cloud'
import { makePlayerCopy, offline } from './lib/playerCopy'
import { getRecord, patchRecord, putBack } from './lib/records'
import { PORT } from './lib/server'

/**
 * Who can say what at the table, and what reaches players (laptop only):
 *  - the live link: a player's app only believes the GM's own room ("table:<world>"), so a player
 *    posting GM messages in the room every player can post in ("members:<world>") changes nothing;
 *    rolls show the name from the member list (by user id), and a name that only claims to be the
 *    GM says "(a player)"; the GM's app sends only to its own room, and a saved roll's name stays
 *    on the GM screen;
 *  - "This session is being recorded" in the Common Room and on the players' screen while the GM's
 *    app records, gone once it stops;
 *  - the picture of a GM-only page goes out as "A picture" (or what the GM calls it), never under
 *    the page's name;
 *  - names: no hidden characters, no other member's name, nothing that reads as the GM's; joining
 *    suggests a first name only;
 *  - an email link for another account doesn't switch accounts unless the person says so, and a
 *    link of a kind the app never sends is ignored;
 *  - "Sign out and remove all worlds and keys from this device" says what goes, then removes it.
 * The cloud and its live rooms are pretend (lib/cloud.ts, and fakeRealtime below): nothing leaves
 * the machine. Each test puts back what it changed.
 */

test.skip(({ device }) => device !== 'laptop', 'the same on a phone')

/**
 * A pretend realtime server for the page: lets the app into any room (except those in `refuse`,
 * the way a server turns away someone not allowed in, until the test lets them), answers its
 * heartbeats, keeps what the app broadcasts (topic, event and payload) and passes on what the test says.
 */
async function fakeRealtime(page: Page) {
  const joined = new Set<string>()
  const refuse = new Set<string>()
  const sent: { topic: string; event: string; payload: Record<string, unknown> }[] = []
  let socket: WebSocketRoute | undefined
  await page.routeWebSocket(/supabase\.co\/realtime/, (ws) => {
    socket = ws
    ws.onMessage((m) => {
      if (typeof m !== 'string') return void sent.push(readPush(m))
      const [joinRef, ref, topic, event] = JSON.parse(m) as [string | null, string | null, string, string]
      if (event === 'phx_join' && refuse.has(topic)) return ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'error', response: { reason: 'Unauthorized' } }]))
      if (event === 'phx_join') joined.add(topic)
      if (ref !== null) ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]))
    })
  })
  const say = (topic: string, event: string, payload: object) => socket!.send(JSON.stringify([null, null, `realtime:${topic}`, 'broadcast', { type: 'broadcast', event, payload }]))
  return { joined, refuse, sent, say }
}

/** One broadcast the app sent, in realtime's binary form: kind, then the lengths of what follows, then the JSON payload. */
function readPush(b: Buffer) {
  const [, joinRef, ref, topicLength, eventLength, metaLength] = b
  let at = 7 + joinRef + ref
  const take = (n: number) => b.subarray(at, (at += n)).toString('utf8')
  const topic = take(topicLength)
  const event = take(eventLength)
  at += metaLength
  return { topic, event, payload: JSON.parse(b.subarray(at).toString('utf8') || '{}') as Record<string, unknown> }
}

async function freshContext(browser: Browser, device: Device) {
  const context = await browser.newContext({ baseURL: `http://localhost:${PORT}`, serviceWorkers: 'block', viewport: device === 'phone' ? { width: 390, height: 844 } : { width: 1366, height: 860 } })
  await context.route((url) => url.host !== `localhost:${PORT}`, (route) => route.abort())
  return context
}

const cloudState = (): CloudState => ({ worldId: '', world_members: [], player_questions: [], downtime_actions: [], character_claims: [], character_requests: [], writes: [] })

const fakeJwt = (sub: string, email: string) => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.c2ln`
}

test('a player’s app believes only the GM’s room: a player passing for the GM changes nothing, rolls go by who sent them, and recording is said', async ({ page, world }) => {
  await offline(page)
  const rt = await fakeRealtime(page)
  await page.goto('/')
  const copy = await makePlayerCopy(page, world, 'member')
  // The player's character, so the session being played is their campaign's.
  const pc = world.dump.entities.find((e) => e.visibility === 'players' && e.type === 'pc' && (e as { template?: boolean }).template !== true) as { campaignId?: string } | undefined
  const live = { session: { id: 's-live', number: 7, title: 'The Drowned Bell', campaignId: pc?.campaignId ?? '' } }
  // The GM's room doesn't let the player in yet (a slow or failed join): the moment an older app
  // still believed GM messages from the room every player can post in.
  rt.refuse.add('realtime:table:testcopy')
  try {
    await open(page, `/w/${copy.id}`)
    await expect.poll(() => [...rt.joined]).toContain('realtime:members:testcopy')
    const heading = page.locator('.room-head h1')
    const recorded = page.getByText('This session is being recorded')

    // In the room every player can post in, a "GM" message is a player's: nothing changes.
    rt.say('members:testcopy', 'table', { ...live, recording: true, sentAt: Date.now() })
    await page.waitForTimeout(1000)
    await expect(heading).not.toContainText('Playing now')
    await expect(recorded).toHaveCount(0)

    // The GM's room lets them in (the app tries again by itself).
    rt.refuse.clear()
    await expect.poll(() => [...rt.joined], { timeout: 30_000 }).toContain('realtime:table:testcopy')
    // Now in it, still nothing from the members' room counts.
    rt.say('members:testcopy', 'table', { ...live, recording: true, sentAt: Date.now() })
    await page.waitForTimeout(500)
    await expect(heading).not.toContainText('Playing now')

    // From the GM's own room: playing now, and being recorded.
    rt.say('table:testcopy', 'table', { ...live, recording: true, sentAt: Date.now() })
    await expect(heading).toContainText('Playing now')
    await expect(recorded).toBeVisible()

    // Rolls: Ash's, signed "GM", shows as Ash's; an old app's "GM" says "(a player)"; the GM's own is the GM's.
    rt.say('members:testcopy', 'dice', { id: 'r-1', who: 'GM', uid: 'u-ash', expr: 'd20', total: 17, detail: '17' })
    rt.say('members:testcopy', 'dice', { id: 'r-2', who: 'GM', expr: 'd20', total: 3, detail: '3' })
    rt.say('table:testcopy', 'dice', { id: 'r-3', who: 'GM', expr: 'd20', total: 12, detail: '12' })
    const roll = (total: number) => page.locator('.table-rolls li', { has: page.locator('b', { hasText: new RegExp(`^${total}$`) }) }).locator('span').first()
    await expect(roll(17)).toHaveText('Ash')
    await expect(roll(3)).toHaveText('GM (a player)')
    await expect(roll(12)).toHaveText('GM')

    // The GM's app stops recording: the note goes, and the session is still on.
    rt.say('table:testcopy', 'table', { ...live, recording: false, sentAt: Date.now() })
    await expect(recorded).toHaveCount(0)
    await expect(heading).toContainText('Playing now')
    // Another of the GM's apps, not recording, says nothing either way: the note stays as it was.
    rt.say('table:testcopy', 'table', { ...live, recording: true, sentAt: Date.now() })
    await expect(recorded).toBeVisible()
    rt.say('table:testcopy', 'table', { ...live, sentAt: Date.now() })
    await page.waitForTimeout(500)
    await expect(recorded).toBeVisible()
  } finally {
    await page.evaluate((id) => localStorage.removeItem(`codex.room.liveSeen.${id}`), copy.id)
    await copy.remove()
  }
})

test('the GM’s app talks only in the GM’s room, and a saved roll’s name stays on the GM screen', async ({ page, world }) => {
  const rt = await fakeRealtime(page)
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  await open(page, w)
  const session = (await getRecord(page, 'sessions', s1.id))!
  const screen = ((await getRecord(page, 'worlds', world.id))!.gmScreen ?? { pages: [] }) as object
  const was = await patchRecord(page, 'worlds', world.id, { cloud: { enabled: true }, gmScreen: { ...screen, rolls: [{ id: 'roll-secret', name: 'Assassin in the choir', expr: 'd20+5' }] } })
  await patchRecord(page, 'sessions', s1.id, { lectern: { ...(session.lectern as object), share: { rolls: true } } })
  await page.evaluate(([id, sid]) => sessionStorage.setItem(`codex.liveSession.${id}`, sid), [world.id, s1.id])
  try {
    await open(page, `${w}/s/${s1.id}/lectern`)
    // The live session goes out, from the GM's room.
    await expect.poll(() => rt.sent.filter((m) => m.event === 'table').map((m) => m.topic)).toContain(`realtime:table:${world.id}`)
    const panel = page.locator('section.lectern-panel', { has: page.getByRole('heading', { name: /GM screen/ }) })
    const unfold = panel.getByRole('button', { name: /^Open GM screen/ })
    if (await unfold.count()) await unfold.click()
    await panel.getByRole('button', { name: 'Saved rolls' }).click()
    await panel.getByRole('button', { name: /Assassin in the choir/ }).click()
    await expect.poll(() => rt.sent.filter((m) => m.event === 'dice').length).toBeGreaterThan(0)
    // Give a copy to another room time to go out too, if there were one.
    await page.waitForTimeout(500)
    const dice = rt.sent.filter((m) => m.event === 'dice')
    // Players get the dice, not the roll's name, and only from the GM's room.
    expect(dice.map((d) => d.payload.expr)).toEqual(['d20+5'])
    expect(JSON.stringify(dice.map((d) => d.payload))).not.toContain('Assassin')
    expect(dice.map((d) => d.topic)).toEqual([`realtime:table:${world.id}`])
    // The GM's own result keeps the name.
    await expect(panel.locator('.roll-result')).toContainText('Assassin in the choir')
    // Nothing of the GM's went to the room every player can post in.
    const gmSays = ['table', 'dice', 'ping', 'downtime', 'signal-seen']
    expect(rt.sent.filter((m) => m.topic === `realtime:members:${world.id}` && gmSays.includes(m.event)).map((m) => m.event)).toEqual([])
  } finally {
    await page.evaluate((id) => {
      sessionStorage.removeItem(`codex.liveSession.${id}`)
      localStorage.removeItem(`codex.room.liveSeen.${id}`)
    }, world.id)
    await putBack(page, 'worlds', [[world.id, was]])
    await putBack(page, 'sessions', [[s1.id, session]])
  }
})

test('the players’ screen says the session is being recorded while this device records it', async ({ page, world }) => {
  await open(page, `/screen/${world.slug}`)
  const recorded = page.getByText('This session is being recorded')
  await expect(page.getByRole('heading', { name: world.world.name })).toBeVisible()
  await expect(recorded).toHaveCount(0)
  // The window that records (the GM's Lectern, say) tells the device's other windows.
  const say = (recording: string | null) => page.evaluate((r) => new BroadcastChannel('codex.recording').postMessage({ recording: r }), recording)
  await say(world.id)
  await expect(recorded).toBeVisible()
  await say(null)
  await expect(recorded).toHaveCount(0)
  // Another world being recorded isn't this one.
  await say('some-other-world')
  await page.waitForTimeout(500)
  await expect(recorded).toHaveCount(0)
})

test('the picture of a GM-only page goes out as “A picture”, or what the GM calls it, never under the page’s name', async ({ page, world }) => {
  const w = `/w/${world.slug}`
  const s1 = world.session(1)
  const secret = world.dump.entities.find((e) => e.visibility === 'gm' && e.type === 'npc' && (e as { imageId?: string }).imageId && !(e as { template?: boolean }).template)!
  const known = world.dump.entities.find((e) => e.visibility === 'players' && e.type === 'npc' && (e as { imageId?: string }).imageId && !(e as { template?: boolean }).template)!
  await open(page, `${w}/s/${s1.id}/lectern`)
  const before = await getRecord(page, 'worlds', world.id)
  const showing = async () => ((await getRecord(page, 'worlds', world.id)) as { showing?: { title: string; assetId?: string } | null }).showing ?? null
  // An older portrait, no longer on the page, in a file named after it.
  const oldFile = `${secret.name} old`
  const oldId = 'test-old-portrait'
  await page.evaluate(
    ({ id, worldId, name }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction('assets', 'readwrite')
          tx.objectStore('assets').put({ id, worldId, name, mime: 'image/png', size: 4, blob: new Blob(['test'], { type: 'image/png' }), tags: [], visibility: 'gm', createdAt: 1 })
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    { id: oldId, worldId: world.id, name: `${oldFile}.png` },
  )
  try {
    await open(page, `${w}/s/${s1.id}/lectern`)
    const panel = page.locator('#lectern-show')
    const unfold = panel.getByRole('button', { name: /^Open Show players/ })
    if (await unfold.count()) await unfold.click()
    const find = panel.getByRole('searchbox', { name: 'Find a picture' })
    await find.fill(secret.name)
    await panel.locator('.show-pics .show-thumb', { hasText: secret.name }).filter({ hasNotText: oldFile }).first().click()
    // Asked first, with a name that gives nothing away.
    const ask = page.getByRole('dialog', { name: 'Show this picture?' })
    const name = ask.getByLabel('What players see it called')
    await expect(name).toHaveValue('A picture')
    // Its own name won't do.
    await name.fill(secret.name.toUpperCase())
    await expect(ask.getByRole('alert')).toContainText('players don’t know yet')
    await expect(ask.getByRole('button', { name: 'Show players' })).toBeDisabled()
    await name.fill('A hooded stranger')
    await ask.getByRole('button', { name: 'Show players' }).click()
    await expect.poll(async () => (await showing())?.title).toBe('A hooded stranger')
    const handouts = async () => (((await getRecord(page, 'worlds', world.id)) as { handouts?: { title: string }[] }).handouts ?? []).map((h) => h.title)
    expect(await handouts()).not.toContain(secret.name)
    await expect(panel.locator('.now-showing')).toContainText('A hooded stranger')
    // A picture players may know goes straight up, under its page's name.
    await find.fill(known.name)
    await panel.locator('.show-pics .show-thumb', { hasText: known.name }).first().click()
    await expect.poll(async () => (await showing())?.title).toBe(known.name)
    await expect(page.getByRole('dialog', { name: 'Show this picture?' })).toHaveCount(0)
    // The file named after the page asks first too; Cancel shows nothing.
    await find.fill(oldFile)
    await panel.locator('.show-pics .show-thumb', { hasText: oldFile }).click()
    await expect(ask).toContainText(`Its file is named after “${secret.name}”`)
    await expect(name).toHaveValue('A picture')
    await ask.getByRole('button', { name: 'Cancel' }).click()
    await expect(ask).toHaveCount(0)
    expect((await showing())?.title).toBe(known.name)
    // Older handouts under the secret name, or under a file name after it, shown again, go out as "A picture".
    const asset = (secret as { imageId?: string }).imageId!
    await patchRecord(page, 'worlds', world.id, {
      handouts: [
        { id: 'old-handout', kind: 'image', title: secret.name, assetId: asset, at: 2 },
        { id: 'old-file-handout', kind: 'image', title: oldFile, assetId: oldId, at: 1 },
      ],
      showing: null,
    })
    await open(page, `${w}/handouts`)
    const listed = (title: string) => page.locator('.handout-list li', { hasText: title })
    await listed(oldFile).getByRole('button', { name: 'Show again' }).click()
    await expect.poll(async () => (await showing())?.title).toBe('A picture')
    await expect(listed(secret.name)).toHaveCount(1)
    await listed(secret.name).getByRole('button', { name: 'Show again' }).click()
    await expect.poll(async () => (await showing())?.assetId).toBe(asset)
    expect((await showing())?.title).toBe('A picture')
    expect(await handouts()).toEqual(['A picture', 'A picture'])
  } finally {
    await putBack(page, 'worlds', [[world.id, before]])
    await putBack(page, 'assets', [[oldId, null]])
  }
})

test('names: no hidden characters, nothing that reads as the GM, and joining suggests just a first name', async ({ browser, device }) => {
  const context = await freshContext(browser, device)
  try {
    const state = cloudState()
    await fakeCloud(context, state)
    // Signed in with Google: the account has a full name.
    await context.addInitScript(() => {
      const key = 'sb-ysrxumagiiaoihlhofqt-auth-token'
      try {
        const s = JSON.parse(localStorage.getItem(key) ?? 'null')
        if (s) localStorage.setItem(key, JSON.stringify({ ...s, user: { ...s.user, user_metadata: { full_name: 'Samantha Jane Doe' } } }))
      } catch {
        /* about:blank */
      }
    })
    const page = await context.newPage()
    await page.goto('/join/test-token')
    const box = page.getByLabel('What should the table call you?')
    await expect(box).toHaveValue('Samantha')
    await expect(page.getByText('you don’t have to use your real name')).toBeVisible()
    await expect(page.getByText('Others in the world will see you as “Samantha”')).toBeVisible()
    // A right-to-left override (or a zero-width space) can make a name look like another: not allowed.
    for (const bad of ['Sam‮yrrah', 'Sa​m']) {
      await box.fill(bad)
      await expect(page.getByRole('alert')).toContainText('hidden characters')
      await page.getByRole('button', { name: 'Join the world' }).click()
    }
    // A player can't go by the GM's name.
    await box.fill('GM Brayden')
    await expect(page.getByRole('alert')).toContainText('reads like the GM’s name')
    await page.getByRole('button', { name: 'Join the world' }).click()
    expect(state.writes).toEqual([])
    // A plain name joins as before.
    await box.fill('Sam')
    await page.getByRole('button', { name: 'Join the world' }).click()
    await expect.poll(() => state.writes).toContain('RPC join_world')
  } finally {
    await context.close()
  }
})

test('a player can’t take a name someone else in the world has', async ({ page, world }) => {
  await offline(page)
  const sent: unknown[] = []
  await page.route('**/rest/v1/rpc/rename_member', async (route) => {
    sent.push(route.request().postDataJSON())
    await route.fulfill({ status: 204, body: '' })
  })
  await page.goto('/')
  const copy = await makePlayerCopy(page, world, 'member')
  try {
    await open(page, `/w/${copy.id}?tab=me`)
    await page.getByRole('button', { name: 'Change my name' }).click()
    const box = page.getByLabel('Your name')
    // Ash is in the world already (any capitals, any spacing).
    await box.fill('  ASH ')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('alert')).toContainText('already called')
    await box.fill('Dm Sam')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('alert')).toContainText('reads like the GM’s name')
    expect(sent).toEqual([])
    await box.fill('Ashley')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Everyone here sees you as')).toContainText('Ashley')
    expect(sent).toEqual([expect.objectContaining({ name: 'Ashley' })])
  } finally {
    await copy.remove()
  }
})

test('an email link for another account asks before switching, and a link of a kind the app never sends is ignored', async ({ browser, device }) => {
  const context = await freshContext(browser, device)
  try {
    await fakeCloud(context, cloudState())
    const verified: string[] = []
    const loggedOut: string[] = []
    const other = { id: '00000000-0000-4000-8000-0000000000bb', aud: 'authenticated', role: 'authenticated', email: 'stranger@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
    const theirs = { access_token: fakeJwt(other.id, other.email), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'their-refresh', user: other }
    await context.route('**/auth/v1/verify**', (route) => {
      verified.push(route.request().postData() ?? '')
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(theirs) })
    })
    await context.route('**/auth/v1/logout**', (route) => {
      loggedOut.push(route.request().headers()['authorization'] ?? '')
      return route.fulfill({ status: 204, body: '' })
    })
    const page = await context.newPage()
    const asked: string[] = []
    page.on('dialog', (d) => {
      asked.push(d.message())
      void d.dismiss()
    })
    const notice = page.getByRole('dialog', { name: 'The Warded Atlas account' })
    const signedInAs = () => page.evaluate(() => (JSON.parse(localStorage.getItem('sb-ysrxumagiiaoihlhofqt-auth-token') ?? '{}') as { user?: { email?: string } }).user?.email)

    // A kind of link the app's emails never use: not even sent to the server.
    await page.goto('/?token_hash=abc&type=invite')
    await expect(notice).toContainText('isn’t one the Warded Atlas sends')
    expect(verified).toEqual([])
    expect(page.url()).not.toContain('token_hash')

    // A link for someone else's account: asked first, and No keeps you as you were.
    await page.goto('/?token_hash=def&type=magiclink')
    await expect.poll(() => asked.length).toBe(1)
    expect(asked[0]).toContain('This link signs in as stranger@example.com')
    expect(asked[0]).toContain('you’re signed in as gm@example.com')
    await expect(notice).toContainText('Nothing changed: you’re still signed in as gm@example.com')
    expect(verified).toHaveLength(1)
    expect(await signedInAs()).toBe('gm@example.com')
    // The other account's sign-in that the check made is thrown away again.
    expect(loggedOut).toEqual([`Bearer ${theirs.access_token}`])
  } finally {
    await context.close()
  }
})

test('“Sign out and remove all worlds and keys” says what goes, then leaves nothing of yours on the device', async ({ browser, device }) => {
  test.setTimeout(120_000)
  const context = await freshContext(browser, device)
  try {
    const state = cloudState()
    await fakeCloud(context, state)
    const loggedOut: string[] = []
    await context.route('**/auth/v1/logout**', (route) => {
      loggedOut.push(route.request().url())
      return route.fulfill({ status: 204, body: '' })
    })
    const page = await context.newPage()
    await page.goto('/')
    await page.getByRole('button', { name: /New world/ }).click()
    await page.getByLabel('Name').fill('The Lantern Road')
    await page.getByRole('button', { name: 'Create world' }).click()
    await page.waitForURL(/\/w\/[^/]+/)
    const worlds = () =>
      page.evaluate(
        () =>
          new Promise<{ id: string; name: string }[]>((resolve) => {
            const req = indexedDB.open('ttrpg-campaign-manager')
            req.onsuccess = () => {
              const db = req.result
              if (!db.objectStoreNames.contains('worlds')) {
                db.close()
                return resolve([])
              }
              const get = db.transaction('worlds').objectStore('worlds').getAll()
              get.onsuccess = () => {
                db.close()
                resolve(get.result)
              }
            }
          }),
      )
    const [local] = await worlds()
    // A second world, backed up to the account.
    state.worldId = 'synced-world'
    await putRows(page, 'worlds', [{ ...local, id: 'synced-world', name: 'The Glass Coast', cloud: { enabled: true } }])
    await page.evaluate(() => localStorage.setItem('codex.test.marker', 'mine'))
    await open(page, '/')
    await page.getByRole('button', { name: /gm@example\.com/ }).click()
    const account = page.getByRole('dialog', { name: 'Your account' })
    await account.getByRole('button', { name: 'Sign out and remove all worlds and keys from this device…' }).click()
    await expect(account).toContainText('Gone for good')
    await expect(account.locator('.error')).toContainText('“The Lantern Road”')
    await expect(account).toContainText('Saved in your account, so they come back when you sign in again: “The Glass Coast”')
    await expect(account).toContainText('the AI keys saved here')
    // Not before saying so.
    const remove = account.getByRole('button', { name: 'Remove everything and sign out' })
    await expect(remove).toBeDisabled()
    // Cancel changes nothing.
    await account.getByRole('button', { name: 'Cancel' }).click()
    await expect(account.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
    expect((await worlds()).map((x) => x.name).sort()).toEqual(['The Glass Coast', 'The Lantern Road'])
    // Now for real.
    await account.getByRole('button', { name: 'Sign out and remove all worlds and keys from this device…' }).click()
    await account.getByLabel(/I understand that world is gone for good/).check()
    // It starts the app afresh once everything is gone.
    const reloaded = page.waitForEvent('load')
    await remove.click()
    await reloaded
    expect(new URL(page.url()).pathname).toBe('/')
    await expect(page.getByRole('heading', { name: /Your worlds/ })).toBeVisible()
    await expect.poll(async () => (await worlds()).map((x) => x.name)).toEqual([])
    expect(await page.evaluate(() => localStorage.getItem('codex.test.marker'))).toBeNull()
    expect(loggedOut.some((u) => u.includes('scope=local'))).toBe(true)
  } finally {
    await context.close()
  }
})
