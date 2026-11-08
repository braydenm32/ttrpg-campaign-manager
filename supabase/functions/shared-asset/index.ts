// Serves the files in a world's player-safe view, to share-link readers and joined players.
// What it accepts and why is described at the top of handler.ts, which does the work.
// Deploy both files together: npx supabase functions deploy shared-asset --no-verify-jwt
// (no JWT check at the gateway: share-link readers aren't signed in; handler.ts checks who may see what).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handle } from './handler.ts'

Deno.serve((req) => handle(req, { createClient, env: (name) => Deno.env.get(name) }))
