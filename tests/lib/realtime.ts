import type { Page, WebSocketRoute } from '@playwright/test'

/**
 * A pretend realtime server for one page (the same as the one in table-trust.spec.ts): lets the app
 * into any room, answers its heartbeats, keeps what the app broadcasts (topic, event and payload)
 * and passes on what the test says. Set it up before the page opens the app.
 */
export async function fakeRealtime(page: Page) {
  const joined = new Set<string>()
  const sent: { topic: string; event: string; payload: Record<string, unknown> }[] = []
  let socket: WebSocketRoute | undefined
  await page.routeWebSocket(/supabase\.co\/realtime/, (ws) => {
    socket = ws
    ws.onMessage((m) => {
      if (typeof m !== 'string') return void sent.push(readPush(m))
      const [joinRef, ref, topic, event] = JSON.parse(m) as [string | null, string | null, string, string]
      if (event === 'phx_join') joined.add(topic)
      if (ref !== null) ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]))
    })
  })
  /** Says something in a room ("table:<world>"), as the server passes on a broadcast. */
  const say = (topic: string, event: string, payload: object) => socket!.send(JSON.stringify([null, null, `realtime:${topic}`, 'broadcast', { type: 'broadcast', event, payload }]))
  return { joined, sent, say }
}

/** One broadcast the app sent, in realtime's binary form: kind, then the lengths of what follows, then the JSON payload. */
function readPush(b: Buffer) {
  const [, joinRef, ref, topicLength, eventLength, metaLength] = b
  let at = 7 + joinRef + ref
  const take = (n: number) => b.subarray(at, (at += n)).toString('utf8')
  const topic = take(topicLength)
  const event = take(eventLength)
  at += metaLength
  return { topic, event, payload: JSON.parse(b.subarray(at).toString('utf8') || '{}') as Record<string, unknown> }
}
