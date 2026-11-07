import { useSyncExternalStore } from 'react'
import { cloudErrorMessage, supabase } from '../cloud/client'
import { getAiSettings, onAiSettings, setAiSettings, type AiSettings, type DeviceKeys } from './settings'

/**
 * "Save to my account": the GM's AI keys kept in their own row of `ai_keys`, which no other user can
 * read, so every device they sign in on picks them up. Nothing else from the AI settings goes up, and
 * the keys never go into a world, a backup or anything players receive.
 *
 * Once a device is in step (`keysInAccount`), the account is the master copy: a key changed or
 * removed on one device reaches the others the next time they open the app signed in. Signing out
 * takes the account's keys off that device again, and puts back any keys the device had of its own.
 *
 * A computer can be shared, so the device notes whose each key is (`anthropicBy`, `assemblyBy`).
 * Signing in only adds a key the account doesn't have yet when that same person typed it here; for a
 * key typed while no one was signed in it asks first. Anyone else's key is set aside (`ownKeys`)
 * while this person is signed in, and comes back when they sign out.
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

/** Each key, the note of whose it is, and its column in `ai_keys`. */
const SLOTS = [
  { key: 'anthropicKey', by: 'anthropicBy', column: 'anthropic_key', name: 'Anthropic' },
  { key: 'assemblyKey', by: 'assemblyBy', column: 'assembly_key', name: 'AssemblyAI' },
] as const

const keysNow = () => {
  const s = getAiSettings()
  return JSON.stringify([s.anthropicKey.trim(), s.assemblyKey.trim()])
}

/** Puts this device's keys in the person's row. False (with the reason shown) if that failed. */
async function upload(id: string) {
  const s = getAiSettings()
  const keys = keysNow()
  setState({ status: 'saving' })
  const { error } = await supabase.from('ai_keys').upsert({ user_id: id, anthropic_key: s.anthropicKey.trim(), assembly_key: s.assemblyKey.trim() })
  if (userId !== id) return false
  if (error) {
    setState({ status: 'error', error: cloudErrorMessage(error) })
    return false
  }
  inAccount = keys
  setState({ status: 'saved' })
  return true
}

async function save() {
  clearTimeout(timer)
  if (userId && getAiSettings().keysInAccount) await upload(userId)
}

// A key typed or removed on this device goes up shortly after, once the device is in step.
onAiSettings(() => {
  if (!userId || !getAiSettings().keysInAccount || keysNow() === inAccount) return
  clearTimeout(timer)
  timer = setTimeout(save, 800)
})

/** Takes an account's keys off this device, and puts back the device's own keys if any were set aside. */
function putBackOwnKeys() {
  const s = getAiSettings()
  if (!s.keysInAccount && !s.ownKeys) return
  const own = s.ownKeys
  setAiSettings({
    anthropicKey: own?.anthropicKey ?? '',
    assemblyKey: own?.assemblyKey ?? '',
    anthropicBy: own?.anthropicBy,
    assemblyBy: own?.assemblyBy,
    keysInAccount: false,
    ownKeys: undefined,
  })
}

/** On sign-in (and each time the app opens signed in): bring the account's keys onto this device. */
export async function startAccountKeys(id: string) {
  if (userId === id) return
  userId = id
  // Still in step with someone else's account (they never signed out here): their keys go first.
  const before = getAiSettings()
  if (before.keysInAccount && SLOTS.some((slot) => before[slot.by] && before[slot.by] !== id)) putBackOwnKeys()
  setState({ status: 'loading' })
  const { data, error } = await supabase.from('ai_keys').select('anthropic_key, assembly_key').eq('user_id', id).maybeSingle()
  if (userId !== id) return
  if (error) {
    // Most likely offline: this device carries on with the keys it has.
    return setState(getAiSettings().keysInAccount ? { status: 'error', error: cloudErrorMessage(error) } : { status: 'off' })
  }
  const s = getAiSettings()
  if (!data) {
    // Never saved, or taken out of the account on another device: this device keeps its copy, as this person's.
    if (s.keysInAccount) setAiSettings({ keysInAccount: false, anthropicBy: id, assemblyBy: id })
    return setState({ status: 'off' })
  }
  const theirs = { anthropicKey: data.anthropic_key ?? '', assemblyKey: data.assembly_key ?? '' }
  const next: Partial<AiSettings> = { ...theirs, anthropicBy: id, assemblyBy: id, keysInAccount: true }
  const own: DeviceKeys = { anthropicKey: '', assemblyKey: '', ...s.ownKeys }
  if (!s.keysInAccount) {
    // Joining: a key already here that the account doesn't have goes up only if it's this person's.
    const extra = SLOTS.filter((slot) => s[slot.key].trim() && s[slot.key].trim() !== theirs[slot.key])
    const unsure = extra.filter((slot) => !theirs[slot.key] && !s[slot.by])
    const two = unsure.length > 1
    const agreed =
      unsure.length > 0 &&
      confirm(
        `This device already has ${two ? 'Anthropic and AssemblyAI keys' : `an ${unsure[0].name} key`} that ${two ? 'aren’t' : 'isn’t'} in your account. ${two ? 'Are they' : 'Is it'} yours? Someone else using this browser may have added ${two ? 'them' : 'it'}.\n\nOK adds ${two ? 'them' : 'it'} to your Warded Atlas account, so every device you sign in on gets ${two ? 'them' : 'it'}. Cancel leaves ${two ? 'them' : 'it'} out: set aside while you’re signed in, and back when you sign out.`,
      )
    for (const slot of extra) {
      const mine = s[slot.key].trim()
      const by = s[slot.by]
      if (!theirs[slot.key] && (by === id || (!by && agreed))) next[slot.key] = mine
      else if (!own[slot.key]) Object.assign(own, { [slot.key]: mine, [slot.by]: by })
    }
  }
  inAccount = JSON.stringify([theirs.anthropicKey, theirs.assemblyKey])
  setAiSettings({ ...next, ownKeys: own.anthropicKey || own.assemblyKey ? own : undefined })
  if (keysNow() !== inAccount) await save()
  else setState({ status: 'saved' })
}

/** Signed out: stop following the account, take its keys off this device, and put back the device's own. */
export function stopAccountKeys() {
  clearTimeout(timer)
  userId = null
  inAccount = ''
  putBackOwnKeys()
  setState({ status: 'off' })
}

/** The "Save to my account" tick. Untick removes the keys from the account; this device keeps its copy. */
export async function saveKeysToAccount(on: boolean) {
  if (!userId) return
  if (on) {
    const s = getAiSettings()
    // A key someone else typed here, or typed while no one was signed in, goes up only if this person says it's theirs.
    const unsure = SLOTS.filter((slot) => s[slot.key].trim() && s[slot.by] !== userId)
    const two = unsure.length > 1
    if (
      unsure.length &&
      !confirm(
        `${two ? 'Are the Anthropic and AssemblyAI keys' : `Is the ${unsure[0].name} key`} on this device yours? Someone else using this browser may have added ${two ? 'them' : 'it'}.\n\nOK saves ${two ? 'them' : 'it'} to your account as yours.`,
      )
    )
      return
    const id = userId
    setAiSettings({ anthropicBy: id, assemblyBy: id })
    // In step only once the account has them: if that fails (offline, say), the tick stays off and says why.
    if (await upload(id)) setAiSettings({ keysInAccount: true })
    return
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
