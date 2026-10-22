import { useSyncExternalStore } from 'react'

/**
 * AI settings live on this device only (browser storage), never in a world, a backup or the cloud,
 * so API keys stay with the person who pays for them.
 */
export interface AiSettings {
  /** Anthropic API key (console.anthropic.com), for one-click recaps. */
  anthropicKey: string
  /** AssemblyAI API key, for cloud transcription with speaker labels. */
  assemblyKey: string
  /** Whisper model used for on-device transcription. */
  deviceModel: 'base' | 'small'
  /** Language spoken at the table; "auto" lets the transcriber guess. */
  language: 'en' | 'auto'
}

const KEY = 'codex.ai'
const DEFAULTS: AiSettings = { anthropicKey: '', assemblyKey: '', deviceModel: 'base', language: 'en' }
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

export function useAiSettings() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getAiSettings,
  )
}

export const DEVICE_MODELS = {
  base: { id: 'onnx-community/whisper-base', label: 'Quick (about 80 MB download)' },
  small: { id: 'onnx-community/whisper-small', label: 'Better (about 250 MB download, slower)' },
} as const
