// Serves one file from a shared world to anyone holding the share link.
// The file must be in the player-safe list that public.shared_world(token) returns,
// so GM-only images and session recordings can never be fetched this way.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const id = url.searchParams.get('id')
  if (!token || !id) return new Response('Missing token or id', { status: 400, headers: cors })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: world, error } = await admin.rpc('shared_world', { token })
  if (error || !world) return new Response('Not found', { status: 404, headers: cors })
  const asset = (world.assets ?? []).find((a: { id: string }) => a.id === id)
  if (!asset) return new Response('Not found', { status: 404, headers: cors })

  const { data: file, error: dlError } = await admin.storage.from('assets').download(`${world.worldId}/${id}`)
  if (dlError || !file) return new Response('Not found', { status: 404, headers: cors })
  return new Response(file, {
    headers: { ...cors, 'Content-Type': asset.mime ?? 'application/octet-stream', 'Cache-Control': 'private, max-age=60' },
  })
})
