import { db, type Transcript, type TranscriptLine } from '../db'
import { formatTime } from '../recorder'

/** Saves (or clears) one recording's transcript without touching anything else on the session. */
export function saveTranscript(sessionId: string, assetId: string, transcript: Transcript | undefined) {
  return db.sessions
    .where('id')
    .equals(sessionId)
    .modify((s) => {
      const r = s.recordings.find((x) => x.assetId === assetId)
      if (r) r.transcript = transcript
    })
}

export function speakerName(t: Transcript, label?: string) {
  if (!label) return ''
  return t.speakers?.[label]?.trim() || `Speaker ${label}`
}

/** The transcript as plain text, one line per utterance: "[01:02:03] Wren: Let's go." */
export function transcriptText(t: Transcript, offset = 0) {
  return t.lines
    .map((l) => {
      const who = speakerName(t, l.speaker)
      return `[${formatTime(l.start + offset)}] ${who ? `${who}: ` : ''}${l.text.trim()}`
    })
    .join('\n')
}

/** Speaker labels in order of first appearance. */
export function speakerLabels(t: Transcript) {
  return [...new Set(t.lines.map((l) => l.speaker).filter((s): s is string => !!s))]
}

/**
 * Whisper sometimes "hears" stock phrases in silence or repeats itself. Drop the obvious ones.
 */
export function cleanLines(lines: TranscriptLine[]) {
  const junk = /^(thank you\.?|thanks for watching!?|you|\.+|\[.*\]|\(.*\))$/i
  const out: TranscriptLine[] = []
  for (const l of lines) {
    const text = l.text.trim()
    if (!text || junk.test(text)) continue
    if (out.at(-1)?.text === text) continue
    out.push({ ...l, text })
  }
  return out
}
