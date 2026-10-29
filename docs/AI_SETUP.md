# Setting up the AI features

A step-by-step guide to switching on the app's AI features: turning session recordings into transcripts, and the Claude tools (recaps, world updates, the Archivist, prep, flavour and NPC lines). It covers what each one needs, what it costs and where your keys and recordings go.

**The short version:** everything is optional, and most of it works free. If you want one-click results, make two accounts (AssemblyAI and the Anthropic Console), copy a key from each, and paste them into **World settings → This device → AI tools**. Tick **Save my keys to my account** and every device you sign in on gets them too. That's the whole setup: there's nothing to change in Supabase, Cloudflare or the code.

**Contents**

1. [What there is, and what it costs](#1-what-there-is-and-what-it-costs)
2. [AssemblyAI: cloud transcripts with speaker names](#2-assemblyai-cloud-transcripts-with-speaker-names)
3. [Claude: the Anthropic API key](#3-claude-the-anthropic-api-key), and [saving your keys to your account](#save-the-keys-to-your-account-optional)
4. [The free ways (no keys at all)](#4-the-free-ways-no-keys-at-all)
5. [Using each feature](#5-using-each-feature): record, transcribe, recap, world updates, the Archivist, prep, flavour, NPC lines, read aloud, spotlight
6. [Which Claude does which job](#6-which-claude-does-which-job)
7. [Privacy: where keys, recordings and transcripts go](#7-privacy-where-keys-recordings-and-transcripts-go)
8. [A second computer, a phone, or a co-GM](#8-a-second-computer-a-phone-or-a-co-gm)
9. [When something goes wrong](#9-when-something-goes-wrong)
10. [For Claude: where it lives in the code](#10-for-claude-where-it-lives-in-the-code)

---

## 1. What there is, and what it costs

A few words you'll see:

- **API key:** a long password that lets the app use a service on your account, so the service can bill you. You paste it into the app once, and either save it to your Warded Atlas account (so every device you sign in on has it) or paste it again on each device.
- **AssemblyAI:** a company that turns speech into text. It's what "Transcribe in the cloud" uses.
- **Anthropic Console:** where you buy Claude by the job for apps like this one (the "API"). It is **separate from your Claude subscription** on claude.ai: a different bill, with its own prepaid credit.
- **Copy for Claude:** the free way. The app copies everything Claude needs; you paste it into claude.ai (using your subscription) and paste the answer back.

| Feature | Free way | One-click way | Rough cost of the one-click way |
| --- | --- | --- | --- |
| Recording → transcript | **On this device** (Whisper): free, private, slow, no speaker names | **AssemblyAI** key: fast, labels who's speaking | About US$0.23 an hour of audio, so about 90 US cents for a 4-hour session. New accounts get US$50 free (about 200 hours) |
| Recap + world updates | Copy for Claude | **Write it now** with an Anthropic key | About 20 to 50 US cents a session |
| The Archivist: ask your world | Copy for Claude | **Ask** with an Anthropic key | About 5 to 10 US cents for a first question in a big world; follow-ups cost less |
| The Archivist: check for contradictions | Copy for Claude | **Check now** | One page and its neighbours: about 10 to 30 US cents. The whole of a world as big as Vael Ardith: about US$2 |
| Prep helper | Copy for Claude | **Suggest prep** | About 10 to 25 US cents |
| Flavour for generators | Copy for Claude | **Add flavour** | About 1 US cent |
| NPC lines in character | Copy for Claude | **Give me lines** | About 1 US cent |
| Read recaps aloud | Always free (your device's own voices) | – | Free |
| Spotlight stats | Always free (worked out in the app) | – | Free |

You never have to guess: every one-click button shows its **estimated price before you press it**, and the **real cost afterwards** ("That recap cost about US$0.34 with Claude Opus 5.5"). Bigger worlds and longer sessions cost more, because Claude reads more.

Prices checked 29 October 2026 at [assemblyai.com/pricing](https://www.assemblyai.com/pricing) and in the Anthropic price list. The app's own numbers live in `src/ai/claude.ts`; if Anthropic changes its prices, ask Claude to update them there.

---

## 2. AssemblyAI: cloud transcripts with speaker names

Skip this if you're happy with the free on-device transcripts.

1. Sign up at **https://www.assemblyai.com/dashboard/signup**. No card is needed for the free US$50.
2. On your AssemblyAI dashboard, open **API Keys** and copy your key.
3. In The Warded Atlas, open any world, then **World settings → This device → AI tools**.
4. Paste it into **AssemblyAI API key (for cloud transcription)**. Press **Show** once to check it pasted whole, with no space at either end.
5. When the free credit runs low, add a card in the AssemblyAI dashboard (Billing). Pay-as-you-go: you only pay for the hours you send.

**What it uses:** AssemblyAI's best model (Universal-3.5 Pro), falling back to Universal-2 for languages that one doesn't cover, with speaker labels switched on. If your table speaks something other than English, set **Language spoken at the table** to **Something else (detect it)** in the same settings.

**Transcripts are deleted from AssemblyAI.** Once a cloud transcript is saved in your world, the app deletes AssemblyAI's copy, so your table's talk isn't kept by another company. If you'd rather keep a copy in your AssemblyAI account (to look at on their website), tick **Keep a copy at AssemblyAI** in the same settings. In the rare case the delete fails, the transcript still saves and the app tells you, so you can delete it from the AssemblyAI dashboard yourself.

---

## 3. Claude: the Anthropic API key

Skip this if you'll always use Copy for Claude (see [section 4](#4-the-free-ways-no-keys-at-all)).

1. Go to **https://console.anthropic.com** and sign up with Google or email. (It may open as platform.claude.com: same place.) This is a separate account from your claude.ai subscription, even with the same email.
2. **Settings → Plans & Billing**: add a card, then **Add funds** (or **Purchase credits**). The minimum is US$5, which covers roughly 10 to 25 sessions' recaps plus plenty of small jobs.
3. Leave **auto-reload off** (under Billing, **Edit settings**). Then you can never spend more than the credit you bought: when it runs out, the app says so and you top up.
4. Optional: **Settings → Limits → Change limit**, and set a monthly limit such as US$10.
5. **Settings → API Keys → Create Key**. Name it "Warded Atlas" and copy it. **It's shown only once**; if you lose it, just make a new one.
6. In The Warded Atlas: **World settings → This device → AI tools → Anthropic API key**. Paste it and press **Show** once to check it.

That one key powers every Claude button in the app. New Anthropic accounts start with low rate limits, so if a big job says you're "over your limit for now", wait a minute and try again; the limits rise as you use it.

### Save the keys to your account (optional)

Under the two keys in **World settings → This device → AI tools**, tick **Save my keys to my account** (you need to be signed in). From then on:

- Any computer, phone or the desktop app you sign in on gets both keys by itself, the next time it opens the app. No more pasting.
- Change or remove a key on one device and the others follow the next time they open the app.
- Signing out takes the keys off that device. Sign back in and they come back.
- Untick it to take the keys out of your account. Each device keeps the copy it already has until you remove it there.

Only your login can read them. They never go into a world, a backup, a share link or anything players or co-GMs receive, and deleting your account deletes them too. The one thing to know: anyone who gets into your Warded Atlas account could use your keys, so keep a monthly limit and auto-reload off in the Anthropic Console (steps 3 and 4 above), and use a password you don't use anywhere else (or Google sign-in).

---

## 4. The free ways (no keys at all)

**On-device transcripts.** On a session with a recording, press **Transcribe on this device**. The first time, it downloads a speech model once (**Quick**, about 80 MB, or **Better**, about 250 MB and slower; pick in **World settings → This device → AI tools → On-device speech model**). After that it works offline, and the audio never leaves your device. It is slow (roughly as long as the session on an ordinary laptop) and doesn't tell speakers apart. Keep the page open; if you leave or pause, it carries on from where it got to next time.

**Copy for Claude.** Every Claude feature has this button next to its one-click button:

1. Press **Copy for Claude**. The app copies the instructions and the parts of your world Claude needs.
2. Open **https://claude.ai/new**, paste, and send.
3. Copy Claude's **whole** reply (the copy button under it is easiest).
4. Back in the app, paste it into the box that opened (for example **Paste Claude's reply here**) and press the button under it (**Check the draft** for recaps).

It uses your Claude subscription, so it costs nothing extra. The answer comes back in exactly the same form as the one-click way, so world updates, prep and the rest work the same.

---

## 5. Using each feature

### 5a. Recording a session

1. Get everyone's OK to record first.
2. Open the session (**Prep → your campaign → the session**) and press **Start recording**.
   - At the table: choose **In person: this device's microphone**. A laptop in the middle of the table works; a cheap USB conference microphone works better.
   - Online: choose **Online: microphone + call audio (Discord, Zoom…)**, pick the tab or screen with the call when the browser asks, and tick **Share audio**.
3. Press **Bookmark** at big moments (a death, a twist, a new NPC). Claude gets them as hints.
4. Press **Stop** at the end. The recording saves as it goes, so a crash loses almost nothing.

The recording stays **on the device that made it**, so transcribe on that device. The transcript then syncs to your other devices.

### 5b. Transcribing

On the session page, under the recording:

- **Transcribe in the cloud** (AssemblyAI key): a 4-hour session takes a few minutes. You can leave the page and come back; **Check on cloud transcript** picks it up.
- **Transcribe on this device**: free and private, but slow (see [section 4](#4-the-free-ways-no-keys-at-all)).

Then open **Name speakers** and type who each letter is, like `Sam (Wren)`. Next session, **Same as last time** fills the names in; check them, because AssemblyAI letters people in the order they first speak. Named speakers make the recap, the world updates and the spotlight stats much better.

### 5c. Recap and world updates

On the session page, under **Write up this session**:

1. Press **Write it now** (Anthropic key) or **Copy for Claude**. Claude reads the transcript and your GM notes. With a key, you can go to other pages while it writes: a note at the top says **Claude is writing…**, then **Claude finished**, and takes you back.
2. Check the **GM summary**, fix anything misheard, and press **Add to GM notes**.
3. Check the **Player recap** and press **Use as the player recap**. Players see it once you reveal the session.
4. Under **Keep the world up to date**, go through Claude's suggestions: new NPCs and places that came up, lines for existing pages, quest progress, relationships, timeline events, deaths and captures, loot changing hands, loose threads, and things that contradict your notes. Untick or **Edit** anything wrong; tick **Players can see this line** or **Add to timeline** where you want them.
5. Press **Add N changes to the world**.

New pages start GM only; lines on existing pages go under a "Session log" heading. **World → The Chronicle** lists every change by session, and each page's **History** can roll any one back.

### 5d. The Archivist (Prep → The Archivist)

- **Ask your world:** type a question ("Who would want the party dead?") and press **Ask**. Claude looks up the pages it needs and answers only from your notes, with links, saying when something is secret. Ask follow-ups in the same box; they're cheaper because Claude remembers what it already read.
- **Check for contradictions:** pick **The whole world** or **One page and its neighbours**, then **Check now**. Each problem comes with a suggested fix; tick it off when it's dealt with. The whole world reads everything, so it's the priciest button in the app (the button tells you first). Once a month is plenty.

### 5e. Prep helper (a session's Prep tab)

Under **Prep with Claude**, press **Suggest prep**. Claude reads the last two sessions, the party, open threads and running clocks, and suggests a strong start, scenes, secrets and clues, and who to have ready. Untick what you don't want; the rest goes onto your prep sheet.

### 5f. Flavour for generators (Prep → Generators)

Roll a tavern, shop or person, then under **Flavour with Claude** press **Add flavour**: a read-aloud description, rumours tied to your world, and one secret (kept GM only when you save).

### 5g. NPC lines (any NPC page)

Under **Lines in character**, say what's happening ("The party asks about the missing oil") and press **Give me lines**. Claude writes four lines in that character's voice; **Keep in GM notes** saves the ones you like.

### 5h. Read aloud (free)

**Read aloud** on a session's recap, in the Common Room, and as **Previously on… (read aloud)** in the Lectern. It uses your device's own voices, never reads secret passages, and costs nothing. Pick the voice and speed in **World settings → This device → AI tools**.

### 5i. Spotlight stats (free)

On each session page: how long each person talked (needs a transcript with speaker names) and how often each character came up. Worked out on your device; nothing is sent anywhere.

---

## 6. Which Claude does which job

The app uses two Claude models and picks for you. The button shows which one (hover over the little tag for why).

| Model | Price (US$ per million tokens, in / out) | Used for |
| --- | --- | --- |
| **Claude Opus 5.5**, the most capable | $4 / $20 | Recaps with world updates, contradiction checks, prep |
| **Claude Sonnet 5.5**, quicker and half the price | $2 / $10 | Archivist questions, flavour, NPC lines |

A token is about four letters of English. Big jobs that have to be right (changing your world, spotting contradictions) get Opus; small, quick ones get Sonnet. Both read your world's material once and remember it briefly (Anthropic calls it caching), so follow-up questions only pay for what's new.

If Claude ever declines a job on safety grounds (rare; usually a very dark scene), the app quietly lets Anthropic try a fallback model first, then tells you if it still couldn't. Copy for Claude always works as a backup.

---

## 7. Privacy: where keys, recordings and transcripts go

- **API keys stay on the device you typed them into,** in that browser (or the desktop app), unless you tick **Save my keys to my account**. Then they're also kept with your account in the Warded Atlas cloud, where only your login can read them. Either way they're never in a world, a backup or anything players see, and they're only ever sent to AssemblyAI or Anthropic themselves.
- **Recordings stay on the device that recorded them.** Audio isn't uploaded to the cloud sync. Backups leave audio out unless you tick it.
- **Transcripts and recap drafts sync** to your other devices so you can review them anywhere. They're **GM only**: players never receive them.
- **On-device transcription** never sends audio anywhere.
- **AssemblyAI** receives the audio to transcribe it, then the app deletes its copy (unless you tick **Keep a copy at AssemblyAI**).
- **Claude with your key** goes to Anthropic's API, which doesn't train on API data by default. **Copy for Claude** goes through your claude.ai account under the same settings as your normal chats.
- **What Claude reads includes your secrets** (GM notes, `:::gm` passages), because it's working for you. What comes back is only ever shown to you: the player recap is the only part players see, and only once you use it and reveal the session. World updates follow the usual rules (new pages GM only, session-log lines hidden unless you tick them).

---

## 8. A second computer, a phone, or a co-GM

- **Your other devices:** with **Save my keys to my account** ticked, just sign in and they're there. Otherwise paste the keys again on each one (**World settings → This device → AI tools**). On a phone, the free on-device transcription is very slow; use AssemblyAI or transcribe on the laptop that recorded.
- **A co-GM:** they need their own keys on their own devices (and pay for their own use), or they can use Copy for Claude with their own Claude subscription. Your keys never reach them.
- **Players:** none of the AI features are open to players. They see the player recap you approved and can have it read aloud.

---

## 9. When something goes wrong

| What the app says | What to do |
| --- | --- |
| "Add an AssemblyAI key in World settings first" / "Add an Anthropic API key in World settings first" | The key isn't on this device yet. If you saved your keys to your account, check you're signed in and reopen the app; otherwise see [section 2](#2-assemblyai-cloud-transcripts-with-speaker-names) or [3](#3-claude-the-anthropic-api-key) |
| An error under **Save my keys to my account** | Usually you're offline or the free server is asleep. The keys on this device still work; it saves them when you change a key again or reopen the app online |
| "AssemblyAI didn't accept the API key" | Copy it again from the AssemblyAI dashboard (API Keys) and paste it, with no spaces at either end |
| "Could not reach AssemblyAI" | Check your internet. If it keeps happening with good internet, tell Claude in the project |
| "AssemblyAI couldn't transcribe this recording" | Usually the recording is empty or very short. Play it back first to check there's sound |
| "The transcript is saved here, but AssemblyAI didn't delete its copy" | Nothing is lost. Delete it yourself in the AssemblyAI dashboard if you like |
| "Anthropic didn't accept the API key" | Make a fresh key (Console → API Keys) and paste it in. Keys are shown only once |
| "Your Anthropic account is out of credit" | Console → Plans & Billing → Add funds |
| "You're over your limit for now" | New accounts have low limits. Wait a minute and try again, or use Copy for Claude this once |
| "Anthropic is busy or having trouble right now" | Wait a few minutes and try again |
| "That's more than Claude can read in one go" | Try a smaller job (one page and its neighbours, one recording), or Copy for Claude |
| "Claude ran out of room before it finished" | The answer is cut off. Try a smaller job, or Copy for Claude |
| "Claude declined…" | Rare. Use Copy for Claude, or tidy the transcript and try again |
| "Claude's answer didn't come in the shape the app can read" | Shown as plain text so nothing is lost. Press the button again, or with Copy for Claude make sure you pasted the **whole** reply |
| On-device transcription is very slow | Normal on older computers (about as long as the session). Leave it running, or use AssemblyAI for long sessions |
| A name is wrong everywhere | Fix the speaker name on the transcript, or edit or untick that world update. Anything already added can be undone from the page's **History** |

If Claude is writing and you close the tab or the app, the job stops (and you're only charged for what it wrote so far). Moving to another page inside the app is fine.

---

## 10. For Claude: where it lives in the code

Everything is in `src/ai/`, all client-side: no Supabase edge function and no secrets in Supabase or Cloudflare. The only server part is the opt-in `ai_keys` table (migration `20261029020000_ai_keys.sql`): one row per person, readable and writable only by its owner, removed with the account, and never in `player_view`.

| File | What it does |
| --- | --- |
| `settings.ts`, `AiSettingsSection.tsx` | The device's settings (`localStorage` key `codex.ai`): both keys, Save to my account, Keep a copy at AssemblyAI, on-device model, language, voice |
| `accountKeys.ts` | Save my keys to my account: loads the keys on sign-in, saves changes, clears them on sign-out |
| `claude.ts` | Every Claude call: the two models and their prices (`MODEL`, `QUICK_MODEL`), cost estimates, tool loop, caching, refusal fallback, friendly errors |
| `cloud.ts` | AssemblyAI: upload, start, wait, delete |
| `device.ts`, `whisper.worker.ts` | On-device Whisper |
| `recap.ts`, `RecapPanel.tsx`, `worldUpdates.ts`, `WorldUpdatesReview.tsx` | Recaps and world updates |
| `Archivist.tsx`, `PrepHelper.tsx`, `Flavour.tsx` | The other Claude tools; `ClaudeJob.tsx` is their shared Copy for Claude / one-click panel |
| `jobs.ts`, `LeaveGuard.tsx`, `kept.ts` | Jobs that keep writing while the GM is on another page |
| `ReadAloud.tsx`, `Spotlight.tsx` | The free features |

When a model, price or setup step changes, update this guide, the help tips in `src/help.tsx` (`aiTools`, `keysInAccount`, `claudeJobs`, `transcript`, `keepAtAssembly`) and the AI section of `docs/ROADMAP.md`.
