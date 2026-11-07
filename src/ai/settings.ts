import { useSyncExternalStore } from 'react'

/**
 * AI settings live on this device (browser storage), never in a world or a backup, so API keys stay
 * with the person who pays for them. The keys alone can also be saved to the person's own account
 * if they tick "Save to my account" (see accountKeys.ts). The device notes whose each key is, so on
 * a shared computer one person's keys never end up in another person's account.
 */
export interface AiSettings {
  /** Anthropic API key (console.anthropic.com), for one-click recaps. */
  anthropicKey: string
  /** AssemblyAI API key, for cloud transcription with speaker labels. */
  assemblyKey: string
  /** Leave the transcript in the GM's AssemblyAI account after saving it here (normally it's deleted there). */
  keepAtAssembly: boolean
  /** Whisper model used for on-device transcription. */
  deviceModel: 'base' | 'small'
  /** Language spoken at the table; "auto" lets the transcriber guess. */
  language: 'en' | 'auto'
  /** The device voice for reading recaps aloud (its voiceURI); empty picks the device's default. */
  voice: string
  /** Reading speed, 1 is normal. */
  voiceRate: number
  /** This device keeps its keys in step with the signed-in account (see accountKeys.ts). */
  keysInAccount: boolean
  /**
   * Whose each key is: the id of the person signed in when it was typed (or whose account it came
   * from), '' when no one was signed in, missing for keys typed before the app noted it. Signing in
   * only adds a person's own keys to their account (see accountKeys.ts).
   */
  anthropicBy?: string
  assemblyBy?: string
  /** This device's own keys, set aside while a signed-in account's keys are in use; signing out puts them back. */
  ownKeys?: DeviceKeys
  /** Whoever records here has said everyone agreed to sending recordings to AssemblyAI (asked once per device). */
  assemblyAgreed?: boolean
}

/** The two keys and whose they are. */
export type DeviceKeys = Pick<AiSettings, 'anthropicKey' | 'assemblyKey' | 'anthropicBy' | 'assemblyBy'>

const KEY = 'codex.ai'
const DEFAULTS: AiSettings = { anthropicKey: '', assemblyKey: '', keepAtAssembly: false, deviceModel: 'base', language: 'en', voice: '', voiceRate: 1, keysInAccount: false }
const listeners = new Set<() => void>()
let cached: AiSettings | undefined

export function getAiSettings(): AiSettings {
  if (!cached) {
    try {
      cached = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
    } catch {
      cached = { ...DEFAULTS }
    }
  }
  return cached!
}

export function setAiSettings(patch: Partial<AiSettings>) {
  cached = { ...getAiSettings(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(cached))
  } catch {
    // Private mode or storage blocked: settings last until the page closes.
  }
  listeners.forEach((l) => l())
}

/** Called after every change to the settings; returns a function that stops listening. */
export function onAiSettings(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAiSettings() {
  return useSyncExternalStore(onAiSettings, getAiSettings)
}

export const DEVICE_MODELS = {
  base: { id: 'onnx-community/whisper-base', label: 'Quick (about 80 MB download)' },
  small: { id: 'onnx-community/whisper-small', label: 'Better (about 250 MB download, slower)' },
} as const
