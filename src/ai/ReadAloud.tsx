import { useEffect, useState, useSyncExternalStore } from 'react'
import { SpeakerHigh, Stop } from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Session } from '../db'
import { Help } from '../help'
import { Ico } from '../icons'
import { splitSecrets } from '../Markdown'
import { plainLinks } from '../text'
import { getAiSettings, setAiSettings, useAiSettings } from './settings'

/**
 * Reading recaps aloud with the voices built into the device: free, private and offline. Only one
 * thing reads at a time, and secret passages are never read.
 */

const speech = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined

let reading: string | undefined
const listeners = new Set<() => void>()
const setReading = (id: string | undefined) => {
  reading = id
  listeners.forEach((l) => l())
}
const useReading = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => reading,
  )

/**
 * Markdown as sentences to say: no links, markup or secrets. Not even a player's own passages: read
 * aloud, the whole table would hear them.
 */
export function speakable(markdown: string) {
  const said = splitSecrets(markdown)
    .filter((s) => s.kind === 'text')
    .map((s) => s.body)
    .join('\n')
  return plainLinks(said)
    .replace(/^[ \t]*:::.*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*(.+)$/gm, '$1.')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~>|]+/g, '')
    .replace(/\.\.(\s|$)/g, '.$1')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/** Long text is said in pieces: some browsers stop a single long utterance part way. */
function pieces(text: string) {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let cur = ''
    for (const sentence of para.match(/[^.!?…]+[.!?…]*["”’)]*\s*/g) ?? [para]) {
      if ((cur + sentence).length > 220 && cur) {
        out.push(cur.trim())
        cur = ''
      }
      cur += sentence
    }
    if (cur.trim()) out.push(cur.trim())
  }
  return out
}

export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => speech?.getVoices() ?? [])
  useEffect(() => {
    if (!speech) return
    const load = () => setVoices(speech.getVoices())
    speech.addEventListener('voiceschanged', load)
    return () => speech.removeEventListener('voiceschanged', load)
  }, [])
  return voices
}

export function speak(text: string, id = 'try') {
  if (!speech) return
  speech.cancel()
  const { voice, voiceRate } = getAiSettings()
  const chosen = speech.getVoices().find((v) => v.voiceURI === voice)
  const parts = pieces(text)
  if (!parts.length) return
  setReading(id)
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p)
    if (chosen) {
      u.voice = chosen
      u.lang = chosen.lang
    }
    u.rate = voiceRate || 1
    if (i === parts.length - 1) u.onend = u.onerror = () => reading === id && setReading(undefined)
    speech.speak(u)
  })
}

export function stopReading() {
  speech?.cancel()
  setReading(undefined)
}

/** A "Read aloud" button for a recap (or any player-facing Markdown). */
export function ReadAloud({ text, id, label = 'Read aloud', className = 'ghost small' }: { text: string; id: string; label?: string; className?: string }) {
  const now = useReading()
  // Stop when the page that started it goes away.
  useEffect(() => () => void (reading === id && stopReading()), [id])
  if (!speech || !text.trim()) return null
  const on = now === id
  return (
    <button className={className} onClick={() => (on ? stopReading() : speak(speakable(text), id))} aria-pressed={on} title={on ? 'Stop reading' : 'Read it aloud with this device’s voice'}>
      <Ico as={on ? Stop : SpeakerHigh} /> {on ? 'Stop' : label}
    </button>
  )
}

/** Voice and speed, in AI settings. */
export function VoiceSettings() {
  const s = useAiSettings()
  const voices = useVoices()
  if (!speech) return <p className="muted small">This browser can’t read aloud.</p>
  const sorted = [...voices].sort((a, b) => Number(b.lang.startsWith('en')) - Number(a.lang.startsWith('en')) || a.name.localeCompare(b.name))
  return (
    <div className="grid-2">
      <label>
        <span>
          Voice for reading recaps aloud <Help topic="readAloud" />
        </span>
        <select value={s.voice} onChange={(e) => setAiSettings({ voice: e.target.value })}>
          <option value="">This device’s usual voice</option>
          {sorted.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </label>
      <label>
        Speed
        <div className="row">
          <input type="range" min={0.6} max={1.4} step={0.05} value={s.voiceRate} onChange={(e) => setAiSettings({ voiceRate: Number(e.target.value) })} aria-label="Reading speed" />
          <button type="button" className="small" onClick={() => speak('Previously, on our adventure: the lantern guttered, and the party stepped into the dark.')}>
            Try it
          </button>
        </div>
      </label>
    </div>
  )
}

/** In the Lectern: read the last session's player recap to the table. */
export function PreviouslyOn({ session }: { session: Session }) {
  const last = useLiveQuery(
    async () =>
      (await db.sessions.where({ worldId: session.worldId }).toArray())
        .filter((s) => s.campaignId === session.campaignId && s.number < session.number && s.recap.trim())
        .sort((a, b) => b.number - a.number)[0],
    [session.worldId, session.campaignId, session.number],
  )
  if (!last) return null
  return <ReadAloud text={`Previously, on ${last.title || `session ${last.number}`}.\n\n${last.recap}`} id={`prev-${session.id}`} label="Previously on… (read aloud)" className="small" />
}
