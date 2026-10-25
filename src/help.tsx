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
  previewAs:
    'Pick one player to see the world exactly as they do: what’s revealed to everyone, plus pages revealed just to them and :::for passages for their character.',
  codex:
    'The codex holds every page in your world, grouped by type. Pages can sit inside places (a tavern inside a town), and the sidebar opens down to wherever you are.',
  quickAdd: 'Make a new page of any type in one click. It starts as 🔒 GM only, so nothing is revealed until you choose.',
  visibility:
    '🔒 GM only means just you. 👁 Revealed means every player can see it. Click to switch. Pins, maps, sessions and files work the same way.',

  // Pages
  entityPage:
    'A page in your codex. Link other pages by writing [[Their Name]]; hover over a link to peek at that page. The sidebar shows the picture, maps it appears on, details and tags; below are the places and people inside it and every page that mentions it.',
  secrets:
    'Hide part of a page with the 🔒 GM-only passage button: players never see it. Use 🤫 Secret for… to keep a passage for certain characters only, like ":::for Wren and Silas". Names are suggested as you type.',
  revealTo:
    'This page is GM only, but you can still let particular players see it. Tick their names and only they get it, marked "Just for you". Needs cloud sync and players who have joined.',
  gmNotes: 'Notes for you alone. They are never sent to players, not even on revealed pages.',
  fields: 'Free-form details like stats, prices or alignment. Add whatever your game needs. Click 👁 to make a detail 🔒 GM only: players never get it, even on a revealed page.',
  hiddenCampaign:
    'A campaign you’re still planning can stay 🔒 GM only: players don’t see it or any of its sessions until you switch it to 👁 players.',
  pictures: 'Put pictures in the text: paste one, drop one in, or use 🖼️ Picture. Players see a picture once the text around it is revealed to them (not inside a secret passage).',
  search: 'Finds pages by name, nickname, summary, details, tags and the words in them, plus sessions (title, recap and your notes) and maps. Press Ctrl+K (⌘K on a Mac) anywhere to search. In the player view it only searches what players can read.',
  phoneMenu: 'On a phone the menu folds away so each page starts at the top. Tap ☰ Menu to open it; it folds up again when you pick a page. 🔍 Search stays at the top.',
  news: 'What your GM has revealed since you last looked: new pages, session recaps and answers to your questions. Tap one to read it, and “Got it” when you’re done.',
  backupReminder: 'A reminder to download a backup of this world every two weeks (monthly with cloud sync on). Save the file somewhere safe, like Google Drive or a USB stick. “Later” asks again in a week.',
  aliases:
    'Other names this page goes by, like “the Harbourmaster” for Corvin Vane. A [[link]] to any of them finds this page. Nicknames are for you: players don’t see them. Renaming a page updates every link to it.',
  gmTags: 'Tags only you see, like “traitor” or “recurring”. Players get the ordinary tags of a revealed page, never these.',
  history:
    'Every time you save a page, the version before is kept on this device (the last 40). Look at an old version or restore it; restoring keeps today’s version too.',
  recentlyDeleted: 'Pages, sessions, campaigns, maps, files, corkboards and sounds deleted on this device (pages deleted on another device too). Restore brings them back as they were. Things other than pages are kept for a month.',
  templates:
    'A template is a starting point for new pages, like a "Dungeon room" with the headings and details you always fill in. Templates are always GM only and never appear in lists. Make one with "Save as template" on any page.',
  lifeStatus:
    'Mark a character alive, dead, missing or captured. It shows in lists, on map pins, at the Lectern and on corkboards. Players only see it if you tick "Players know this".',
  print: 'A clean copy to print or save as a PDF (choose "Save as PDF" in the print window). The player copy leaves out secrets, GM notes and anything not revealed.',
  customTypes: 'Add your own kinds of page, such as Ships, Spells or Gods of the Deep. Each gets its own section in the codex.',

  // Maps
  maps: 'Upload a map image or draw one in the map builder. Then drop pins and draw regions, and link them to pages so clicking them shows what is there.',
  mapView:
    'Click a pin or region to see what is there. "Enter" opens a more detailed map, such as a town inside a region. As GM, use the toolbar to add pins and regions.',
  fog:
    'Hide the map from players and uncover it as they explore. Uncover a circle, a box or any shape; switch to Cover to hide a part again. Players get a copy of the picture with the fog painted on, so covered areas and the pins in them can’t be peeked at.',
  mapBuilder: 'Draw a map from scratch: paint land and water, drag out rooms, draw roads, rivers and walls, stamp symbols and add labels. It then works like any uploaded map.',

  // Story
  timeline: 'Events in order: the history before your campaign, and what has happened during it. Filter by place to see one area’s story.',
  threads:
    'Every hook, mystery, promise and grudge you’ve left dangling. Move them from dangling to in play to tied off. A thread that hasn’t moved in three sessions gets flagged so nothing is forgotten.',
  leads: 'The rumours, hooks and mysteries your GM has shared with the party.',
  calendar:
    'Your world’s own calendar: month and day names, the year’s name (like DR) and moons. Pick a ready-made one (Forgotten Realms, Golarion, Eberron, Greyhawk, Exandria) or make your own. Events can then have real dates.',
  worldToday: 'Today’s date in your world. Move it on as time passes in the game; each session remembers the date it started on.',
  relations:
    'How this page connects to others: family, friends, enemies, who serves whom. Players only see a link when you tick “Players know”. Every link shows up on both pages.',
  relationWeb:
    'Everyone and how they’re connected, drawn as a web. Drag people about, click one to focus on them, or switch to the family tree. Add links from any page’s Relationships box.',
  clocks:
    'A progress clock is a circle cut into slices. Fill a slice when a villain’s plan moves on, a rival gets closer or danger grows; when it’s full, it happens. Players only see clocks you mark “Players know”.',
  safety:
    'Agree what’s off limits before you play. Lines never happen in the game; veils can happen, but off screen. Everyone in the world can read this page.',
  xcard:
    'Tap the X-card if something in the game isn’t OK for you. Your GM is told straight away, without your name, and moves the story on. No one asks why.',
  campaign: 'A campaign is one story in your world, with its sessions, party and active quests. A world can hold several.',

  // Sessions
  session:
    'One game night. Keep 🔒 GM notes for yourself and a 👁 player recap for the table. Record the session, then turn the recording into a transcript and a recap.',
  recording:
    'Record from one microphone for games at the table, or the microphone plus your Discord or Zoom audio for online games. Add bookmarks while you play to jump back to big moments. Recordings are big, so they stay on the device that made them; their transcripts sync to your other devices.',
  transcript:
    'Turns a recording into text. "On this device" is free and private but slower, with no speaker names. "Cloud" uses AssemblyAI with your own key, is faster and tells speakers apart.',
  recap:
    'Claude drafts a GM summary and a player recap from the transcript. "Copy for Claude" works with a Claude subscription for free; "Write it now" uses your own API key. You review both before saving.',
  lectern:
    'The Lectern is your screen while you run the session: the current scene, who is there, loose threads, initiative, dice, quick notes and improvised names, all on one page.',
  prep:
    'Plan the session: a strong start, the scenes you expect, secrets and clues, and fights ready to run. At the Lectern you tick scenes and clues off as they happen.',
  strongStart: 'How the session opens. Starting in the middle of something happening gets the table going fast.',
  clues:
    'Things the players could learn, not tied to any one scene. Drop each one wherever it fits and tick it off when they find it; leftovers carry into your next prep.',
  encounters:
    'Build a fight ahead of time: who’s in it, how many, HP and AC. Pick NPC pages to read their HP and AC from their details. "Run" adds everyone to the Lectern’s initiative tracker.',
  soundboard:
    'Buttons for ambience, music and sound effects. Upload your own audio files, or add Syrinscape moods and elements. Tap to play, tap again to stop. Sounds keep playing as you move around the app.',
  syrinscape:
    'Control Syrinscape from here: keep its online player open, add your auth token once on this device, then paste the remote control link of any mood or element.',
  showPlayers:
    'Put a picture, a page or some text on every player’s screen right now, like handing round a letter or showing a monster. It pops up for players who joined; open the Players’ screen on a TV or second monitor for the table.',
  playersScreen: 'A clean screen for a TV or second monitor at the table. It shows whatever you’re showing players, and nothing else.',
  initiative: 'Add everyone in the fight, roll or type initiative, then step through turns. Track HP and conditions as you go.',
  dice: 'Roll any dice. Type things like 2d6+3 or 4d6kh3 (keep the highest three), or tap a quick die.',
  quickNote: 'Jot something down mid-session. It is added to this session’s GM notes with the time.',
  randomTables:
    'Your own tables to roll on: one entry per line. "3x Goblins" makes an entry three times as likely, {2d6} rolls dice inside an entry, and {Weather} rolls on your table called Weather.',
  improvise: 'Need a name or a tavern right now? Roll one here and save it into your world if it sticks.',

  // Tools
  boards:
    'A corkboard for mysteries, plots and politics. Pin pages and note cards, drag them about, and tie string between them with 🧶. Click a string to label or cut it. GM only.',
  generators: 'Roll up taverns, shops and NPCs without any AI. Save the ones you like; they start as GM only.',
  assets: 'Every file in this world: map images, portraits and handouts. Mark a file revealed to let players see it.',
  loot:
    'Who carries what. Set "Carried by" on any item page to a character or the party stash, and keep the party’s coin here. Players see revealed items and the purse.',
  importPages:
    'Bring pages in from Obsidian (or any Markdown notes), a Kanka export or a World Anvil export. Everything arrives as 🔒 GM only, so you can tidy up before revealing anything.',
  exportMarkdown: 'Download every page as Markdown files in folders, ready to open in Obsidian or any notes app. GM notes and secrets are included, so keep it to yourself.',
  discord:
    'Post recaps and session dates to your group’s Discord channel. In Discord: Server settings, Integrations, Webhooks, New webhook, then copy its link here. The link is kept on this device only.',
  backup: 'Save the whole world, uploaded files and recordings included, as one .zip file. Keep a backup even if sync is on. Older .json backups still import.',

  // Sharing and players
  cloudSync:
    'Sign in to keep this world in step across your devices. Your world is still saved on each device, so it works offline and catches up when you reconnect. If two devices change the same page at once, both sets of changes are kept where they don’t overlap; where they do, the other version is kept in the page’s history.',
  socialLogin:
    'Sign in with your Google or Facebook account instead of a password. If you already made an account with the same email, you’ll land in that same account. Not available in the desktop app yet, so use email there.',
  shareLink: 'A public, read-only wiki of everything you’ve revealed to the whole table. No account needed, so it suits people outside your group. GM-only things are removed before anything is sent. Players should join with the invite link instead.',
  wiki: 'A read-only wiki of this world, shared by its GM. It shows only what the GM has revealed to everyone, and updates as they add to it.',
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
  questions:
    'Ask your GM something privately: about a page, or anything at all. Only your GM sees your question, and only you see the answer.',
  questionsGm:
    'Questions your players sent you, privately. Your answer goes only to the player who asked. If they asked about a hidden page, you can reveal it to just them from here.',
  editCharacter:
    'Keep your character’s details up to date: the one-line summary, stats and anything you want to write about them. Your GM sees your changes and can change them back.',
  character: 'Who plays this character. Players ask to play their character from here, and you approve it (here or in World settings) before it counts, so nobody can take someone else’s character or their secrets. You can release a claim later.',
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
