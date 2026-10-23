import { useSyncExternalStore } from 'react'
import { db, type Sound } from '../db'
import { syrinscape } from './syrinscape'

/**
 * Plays soundboard buttons. Uploaded files play right here; Syrinscape buttons tell the GM's
 * Syrinscape player to start or stop. Playing carries on while the GM moves around the app.
 */

interface Playing {
  audio?: HTMLAudioElement
  url?: string
}

const playing = new Map<string, Playing>()
/** Syrinscape moods marked as playing; Syrinscape plays one mood at a time. */
const moods = new Set<string>()
let snapshot: string[] = []
const listeners = new Set<() => void>()
const changed = () => {
  snapshot = [...playing.keys()]
  listeners.forEach((l) => l())
}

/** The ids of the buttons playing now (Syrinscape buttons count as playing until stopped here). */
export function usePlaying() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snapshot,
  )
}

export async function play(sound: Sound) {
  if (playing.has(sound.id)) return
  if (sound.source === 'syrinscape') {
    if (!sound.syrinscape) return
    await syrinscape.send(sound.syrinscape, 'play')
    // Elements are one-off sounds; only moods keep "playing".
    if (sound.syrinscape.kind === 'mood') {
      // Starting a mood replaces any other mood in Syrinscape.
      for (const id of moods) playing.delete(id)
      moods.clear()
      moods.add(sound.id)
      playing.set(sound.id, {})
      changed()
    }
    return
  }
  const asset = sound.assetId ? await db.assets.get(sound.assetId) : undefined
  if (!asset) throw new Error('The file for this sound is missing. It may still be syncing from another device.')
  const url = URL.createObjectURL(asset.blob)
  const audio = new Audio(url)
  audio.loop = sound.loop
  audio.volume = Math.max(0, Math.min(1, sound.volume))
  audio.onended = () => stopLocal(sound.id)
  playing.set(sound.id, { audio, url })
  changed()
  try {
    await audio.play()
  } catch (err) {
    stopLocal(sound.id)
    throw err
  }
}

function stopLocal(id: string) {
  const p = playing.get(id)
  if (!p) return
  p.audio?.pause()
  if (p.url) URL.revokeObjectURL(p.url)
  playing.delete(id)
  moods.delete(id)
  changed()
}

export async function stop(sound: Sound) {
  if (sound.source === 'syrinscape' && sound.syrinscape) await syrinscape.send(sound.syrinscape, 'stop')
  stopLocal(sound.id)
}

export const toggle = (sound: Sound) => (playing.has(sound.id) ? stop(sound) : play(sound))

/** Changes the volume of a file that's playing now. */
export function setLiveVolume(id: string, volume: number) {
  const a = playing.get(id)?.audio
  if (a) a.volume = Math.max(0, Math.min(1, volume))
}

/** Stops every file here, and everything in Syrinscape if it's set up. */
export async function stopAll() {
  for (const id of [...playing.keys()]) stopLocal(id)
  if (syrinscape.token()) await syrinscape.stopAll()
}
