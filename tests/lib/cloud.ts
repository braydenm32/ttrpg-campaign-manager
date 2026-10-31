import type { BrowserContext, Page, Route } from '@playwright/test'

/**
 * A pretend cloud for tests that need players: the app talks to it exactly as it talks to the real
 * one (Supabase), but every answer comes from here, in the test's own browser. Nothing leaves the
 * machine. It knows just enough for the GM's Inbox: who has joined, their questions, downtime,
 * claims on characters and new characters, and it remembers what the app changes. Sync gets polite
 * empty answers, so a world can have cloud sync switched on without a server.
 */

const URL = 'https://ysrxumagiiaoihlhofqt.supabase.co'
const STORAGE_KEY = 'sb-ysrxumagiiaoihlhofqt-auth-token'

export const GM = { id: '00000000-0000-4000-8000-0000000000aa', email: 'gm@example.com' }

type Row = Record<string, unknown>
export interface CloudState {
  worldId: string
  world_members: Row[]
  player_questions: Row[]
  downtime_actions: Row[]
  character_claims: Row[]
  character_requests: Row[]
  /** Every change the app asked for, as "METHOD table", in order. */
  writes: string[]
  /** The world's links, if it has any: share_token (wiki) and invite_token (players). */
  links?: Row
  /** The co-GM link, if any. */
  gm_invites?: Row[]
}

const fakeJwt = () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 24 * 3600
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: GM.id, email: GM.email, role: 'authenticated', aud: 'authenticated', exp })}.c2ln`
}

const user = { id: GM.id, aud: 'authenticated', role: 'authenticated', email: GM.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }

/** Signs the GM in (a session kept where the app looks for it) and answers for the cloud from `state`. */
export async function fakeCloud(context: BrowserContext, state: CloudState) {
  const access = fakeJwt()
  const session = { access_token: access, token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: 'refresh', user }
  await context.addInitScript(
    ({ key, value }) => {
      try {
        localStorage.setItem(key, value)
      } catch {
        /* about:blank */
      }
    },
    { key: STORAGE_KEY, value: JSON.stringify(session) },
  )
  await context.routeWebSocket(/supabase\.co/, (ws) => ws.close())
  await context.route(`${URL}/**`, (route) => answer(route, state, session))
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

/** Rows matching the request's simple filters (column=eq.value). */
function filtered(rows: Row[], params: URLSearchParams) {
  return rows.filter((r) => [...params].every(([k, v]) => !v.startsWith('eq.') || String(r[k]) === v.slice(3)))
}

async function answer(route: Route, state: CloudState, session: object) {
  const req = route.request()
  const u = new globalThis.URL(req.url())
  const method = req.method()
  const path = u.pathname
  if (path.startsWith('/auth/v1/user')) return json(route, user)
  if (path.startsWith('/auth/v1/')) return json(route, session)
  if (path.startsWith('/storage/v1/')) return json(route, method === 'GET' ? [] : { Key: 'x' })
  if (path.startsWith('/rest/v1/rpc/')) {
    state.writes.push(`RPC ${path.slice('/rest/v1/rpc/'.length)}`)
    const body = req.postDataJSON?.() ?? {}
    if (path.endsWith('answer_character_request')) state.character_requests = state.character_requests.filter((r) => r.id !== body.rid)
    if (path.endsWith('release_character')) state.character_claims = state.character_claims.filter((c) => !String(body.eid).endsWith(String(c.entity_id)))
    return json(route, null)
  }
  const table = path.slice('/rest/v1/'.length)
  const one = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
  if (table === 'cloud_worlds') {
    const rows = [{ id: state.worldId, name: 'Inbox world', share_token: null, updated_at: '2026-01-01T00:00:00Z', owner: GM.id, ...state.links }]
    if (method !== 'GET') {
      state.writes.push(`${method} cloud_worlds`)
      if (method === 'PATCH' && state.links) Object.assign(state.links, req.postDataJSON())
      return route.fulfill({ status: 204, body: '' })
    }
    return json(route, one ? rows[0] : rows)
  }
  const list = (state as unknown as Record<string, Row[]>)[table]
  if (!Array.isArray(list)) {
    // Sync's own tables: nothing in the cloud yet, and any upload is taken.
    if (method === 'GET' || method === 'HEAD') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: '[]' })
    return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
  }
  const params = u.searchParams
  if (method === 'GET') {
    const rows = filtered(list, params)
    if (table === 'character_requests') return json(route, rows.filter((r) => r.status === 'pending'))
    return json(route, one ? (rows[0] ?? null) : rows)
  }
  state.writes.push(`${method} ${table}`)
  const hit = new Set(filtered(list, params))
  if (method === 'PATCH') {
    const body = req.postDataJSON() as Row
    for (const r of hit) Object.assign(r, body)
  }
  if (method === 'DELETE') (state as unknown as Record<string, Row[]>)[table] = list.filter((r) => !hit.has(r))
  return route.fulfill({ status: 204, body: '' })
}

/** A page's own database, written straight in the page (as tests/lib/records.ts does). */
export function putRows(page: Page, table: string, rows: Row[]) {
  return page.evaluate(
    ({ table, rows }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction(table, 'readwrite')
          for (const r of rows) tx.objectStore(table).put(r)
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    { table, rows },
  )
}
