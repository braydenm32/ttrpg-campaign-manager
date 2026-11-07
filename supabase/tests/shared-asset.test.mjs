// Checks the shared-asset edge function's rules against a pretend Supabase (nothing leaves the machine):
//   node --disable-warning=ExperimentalWarning supabase/tests/shared-asset.test.mjs
// Node 22.18 or newer reads handler.ts as it is (types are skipped), the way scripts/check-world.mjs reads parse.ts.
import assert from 'node:assert/strict'
import { fileHeaders, filePath, handle } from '../functions/shared-asset/handler.ts'

const W = '10000000-0000-4000-8000-000000000001'
const OTHER = '30000000-0000-4000-8000-000000000003'
const F = {
  png: 'a0000000-0000-4000-8000-000000000001',
  html: 'a0000000-0000-4000-8000-000000000002',
  svg: 'a0000000-0000-4000-8000-000000000003',
  pdf: 'a0000000-0000-4000-8000-000000000004',
  webm: 'a0000000-0000-4000-8000-000000000005',
  hidden: 'a0000000-0000-4000-8000-000000000006',
}
const TOKEN = 'share-token-w1-aaaaaaaaaaaaaaaa'
const BEARER = 'Bearer player-jwt'
// What player_view hands out: the player-safe files only. The last one is a GM-written id that isn't a
// UUID (before 20261107000000 the id came from the row's JSON): it must never be served.
const view = {
  worldId: W,
  assets: [
    { id: F.png, mime: 'image/png' },
    { id: F.html, mime: 'text/html' },
    { id: F.svg, mime: 'image/svg+xml' },
    { id: F.pdf, mime: 'application/pdf' },
    { id: F.webm, mime: 'audio/webm;codecs=opus' },
    { id: `../${OTHER}/${F.hidden}`, mime: 'image/png' },
  ],
}

/** A pretend Supabase that remembers what it was asked. */
function pretend(answer = view) {
  const calls = { rpc: [], download: [], signed: [] }
  const createClient = (_url, key, options) => ({
    rpc: async (fn, args) => {
      calls.rpc.push({ fn, args, key, auth: options?.global?.headers?.Authorization })
      const ok = fn === 'shared_world' ? args.token === TOKEN : fn === 'member_world' && options?.global?.headers?.Authorization === BEARER && args.wid === W
      return { data: ok ? answer : null, error: null }
    },
    storage: {
      from: (bucket) => ({
        download: async (path) => {
          calls.download.push(`${bucket}:${path}`)
          return { data: new Blob(['file']), error: null }
        },
        createSignedUrls: async (paths) => {
          calls.signed.push(...paths.map((p) => `${bucket}:${p}`))
          return { data: paths.map((p) => ({ signedUrl: `https://storage.example/${p}` })), error: null }
        },
      }),
    },
  })
  return { calls, deps: { createClient, env: (name) => `env:${name}` } }
}

const fn = 'https://example.supabase.co/functions/v1/shared-asset'
const post = (body, query = '', headers = {}) =>
  new Request(`${fn}${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })

const tests = []
const test = (name, run) => tests.push({ name, run })

test('paths are built only from two plain ids', () => {
  assert.equal(filePath(W, F.png), `${W}/${F.png}`)
  assert.equal(filePath(W, `../${OTHER}/${F.hidden}`), null)
  assert.equal(filePath(W, '..%2F' + F.png), null)
  assert.equal(filePath(`${W}/..`, F.png), null)
  assert.equal(filePath(W, `${F.png}/`), null)
  assert.equal(filePath(undefined, F.png), null)
  // What ASSET-1 was about: the address parser would have collapsed the old path into another world's folder.
  assert.equal(new URL(`https://x/object/assets/${W}/../${OTHER}/${F.hidden}`).pathname, `/object/assets/${OTHER}/${F.hidden}`)
})

