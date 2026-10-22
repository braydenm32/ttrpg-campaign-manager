import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'

/**
 * Help tips: a small "?" next to each feature that explains it in a sentence or two.
 * Hover or focus to read on a computer, tap on a phone. Tips can be switched off (and back on in
 * World settings) once you know your way around; the setting is per device.
 */
export const HELP = {
  // Getting around
  overview: 'Your world at a glance: quick-add buttons, campaigns, open quests, loose threads and what changed lately.',
  viewingAs:
    'Switch to Player to preview exactly what your players can see. Anything marked 🔒 GM only, GM notes and secret passages disappear.',
  codex:
    'The codex holds every page in your world, grouped by type. Pages can sit inside places (a tavern inside a town), and the sidebar opens down to wherever you are.',
  quickAdd: 'Make a new page of any type in one click. It starts as 🔒 GM only, so nothing is revealed until you choose.',
  visibility:
    '🔒 GM only means just you. 👁 Revealed means every player can see it. Click to switch. Pins, maps, sessions and files work the same way.',

  // Pages
  entityPage:
    'A page in your codex. Link other pages by writing [[Their Name]]. The sidebar shows the picture, maps it appears on, details and tags; below are the places and people inside it and every page that mentions it.',
  secrets:
    'Hide part of a page with the 🔒 GM-only passage button: players never see it. Use 🤫 Secret for… to keep a passage for certain characters only, like ":::for Wren and Silas". Names are suggested as you type.',
  revealTo:
    'This page is GM only, but you can still let particular players see it. Tick their names and only they get it, marked "Just for you". Needs cloud sync and players who have joined.',
  gmNotes: 'Notes for you alone. They are never sent to players, not even on revealed pages.',
  fields: 'Free-form details like stats, prices or alignment. Add whatever your game needs.',
  history:
    'Every time you save a page, the version before is kept on this device (the last 40). Look at an old version or restore it; restoring keeps today’s version too.',
  recentlyDeleted: 'Pages deleted on this device, or deleted on another device and synced here. Restore brings the page back as it was.',
  templates:
    'A template is a starting point for new pages, like a "Dungeon room" with the headings and details you always fill in. Templates are always GM only and never appear in lists. Make one with "Save as template" on any page.',
  customTypes: 'Add your own kinds of page, such as Ships, Spells or Gods of the Deep. Each gets its own section in the codex.',

  // Maps
  maps: 'Upload a map image or draw one in the map builder. Then drop pins and draw regions, and link them to pages so clicking them shows what is there.',
  mapView:
    'Click a pin or region to see what is there. "Enter" opens a more detailed map, such as a town inside a region. As GM, use the toolbar to add pins and regions.',
  mapBuilder: 'Draw a map from scratch: paint land and water, drag out rooms, draw roads, rivers and walls, stamp symbols and add labels. It then works like any uploaded map.',

  // Story
  timeline: 'Events in order: the history before your campaign, and what has happened during it. Filter by place to see one area’s story.',
  threads:
    'Every hook, mystery, promise and grudge you’ve left dangling. Move them from dangling to in play to tied off. A thread that hasn’t moved in three sessions gets flagged so nothing is forgotten.',
  leads: 'The rumours, hooks and mysteries your GM has shared with the party.',
  campaign: 'A campaign is one story in your world, with its sessions, party and active quests. A world can hold several.',

  // Sessions
  session:
    'One game night. Keep 🔒 GM notes for yourself and a 👁 player recap for the table. Record the session, then turn the recording into a transcript and a recap.',
  recording:
    'Record from one microphone for games at the table, or the microphone plus your Discord or Zoom audio for online games. Add bookmarks while you play to jump back to big moments.',
  transcript:
    'Turns a recording into text. "On this device" is free and private but slower, with no speaker names. "Cloud" uses AssemblyAI with your own key, is faster and tells speakers apart.',
  recap:
    'Claude drafts a GM summary and a player recap from the transcript. "Copy for Claude" works with a Claude subscription for free; "Write it now" uses your own API key. You review both before saving.',
  lectern:
    'The Lectern is your screen while you run the session: the current scene, who is there, loose threads, initiative, dice, quick notes and improvised names, all on one page.',
  initiative: 'Add everyone in the fight, roll or type initiative, then step through turns. Track HP and conditions as you go.',
  dice: 'Roll any dice. Type things like 2d6+3 or 4d6kh3 (keep the highest three), or tap a quick die.',
  quickNote: 'Jot something down mid-session. It is added to this session’s GM notes with the time.',
  randomTables:
    'Your own tables to roll on: one entry per line. "3x Goblins" makes an entry three times as likely, {2d6} rolls dice inside an entry, and {Weather} rolls on your table called Weather.',
  improvise: 'Need a name or a tavern right now? Roll one here and save it into your world if it sticks.',

  // Tools
  generators: 'Roll up taverns, shops and NPCs without any AI. Save the ones you like; they start as GM only.',
  assets: 'Every file in this world: map images, portraits and handouts. Mark a file revealed to let players see it.',
  loot:
    'Who carries what. Set "Carried by" on any item page to a character or the party stash, and keep the party’s coin here. Players see revealed items and the purse.',
  backup: 'Save the whole world, uploaded files included, as one file. Keep a backup even if sync is on.',

  // Sharing and players
  cloudSync:
    'Sign in to keep this world in step across your devices. Your world is still saved on each device, so it works offline and catches up when you reconnect.',
  shareLink: 'A read-only link to everything you’ve revealed. No account needed. GM-only things are removed before anything is sent.',
  players:
    'Invite your players with a link. They sign in, join, claim their character and keep notes. They only ever receive what you’ve revealed to them.',
  playerNotes:
    '"My notes" are private to you. "Group notes" are shared with the whole party, and your GM can read them. Both save when you click away.',
  scratchpad: 'A notebook for anything that isn’t about one page: plans, names, clues. Keep your own notes or write in the party’s shared one.',
  gmPlayerNotes: 'What your players have written together. Only they can edit it, and their private notes stay private.',
  coGM:
    'A co-GM sees and edits everything in this world, secrets included, from their own account. Only you can invite or remove co-GMs, manage players and links, or delete the cloud copy.',
  schedule:
    'Suggest a few dates for the next session. Players who joined mark each one yes, maybe or no, and you book the one that works. Booking makes the session with that date.',
  character: 'Who plays this character. Players claim their own character from here; you can release a claim from World settings.',
  aiTools: 'Keys for transcription and recaps. They stay on this device only: never synced and never in backups.',
} as const

