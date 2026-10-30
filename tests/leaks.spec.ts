import { compare } from './lib/baseline'
import { allText } from './lib/checks'
import { leaksIn, secretsOf, type Secret } from './lib/secrets'
import type { World } from './lib/world'
import { ROUTES } from './routes'
import { expect, go, open, test, type Page } from './fixtures'

/**
 * Player leaks: in the player view, nothing the GM keeps to themselves may appear anywhere on any
 * screen, not even hidden in the page: names and text of GM-only pages, GM notes, ":::gm" and
 * ":::for" passages, GM-only fields and nicknames, clocks players don't know about, GM-only maps,
 * sessions and corkboards. The list of secrets comes from the example world's own data (see
 * tests/lib/secrets.ts). The search box (Ctrl K) is checked too.
 *
 * Not covered: the public wiki link and joined players. Both get a copy the server has already
 * filtered (player_view in supabase/migrations), which needs the real cloud.
 */

test.use({ view: 'player' })

const cache = new Map<string, Secret[]>()
const secrets = (world: World) => {
  if (!cache.has(world.id)) cache.set(world.id, secretsOf(world.dump))
  return cache.get(world.id)!
}

/** Checks the screen for secrets; returns the new ones (not in the baseline). */
async function check(page: Page, world: World, key: string, info: Parameters<typeof compare>[2], where: string) {
  const found = leaksIn(await allText(page), secrets(world))
  const fresh = compare(`laptop player-leaks ${key}`, { problems: found.map((s) => `leak: ${s.text}`) }, info)
  return fresh.map((f) => {
    const s = found.find((x) => `leak: ${x.text}` === f)
    return s ? `${where}: “${s.text}” (${s.why})` : `${where}: ${f}`
  })
}

test('the secrets list is built from the world', async ({ world }, info) => {
  const list = secrets(world)
  const kinds = new Map<string, number>()
  for (const s of list) {
    const kind = s.why.replace(/“[^”]*”/g, '…').replace(/#\d+/, '#N')
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1)
  }
  info.annotations.push({ type: 'secrets', description: `${list.length}: ${[...kinds].map(([k, n]) => `${n} × ${k}`).join('; ')}` })
  if (process.env.SHOW_SECRETS) console.log(list.map((s) => `${s.text}  ←  ${s.why}`).join('\n'))
  // Hundreds of secrets in the example; very few would mean the list builder broke.
  expect(list.length).toBeGreaterThan(200)
  for (const kind of ['name of the GM-only page', 'GM notes on', 'a :::gm passage', "players don't know about"])
    expect(list.some((s) => s.why.includes(kind)), `no secrets of the kind “${kind}”`).toBe(true)
})

// The check itself works: the GM view of a page with secrets on it does show some.
test.describe(() => {
  test.use({ view: 'gm' })
  test('the leak check catches secrets (GM view of a page with secrets)', async ({ page, world }) => {
    await open(page, `/w/${world.slug}/p/${world.pageSlug('Ford Street')}`)
    expect(leaksIn(await allText(page), secrets(world)).length).toBeGreaterThan(0)
    await open(page, `/w/${world.slug}/p/${world.pageSlug('The Sleeper Below')}`)
    expect(leaksIn(await allText(page), secrets(world)).length).toBeGreaterThan(0)
  })
})

// Every address in tests/routes.ts, GM tools included (they must say "for the GM" and show nothing).
for (const route of ROUTES)
  for (const sample of route.samples) {
    if (!sample.url.startsWith('/w/') && !sample.url.startsWith('/screen/')) continue
    // The print page is outside the world's frame: it's the GM copy unless the address asks for the player copy.
    if (route.path.includes('/print/') && !sample.url.includes('copy=players')) continue
    const label = `${route.path}${sample.label ? ` (${sample.label})` : ''}`
    test(`no secrets on ${label}`, async ({ page, world }, info) => {
      const url = world.resolve(sample.url)
      await open(page, url)
      const fresh = await check(page, world, label, info, url)
      expect(fresh, 'GM secrets showing in the player view').toEqual([])
    })
  }

/** Visits a list of addresses in one tab, checking each. */
async function sweep(page: Page, world: World, items: { url: string; name?: string; key: string }[], info: Parameters<typeof compare>[2]) {
  await open(page, `/w/${world.slug}`)
  const fresh: string[] = []
  for (const item of items) {
    await go(page, item.url)
    if (item.name) await expect(page.locator('main h1').first()).toContainText(item.name.slice(0, 20))
    fresh.push(...(await check(page, world, item.key, info, item.url)))
  }
  return fresh
}

const PARTS = 6
for (let part = 0; part < PARTS; part++)
  test(`no secrets on the pages players can see, part ${part + 1} of ${PARTS}`, async ({ page, world }, info) => {
    const pages = world.playerPages.filter((_, i) => i % PARTS === part)
    const fresh = await sweep(
      page,
      world,
      pages.map((e) => ({ url: `/w/${world.slug}/p/${world.pageSlugs.get(e.id)}`, name: e.name, key: `/p/${world.pageSlugs.get(e.id)}` })),
      info,
    )
    expect(fresh, 'GM secrets showing in the player view').toEqual([])
  })

test('GM-only pages and maps opened by address show nothing', async ({ page, world }, info) => {
  const pages = world.dump.entities.filter((e) => e.visibility === 'gm' || e.template).sort((a, b) => a.name.localeCompare(b.name))
  const maps = world.dump.maps
  const fresh = await sweep(
    page,
    world,
    [
      ...pages.map((e) => ({ url: `/w/${world.slug}/p/${world.pageSlugs.get(e.id)}`, key: `/p/${world.pageSlugs.get(e.id)}` })),
      ...maps.map((m) => ({ url: `/w/${world.slug}/maps/${m.id}`, key: `/maps/${m.name}` })),
    ],
    info,
  )
  expect(fresh, 'GM secrets showing in the player view').toEqual([])
  // And they say so, rather than showing an empty page.
  await go(page, `/w/${world.slug}/p/${world.pageSlugs.get(pages[0].id)}`)
  await expect(page.getByText("This page doesn't exist or hasn't been revealed.")).toBeVisible()
})

test('search (Ctrl K) finds no secrets in the player view', async ({ page, world }, info) => {
  await open(page, `/w/${world.slug}`)
  await page.keyboard.press('Control+k')
  const box = page.getByRole('dialog', { name: 'Search' }).getByRole('textbox')
  await expect(box).toBeVisible()
  const list = secrets(world)
  // Every GM-only page name, plus a spread of the other kinds of secret, and the words of a few.
  const names = list.filter((s) => s.why.startsWith('name of'))
  const others = list.filter((s) => !s.why.startsWith('name of'))
  const queries = [
    ...names.map((s) => s.text),
    ...others.filter((_, i) => i % Math.ceil(others.length / 60) === 0).map((s) => s.text.split(' ').slice(0, 3).join(' ')),
  ]
  const leaks: string[] = []
  for (const q of queries) {
    await box.fill(q)
    await page.waitForTimeout(60)
    const text = await page.getByRole('dialog', { name: 'Search' }).innerText()
    for (const s of leaksIn(text, list)) leaks.push(`searching “${q}” shows “${s.text}” (${s.why})`)
  }
  const fresh = compare('laptop player-leaks search', { problems: [...new Set(leaks)].map((l) => `leak: ${l}`) }, info)
  expect(fresh, 'GM secrets in the search results in the player view').toEqual([])
})
