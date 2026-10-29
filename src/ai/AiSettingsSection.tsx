import { VoiceSettings } from './ReadAloud'
import { useState } from 'react'
import { Help } from '../help'
import { DEVICE_MODELS, setAiSettings, useAiSettings } from './settings'
import { Ico } from '../icons'
import { Sparkle } from '@phosphor-icons/react'
import { useAuthSession } from '../cloud/auth'
import { saveKeysToAccount, useAccountKeys } from './accountKeys'

/** Keys and choices for transcription and recaps. Stored on this device, and the keys in the account if the GM ticks it. */
export function AiSettingsSection() {
  const s = useAiSettings()
  const { user } = useAuthSession()
  const account = useAccountKeys()
  return (
    <section>
      <h2>
        <Ico as={Sparkle} /> AI tools (this device) <Help topic="aiTools" />
      </h2>
      <p className="muted">
        Used to turn session recordings into transcripts and recaps. These settings stay on this device and apply to all your
        worlds. Keys are never put in worlds or backups. Tick “Save my keys to my account” to have them on every device you
        sign in on; otherwise add them again on each device you use.
      </p>
      <div className="form">
        <KeyField
          label="Anthropic API key (for one-click recaps, the Archivist and other Claude tools)"
          value={s.anthropicKey}
          onChange={(v) => setAiSettings({ anthropicKey: v })}
          placeholder="sk-ant-…"
          help={
            <>
              Separate from a Claude subscription: create one at{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                console.anthropic.com
              </a>{' '}
              and add a little prepaid credit. A three-hour session’s recap costs roughly 20 to 50 US cents. Without a key you can still use “Copy for Claude”.
            </>
          }
        />
        <KeyField
          label="AssemblyAI API key (for cloud transcription)"
          value={s.assemblyKey}
          onChange={(v) => setAiSettings({ assemblyKey: v })}
          placeholder="Paste your key"
          help={
            <>
              Faster than on-device and tells speakers apart. Get a key at{' '}
              <a href="https://www.assemblyai.com/dashboard/signup" target="_blank" rel="noreferrer">
                assemblyai.com
              </a>
              . Recordings you send are processed by AssemblyAI, and each transcript is deleted from AssemblyAI once it’s saved here.
            </>
          }
        />
        <label className="check">
          <input
            type="checkbox"
            checked={s.keysInAccount}
            disabled={!user || account.status === 'loading' || account.status === 'saving'}
            onChange={(e) => {
              if (e.target.checked || confirm('Take your keys out of your account? This device keeps its copy; other devices keep theirs too until you remove them there.'))
                saveKeysToAccount(e.target.checked)
            }}
          />
          <span>
            Save my keys to my account <Help topic="keysInAccount" />
            <br />
            <span className="muted small">
              {!user
                ? 'Sign in (your account, on the front page) to use this.'
                : account.status === 'error'
                  ? account.error
                  : account.status === 'saving'
                    ? 'Saving…'
                    : account.status === 'saved' && s.keysInAccount
                      ? 'Saved. Any device you sign in on gets them, and signing out takes them off that device.'
                      : 'Only you can read them. They never go into worlds, backups or anything players see.'}
            </span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={s.keepAtAssembly} onChange={(e) => setAiSettings({ keepAtAssembly: e.target.checked })} />
          <span>
            Keep a copy at AssemblyAI <Help topic="keepAtAssembly" />
          </span>
        </label>
        <label>
          On-device speech model
          <select value={s.deviceModel} onChange={(e) => setAiSettings({ deviceModel: e.target.value as 'base' | 'small' })}>
            {Object.entries(DEVICE_MODELS).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </select>
          <span className="muted small">Downloaded once the first time you transcribe on this device, then works offline.</span>
        </label>
        <label>
          Language spoken at the table
          <select value={s.language} onChange={(e) => setAiSettings({ language: e.target.value as 'en' | 'auto' })}>
            <option value="en">English</option>
            <option value="auto">Something else (detect it)</option>
          </select>
        </label>
        <VoiceSettings />
      </div>
    </section>
  )
}

function KeyField({
  label,
  value,
  onChange,
  placeholder,
  help,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  help: React.ReactNode
}) {
  const [show, setShow] = useState(false)
  return (
    <label>
      {label}
      <div className="row">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="button" className="ghost small" onClick={() => setShow(!show)}>
          {show ? 'Hide' : 'Show'}
        </button>
        {value && (
          <button type="button" className="ghost small" onClick={() => onChange('')}>
            Remove
          </button>
        )}
      </div>
      <span className="muted small">{help}</span>
    </label>
  )
}
