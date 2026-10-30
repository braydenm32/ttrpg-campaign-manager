import { TEST_CUSTOM_TYPE, type World } from './lib/world'
import { expect, here, open, test } from './fixtures'

/**
 * Old addresses keep working: links and bookmarks from before the short addresses ("#/…" links,
 * long ids, /e/ for pages, /type/npc for lists) must still land on the same screen, tidied to
 * today's form (src/paths.ts tidyPath and upgradeHashLink). The redesign must keep all of these.
 */

/** from: the old address; to: where it must end up; shows: something that must then be on screen. */
const cases: { name: string; from: (w: World) => string; to: (w: World) => string; shows: (w: World) => string | RegExp }[] = [
  { name: '#/ link to the world', from: (w) => `/#/w/${w.id}`, to: (w) => `/w/${w.slug}`, shows: (w) => w.world.name },
  { name: '#/ link to a page by long ids', from: (w) => `/#/w/${w.id}/e/${w.page('Ford Street').id}`, to: (w) => `/w/${w.slug}/p/${w.pageSlug('Ford Street')}`, shows: () => 'Ford Street' },
  { name: '#/ link with a query', from: (w) => `/#/w/${w.id}/s/${w.session(1).id}?tab=notes`, to: (w) => `/w/${w.slug}/s/${w.session(1).id}?tab=notes`, shows: (w) => w.session(1).title },
  { name: '#/ invite link', from: () => '/#/join/test-token', to: () => '/join/test-token', shows: () => /Sign in|invite|join/i },
  { name: 'world by long id', from: (w) => `/w/${w.id}`, to: (w) => `/w/${w.slug}`, shows: (w) => w.world.name },
  { name: 'world by long id, deeper', from: (w) => `/w/${w.id}/maps`, to: (w) => `/w/${w.slug}/maps`, shows: () => 'Cinderford' },
  { name: '/e/ page by long id', from: (w) => `/w/${w.slug}/e/${w.page('Sabe Hallows').id}`, to: (w) => `/w/${w.slug}/p/${w.pageSlug('Sabe Hallows')}`, shows: () => 'Sabe Hallows' },
  { name: '/e/ page by name', from: (w) => `/w/${w.slug}/e/${w.pageSlug('Sabe Hallows')}`, to: (w) => `/w/${w.slug}/p/${w.pageSlug('Sabe Hallows')}`, shows: () => 'Sabe Hallows' },
  { name: '/p/ page by long id', from: (w) => `/w/${w.slug}/p/${w.page('Tharos').id}`, to: (w) => `/w/${w.slug}/p/${w.pageSlug('Tharos')}`, shows: () => 'Tharos' },
  { name: 'page by long ids throughout', from: (w) => `/w/${w.id}/p/${w.page('Tharos').id}`, to: (w) => `/w/${w.slug}/p/${w.pageSlug('Tharos')}`, shows: () => 'Tharos' },
  { name: '/type/npc', from: (w) => `/w/${w.slug}/type/npc`, to: (w) => `/w/${w.slug}/npcs`, shows: () => 'Sabe Hallows' },
  { name: '/type/location', from: (w) => `/w/${w.id}/type/location`, to: (w) => `/w/${w.slug}/locations`, shows: () => 'Ford Street' },
  { name: 'bare old type word /npc (kept as it is)', from: (w) => `/w/${w.slug}/npc`, to: (w) => `/w/${w.slug}/npc`, shows: () => 'Sabe Hallows' },
  { name: '/type/custom/<id>', from: (w) => `/w/${w.slug}/type/custom/${TEST_CUSTOM_TYPE.id}`, to: (w) => `/w/${w.slug}/other/ward-notes`, shows: () => TEST_CUSTOM_TYPE.many },
  { name: '/other/<id>', from: (w) => `/w/${w.slug}/other/${TEST_CUSTOM_TYPE.id}`, to: (w) => `/w/${w.slug}/other/ward-notes`, shows: () => TEST_CUSTOM_TYPE.many },
  { name: 'map by long world id', from: (w) => `/w/${w.id}/maps/${w.map('Cinderford').id}`, to: (w) => `/w/${w.slug}/maps/${w.map('Cinderford').id}`, shows: () => 'Cinderford' },
  { name: 'print by long ids (not tidied)', from: (w) => `/w/${w.id}/print/e/${w.page('Ford Street').id}`, to: (w) => `/w/${w.id}/print/e/${w.page('Ford Street').id}`, shows: () => 'Ford Street' },
  { name: "players' screen by long id", from: (w) => `/screen/${w.id}`, to: (w) => `/screen/${w.id}`, shows: (w) => w.world.name },
]

for (const c of cases)
  test(c.name, async ({ page, world, pageErrors }) => {
    await open(page, c.from(world))
    await expect.poll(() => here(page)).toBe(c.to(world))
    await expect(page.getByText(c.shows(world)).first()).toBeVisible()
    await expect(page.getByText(/Something went wrong|There’s nothing at this address|Unknown category|doesn't exist or hasn't been revealed/)).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })

test('Back after an old address goes to where you were, not to the old address', async ({ page, world }) => {
  await open(page, `/w/${world.slug}/maps`)
  await page.goto(`/w/${world.slug}/e/${world.page('Tharos').id}`)
  await expect.poll(() => here(page)).toBe(`/w/${world.slug}/p/${world.pageSlug('Tharos')}`)
  await page.goBack()
  await expect.poll(() => here(page)).toBe(`/w/${world.slug}/maps`)
})
