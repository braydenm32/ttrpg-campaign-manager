import type { Page } from '@playwright/test'
import { putBack, type Row } from './records'
import type { World } from './world'

/**
 * A pretend player copy of the example world, written straight into this browser's database: what
 * a public wiki reader (`wiki`) or a joined player (`member`) gets from the server. Only pages
 * players can see go in, without their GM notes, the way the server's player_view sends them. The
 * cloud is never asked: the page is told it is offline, so it doesn't try to refresh the copy.
 * Returns the copy's id, and a function that removes it again.
 */
export async function makePlayerCopy(page: Page, world: World, kind: 'wiki' | 'member') {
  const id = kind === 'wiki' ? 'shared-testcopy' : 'member-testcopy'
  const suffix = kind === 'wiki' ? '@testcopy' : '@mtestcop'
  const pages = world.dump.entities
    .filter((e) => e.visibility === 'players' && (e as unknown as { template?: boolean }).template !== true)
    .map((e) => ({ ...(e as unknown as Row), id: e.id + suffix, worldId: id, gmNotes: '', revealedTo: [] }) as Row)
  const asked = pages.find((e) => e.type === 'npc') ?? pages[0]
  const mine = pages.find((e) => e.type === 'pc')
  const now = new Date().toISOString()
  const shared =
    kind === 'wiki'
      ? { token: 'testcopy', fetchedAt: Date.now() }
      : {
          memberOf: 'testcopy',
          fetchedAt: Date.now(),
          me: 'u-sam',
          members: [
            { userId: 'u-sam', name: 'Sam', role: 'player' },
            { userId: 'u-ash', name: 'Ash', role: 'player' },
          ],
          claims: mine ? [{ entityId: mine.id, userId: 'u-sam', notes: '', approved: true }] : [],
          notes: [{ entityId: '', shared: true, body: '- **Ash:** The fence on Ford Street owes us a favour.', updatedBy: 'u-ash', updatedAt: now }],
          questions: [
            { id: 'q-1', entityId: asked.id, body: 'Did we ever learn who hired the thugs?', answer: 'Not yet. Ask around the docks.', answeredAt: now, createdAt: now },
            { id: 'q-2', entityId: '', body: 'Can my character spend the week studying the old map?', createdAt: now },
          ],
        }
  const { cloud: _c, showing: _s, ...base } = world.dump.worlds[0] as Row & { cloud?: unknown; showing?: unknown }
  await putBack(page, 'worlds', [[id, { ...base, id, shared } as Row]])
  await putBack(page, 'entities', pages.map((p) => [p.id, p] as [string, Row]))
  const remove = async () => {
    await putBack(page, 'entities', pages.map((p) => [p.id, null] as [string, null]))
    await putBack(page, 'worlds', [[id, null]])
  }
  return { id, remove, askedAbout: String(asked.name) }
}

/** Tells the page it's offline before it loads, so a player copy isn't refreshed from the cloud. */
export async function offline(page: Page) {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false }))
}