export type HelpTopic = keyof typeof HELP

const KEY = 'codex.help'
const listeners = new Set<() => void>()
const read = () => {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}
export function setHelpTips(on: boolean) {
  try {
    if (on) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, 'off')
  } catch {
    // Storage blocked: tips stay as they are.
  }
  listeners.forEach((l) => l())
}
export function useHelpTips() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
    () => true,
  )
}

/** A "?" that explains a feature. */
export function Help({ topic, text }: { topic?: HelpTopic; text?: string }) {
  const on = useHelpTips()
  const [open, setOpenState] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number }>()
  const ref = useRef<HTMLSpanElement>(null)
  const id = useId()
  const closing = useRef<ReturnType<typeof setTimeout>>(undefined)
  // The bubble is placed in fixed position, kept inside the window on narrow phones.
  const measure = () => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const width = Math.min(300, window.innerWidth - 24)
    const left = Math.max(12, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 12))
    // Below the "?" when there's room, otherwise above it (the sidebar's "Viewing as" sits at the bottom).
    const below = window.innerHeight - r.bottom > 180 || r.top < 180
    setPlace(below ? { left, width, top: r.bottom + 6 } : { left, width, bottom: window.innerHeight - r.top + 6 })
  }
  const setOpen = (v: boolean) => {
    clearTimeout(closing.current)
    if (v) measure()
    setOpenState(v)
  }
  // A short delay on closing lets the mouse cross the gap into the bubble.
  const closeSoon = () => {
    clearTimeout(closing.current)
    closing.current = setTimeout(() => setOpenState(false), 200)
  }
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [open])
  useEffect(() => {
    if (!pinned) return
    const close = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) {
        setPinned(false)
        setOpen(false)
      }
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (setPinned(false), setOpen(false))
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [pinned])
  if (!on) return null
  const body = text ?? (topic ? HELP[topic] : '')
  return (
    <span
      ref={ref}
      className="help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => !pinned && closeSoon()}
    >
      <button
        type="button"
        className="help-button"
        aria-label="What’s this?"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => !pinned && closeSoon()}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setPinned(!pinned)
          setOpen(!pinned)
        }}
      >
        ?
      </button>
      {open && (
        <span role="tooltip" id={id} className="help-bubble" style={place}>
          {body}
          <button
            type="button"
            className="link help-off"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setHelpTips(false)
            }}
          >
            Hide all tips
          </button>
        </span>
      )}
    </span>
  )
}

/** The switch for help tips (World settings and the home page). */
export function HelpTipsToggle() {
  const on = useHelpTips()
  return (
    <label className="row help-toggle">
      <input type="checkbox" checked={on} onChange={(e) => setHelpTips(e.target.checked)} />
      Show help tips (the little ? buttons)
    </label>
  )
}
