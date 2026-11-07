/**
 * The fingerprint the app notes beside each AssemblyAI job it sent (src/ai/cloud.ts, keyMark), so a
 * test can note jobs the way the app does.
 */
export function keyMark(key: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}
