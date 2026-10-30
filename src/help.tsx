import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'

/**
 * Help tips: a small "?" next to each feature that explains it in a sentence or two.
 * Hover or focus to read on a computer, tap on a phone. Tips can be switched off (and back on in
 * World settings) once you know your way around; the setting is per device.
 */
export const HELP = {
  // Getting around
  overview: 'Home: your world’s cover, the next session with a Run button, what needs you (player questions, character claims, urgent threads), running clocks and what changed lately. “New page” makes a page of any type.',
  modes:
    'The bar across the top splits the world into modes. Home is what needs you now. World is the atlas itself: maps, timeline and every codex page. Prep is getting sessions ready: campaigns, loose threads, handouts and generators. Play is running the table: the Lectern, clocks, sounds and safety tools. The sidebar lists the pages of the mode you’re in.',
  needsYou: 'Things waiting on you: questions your players asked, players asking to claim a character, and urgent loose threads. When it’s empty you’re all caught up.',
  sampleWorld:
    'A small, simple world for a first look: a coast, a town, a handful of people and two drawn maps with pins. Good for learning the basics in a few minutes. Vael Ardith is the full example with a campaign ready to run.',
  exampleWorld:
    'A complete world to explore and learn from: places, people, factions, gods, history, maps (the continent, a region, the town of Cinderford, a battle map and a dungeon), handouts and a campaign ready to run. Open it, look around, borrow ideas, or run it for your group. It lives only on this device unless you switch on sync, and World settings can reset it to new.',
  worldLook: 'Give this world its own cover picture and colour. They show on Home and on the world’s book on your shelf of worlds. Players see them too.',
  theme: 'Candlelit is the dark look, Parchment the light one. “Match this device” follows your phone or computer’s own setting.',
  viewingAs:
    'Switch to Player to preview exactly what your players can see. Anything marked 🔒 GM only, GM notes and secret passages disappear.',
  previewAs:
    'Pick one player to see the world exactly as they do: what’s revealed to everyone, plus pages revealed just to them and :::for passages for their character.',
  codex:
    'The codex holds every page in your world, grouped by type. Pages can sit inside places (a tavern inside a town), and the sidebar opens down to wherever you are.',
  quickAdd: 'Make a new page of any type. It starts as GM only, so nothing is revealed until you choose. You can also press Ctrl+K and type “new npc”.',
  visibility:
    '🔒 GM only means just you. 👁 Revealed means every player can see it. Click to switch. Pins, maps, sessions and files work the same way.',

  // Pages
  entityPage:
    'A page in your codex. Link other pages by typing @ or [[ and the start of a name, then pick from the list (or write [[Their Name]] in full); hover over a link to peek at that page. The sidebar shows the picture, maps it appears on, details and tags; below are the places and people inside it and every page that mentions it.',
  secrets:
    'Hide part of a page with the 🔒 GM-only passage button: players never see it. Use 🤫 Secret for… to keep a passage for certain characters only, like ":::for Wren and Silas". Names are suggested as you type.',
  revealTo:
    'This page is GM only, but you can still let particular players see it. Tick their names and only they get it, marked "Just for you". Needs cloud sync and players who have joined.',
  gmNotes: 'Notes for you alone. They are never sent to players, not even on revealed pages.',
  fields: 'Free-form details like stats, prices or alignment. Add whatever your game needs. Click 👁 to make a detail 🔒 GM only: players never get it, even on a revealed page.',
  hiddenCampaign:
    'A campaign you’re still planning can stay 🔒 GM only: players don’t see it or any of its sessions until you switch it to 👁 players.',
  pictures:
    'Type @ or [[ and the start of a page’s name to link to it: pick it from the list (arrow keys and Enter work too). Put pictures in the text: paste one, drop one in, or use 🖼️ Picture. Players see a picture once the text around it is revealed to them (not inside a secret passage).',
  search: 'Finds pages by name, nickname, summary, details, tags and the words in them, plus sessions and maps. It also does things: type “new npc” to make a page, or “clocks” to go there. Press Ctrl+K (⌘K on a Mac) anywhere to open it. In the player view it only searches what players can read.',
  phoneMenu: 'Open the menu. Its tabs (Home, World, Prep, Play) match the bar at the top on a computer; pick one to see its pages. It closes when you pick a page.',
  news: 'What’s happened since you last looked: new pages, handouts and session recaps, answers to your questions, and what changed on pages you already had (new writing, someone’s fate, a clock that moved). Tap one to read it, and “Got it” when you’re done.',
  backupReminder: 'A reminder to download a backup of this world every two weeks (monthly with cloud sync on). Save the file somewhere safe, like Google Drive or a USB stick. “Later” asks again in a week.',
  aliases:
    'Other names this page goes by, like “the Harbourmaster” for Corvin Vane. A [[link]] to any of them finds this page. Nicknames are for you: players don’t see them. Renaming a page updates every link to it. For a GM-only page, text your players can read keeps the old name (so the new one stays secret), and the old name is added here.',
  gmTags: 'Tags only you see, like “traitor” or “recurring”. Players get the ordinary tags of a revealed page, never these.',
  history:
    'Every time you save a page, the version before is kept on this device (the last 40). Look at an old version or restore it; restoring keeps today’s version too, and who can see the page stays as it is now.',
  recentlyDeleted:
    'Pages, sessions, campaigns, maps, files, corkboards and sounds deleted on this device, or on another device that syncs this world. Restore brings them back as they were. Things other than pages are kept for a month; “Delete forever” or “Empty the bin” frees the space straight away.',
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
  mapBuilder: 'Draw a map from scratch: paint land and water, draw roads, rivers and borders, place mountains, forests and towns, and add labels. It then works like any uploaded map: pins, regions, fog and the player view.',
  newMap:
    'Pick what you are drawing. "World, region or city" is for continents, kingdoms and towns: start with open sea, all land, or a town seen from above. "Dungeon, building or battle map" is on a grid for fights: start with solid rock to dig a dungeon, or with grass, dirt or paving for an outdoor fight. Small, Medium or Large sets how much room you get; you can change your mind later in Map settings.',
  mapScene:
    'A world or region map is seen from the side, the old fantasy-map way: mountains, forests and towns drawn as little pictures. A town map is seen from above, like a bird flying over: paint the ground, draw streets and town walls, and place houses, a castle, a cathedral, docks and fields. A battle map is seen from above on a grid, for fights: paint the ground, add fences and walls, and place trees, rocks, tents and buildings. Dungeons are battle maps too: dig rooms out of the rock with the Rooms tool.',
  cityMap:
    'A town seen from above. Paint grass, dirt, paving or water with Ground, shape the shore with Coast, draw streets and the town wall with Line, then place houses, a castle, churches, docks, farms and more from Place. Every square of the size note is 5 feet, so the pieces come out the right size next to each other.',
  coastBrush:
    'Paint land to push the shore out, or Sea to bring the water in. The coastline draws itself with an inked edge and stippled shallows, and your ground painting stays on the land side.',
  cityLines:
    'Street draws a road with inked edges and a worn middle, and River a band of water; pick how wide each is. A street drawn across a river reads as a bridge. Town wall draws a thick stone wall with battlements and puts towers on the corners and along long stretches; pick the tower or None, and finish near where you started to close the loop. Place a gatehouse on a town wall and it snaps on and opens a gap. Wall towers snap on too, if you want one somewhere else.',
  groundBrush:
    'Paint the ground with a soft brush: grass, dirt for paths, sand, rocky ground, mud, snow, paving stones, a smooth stone floor, wooden boards or water. Where two kinds meet they blend unevenly, like real ground. Water gets an inked bank, ripples and darker deep parts on its own. Paint over anything to change it.',
  rooms:
    'Drag out rooms, round rooms, passages and caves. Anything that overlaps or touches joins up into one space, and the walls draw themselves round the outside. Fill in puts rock back, to trim a room or leave a pillar standing. Rooms snap to the squares unless you untick it; caves come out rough like real rock. Doors are in the Place tool: click near a wall and the door fits itself into it, opens into the room and leaves a gap; pick another version for open, broken or barred doors. Stairs, pillars, pits, altars, coffins and more are in the Dungeon groups. Undo takes back the last one.',
  roomOutside:
    'Solid rock makes a dungeon: everything outside the rooms is rock, hatched like an old hand-drawn dungeon map, and the grid only shows on the floors. The ground is for buildings and ruins on an outdoor map: the rooms get stone walls and the ground carries on outside them. Paint the floors with the Ground tool (smooth floor, paving, wooden boards, water…).',
  birdsEye:
    'Town maps only. From above draws a town plan, every roof seen straight down. Bird’s-eye stands the town up the way old engraved town views do: the plan stays exactly where you drew it, but houses, towers, castles, churches, town walls, trees, wells and market stalls rise up off it, so you see their roofs and the walls that face you. To pick a building with Select, click where it stands on the ground. Pins, regions and fog stay where they were, and you can switch back any time.',
  mapLayers:
    'Each kind of thing sits on its own layer. Untick Show to hide a layer (it also disappears from the picture players get). Tick Lock to stop a layer being picked, moved or erased while you work on something else.',
  landBrush:
    'Paint land with the brush and the coastline draws itself, with ripple lines and stippled shallows. Switch to Water to carve out seas, bays and lakes. Bigger brush for continents, smaller for islands and inlets.',
  mapPieces:
    'Pick a piece and click the map to place it. Type in the search box to find one quickly (tree, tent, boat, church…). Each piece has 8 versions, drawn under Version so you can see them; pick one, or Any for a different one each time (best for ranges and forests). Click and hold to scatter lots at once. Click a placed piece with Select to resize, turn, mirror, swap its version or link it to a page.',
  pieceMix:
    'Tick this, then click several pieces (say trees, bushes and ferns) to put them all on the brush. Every click or scatter picks one of them at random, so a wood comes out mixed instead of all one kind. Click a piece again to take it out. The size slider scales them all together.',
  pieceTurn:
    'Pieces seen from above can be turned to any angle; mountains, towns and other side-on pieces always stand upright. On town maps, houses and other buildings start on "Square to the nearest street": each one turns to face the closest street, river or wall, and scattered ones keep off the road. "Each one at random" is good for crates, barrels and camp gear. With a piece selected, press R to turn it a little, or Shift+R to turn it back. Shadows still fall the same way however a piece is turned.',
  linkedPieces:
    'Link a piece to a page and it works like a pin: click the cottage on the map to read about the cottage. Links start as GM only; click the lock to let players use it. Players never see a link you haven’t shared, a link under the fog, or a page you haven’t revealed. Moving, turning or deleting the piece takes its link along.',
  scatterBrush:
    'Click and hold with Place, then drag, and pieces keep landing inside the dashed circle without piling on top of each other: quick forests, mountain ranges and hills. Trees, mountains and towns stay on land; ships and waves stay at sea. Spread is the size of the circle; How thick sets how close together they sit. Letting go makes it one step, so Undo takes the whole lot back. Erase works the same way: drag across pieces to remove several.',
  gmMarks:
    'Marks only you see, in red like the notes in a published adventure: secret doors (the old "S" on the wall), traps, hidden treasure and danger (ambushes, watchers, monsters). Players get a copy of the map picture without them, so they can’t peek. A secret door snaps onto a wall like a door; select it and press "Players found it" to turn it into a normal door they can see. Tick "Players can see this mark too" on a trap or treasure mark once they know about it.',
  gmOnly:
    'Tick this and the piece, line or label is only on your copy of the map: players get a picture without it. On your copy it has a red dashed line round it so you know. Handy for a cult’s hidden lair on a world map, a secret tunnel, or a label with a note to yourself. A piece linked to a page stays GM only too.',
  secretRooms:
    'Rooms and passages dug with this ticked are only on your copy, washed in red; players see solid rock (or plain ground) there, and the pieces, labels and lines inside them are left off their copy too (a piece there that’s linked to a page becomes GM only). Put a secret door from the "GM only" pieces where a secret passage meets a room. When the players find the door, select it and press "Players found it": the door and the secret rooms behind it show up on their copy.',
  playersCopy:
    'Shows the map as players get it, without the secret doors, traps, secret rooms and anything ticked GM only. Untick to go back to your own copy. Players never receive your copy, only theirs (with the fog of war on top, if it’s on).',
  exportMap:
    'Download the map as a picture (PNG) to print, share or use anywhere. Pick a size: on battle maps that is pixels to a square, since virtual tabletops count that way (Roll20 uses 70, Foundry 100); bigger is sharper for printing but makes a bigger file. Tick Show the grid to draw the squares on. Battle maps and dungeons can also go out as a Universal VTT file (.dd2vtt): the picture with its walls, doors and lights already in it. In Foundry, open it with the Universal Battlemap Importer module; in Roll20 (Pro), use the UniversalVTTImporter script, which wants the PNG at the same size too. Fantasy Grounds and others read it as well. Room walls, Wall, Inner wall and Hedge lines become walls, doors leave a door in them, portcullises and iron gates become see-through bars, pillars and buildings block sight, and lit torches, braziers and campfires give light. If the map has fog of war, the tabletop file and the plain picture leave it out (tabletops add their own); you can also download the fogged picture exactly as players see it now.',
  curvedLabels:
    'Click to place a label, or drag a line on the map and the words will follow it, like a river name or a mountain range. Region lettering is spaced capitals, place names are italic, Title is for the map name.',

  // Story
  timeline: 'Events in order: the history before your campaign, and what has happened during it. Filter by place to see one area’s story.',
  ages: 'Split your history into named ages, like “The Age of Kings” or “The Long Peace”. Each age gets its own section on the timeline, in order, and each event can belong to one. Players see the ages of any events you have revealed.',
  threads:
    'Every hook, mystery, promise and grudge you’ve left dangling. Move them from dangling to in play to tied off. A thread that hasn’t moved in three sessions gets flagged so nothing is forgotten.',
  leads: 'The rumours, hooks and mysteries your GM has shared with the party.',
  calendar:
    'Your world’s own calendar: month and day names, the year’s name (like DR) moons, leap years, festivals and holidays. Pick a ready-made one (Forgotten Realms, Golarion, Eberron, Greyhawk, Exandria) or make your own. Events can then have real dates.',
  worldToday: 'Today’s date in your world. Move it on as time passes in the game; each session remembers the date it started on.',
  relations:
    'How this page connects to others: family, friends, enemies, who serves whom. Players only see a link when you tick “Players know”. Every link shows up on both pages.',
  relationWeb:
    'Everyone and how they’re connected, drawn as a web. Drag people about, click one to focus on them, or switch to the family tree. In a big world it starts with just people, factions and gods; switch to every kind of page to see places and items too. Add links from any page’s Relationships box.',
  clocks:
    'A progress clock is a circle cut into slices. Fill a slice when a villain’s plan moves on, a rival gets closer or danger grows; when it’s full, it happens. Players only see clocks you mark “Players know”.',
  safety:
    'Agree what’s off limits before you play. Lines never happen in the game; veils can happen, but off screen. Everyone in the world can read this page.',
  xcard:
    'Tap the X-card if something in the game isn’t OK for you. Your GM is told without your name: straight away if their app is open, or as soon as they next open it. They move the story on, and no one asks why.',
  campaign: 'A campaign is one story in your world, with its sessions, party and active quests. A world can hold several.',

  // Sessions
  session:
    'One game night. Keep 🔒 GM notes for yourself and a 👁 player recap for the table. Record the session, then turn the recording into a transcript and a recap.',
  recording:
    'Record from one microphone for games at the table, or the microphone plus your Discord or Zoom audio for online games. Add bookmarks while you play to jump back to big moments. Recording carries on while you use the rest of the app (the Lectern, maps, pages), and is saved every few seconds, so if the app closes by accident you can recover it here. Always get everyone’s OK before recording. Recordings are big, so they stay on the device that made them; their transcripts sync to your other devices.',
  transcript:
    'Turns a recording into text. "On this device" is free and private but slower, with no speaker names. "Cloud" uses AssemblyAI with your own key, is faster and tells speakers apart; once the transcript is saved here it’s deleted from AssemblyAI. Name the speakers once and “Same as last time” fills the names in for the next session.',
  recap:
    'Claude drafts a GM summary, a player recap and updates for your pages from the transcript. "Copy for Claude" works with a Claude subscription for free; "Write it now" uses your own API key. You review both before saving.',
  worldUpdates:
    'Claude compares the session with your pages and suggests what to change: new NPCs, places and shops that came up, quests moving on, new relationships, timeline events, deaths and captures, loot changing hands and loose threads. Tick the ones you want and add them in one go. New pages start GM only, and lines on existing pages go in a “Session log” at the bottom of the page. Every change is listed in the Chronicle and can be undone from the page’s history.',
  chronicle:
    'Every change made to your world from a session, newest first: pages made, lines added, quests and fates that changed. Click a line to open the page. Only you see it.',
  heardIn:
    'Where this page’s name (or a nickname) was said out loud in a session’s transcript. Click a time to open the session and play that moment, if the recording is on this device.',
  sessionMentions: 'Sessions whose notes or recap link to this page.',
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
    'Put a picture, a page or some text on every player’s screen right now, like handing round a letter or showing a monster. It pops up for players who joined; open the Players’ screen on a TV or second monitor for the table. Pick a page that isn’t revealed yet and it’s revealed as you show it. A map’s picture always goes out as the players’ copy, never yours with the secrets or the fog lifted. Everything you show is kept in Handouts.',
  handouts: 'Everything you’ve shown players, newest first. Players can open a letter or picture again any time after you stop showing it. Remove a picture or text to take it back. A page you remove stays revealed unless you choose to hide it again.',
  handoutsReady: 'Handouts you’ve prepared but not shown yet: any GM-only page tagged “handout”. Players can’t see them. “Reveal and show” reveals the page to everyone and puts it on their screens, and it moves to Shown so far.',
  playersScreen: 'A clean screen for a TV or second monitor at the table. It shows whatever you’re showing players, and nothing else.',
  initiative: 'Add everyone in the fight, roll or type initiative, then step through turns. Track HP and conditions as you go. In the ± box, type +5 to heal or -5 to damage; a plain number follows the button you press, and Undo puts HP back. “Something else…” in the condition list lets you type your own. With a keyboard, N moves to the next turn (press ? for all the shortcuts).',
  dice: 'Roll any dice. Type things like 2d6+3 or 4d6kh3 (keep the highest three), or tap a quick die.',
  quickNote: 'Jot something down mid-session. It is added to this session’s GM notes with the time.',
  randomTables:
    'Your own tables to roll on: one entry per line. "3x Goblins" makes an entry three times as likely, {2d6} rolls dice inside an entry, and {Weather} rolls on your table called Weather.',
  improvise: 'Need a name or a tavern right now? Roll one here and save it into your world if it sticks.',

  // Tools
  boards:
    'A corkboard for mysteries, plots and politics. Pin pages and note cards, drag them about, and tie string between them with 🧶. Click a string to label or cut it. GM only.',
  generators: 'Roll up taverns, shops and NPCs without any AI, or roll on your own random tables. Save the ones you like; they start as GM only.',
  atTheTable: 'Things you reach for while you play: threads, clocks, loot, handouts, sounds, safety tools and your players.',
  prepTools: 'Things for planning between sessions: generators and tables, corkboards, the relationship web and your files.',
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
  moving:
    'The web app moved from braydenm32.github.io to its own address. Your browser keeps each address’s saved worlds apart, so “Move my worlds” copies everything saved here (worlds, files, recordings, page history and this device’s settings) to the new address. Nothing here is deleted. Afterwards the old address just sends you to the new one, and old invite and share links keep working.',
  deleteAccount:
    'Removes your account and everything stored with it in the cloud: worlds you own, their files and links, and your notes and characters in other people’s worlds. Worlds on this device are kept, so you can still use them without an account.',
  socialLogin:
    'Sign in with your Google or Facebook account instead of a password. If you already made an account with the same email, you’ll land in that same account. Not available in the desktop app yet, so use email there.',
  shareLink: 'A public, read-only wiki of everything you’ve revealed to the whole table. No account needed, so it suits people outside your group. GM-only things are removed before anything is sent. Players should join with the invite link instead.',
  wiki: 'A read-only wiki of this world, shared by its GM. It shows only what the GM has revealed to everyone, and updates as they add to it.',
  players:
    'Invite your players with a link. They sign in, join, claim their character and keep notes. They only ever receive what you’ve revealed to them.',
  playerNotes:
    '"My notes" are private to you. "Group notes" are shared with the whole party, and your GM can read them. Both save when you click away. If someone else changed the group notes while you were typing, nothing is lost: you choose to keep both, yours or theirs.',
  scratchpad: 'A notebook for anything that isn’t about one page: plans, names, clues. Keep your own notes or write in the party’s shared one.',
  gmPlayerNotes: 'What your players have written together. Only they can edit it, and their private notes stay private.',
  coGM:
    'A co-GM sees and edits everything in this world, secrets included, from their own account. Only you can invite or remove co-GMs, manage players and links, or delete the cloud copy.',
  schedule:
    'Suggest a few dates for the next session. Players who joined mark each one yes, maybe or no, and you book the one that works. Booking makes the session with that date and shows it to players. Times show in each person’s own time zone.',
  nextSession: 'Each campaign’s coming session, with its prep and the Lectern one click away, and how many scenes and clues are ready.',
  endSession:
    'Wrap up after play: transcribe the recording, write the recap with Claude, show the session to players and move the world’s date on. “Start next session” carries over the clues they didn’t find, the scenes they didn’t reach, and where the party is.',
  partyCampaign: 'When a world has more than one group, pick which campaign this character plays in. The campaign page and the Lectern’s “Add the party” then only show that group.',
  trackAsThread: 'Quests are what the players know they’re doing. A loose thread is your own tracker for it: how pressing it is, and a warning when it goes cold.',
  claimRequests: 'A player asked to play one of your characters. Approve it and they can edit that character’s sheet and read passages written for them.',
  gettingStarted: 'A few first steps for a new world. It goes away once you’ve made a campaign and a few pages.',
  home: 'Each world is kept on this device. Sign in to sync your worlds across devices, invite players, or open worlds you play in.',
  joining: 'An invite link from your GM lets you join their world as a player. Paste it here if it opened somewhere else, sign in, and you’re in.',
  questions:
    'Ask your GM something privately: about a page, or anything at all. Only your GM sees your question, and only you see the answer.',
  questionsGm:
    'Questions your players sent you, privately. Your answer goes only to the player who asked. If they asked about a hidden page, you can reveal it to just them from here.',
  editCharacter:
    'Keep your character’s details up to date: the one-line summary, stats and anything you want to write about them. Your GM sees your changes and can change them back.',
  character: 'Who plays this character. Players ask to play their character from here, and you approve it (here or in World settings) before it counts, so nobody can take someone else’s character or their secrets. You can release a claim later.',
  commonRoom:
    'Your seat at the table: what the GM is showing, your character, the party, leads, notes and last time’s recap. While your GM runs the session you also see the scene, whose turn it is and the music, roll dice everyone sees, and can quietly ask for a turn or a break.',
  tableLink:
    'Once you go live with this session, players’ Common Room shows which session is on, the scene (only if its page is revealed), the music, your timers and the turn order once combat starts. HP, conditions and your notes never go, and anyone from a page players haven’t seen shows as “Enemy 1” or “Ally 2”. Their rolls and signals (“I’d like to do something”, “I need a break”) come to you here and pop up wherever you are in the app.',
  inspiration:
    'Inspiration or hero points: tap + to hand one out. Players see how many they have in their Common Room and on their character page, and can ask to use one; you’ll get a pop-up with “Use it”.',
  newCharacter:
    'Write up the character you’d like to play and send it to your GM. They can approve it (it becomes your character, ready to play) or get back to you with a note.',
  newCharacterGm:
    'A player wrote up a character they’d like to play. Approve it and the app makes a player character page from it, revealed and already theirs. Or turn it down with a note saying why.',
  gmReply: 'Add a line to your players’ shared notes, signed “GM”: a nudge, a reminder of something they saw, an answer to a question they wrote down. They see it next time they look.',
  leapYears:
    'Every so many years, chosen months get extra days: February’s 29th, or a festival that only happens in leap years (give it 0 days and 1 leap day, like Shieldmeet). Tick “festival” for days between months, like Midwinter: their dates read “Midwinter” or “3rd day of Needfest”. To line a moon up with a published calendar, set a date it was full.',
  timers:
    'Countdowns for the table: a fuse burning, a ritual finishing, a time limit on a puzzle. Tap a length to start one (name it first if you like). It beeps when it runs out. Players see your timers in their Common Room unless you hide one with the eye.',
  tableDice: 'Rolls here show up for the whole table: the other players and your GM see who rolled what.',
  tableSignals:
    'A quiet word to your GM without interrupting: they get a pop-up with your character’s name, and you see when they’ve noticed. For something you’d rather not say out loud, use the X-card instead.',
  aiTools: 'Keys for transcription, recaps and the Claude tools, and the voice for reading recaps aloud. They stay on this device and are never in worlds or backups, unless you save the keys to your account.',
  archivist:
    'Claude, reading your own world. Ask it anything (“who would want the party dead?”) and it looks up the pages it needs, then answers with links, saying when something is secret. Or have it check your notes for contradictions. Uses your Anthropic API key, or “Copy for Claude” for free with a Claude subscription.',
  continuity:
    'Claude reads your pages and sessions and lists where they disagree: someone dead on one page and alive on another, dates that don’t add up, names spelled two ways. Each comes with a suggested fix. Tick “Done” once you’ve dealt with one. Checking the whole world reads everything, so it costs more than checking one page and its neighbours.',
  prepHelper:
    'Claude reads the last two sessions, the party, open threads and running clocks, and suggests a strong start, likely scenes, secrets and clues, and who to have ready. Untick what you don’t want; the rest goes onto your prep sheet, and the people to have ready are linked to the session so they’re at hand in the Lectern.',
  flavour:
    'Claude dresses up what you rolled so it fits your world: a short read-aloud description, rumours tied to people and places you already have, and one secret (kept GM only when you save).',
  npcLines:
    'Say what’s happening and Claude writes four lines this character might say, in their voice, using what their page says about them. Keep the ones you like in your GM notes.',
  spotlight:
    'Who got time at the table. With a transcript that tells speakers apart, it shows how long each person talked; it also counts how often each character came up (in the transcript, or in your notes and recap without one). Worked out on this device; nothing is sent anywhere.',
  readAloud: 'Reads recaps aloud with your device’s own voices: free, private, and secret passages are never read, not even ones meant only for you (the whole table would hear them). Pick a voice and speed here.',
  newCharacterName:
    'Secret passages written “for” a character reach whoever plays a character with that full name or first name. If the new character shares a name with another, those secrets would reach both players, so give one of them a different name.',
  revealQuietly:
    'Reveal quietly lets players read the page the next time they look, without putting it on their screens. Reveal and show does both. Hide from players makes it GM only again (and takes it off their screens if it is showing). GM notes and secret passages stay hidden either way.',
  pageDrafts:
    'While you edit a page, what you type is also kept on this device. If you leave by mistake, the next time you edit the page it offers to bring your changes back. Saving only writes what you changed, so edits made meanwhile by a co-GM or a player are kept.',
  pagePicker: 'Start typing a name to find a page, then click it or press Enter. The ones in the current scene are listed first.',
  goLive:
    'Opening the Lectern doesn’t show players anything. Press “Go live to players” when you start playing: their Common Room then shows this session as being played, with the scene, music, timers and turn order. A “Live” badge stays at the top of every screen until you press Stop or end the session.',
  fightBar: 'On a phone, this bar stays at the top while a fight is on. Tap the name to jump to them in the initiative list.',
  lecternKeys:
    'With a keyboard: N or → for the next turn, B or ← to go back, D to roll a d20, and ? for this list. They don’t work while you’re typing in a box.',
  pinNames:
    'Keeps the names of pins and regions showing on the map instead of only when you hover. They appear once you zoom in a little, so a zoomed-out map isn’t covered in labels. Each map remembers its own setting on this device. Players only get names for the pins they can see. On a phone, tap a pin once to see its name and again to open it.',
  fogRoom:
    'Click inside a room to uncover just that room, right up to its walls. It stops at walls drawn across the room and at doors, gates and bars, so click in the next room to open that one too. Secret rooms are left alone until you mark their door as found. With Cover chosen, it covers the room again. Only on maps with rooms drawn in the map builder.',
  keysInAccount:
    'Keeps your AssemblyAI and Anthropic keys in your Warded Atlas account, so any device you sign in on gets them without pasting. Only you can read them: they never go into worlds, backups, share links or anything players or co-GMs receive. A key you change or remove here reaches your other devices the next time they open the app. Signing out takes the keys off that device. Untick to take them out of your account. Tip: keep a monthly spending limit in the Anthropic Console, since anyone who gets into your account could use them.',
  keepAtAssembly:
    'Once a cloud transcript is saved in your world, the app deletes it from AssemblyAI, so your table’s talk isn’t kept by another company. Tick this to leave a copy in your AssemblyAI account instead (for example, to look at it on their website). Applies on this device only.',
  claudeJobs:
    'Claude keeps writing when you go to another page: a note at the top says “Claude is writing…”, then “Claude finished”, and takes you back to it. If you leave the page while it writes, you choose to keep it writing or stop it. Closing the tab or the app stops it. Small jobs (flavour, NPC lines, Archivist questions) use Claude Sonnet 5.5, quicker and half the price; recaps, contradiction checks and prep use Claude Opus 5.5.',
  secretNames:
    'Players can read this text, and it links to a GM-only page, so they would see that page’s name. Move the link into a :::gm secret, give it a label like [[Lord Vexis|the stranger]], or reveal the page. This is only a warning; nothing is blocked.',
  backupRecordings:
    'Recordings can be very large. Leave this unticked for a small backup that has everything except the audio; transcripts, bookmarks and the rest of each session are kept. Tick it to keep the audio too.',
  lecternSearch:
    'Type to find a panel (“initiative”, “dice”, “music”) or a page by name. Only the matching panels show, opened, and matching pages appear above them with their GM notes and buttons to add them to the scene. Click a panel’s title to fold it away; this device remembers which you folded. “Fold all” leaves just the titles.',
  wantedPages:
    'Names you’ve written as [[links]] in pages or sessions that no page answers to yet, most mentioned first. Pick one and choose a type to make its page (it starts as GM only). You can also click a grey dashed link anywhere to make its page.',
  partyGlance:
    'Every character in one table, with the details you choose as columns: AC, Passive Perception, Languages, Darkvision, anything from their pages. Choose columns once and they show here and at the Lectern. Only you see this table.',
  gmScreen:
    'Your own GM screen. Pin pages you look up every session (house rules, a monster, a random table) to read them here, save rolls you make again and again (“Goblin attack d20+4”) as buttons, and ask the Archivist a question without leaving the Lectern. Only you see it.',
  names:
    'Names for people, places, taverns and ships, in eight styles (Common, Elvish, Dwarvish, Orcish, Halfling, Northern, Southern, Infernal). “Like my world’s names” learns from the names already in your world (your NPCs for people, your locations for places) and makes up new ones that sound the same. Press More for another batch.',
  treasure:
    'Roll a pile of treasure, from pocket change to a dragon’s hoard: coins, gems, art and odd things, sometimes something magical. “Give to the party” puts the coins in the party’s purse and the rest in the party stash, where players can see it. Gem and art values are in gold pieces; change anything afterwards on Party loot.',
  starterTables:
    'Ready-made random tables (rumours, plot hooks, road and wilderness encounters, dungeon dressing, trinkets, NPC quirks, town events) to get you rolling. They start as GM only, and you can change, add or remove any line.',
  objectives:
    'The steps to finish this quest. Players see the ones with an open eye and can follow the ticks as you make them. A step with a closed eye stays yours alone (a hidden goal, a twist) until you click the eye to tell them.',
  rewards:
    'What finishing the quest is worth. A reward stays hidden from players until you click its eye. “Give to the party” puts any coins in its text (like “200 gp”) into the party’s purse and its item into the party stash, and shows it to players.',
  downtime:
    'Tell your GM what your character does between sessions: training, research, crafting, visiting someone, working a job. Only your GM sees it, and their answer appears here, for you alone.',
  downtimeGm:
    'What your players’ characters are doing between sessions. Answer each one (only that player sees your answer) and it moves to Answered. Players send these from their character tab in the Common Room.',
  callForRoll:
    'Ask the table for a roll. Type a line like “@all roll perception 15” (everyone rolls Perception, DC 15), “@Wren @Silas stealth dc 12 secret” or “@all d20+2 strength”, or fill in the boxes. While you’re live, the players asked get a Roll button with their bonus filled in from their character’s details, and their results land here, marked pass or fail. Roll for anyone who isn’t online. “Secret” keeps results from the other players; “Tell them the DC” shows it. Press Done to clear it.',
  sceneCards:
    'Give a planned scene everything it needs: where it happens, read-aloud text, who’s there, sounds to play, one of this session’s fights, a picture or page to show players, and GM-only pages to reveal. At the Lectern, ▶ Start on the scene does it all at once and ticks it as played (it asks before revealing anything).',
  lecternNotes:
    'This session’s GM notes, the same ones as on the session page. Add a line with the time from the box (it goes at the end), or press Edit to change them.',
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
