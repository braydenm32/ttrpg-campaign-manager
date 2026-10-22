// Serves one file from a world's player-safe view:
//  - ?token=…&id=…  anyone holding the share link (public.shared_world)
//  - ?world=…&id=…  a signed-in player who joined the world (public.member_world, checked as that player)
// The file must be in the player-safe list those functions return, so GM-only images and
// session recordings can never be fetched this way.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const worldId = url.searchParams.get('world')
  const id = url.searchParams.get('id')
  if ((!token && !worldId) || !id) return new Response('Missing token or id', { status: 400, headers: cors })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  let view
  if (token) {
    view = await admin.rpc('shared_world', { token })
  } else {
    const auth = req.headers.get('Authorization')
    if (!auth) return new Response('Sign in first', { status: 401, headers: cors })
    // Runs as the player, so membership is checked by the database.
    const asPlayer = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    })
    view = await asPlayer.rpc('member_world', { wid: worldId })
  }
  const world = view.data
  if (view.error || !world) return new Response('Not found', { status: 404, headers: cors })
  const asset = (world.assets ?? []).find((a: { id: string }) => a.id === id)
  if (!asset) return new Response('Not found', { status: 404, headers: cors })

  const { data: file, error: dlError } = await admin.storage.from('assets').download(`${world.worldId}/${id}`)
  if (dlError || !file) return new Response('Not found', { status: 404, headers: cors })
  return new Response(file, {
    headers: { ...cors, 'Content-Type': asset.mime ?? 'application/octet-stream', 'Cache-Control': 'private, max-age=60' },
  })
})
