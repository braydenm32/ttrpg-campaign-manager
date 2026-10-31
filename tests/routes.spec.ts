import { expect, test } from '@playwright/test'
import { appRoutes } from './lib/app-routes'
import { ROUTES } from './routes'

/**
 * Every <Route> in src/App.tsx must be in tests/routes.ts (with a sample address), so the screens
 * test opens it and the leaks test checks it. A route that's gone from App.tsx must go from the
 * list too, so the list stays the true inventory.
 */
test('every route in App.tsx is in tests/routes.ts', () => {
  const inApp = appRoutes()
  expect(inApp.length, 'found no routes in src/App.tsx: has the file moved?').toBeGreaterThan(10)
  const listed = ROUTES.map((r) => r.path)
  const missing = inApp.filter((p) => !listed.includes(p))
  const stale = listed.filter((p) => !inApp.includes(p))
  expect(missing, 'Routes in src/App.tsx with no entry in tests/routes.ts: add each with a sample address').toEqual([])
  expect(stale, 'Entries in tests/routes.ts that are no longer routes in src/App.tsx: remove them').toEqual([])
  expect(new Set(listed).size, 'a route is listed twice in tests/routes.ts').toBe(listed.length)
})

test('every route has at least one sample address', () => {
  for (const r of ROUTES) expect(r.samples.length, r.path).toBeGreaterThan(0)
})
