import { useSyncExternalStore } from 'react'
import { cloudErrorMessage, supabase } from '../cloud/client'
import { getAiSettings, onAiSettings, setAiSettings } from './settings'

/**
 * "Save to my account": the GM's AI keys kept in their own row of `ai_keys`, which only they can read,
 * so every device they sign in on picks them up. Nothing else from the AI settings goes up, and the
 * keys never go into a world, a backup or anything players receive.
 *
 * Once a device is in step (`keysInAccount`), the account is the master copy: a key changed or
 * removed on one device reaches the others the next time they open the app signed in. Signing out
 * takes the account's keys off that device again.
 */

export interface AccountKeysState {
  status: 'off' | 'loading' | 'saving' | 'saved' | 'error'
  error?: string
}

let state: AccountKeysState = { status: 'off' }
const listeners = new Set<() => void>()
const setState = (next: AccountKeysState) => {
  state = next
  listeners.forEach((l) => l())
}

/** The signed-in person whose keys this device follows. */
let userId: string | null = null
/** The keys as the account last had them, so only real changes are saved. */
let inAccount = ''
let timer: ReturnType<typeof setTimeout> | undefined

const keysNow = () => {
  const s = getAiSettings()
  return JSON.stringify([s.anthropicKey.trim(), s.assemblyKey.trim()])
}

async function save() {
  clearTimeout(timer)
  if (!userId || !getAiSettings().keysInAccount) return
  const s = getAiSettings()
  const keys = keysNow()
  setState({ status: 'saving' })
  const { error } = await supabase.from('ai_keys').upsert({ user_id: userId, anthropic_key: s.anthropicKey.trim(), assembly_key: s.assemblyKey.trim() })
  if (error) return setState({ status: 'error', error: cloudErrorMessage(error) })
  inAccount = keys
  setState({ status: 'saved' })
}

// A key typed or removed on this device goes up shortly after, once the device is in step.
onAiSettings(() => {
  if (!userId || !getAiSettings().keysInAccount || keysNow() === inAccount) return
  clearTimeout(timer)
  timer = setTimeout(save, 800)
})

/** On sign-in (and each time the app opens signed in): bring the account's keys onto this device. */
export async function startAccountKeys(id: string) {
  if (userId === id) return
  userId = id
  setState({ status: 'loading' })
  const { data, error } = await supabase.from('ai_keys').select('anthropic_key, assembly_key').eq('user_id', id).maybeSingle()
  if (userId !== id) return
  if (error) {
    // Most likely offline: this device carries on with the keys it has.
    return setState(getAiSettings().keysInAccount ? { status: 'error', error: cloudErrorMessage(error) } : { status: 'off' })
  }
  const s = getAiSettings()
  if (!data) {
    // Never saved, or taken out of the account on another device: this device keeps its own copy.
    if (s.keysInAccount) setAiSettings({ keysInAccount: false })
    return setState({ status: 'off' })
  }
  // A device joining for the first time keeps a key the account doesn't have yet, and sends it up.
  const joining = !s.keysInAccount
  inAccount = JSON.stringify([data.anthropic_key, data.assembly_key])
  setAiSettings({
    anthropicKey: data.anthropic_key || (joining ? s.anthropicKey : ''),
    assemblyKey: data.assembly_key || (joining ? s.assemblyKey : ''),
    keysInAccount: true,
  })
  if (keysNow() !== inAccount) await save()
  else setState({ status: 'saved' })
}

/** Signed out: stop following the account, and take its keys off this device. */
export function stopAccountKeys() {
  clearTimeout(timer)
  userId = null
  inAccount = ''
  if (getAiSettings().keysInAccount) setAiSettings({ anthropicKey: '', assemblyKey: '', keysInAccount: false })
  setState({ status: 'off' })
}

/** The "Save to my account" tick. Untick removes the keys from the account; this device keeps its copy. */
export async function saveKeysToAccount(on: boolean) {
  if (!userId) return
  if (on) {
    setAiSettings({ keysInAccount: true })
    return save()
  }
  clearTimeout(timer)
  setState({ status: 'saving' })
  const { error } = await supabase.from('ai_keys').delete().eq('user_id', userId)
  if (error) return setState({ status: 'error', error: cloudErrorMessage(error) })
  inAccount = ''
  setAiSettings({ keysInAccount: false })
  setState({ status: 'off' })
}

export function useAccountKeys() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}
