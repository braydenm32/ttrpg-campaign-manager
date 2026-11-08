// deno-lint-ignore-file no-explicit-any
// What the shared-asset function does, kept apart from Deno so supabase/tests/shared-asset.test.mjs can
// run it against a pretend Supabase. index.ts hands it the real client.
//
// Files from a world's player-safe view:
//  - POST { token, id } or { world, id }: one file, for anyone holding the share link (public.shared_world)
//    or a signed-in player who joined the world (public.member_world, checked as that player). The app
//    also puts ?id=… on the address, so this works with the older copy of this function too.
//  - POST { token | world, ids: [...] }: short-lived download links for many files at once, so the
//    player-safe view is worked out once per refresh instead of once per picture.
//  - GET ?token=…&id=… or ?world=…&id=…: the old way, still answered for copies of the app from before
//    November 2026. It puts the share link in the address (and so in logs): drop it once those copies
//    have updated (TOK-1).
// Each file must be in the player-safe list those functions return, so GM-only images and session
// recordings can never be fetched this way. Ids are only ever plain UUIDs and the storage path is built
// from nothing else, so no id can reach into another world's folder (ASSET-1). Files are served as what
// they are only for pictures, sound, video and PDFs; anything else is a plain download, and browsers are
// told not to guess (FILE-7).

type Client = any

export interface Deps {
  /** createClient from @supabase/supabase-js. */
  createClient: (url: string, key: string, options?: Record<string, unknown>) => Client
  /** Reads a setting (Deno.env.get). */
  env: (name: string) => string | undefined
}

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (x: unknown): x is string => typeof x === 'string' && UUID.test(x)
// Share links are 24 random bytes in base64url (src/cloud/share.ts); anything far off isn't one.
const TOKEN = /^[A-Za-z0-9_-]{20,200}$/

/** Where a world's file is in storage, built only from two checked ids (never a dot segment, plain or encoded). */
export function filePath(worldId: unknown, id: unknown): string | null {
  if (!isUuid(worldId) || !isUuid(id)) return null
  const path = `${worldId}/${id}`
  if (path.includes('..') || /%2e|%2f|%5c/i.test(path)) return null
  return path
}

/** Picture, sound, video and PDF types are served as themselves; the rest goes out as a plain download. */
const SHOWN = /^(image\/(png|jpeg|gif|webp|avif|bmp|tiff|heic|heif|x-icon|vnd\.microsoft\.icon)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|application\/pdf)$/

/** The headers a file goes out with, from the type the GM's app gave it. */
export function fileHeaders(mime: unknown): Record<string, string> {
  const type = typeof mime === 'string' ? mime.split(';')[0].trim().toLowerCase() : ''
  const safe = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=60' }
  if (SHOWN.test(type)) return { ...safe, 'Content-Type': type }
  // An SVG is a picture to the app (which reads files with fetch, never by opening this address), but it
  // can carry scripts: anyone opening the address directly gets a download, with scripts switched off.
  if (type === 'image/svg+xml')
    return { ...safe, 'Content-Type': type, 'Content-Disposition': 'attachment', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" }
  return { ...safe, 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment' }
}

const say = (status: number, text: string) => new Response(text, { status, headers: cors })

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'GET' && req.method !== 'POST') return say(405, 'Use GET or POST')
  const url = new URL(req.url)
  const raw = req.method === 'POST' ? await req.json().catch(() => null) : null
  const body: Record<string, unknown> = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const token = body.token ?? url.searchParams.get('token') ?? undefined
  const worldId = body.world ?? url.searchParams.get('world') ?? undefined
  const id = body.id ?? url.searchParams.get('id') ?? undefined
  const ids = Array.isArray(body.ids) ? body.ids.filter(isUuid).slice(0, 1000) : undefined
  if ((token === undefined && worldId === undefined) || (id === undefined && !ids)) return say(400, 'Missing token or id')
  if (token !== undefined && (typeof token !== 'string' || !TOKEN.test(token))) return say(404, 'Not found')
  if (token === undefined && !isUuid(worldId)) return say(404, 'Not found')
  if (!ids && !isUuid(id)) return say(404, 'Not found')

  const admin = deps.createClient(deps.env('SUPABASE_URL')!, deps.env('SUPABASE_SERVICE_ROLE_KEY')!)
  let view
  if (token !== undefined) {
    view = await admin.rpc('shared_world', { token })
  } else {
    const auth = req.headers.get('Authorization')
    if (!auth) return say(401, 'Sign in first')
    // Runs as the player, so membership is checked by the database.
    const asPlayer = deps.createClient(deps.env('SUPABASE_URL')!, deps.env('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    })
    view = await asPlayer.rpc('member_world', { wid: worldId })
  }
  const world = view?.data
  if (view?.error || !world || !isUuid(world.worldId)) return say(404, 'Not found')
  // The player-safe files, by id (each file's own row id, from player_view).
  const files = new Map<string, { id: string; mime?: unknown }>()
  for (const a of Array.isArray(world.assets) ? world.assets : []) if (isUuid(a?.id)) files.set(a.id, a)

  if (ids) {
    const wanted = ids.filter((x) => files.has(x) && filePath(world.worldId, x))
    const urls: Record<string, string> = {}
    if (wanted.length) {
      const { data } = await admin.storage.from('assets').createSignedUrls(wanted.map((x) => filePath(world.worldId, x)!), 600)
      data?.forEach((d: { signedUrl?: string }, i: number) => d?.signedUrl && (urls[wanted[i]] = d.signedUrl))
    }
    return Response.json({ urls }, { headers: cors })
  }
  const asset = files.get(id as string)
  const path = asset && filePath(world.worldId, asset.id)
  if (!asset || !path) return say(404, 'Not found')
  const { data: file, error } = await admin.storage.from('assets').download(path)
  if (error || !file) return say(404, 'Not found')
  return new Response(file, { headers: { ...cors, ...fileHeaders(asset.mime) } })
}
