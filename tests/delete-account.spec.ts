import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { fakeCloud, GM, type CloudState } from './lib/cloud'
import { PORT } from './lib/server'

/**
 * Deleting your account, on a laptop, with a pretend cloud (nothing leaves the machine): every map
 * pack picture you have online goes first, however many there are, and if any can't be removed the
 * account is left as it was and you're told why, so no pictures are left online that nobody could
 * then remove.
 */

const cloud = (): CloudState => ({ worldId: crypto.randomUUID(), world_members: [], player_questions: [], downtime_actions: [], character_claims: [], character_requests: [], writes: [] })

/**
 * The pretend cloud's map pack pictures (paths like "<user>/<piece>/<file>"). Like the real one, a
 * folder is listed at most `limit` at a time, folders come without an id, and `refuse` removes
 * nothing without saying so (as the cloud does with pictures it won't let you remove).
 */
async function packPictures(context: BrowserContext, files: Set<string>, refuse = false) {
  await context.route(/\/storage\/v1\/object\/list\/map-packs$/, (route) => {
    const { prefix = '', limit = 100, offset = 0 } = route.request().postDataJSON() as { prefix?: string; limit?: number; offset?: number }
    const inside = new Map<string, boolean>()
    for (const f of files)
      if (f.startsWith(`${prefix}/`)) {
        const [name, ...more] = f.slice(prefix.length + 1).split('/')
        inside.set(name, inside.get(name) || more.length > 0)
      }
    const page = [...inside].sort(([a], [b]) => a.localeCompare(b)).slice(offset, offset + limit)
    const body = page.map(([name, folder]) => (folder ? { name, id: null } : { name, id: `id-${name}`, metadata: {} }))
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await context.route(/\/storage\/v1\/object\/map-packs$/, (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    const { prefixes } = route.request().postDataJSON() as { prefixes: string[] }
    const gone = refuse ? [] : prefixes.filter((p) => files.delete(p))
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(gone.map((name) => ({ name }))) })
  })
}

/** Opens the account window from the worlds page and deletes the account, typing DELETE when asked. */
async function deleteAccount(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: new RegExp(GM.email) }).click()
  await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible()
  page.once('dialog', (d) => void d.accept('DELETE'))
  await page.getByRole('button', { name: 'Delete my account' }).click()
}

test.beforeEach(async ({ context }) => {
  // Nothing leaves the machine: the pretend cloud answers for the cloud.
  await context.route((url) => url.host !== `localhost:${PORT}`, (route) => route.abort())
})

test('deleting your account removes every map pack picture first, even more than a thousand in one piece', async ({ page, context }) => {
  test.setTimeout(120_000)
  const state = cloud()
  await fakeCloud(context, state)
  const files = new Set<string>()
  for (let i = 0; i < 1500; i++) files.add(`${GM.id}/big-piece/${i}-1-full.webp`)
  for (const piece of ['door', 'tree']) for (const kind of ['full', 'thumb']) files.add(`${GM.id}/${piece}/1-1-${kind}.webp`)
  // Another GM's pictures are none of this account's business.
  files.add('someone-else/their-piece/1-1-full.webp')
  await packPictures(context, files)

  await deleteAccount(page)
  await expect.poll(() => state.writes.includes('RPC delete_my_account'), { timeout: 60_000 }).toBe(true)
  expect([...files]).toEqual(['someone-else/their-piece/1-1-full.webp'])
})

test('if a map pack picture can’t be removed, the account isn’t deleted and the GM is told why', async ({ page, context }) => {
  const state = cloud()
  await fakeCloud(context, state)
  const files = new Set([`${GM.id}/door/1-1-full.webp`, `${GM.id}/door/1-1-thumb.webp`])
  await packPictures(context, files, true)

  await deleteAccount(page)
  await expect(page.getByText(/map pack pictures couldn’t all be removed/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your account' })).toBeVisible()
  // Nothing else was touched: no world's cloud copy, and not the account.
  expect(state.writes.filter((w) => w === 'RPC delete_my_account' || w.endsWith('cloud_worlds'))).toEqual([])
  expect(files.size).toBe(2)
})