test('file types: pictures, sound, video and PDFs as themselves, anything else as a download', () => {
  assert.deepEqual(fileHeaders('image/png'), { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=60', 'Content-Type': 'image/png' })
  assert.equal(fileHeaders('IMAGE/JPEG')['Content-Type'], 'image/jpeg')
  assert.equal(fileHeaders('audio/webm;codecs=opus')['Content-Type'], 'audio/webm')
  assert.equal(fileHeaders('video/mp4')['Content-Type'], 'video/mp4')
  assert.equal(fileHeaders('application/pdf')['Content-Type'], 'application/pdf')
  for (const t of ['image/png', 'audio/mpeg', 'video/webm', 'application/pdf']) assert.equal(fileHeaders(t)['Content-Disposition'], undefined, t)
  for (const t of ['text/html', 'application/xhtml+xml', 'text/javascript', 'application/octet-stream', '', undefined, 42]) {
    const h = fileHeaders(t)
    assert.equal(h['Content-Type'], 'application/octet-stream', String(t))
    assert.equal(h['Content-Disposition'], 'attachment', String(t))
    assert.equal(h['X-Content-Type-Options'], 'nosniff', String(t))
  }
  const svg = fileHeaders('image/svg+xml')
  assert.equal(svg['Content-Type'], 'image/svg+xml')
  assert.equal(svg['Content-Disposition'], 'attachment')
  assert.match(svg['Content-Security-Policy'], /sandbox/)
})

test('many files at once: only player-safe ones, in this world\'s folder', async () => {
  const { calls, deps } = pretend()
  const res = await handle(post({ token: TOKEN, ids: [F.png, F.hidden, `../${OTHER}/${F.hidden}`, F.pdf, 7, null, `${F.png}/../x`] }), deps)
  assert.equal(res.status, 200)
  const { urls } = await res.json()
  assert.deepEqual(Object.keys(urls).sort(), [F.pdf, F.png].sort())
  assert.deepEqual(calls.signed.sort(), [`assets:${W}/${F.pdf}`, `assets:${W}/${F.png}`].sort())
  assert.equal(calls.rpc[0].fn, 'shared_world')
  assert.equal(calls.rpc[0].key, 'env:SUPABASE_SERVICE_ROLE_KEY')
})

test('one file by POST (what src/cloud/share.ts sends now): token in the body, never the address', async () => {
  const { calls, deps } = pretend()
  const res = await handle(post({ token: TOKEN, id: F.png }, `?id=${F.png}`), deps)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Content-Type'), 'image/png')
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff')
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*')
  assert.equal(await res.text(), 'file')
  assert.deepEqual(calls.download, [`assets:${W}/${F.png}`])
})

test('one file by POST with the id only in the address (the shape the older function understood)', async () => {
  const { calls, deps } = pretend()
  const res = await handle(post({ token: TOKEN }, `?id=${F.pdf}`), deps)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Content-Type'), 'application/pdf')
  assert.deepEqual(calls.download, [`assets:${W}/${F.pdf}`])
})

test('what src/cloud/share.ts sends now also works with the function deployed before this change', async () => {
  // How version 3 of the function (deployed until this change) read a request, copied from git history.
  const oldRead = async (req) => {
    const url = new URL(req.url)
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    return { token: body.token ?? url.searchParams.get('token'), world: body.world ?? url.searchParams.get('world'), id: url.searchParams.get('id'), ids: Array.isArray(body.ids) ? body.ids : undefined }
  }
  // As downloadFiles builds its one-file request, for a share link and for a joined world.
  const oneFile = (from, id) => post({ ...from, id }, `?id=${encodeURIComponent(id)}`)
  assert.deepEqual(await oldRead(oneFile({ token: TOKEN }, F.png)), { token: TOKEN, world: null, id: F.png, ids: undefined })
  assert.deepEqual(await oldRead(oneFile({ world: W }, F.png)), { token: null, world: W, id: F.png, ids: undefined })
  assert.ok(!oneFile({ token: TOKEN }, F.png).url.includes(TOKEN))
})

test('the old GET ?token=&id= still works for copies of the app from before the change', async () => {
  const { calls, deps } = pretend()
  const res = await handle(new Request(`${fn}?token=${TOKEN}&id=${F.png}`), deps)
  assert.equal(res.status, 200)
  assert.deepEqual(calls.download, [`assets:${W}/${F.png}`])
})

test('ids that are not plain UUIDs are refused before anything is fetched', async () => {
  for (const id of [`../${OTHER}/${F.hidden}`, `${F.png}/../../${OTHER}/${F.hidden}`, '%2e%2e%2f' + F.png, F.png + ' ', '']) {
    const { calls, deps } = pretend()
    const res = await handle(post({ token: TOKEN, id }, `?id=${encodeURIComponent(id)}`), deps)
    assert.equal(res.status, 404, id)
    assert.deepEqual(calls.download, [], id)
  }
})

test('a file that is not in the player-safe list is not found', async () => {
  const { calls, deps } = pretend()
  const res = await handle(post({ token: TOKEN, id: F.hidden }), deps)
  assert.equal(res.status, 404)
  assert.deepEqual(calls.download, [])
})

test('a page or script type is sent as a download, an SVG with scripts off', async () => {
  const { deps } = pretend()
  const html = await handle(post({ token: TOKEN, id: F.html }), deps)
  assert.equal(html.headers.get('Content-Type'), 'application/octet-stream')
  assert.equal(html.headers.get('Content-Disposition'), 'attachment')
  const svg = await handle(post({ token: TOKEN, id: F.svg }), deps)
  assert.equal(svg.headers.get('Content-Type'), 'image/svg+xml')
  assert.match(svg.headers.get('Content-Security-Policy'), /sandbox/)
  const webm = await handle(post({ token: TOKEN, id: F.webm }), deps)
  assert.equal(webm.headers.get('Content-Type'), 'audio/webm')
})

test('joined players: checked as themselves, and must be signed in', async () => {
  const { calls, deps } = pretend()
  const res = await handle(post({ world: W, id: F.png }, `?id=${F.png}`, { Authorization: BEARER }), deps)
  assert.equal(res.status, 200)
  assert.equal(calls.rpc[0].fn, 'member_world')
  assert.equal(calls.rpc[0].auth, BEARER)
  assert.equal(calls.rpc[0].key, 'env:SUPABASE_ANON_KEY')
  const anon = await handle(post({ world: W, id: F.png }), pretend().deps)
  assert.equal(anon.status, 401)
  const notUuid = await handle(post({ world: 'not-a-world', id: F.png }, '', { Authorization: BEARER }), pretend().deps)
  assert.equal(notUuid.status, 404)
})

test('a share link that is turned off, or not a share link at all, finds nothing', async () => {
  const off = pretend()
  assert.equal((await handle(post({ token: 'x'.repeat(32), id: F.png }), off.deps)).status, 404)
  assert.deepEqual(off.calls.download, [])
  const junk = pretend()
  assert.equal((await handle(post({ token: '../../etc', id: F.png }), junk.deps)).status, 404)
  assert.deepEqual(junk.calls.rpc, [])
  assert.equal((await handle(post({ id: F.png }), pretend().deps)).status, 400)
  assert.equal((await handle(post({ token: TOKEN }), pretend().deps)).status, 400)
  assert.equal((await handle(new Request(fn, { method: 'POST', body: 'null' }), pretend().deps)).status, 400)
})

test('a view whose world id is not a UUID serves nothing', async () => {
  const { calls, deps } = pretend({ ...view, worldId: `${W}/..` })
  assert.equal((await handle(post({ token: TOKEN, id: F.png }), deps)).status, 404)
  assert.deepEqual(calls.download, [])
})

test('the browser\'s pre-flight check is answered', async () => {
  const res = await handle(new Request(fn, { method: 'OPTIONS' }), pretend().deps)
  assert.equal(res.status, 200)
  assert.match(res.headers.get('Access-Control-Allow-Headers'), /content-type/)
})

let failed = 0
for (const t of tests) {
  try {
    await t.run()
    console.log(`ok   ${t.name}`)
  } catch (e) {
    failed++
    console.log(`FAIL ${t.name}\n     ${String(e?.message ?? e).split('\n').join('\n     ')}`)
  }
}
console.log(failed ? `${failed} of ${tests.length} failed` : `all ${tests.length} passed`)
process.exit(failed ? 1 : 0)
