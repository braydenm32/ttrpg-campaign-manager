import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'

/**
 * Help tips: a small "?" next to each feature that explains it in a sentence or two.
 * Hover or focus to read on a computer, tap on a phone. Tips can be switched off (and back on in
 * World settings) once you know your way around; the setting is per device.
 */
export const HELP = {
  // Getting around
  overview: 'Your Desk: the session in hand with the one button for what comes next, everything waiting on you before it, ticking clocks, the party, the sessions coming up and what changed lately. “New page” makes a page of any type.',
  areas:
    'The world is split into areas, down the side on a computer and along the bottom on a phone. Desk is what needs you now. Session is the session in hand: prepare it, play it (the Lectern) and wrap it up. Atlas is the world itself (maps, places, people), Story is what’s moving (threads, quests, clocks, timeline), and More has the tools you need now and then. The tabs along the top belong to the area you’re in, and each area remembers where you were. Players get the Common Room and The World instead. On a phone the top bar slides out of the way while you scroll down a page and comes back as soon as you scroll up.',
  more: 'Things used now and then, in one place: what you reach for at the table (handouts, sounds, table rules, the players’ screen for a TV), the workshop (generators and tables, files, the Archivist, templates) and keeping the world (settings, backups, importing, Recently deleted). The numbers say how many there are (and how much space files take). Search (Ctrl+K) finds every one of them by name too.',
  settings:
    'Everything about this world in four tabs: the world itself (name, cover, calendar, your own page types, templates), players and sharing (sync, invite links, the wiki link, co-GMs), this device (look, help tips, Discord, AI keys) and data (backups, importing, recently deleted). Each tab is a step in Back.',
  everything:
    'Every kind of page in this world with how many there are, your own kinds included. Maps, places (shops and taverns too), people, factions and lore (deities too) have tabs of their own; items, events and your own kinds are only here.',
  needsYou: 'Everything waiting on you before the next session, each with one button: what players sent (questions, downtime, claims, new characters, the same as the Inbox), a session with no date or no plan yet, a recap for the session you just played, a session whose date went by without being played (“Did you play it?”), a backup that’s due and characters nobody plays yet. Under “Keep in mind” come reminders that aren’t counted in the red number: a few pressing threads and pages you’ve linked but not written. When nothing is waiting you’re all caught up.',
  sampleWorld:
    'A small, simple world for a first look: a coast, a town, a handful of people and two drawn maps with pins. Good for learning the basics in a few minutes. It has no tour: Vael Ardith is the full example, with a campaign ready to run and a Start here tour.',
  exampleWorld:
    'A complete world to explore and learn from: places, people, factions, gods, history, maps (the continent, a region, the town of Cinderford, a battle map and a dungeon), handouts and a campaign ready to run. Open it, look around, borrow ideas, or run it for your group. It lives only on this device unless you switch on sync, and World settings can reset it to new.',
  worldLook: 'Give this world its own cover picture and colour. They show on the Desk and on the world’s book in Your worlds. Players see them too.',
  theme: 'Candlelit is the dark look, Parchment the light one. “Match this device” follows your phone or computer’s own setting.',
  viewingAs:
    'Switch to Player to preview exactly what your players can see. Anything marked 🔒 GM only, GM notes and GM-only passages disappear.',
  previewAs:
    'Pick one player to see the world exactly as they do: what’s revealed to everyone, plus pages revealed just to them and passages written for their character. Without invited players you can still pick a character, to check their passages and their Common Room.',
  people:
    'The people of this world. NPCs and player characters are two kinds of person: the switch at the top goes between them (and to factions, in the player view).',
  places:
    'The places of this world, from regions down to single rooms. Shops (taverns too) are a second kind of place: the switch at the top goes between them. Places sit inside places, so a tavern can be in a town, in a region.',
  lore: 'History, legends and beliefs of this world, with the gods (deities) as a second kind: the switch at the top goes between them.',
  codex:
    'Every page in your world, grouped by type. Places (with shops and taverns), People, Factions and Lore (with deities) have tabs of their own in the Atlas, and this list shows every type with how many pages it has. Pages of no particular type are under Other pages. Pages can sit inside places (a tavern inside a town), and any page can be part of a page of its own kind (a faction under a faction); a list with pages under others shows them as a tree you can fold.',
  partOf:
    'A page can be part of another page of its own kind: a smaller faction under a bigger one, a chapter of lore under its subject, a quest’s side quests under it, an item under a set. Pick it in Edit, under “Part of” (places use “Inside” the same way). It then sits where that page is, its trail at the top shows the way up, and its list shows it folded under it. A page can’t go under one of its own pages. Delete a page, or change its kind, and the pages under it move up a level (Undo puts them back). Players see the nesting only between pages they can see.',
  questList: 'Quests are grouped by where they stand: Active (the party is on it now), Open (waiting to be taken up) and Done (finished or failed). Change a quest’s status on its page with Edit.',
  quickAdd: 'Make a new page of any type. It starts as GM only, so nothing is revealed until you choose. You can also press Ctrl+K and type “new npc”.',
  visibility:
    '🔒 GM only means just you. 👁 Players can see this means every player can see it. Click to switch. Pins, maps and sessions work the same way. A file goes wherever what uses it goes (Files says which).',

  // Pages
  entityPage:
    'A page in your world. Link other pages by typing @ or [[ and the start of a name, then pick from the list (or write [[Their Name]] in full); hover over a link to peek at that page. The sidebar shows the picture, maps it appears on, details and tags; below are the places and people inside it, the pages under it (a faction’s smaller factions) and every page that mentions it.',
  secrets:
    'Hide part of a page with the “GM-only passage” button: players never see it. “Secret for…” keeps a passage for certain characters only: pick their names and it is marked for you (written as “:::for Wren and Silas” on a line of its own, closed with “:::”). Names are suggested as you type.',
  revealTo:
    'This page is GM only, but you can still let particular players see it. Tick their names and only they get it, marked "Revealed to you". Needs cloud sync and players who have joined.',
  gmNotes: 'Notes for you alone. They are never sent to players, not even on revealed pages.',
  formattedEditor:
    'Formatted: write the text as it will look. The buttons make headings, bold, italic, lists, quotes, web links, tables and a line across the page, and add page links and pictures; Ctrl+B, Ctrl+I, Ctrl+K and Ctrl+Z work too (⌘ on a Mac). A GM-only passage is a marked box you type in; “Reveal to players” on the box takes the box away and keeps the words, for players to read for good. Text pasted from a web page or Word keeps its headings, bold and lists and drops the rest. Markdown: the plain text box, for anyone who prefers it; both edit the same text, so switching loses nothing, and your choice is remembered on this device. A dashed box marked “Kept as typed” is Markdown the formatted view can’t show, kept exactly as it is. As players see it: the text as players will get it, without the GM-only passages.',
  fields: 'Free-form details like stats, prices or alignment. Add whatever your game needs. Click the eye to make a detail 🔒 GM only: players never get it, even on a revealed page.',
  campaignStatus:
    'What a campaign’s status does. Planning: not played yet; it becomes Active by itself when you start or play its first session. Active: being played; its next session is on the Desk, and comes first if two campaigns are level. Paused: off the Desk, the Session area, “Needs you” and the players’ “next session”, until you press Carry on (on the Desk, the Session area or the campaign); starting one of its sessions carries it on too. Finished: off them as well, until you press Back on the Desk on the campaign; its sessions and recaps stay under All sessions and the Timeline. A session that is still being played stays on the Desk until you wrap it up, whatever the status.',
  gameSystem:
    'Which game you’re playing. Each campaign has its own; the world’s default game system is used where no campaign says. The one rule: the game of the campaign on the Desk (the next session’s), else the world’s. Look it up opens on that game, reading a pasted character sheet assumes it, and Claude is told it. A character who plays in one campaign goes by that campaign’s game, and so does a player.',
  hiddenCampaign:
    'A campaign you’re still planning can stay 🔒 GM only: players don’t see it or any of its sessions until you switch it to 👁 Players can see this.',
  pictures:
    'Type @ or [[ and the start of a page’s name to link to it: pick it from the list (arrow keys and Enter work too). Put pictures in the text: paste one, drop one in, or use 🖼️ Picture. Players see a picture once the text around it is revealed to them (not inside a GM-only passage).',
  search: 'Finds pages by name, nickname, summary, details, tags and the words in them, plus sessions and maps. Several words find pages that have all of them, in any order (“mercy fort” finds Fort Mercy), and each result says what kind of page it is. It also does things: type “new npc” to make a page, or “clocks” to go there. Places come first, and the tools inside a screen are there too: “initiative”, “dice” or “timer” open that panel of the Lectern, “fog” the maps, “calendar” World settings. Press Ctrl+K (⌘K on a Mac) anywhere to open it. In the player view it only searches what players can read.',
  news: 'What’s happened since you last looked: new pages, handouts and session recaps, answers to your questions, and what changed on pages you already had (new writing, someone’s fate, a clock that moved). Tap one to read it, and “Got it” when you’re done.',
  backupReminder: 'A reminder to download a backup of this world every two weeks (monthly with cloud sync on). Save the file somewhere safe, like Google Drive or a USB stick. “Later” asks again in a week.',
  aliases:
    'Other names this page goes by, like “the Harbourmaster” for Corvin Vane. A [[link]] to any of them finds this page. Nicknames are for you: players don’t see them. Renaming a page updates every link to it. For a GM-only page, text your players can read keeps the old name (so the new one stays secret), and the old name is added here.',
  gmTags: 'GM-only tags, like “traitor” or “recurring”. Players get the ordinary tags of a revealed page, never these.',
  history:
    'Every time you save a page, the version before is kept on this device (the last 40). Look at an old version or restore it; restoring keeps today’s version too, and who can see the page stays as it is now.',
  recentlyDeleted:
    'Pages, sessions, campaigns, maps, map pins, files, corkboards and sounds deleted on this device, or on another device that syncs this world. Each asks first, except a map pin, which goes at once. Pages, sessions, campaigns, maps, pins and files leave an Undo note too; after that, Restore here brings anything back as it was: a page with the places inside it and the pages under it, what it carried and its map pins; a session or campaign with its notes, recaps and recordings; a map with its pins; a pin on the same spot of its map (restore the map first if that went too). A whole world, or its cloud copy, never comes here: those ask you to type the world’s name, and only a backup brings them back. When two devices change the same session, corkboard or world setting at once, this device’s version is kept and the other one waits here, marked “changed on another device”. Things other than pages are kept for a month; “Delete forever” or “Delete all for good” frees the space straight away.',
  oneShot:
    'Run this world again and again, for one table after another. Making it a one-shot saves the world as it is now as its starting point; after a game, “Reset for the next table” puts everything back the way it was: reveals, fog of war, clocks, the in-game time, handouts, who’s alive, loot, quests and the sessions. Changed your prep? “Update starting point”. The starting point is kept on this device only; on another device, save one there before anyone plays, or use a backup downloaded from this world.',
  oneShotReset:
    'Before anything changes, this lists the pages that changed since the starting point. Tick any fix to your prep you want to keep: it stays as it is now and becomes part of the starting point. A short record of the run (date, who played, recap and notes) goes on the GM-only “Past runs” page, which resets never touch. With players online you can also remove them (the next group joins with the same invite link), free up the characters they claimed and clear their group notes. What the reset replaces stays in Recently deleted for a month.',
  templates:
    'A template is a starting point for new pages, like a "Dungeon room" with the headings and details you always fill in. Templates are always GM only and never appear in lists. Make one with "Save as template" on any page.',
  lifeStatus:
    'Mark a character alive, dead, missing or captured. It shows in lists, on map pins and at the Lectern. Players only see it if you tick “Players know”.',
  print: 'A clean copy to print or save as a PDF (choose "Save as PDF" in the print window). The player copy leaves out secrets, GM notes and anything not revealed.',
  customTypes: 'Add your own kinds of page, such as Ships, Spells or Gods of the Deep. Each gets its own section in Everything.',

  // Maps
  maps: 'Upload a map image or draw one in the map builder. Then drop pins and draw regions, and link them to pages so clicking them shows what is there.',
  mapView:
    'Click a pin or region to see what is there. "Enter" opens a more detailed map, such as a town inside a region. As GM, use the toolbar to add pins and regions. Clicking a pin shows its page first (Open page); “Edit pin” changes its name, colour, page, category or note.',
  liveMap:
    '“Show players” puts this map on every player’s screen as they may see it: the fog stays on, and GM-only pins, pieces and labels are left out. It is their copy of the picture, never yours. While it is up it stays live: clear or put back fog, or reveal a pin, and their phones and the Players’ screen (a TV) follow within a second or two, without pressing Show again. The TV keeps the whole map in view; on a phone each player can drag and pinch their own view. “Stop showing” at the top takes it down, and Undo puts it back. A map players can’t see goes out under a name you choose, as a picture only, with no pins. A player who opens the app late gets the map as it stands now. If you use two devices, the one where you pressed “Show players” or last changed the fog is the one that keeps it live.',
  printMap:
    'Print the map, or save it as a PDF. The GM copy is your own picture and, if the map has numbers, every numbered pin and the whole key. The player copy is what players may see: the fog stays on, and GM-only pins, pieces and key entries are left out. A map that is GM only prints as its picture alone, without its name.',
  fog:
    'Hide the map from players and uncover it as they explore. Uncover a circle (its outline follows the pointer at the size you set; drag to uncover a trail), a box or any shape; switch to Cover to hide a part again. Undo takes back the last one (a whole room or trail at once) and Redo puts it back. Players get a copy of the picture with the fog painted on, so covered areas and the pins in them can’t be peeked at. While the map is on players’ screens (“Show players”), what you uncover or cover shows there at once.',
  signOut: 'Signing out stops cloud sync on this device; your own worlds stay here. If you joined worlds as a player, it asks whether to remove their copies from this device too. You stay in those worlds: sign in again and Your worlds lists them to open. On a shared or borrowed computer, choose “Sign out and remove all worlds and keys from this device” instead: it saves your latest changes to your account first, says what goes (a world that’s only on this device is gone for good, and so are recordings made here), then removes everything the app keeps on this device, AI keys included.',
  syncProblem: 'Cloud sync stopped, or finished with something to tell you (a file that didn’t upload, say). Nothing is lost: your changes stay on this device and go up once sync works again. “Try again” syncs now; if it keeps failing, check you’re online and signed in (World settings › Players and sharing).',
  deviceStorage: 'How much room this app’s worlds, pictures, recordings and Recently deleted take in this browser, and whether the browser has promised to keep them. Without that promise a browser may clear the data when the device runs short of space (Safari on an iPhone can after a week unused), so keep a backup. Installing the app to your home screen usually earns the promise.',
  unusedFiles: 'Files no page, map, handout, sound or session uses (as a picture, in its text, or as a recording). Handy for tidying up: deleted files go to Recently deleted for a month. Each file also says what uses it.',
  stock: 'Items a shop sells (or that are kept at this place): set an item’s “Carried by, or sold at” to the shop. The price is the item’s Price detail; players see it when the item is revealed to them. “Sold to the party” moves one into the party stash, reveals it, and takes the price from the purse (Undo puts both back).',
  scenePin: 'Where this scene happens on a map. Tapping that pin on the map then shows “Scene: …” with Start, for the session you’re preparing or playing, so you can run it straight from the map.',
  pinCategories: 'Give pins a kind, like “Quest sites”, “Danger” or “Shops” (type your own, or pick one you used before). The row of kinds above the map shows only the pins of the kinds you tap; “All” shows every pin again. Your choice stays in the address, so Back keeps it. Players see the kinds of the pins they can see.',
  mapNumbers: 'For dungeons and towns: switch on “Show numbers” in Map settings and each pin and linked piece gets a number, like a published adventure (“4. The ossuary”). Key lists number, name and one line; tap one to find it. Numbers stay put as you add and reveal pins; “Number again” starts over. The Export picture and Print can include the numbers and key. Players see only the numbers and key entries they can see.',
  pinOnMap: 'Opens the map you pick ready to place a pin for this page: click the spot and the pin is made, linked to the page and named after it. It starts GM only, like a new page.',
  mapVersions:
    'The map builder saves as you draw. Before each spell of drawing it also keeps the map as it was (the last ten, on this device only), so a fill or erase you regret after closing the tab can still be put right. “Name this version” keeps the map as it is now under a name, until you delete it. Restore puts that drawing back, with the pins of its linked pieces, and the players’ copy is redrawn from it; Undo takes a restore back.',
  mapBuilder: 'Draw a map from scratch: paint land and water, draw roads, rivers and borders, place mountains, forests and towns, and add labels. It then works like any uploaded map: pins, regions, fog and the player view. On a computer each tool has a key: V Select, H Pan, B the brush (Land or Ground), D Rooms, C Coast, L Line, P Place, T Label, E Erase; Esc goes back to Select. On a phone the map fills the screen: the tools are along the bottom, tap the line above them for the tool’s options, and ⋯ at the top has zoom, Fit, Export, Versions and the layers. Pinch to zoom and drag with two fingers to move around.',
  newMap:
    'Pick what you are drawing. “World or region (side view)” is for continents and kingdoms: start with open sea or all land. “Town or city (from above)” is a town seen from above. “Battle map or dungeon (5 ft squares)” is on a grid for fights: start with solid rock to dig a dungeon, or with grass, dirt or paving for an outdoor fight. Small, Medium or Large sets how much room you get: pick the size you’ll need, since it can’t be changed afterwards.',
  mapScene:
    'A world or region map is a side view, the old fantasy-map way: mountains, forests and towns drawn as little pictures. A town or city map is seen from above, like a bird flying over: paint the ground, draw streets and town walls, and place houses, a castle, docks and fields. A battle map is also seen from above, on a grid for fights: paint the ground, add fences and walls, and place trees, rocks, tents and buildings. Dungeons are battle maps too: dig rooms out of the rock with the Rooms tool. Changing the kind of a map you have drawn on asks first if something on it (a coast, painted ground, rooms) won’t show on the new kind; it stays in the drawing for when you switch back.',
  coastBrush:
    'Paint land to push the shore out, or Sea to bring the water in. The coastline draws itself with an inked edge and stippled shallows, and your ground painting stays on the land side.',
  cityLines:
    'Street draws a road with inked edges and a worn middle, and River a band of water; pick how wide each is. A street drawn across a river reads as a bridge. Town wall draws a thick stone wall with battlements and puts towers on the corners and along long stretches; pick the tower or None, and finish near where you started to close the loop. Place a gatehouse on a town wall and it snaps on and opens a gap. Wall towers snap on too, if you want one somewhere else.',
  groundBrush:
    'Paint the ground with a soft brush: grass, dirt for paths, sand, rocky ground, mud, snow, paving stones, a smooth stone floor, wooden boards or water. Where two kinds meet they blend unevenly, like real ground. Water gets an inked bank, ripples and darker deep parts on its own. Paint over anything to change it, or click along the middle of a stroke with Select to change its ground, move it or delete it (Erase works the same way).',
  rooms:
    'Drag out rooms, round rooms, passages and caves. Anything that overlaps or touches joins up into one space, and the walls draw themselves round the outside. Fill in puts rock back, to trim a room or leave a pillar standing. Rooms snap to the squares unless you untick it; caves come out rough like real rock. Doors are in the Place tool: click near a wall or in a passage and the door fits itself into it (a faint outline shows where before you click), opens into the room and leaves a gap; pick another version for open, broken or barred doors. Stairs, pillars, pits, altars, coffins and more are in the Dungeon groups. To change or remove a room later, click its edge with Select (or a passage or cave anywhere along it): switch it between Dig out and Fill in, make it secret or not, drag it, or delete it. Erase works on a room’s edge too.',
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
  packPicker:
    'Switch between the pieces drawn by the app and Your packs: your own pictures, uploaded once in Map packs and switched on for this world in World settings › Map pieces. Only small previews are kept on this device at first; a piece downloads the moment you pick it and stays on this device after that. A tick means it is here already; “Download the whole pack” gets them all, for playing without internet.',
  packTint:
    'Off, your pictures look exactly as you drew them. On, they take on the map’s look: a wash of the climate’s colours in colour, or inked in browns on parchment. See-through parts stay see-through.',
  tileWalls:
    'Build walls and fences square by square from a map pack: pick a brick, stone, timber or cave wall, or a hedge, picket, iron or rope fence, and drag along the squares it runs through. Each square joins up with the wall next to it by itself, so corners, crossings and ends come out right. Doorway leaves a doorway in a straight run of wall (click it again to wall it up), Broken breaks a stretch, and Take away removes wall. Walls go in exports for virtual tabletops, with a door at each doorway; fences other than hedges don’t block sight.',
  packGrounds:
    'Floor textures from your map packs (cobblestones, flagstones, marble, planks, grass, sand, lava and more) paint just like the other grounds, a picture repeated across the brush stroke. Laid floors stop at the walls of rooms unless you untick it. You can also start a whole map on one, in Drawing settings.',
  packCondition:
    'Pieces from an imported pack can come in several conditions: intact, damaged, broken, burned, ruined. Each condition fills exactly the same space, so you can change a piece already on the map and it stays where it is.',
  mapPacks:
    'Your own map pieces: pictures you made or bought (PNG, WebP or JPG; see-through backgrounds work best). Drop in files, a folder or a ZIP. Each folder becomes a group; tree-1, tree-2, tree-3 become versions of one piece “Tree”; “2x3” in a name makes it 2 squares wide and 3 tall. Check what each piece is for and its size, then save. Pictures are kept at most 1024 px across and stored once in your account, however many worlds use them. Switch a pack on for a world in World settings › Map pieces. Players never get the pieces, only the finished map picture.',
  worldPacks:
    'Which of your map packs this world can use in the map builder. Switching one off only hides it from the picker: maps that already use its pieces keep them. When you give a piece new pictures, maps keep the old ones until you choose “Use the new pictures” here. Co-GMs of a synced world can draw with the packs that are on, but never change them.',
  pieceMix:
    'Tick this, then click several pieces (say trees, bushes and ferns) to put them all on the brush. Every click or scatter picks one of them at random, so a wood comes out mixed instead of all one kind. Click a piece again to take it out. The size slider scales them all together.',
  pieceTurn:
    'Pieces seen from above can be turned to any angle; mountains, towns and other side-on pieces always stand upright. On town maps, houses and other buildings start on "Square to the nearest street": each one turns to face the closest street, river or wall, and scattered ones keep off the road. "Each one at random" is good for crates, barrels and camp gear. With a piece selected, press R to turn it a little, or Shift+R to turn it back. Shadows still fall the same way however a piece is turned.',
  linkedPieces:
    'Link a piece to a page and it works like a pin: click the cottage on the map to read about the cottage. Links start as GM only; click the lock to let players use it. Players never see a link you haven’t shared, a link under the fog, or a page you haven’t revealed. Moving, turning or deleting the piece takes its link along.',
  scatterBrush:
    'Click and hold with Place, then drag, and pieces keep landing inside the dashed circle without piling on top of each other: quick forests, mountain ranges and hills. Trees, mountains and towns stay on land; ships and waves stay at sea. Spread is the size of the circle; How thick sets how close together they sit. Letting go makes it one step, so Undo takes the whole lot back. Erase works the same way: drag across pieces to remove several.',
  gmMarks:
    'Marks only you see, in red like the notes in a published adventure: secret doors (the old "S" on the wall), traps, hidden treasure and danger (ambushes, watchers, monsters). Players get a copy of the map picture without them, so they can’t peek. A secret door snaps onto a wall like a door; select it and press "Players found it" to turn it into a normal door they can see. Untick “GM only” on a trap or treasure mark once players know about it.',
  gmOnly:
    'Tick this and the piece, line or label is only on your copy of the map: players get a picture without it. On your copy it has a red dashed line round it so you know. Handy for a cult’s hidden lair on a world map, a secret tunnel, or a label with a note to yourself. A piece linked to a page stays GM only too.',
  secretRooms:
    'Rooms and passages dug with this ticked are only on your copy, washed in red; players see solid rock (or plain ground) there, and the pieces, labels and lines inside them are left off their copy too (a piece there that’s linked to a page becomes GM only). Put a secret door from the "GM only" pieces where a secret passage meets a room. When the players find the door, select it and press "Players found it": the door and the secret rooms behind it show up on their copy.',
  playersCopy:
    'Shows the map as players get it, without the secret doors, traps, secret rooms and anything ticked GM only. Untick to go back to your own copy. Players never receive your copy, only theirs (with the fog of war on top, if it’s on).',
  exportMap:
    'Download the map as a picture (PNG) to print or share. On battle maps, pick a size in pixels to a square, since virtual tabletops count that way (Roll20 uses 70, Foundry 100). Battle maps and dungeons can also go out as a virtual tabletop file (.dd2vtt) with their walls, doors and lights already in it. If the map has fog of war, you can also download the fogged picture exactly as players see it now.',
  curvedLabels:
    'Click to place a label, or drag a line on the map and the words will follow it, like a river name or a mountain range. Region lettering is spaced capitals, place names are italic, Title is for the map name.',

  // Story
  timeline: 'Events in order: the history before your campaign, and what has happened during it. Filter by place to see one area’s story, and jump straight to an age or to the campaign from the row at the top. List or Month, the month you’re on and the place stay in the web address, so Back comes back to them.',
  ages: 'Split your history into named ages, like “The Age of Kings” or “The Long Peace”. Each age gets its own section on the timeline, in order, and each event can belong to one. Players see the ages of any events you have revealed.',
  threads:
    'Every hook, mystery, promise and grudge you’ve left dangling. The columns say where a thread stands with the players (dangling, in play, tied off); pressing, normal and slow burn say how soon it bites. “Next session” marks threads that touch your plan for the next session, and they come first. One that hasn’t moved in three sessions gets flagged so nothing is forgotten. Moving a thread offers Undo.',
  leads:
    'The quests, rumours, hooks and mysteries your GM has shared with the party that are still open, the ones under way first, and the clocks that are ticking. Done and tied-off ones are folded away at the bottom.',
  calendar:
    'Your world’s own calendar: month and day names, the year’s name (like DR) moons, leap years, festivals and holidays. Pick a ready-made one (Forgotten Realms, Golarion, Eberron, Greyhawk, Exandria) or make your own. Events can then have real dates.',
  worldToday: 'Today’s date in your world. Move it on as time passes in the game; each session remembers the date it started on (set when you press Start playing, if you haven’t set one).',
  relations:
    'How this page connects to others: family, friends, enemies, who serves whom. In the Relationship box, type any words you like (“sworn to”, “owes a life debt to”) and pick from the suggestions that pop up, or press the arrow for the common ones. Players only see a link (and its note) when you tick “Players know”. Every link shows up on both pages.',
  relationWeb:
    'Everyone and how they’re connected, drawn as a web. It opens on one person and everyone within two links of them: your own character for a player, otherwise the best-connected player character. Click someone to move to them (Back goes back), pick Everyone to see the whole web, or switch to the family tree. In a big world it shows just people, factions and gods; switch to every kind of page to see places and items too. Add links from any page’s Relationships box; removing one offers Undo. On a phone, swiping up or down over the web scrolls the page; drag sideways or use + and − to move around it.',
  gameClock:
    'The time of day in your world. Set it, then press Run: at real time, faster (1 real minute = 10 game minutes, or any speed you type), or say “Reach 21:00 in 1 h 30 min real time” and it works out the speed and stops there. Passing midnight moves the world’s date on a day. Show players puts it on the players’ screen (a clock face with a sun or moon, or 24-hour digital), in a corner over whatever you’re showing, or filling the screen when nothing else is up; their phones show it too. An alarm (“23:00: the ritual completes”) pings only you. It pauses itself when you mark a session played. It lives on Date and time (press the world’s date in the top bar) beside the date, and at the Lectern while you play. (Clocks, under Story, are progress clocks: a different thing.)',
  dateAndTime:
    'The world’s date and time in one place, opened by pressing the date in the top bar (or Story › Date and time). Move the date on a day, a week or a month, roll today’s weather from the season and climate, and run the in-game time. Players see the date, the season, the moons and the weather, and the in-game time only while you show it. This month’s grid lists dated events and sessions; GM-only ones stay yours. The calendar itself (months, weekdays, seasons, climate) is set up in World settings.',
  dateAndTimePlayers: 'Today’s date in the world, its season and weather, and the time of day while your GM shows it. The month lists the events and sessions you know about.',
  gameTimePlayers: 'The time of day in the game world, as your GM keeps it. It may run faster than real time.',
  clocks:
    'A progress clock is a circle cut into slices. Fill a slice when a villain’s plan moves on, a rival gets closer or danger grows; when it’s full, it happens. Players only see clocks you mark “Players know”, on pages they can see: each clock says which. Start one here or from a page’s Clocks box; removing one offers Undo.',
  reputation:
    'How far the party’s name has spread (from Town up to Global) and what people make of them, from notorious to celebrated. Each change asks what happened and in which session, and the history lists them all, newest first. Players see the reach and the lean on their Party tab, and only the reasons and place notes you tick for them.',
  reputationNotes:
    'How particular places see the party: “Cinderford: owe us a debt”, “the Ashen Court: wanted”. Link a note to the place’s page if it has one. Notes are GM only until you tick “Players can see this”.',
  reputationLevels:
    'The steps of the ladder, nearest first. Rename them to suit your world (Village, Barony, Kingdom, the Known Lands), or add and remove steps. Characters use the same ladder as the party.',
  characterFame:
    'This character’s own fame: how far their name has spread and which way the talk leans, with the history folded away. Players see it on the character’s page and the Party tab, with only the reasons you tick for them.',
  safety:
    'Table rules are your table’s safety tools. Agree what’s off limits before you play. Lines never happen in the game; veils can happen, but off screen. Everyone in the world can read this page.',
  xcard:
    'Tap the X-card if something in the game isn’t OK for you. Your GM is told without your name: straight away if their app is open, or as soon as they next open it. They move the story on, and no one asks why.',
  campaign: 'A campaign is one story in your world, with its sessions, party and active quests. A world can hold several.',

  // Sessions
  session:
    'One game night, in three stages along the top: Prepare (the plan), Play (the Lectern) and Wrap up (notes, the players’ recap, the recording, then “Mark as played”). Everything saves as you type.',
  stages:
    'Where a session is: Planned (nothing written yet), Preparing (it has a plan), Playing (you pressed “Start playing”, or it’s live or recording) and Played (you marked it played in Wrap up, or it has a recap and was never started). A date going by doesn’t mark a session played: the Desk asks whether you played it. Once a session is played, the next one becomes the one the Desk and the Session area open.',
  startPlaying:
    'One press to start the night. A small box asks two things: “Go live to players” (their Common Room shows the session as being played; only offered when the world is shared with players) and “Record” (opens the recording panel, where you ask everyone and press Start recording: nothing is recorded before that). Your ticks are remembered on this device. Then the session is marked as being played and the Lectern opens. Pressed it by mistake? The note at the bottom has “Not started after all” for a few seconds: it takes back the start and the live link (a recording you have started carries on until you stop it). Session details keeps the same button for later. Both can still be switched on or off at the Lectern while you play.',
  continuePlaying: 'This session is already under way: goes back to Play: the Lectern, where you left it. Nothing is started again.',
  sessionTitle: 'Click the number or the title to change it. It saves as you type.',
  sessionDetails:
    'The real date you play (leave it empty until it’s set; booking a date on the campaign page fills it in), the date in your world, and whether players can read this session’s recap. Print and Delete are here too.',
  featured: 'The pages this session is about. People you put in a scene at the Lectern are added by themselves.',
  wrapUp:
    'Every “Wrap up” button (the Desk, the Lectern, this tab) opens this page and its checklist, and changes nothing by itself. After play, in order: end the live session (the checklist’s first step), what happened (your plan is underneath to look at), the recording and its transcript, the write-up from Claude, the players’ recap, highlights, and changes to your pages. Then “Mark as played”, and the next session is ready to prepare. The line at the top counts how many of the “Before you finish” steps are done (a session with no recording has no recording step to count, and “Who was there” is a check, not a step); “who featured” only counts who came up once you pressed Start playing, and the notes step looks at “What happened”, not at your plan.',
  markPlayed:
    'Marks this session played and moves on: the next session (made now if there isn’t one) becomes the one the Desk and the Session area open, and the clues and scenes you didn’t reach are added to its plan, marked “(from #1)”. A date still ahead changes to today. If you skipped the first step, it also ends the live session: whatever is on players’ screens, the in-game time too, comes down (handouts stay in Handouts). Undo puts it all back.',
  revealRecap:
    'Players can read the recap and the highlights, and see who featured, once the session is revealed to them. GM notes, the prep, the recording and the transcript stay yours.',
  undo: 'Removed something by mistake? The note at the bottom of the screen has Undo for a few seconds.',
  recording:
    'Record from one microphone for games at the table, or the microphone plus your Discord or Zoom audio for online games. Add bookmarks while you play to jump back to big moments. Recording carries on while you use the rest of the app (the Lectern, maps, pages), and is saved every few seconds, so if the app closes by accident you can recover it here. Always get everyone’s OK before recording (and a parent’s OK for anyone under 18), and tell them where it goes: the audio stays on the device that made it unless you send it to AssemblyAI (US) for a transcript; the transcript syncs with the world, where any co-GM can read it, and goes to Claude (Anthropic, US) if you ask for a recap.',
  transcript:
    'Turns a recording into text. "On this device" is free and private but slower, with no speaker names. "Cloud" uploads the recording to AssemblyAI (a US company) with your own key, is faster and tells speakers apart; the first time on a device it asks whether everyone recorded agreed to that. Once the transcript is saved here it’s deleted from AssemblyAI, and so is one you start over. Name the speakers once and “Same as last time” fills the names in for the next session.',
  recap:
    'Claude drafts a GM summary, a player recap and updates for your pages from the transcript. "Open in Claude" (or ChatGPT) is free with your own account there; "Write it now" uses your own API key. You review both before saving.',
  worldUpdates:
    'Claude compares the session with your pages and suggests what to change: new NPCs, places and shops that came up, quests moving on, new relationships, timeline events, deaths and captures, loot changing hands, threads and the party’s reputation. Tick the ones you want and add them in one go. New pages start GM only, and lines on existing pages go in a “Session log” at the bottom of the page. Every change is listed under “What changed” in this session’s Wrap up and can be undone from the page’s history.',
  whatChanged:
    'In a session’s Wrap up: every change its write-up made to your world (pages made, lines added, quests and fates that changed). Click a line to open the page. It used to be the Chronicle tab under Story; old Chronicle links open the newest one here. It’s GM only.',
  heardIn:
    'Where this page’s name (or a nickname) was said out loud in a session’s transcript. Click a time to open the session and play that moment, if the recording is on this device.',
  sessionMentions: 'Sessions whose notes or recap link to this page.',
  lectern:
    'Play: the Lectern is your screen while you run the session: the scene and its read-aloud text, who is there, the fight, the party, and tools (show players, dice, loot, sounds). On a computer it’s three columns; on a phone the scene comes first, Who’s here and Clocks start folded, and the row of buttons at the top jumps to each part. “Record” opens the recording panel. “Wrap up” opens the checklist for after the game and changes nothing by itself: ending the live session is the checklist’s first step (on a phone the button sits at the bottom, away from your thumb).',
  nextScene:
    'Goes on to the next scene you planned: ticks off this one, and puts the next one’s place, read-aloud text and people on screen (and its fight, sounds and handout, if its card has them). A scene with nothing on its card leaves the text and people as you set them. If it reveals pages, you see what players will get first. Undo puts it all back: the last scene, the fight and people it added, and the pages it revealed or showed.',
  sceneChange:
    'Choosing another place starts a new scene: the read-aloud text and who’s here are replaced with what you planned for that place (or cleared). Undo puts the last scene back.',
  quickNote: 'Jot something down without stopping the game. It goes at the end of this session’s “What happened”, with the time. What you’ve typed is kept if you leave the Lectern and come back.',
  lecternJump: 'Jumps to that part of the Lectern. Back brings you to the same place again.',
  partyFound:
    'What the party actually found: add coins to the purse, or give them an item (a new item page, GM only until you reveal it, carried by the party). Nothing random.',
  prep:
    'Plan the session: a strong start, the scenes you expect, secrets and clues, and fights ready to run. At the Lectern you tick scenes and clues off as they happen. Removed something by mistake? The note at the bottom of the screen has Undo for a few seconds.',
  strongStart: 'How the session opens. Starting in the middle of something happening gets the table going fast.',
  clues:
    'Things the players could learn, not tied to any one scene. Drop each one wherever it fits and tick it off when they find it; leftovers carry into your next prep.',
  encounters:
    'Build a fight ahead of time: who’s in it, how many, HP and AC. Pick NPC pages to read their HP and AC from their details. “Fight it at the Lectern” adds everyone to the Lectern’s initiative list, once: pressing it again only opens the Lectern, unless you ask for another set.',
  soundboard:
    'Buttons for ambience, music and sound effects. Upload your own audio files, pick a soundset from your Syrinscape library and play its moods, or add Syrinscape moods and elements as buttons. Tap to play, tap again to stop. Sounds keep playing as you move around the app.',
  syrinscape:
    'Control Syrinscape from here: keep its online player open, add your Syrinscape token once on this device, then paste the remote control link of any mood or element.',
  syrinscapeSets:
    'Pick any soundset in your Syrinscape library and its moods appear as buttons: tap one to start it in Syrinscape, tap again to stop. Keep Syrinscape’s player open: it makes the sound. The soundset you picked stays chosen in this world, here and at the Lectern. “Keep these moods as buttons” saves them to your soundboard.',
  showPlayers:
    'Put a picture, a page or some text on every player’s screen right now, like handing round a letter or showing a monster. It pops up for players who joined, and the button by this heading opens the Players’ screen: a clean screen for a TV or second monitor that shows only what you’re showing. What’s up now sits at the top (the in-game time too, when it’s on their screens) with a Stop button that takes it all down; Undo in the note puts it back. Pictures from this scene come first. Pick a page that isn’t revealed yet and it’s revealed as you show it. A map’s picture always goes out as the players’ copy, never yours with the secrets or the fog lifted; to show a map that follows the fog as you clear it, use “Show players” on the map itself. Once a fight starts, the Players’ screen also shows the turn order (as players’ phones do: no HP, and a fighter from a page they haven’t seen is “Enemy 1”), and any timers you haven’t hidden. “Several” keeps boards you lay out ahead of time, to put up all at once, and everything you show is kept in Handouts.',
  handouts: 'Everything you’ve shown players, newest first. Players can open a letter or picture again any time after you stop showing it. Remove a picture or text to take it back. A page you remove stays revealed unless you choose to hide it again.',
  handoutsReady: 'Handouts you’ve prepared but not shown yet: any GM-only page tagged “handout”. Players can’t see them. “Reveal and show” first says what players will see, then reveals the page to everyone and puts it on their screens (with Undo), and it moves to Shown so far.',
  showSeveral:
    'Put several handouts up at once, like clues laid out on a table. Pick pictures, pages or text on the right (or on the bottom on a phone), then drag them about on the preview, which is the players’ screen in miniature; drag a corner to resize, or press Tidy up to line them up. Nothing reaches players until you press Show; after that, changes wait until you press Update players’ screen. Players’ phones list them one under another. Pages not revealed yet are revealed when you show the board, after a look at what players will see. Make as many boards as you like (New board), name each one (“Crime scene”, “The letters”) and set them up while you prep; they wait in Handouts and on the Lectern, ready to put up with one tap. Players never see a board’s name, only the heading if you give it one.',
  initiative: 'Add everyone in the fight, roll or type initiative, then step through turns. Each fighter is one line: tap the name for the details (initiative, side, conditions, exact HP), or use −5 / −1 / +1 right on the line. “Defeated” moves someone to the Down list and skips them in the turn order; “Back in” returns them. A foe brought to 0 HP goes there by itself (Undo in the note takes it back), while a player character or ally on 0 keeps their turn. In the ± box, type +5 to heal or -5 to damage; a plain number follows the button you press, and Undo puts HP back. “Something else…” in the condition list lets you type your own, and a number at the end, like “Burning 2”, counts down at the end of their turn. With a keyboard, N moves to the next turn (press ? for all the shortcuts).',
  dice: 'Roll any dice. Type things like 2d6+3 or 4d6kh3 (keep the highest three), or tap a quick die.',
  randomTables:
    'Your own tables to roll on: one entry per line. "3x Goblins" makes an entry three times as likely, {2d6} rolls dice inside an entry, and {Weather} rolls on your table called Weather.',
  improvise: 'Need a name or a tavern right now? Roll one here and save it into your world if it sticks.',

  // Tools
  boards:
    'Corkboards are retired: you can’t make new ones, and this only shows while your world still has some. “Copy into a page” writes a board’s cards (pages as links, notes as quotes) and its strings into a new GM-only page, so nothing is lost; then delete the board. Until then you can still move cards, tie string and cut it. GM only.',
  generators: 'Your own random tables come first: pick one and roll. Below, roll up taverns, shops and NPCs without any AI, then names and treasure. Save the ones you like; they start as GM only.',
  playersWillSee:
    'Before something reaches your players you see what they’ll get: which page, which coins, which items. Once you go ahead, Undo takes it back for a few seconds, though anyone looking at that moment may already have seen it.',
  existingImage:
    'A page’s picture can be uploaded, or picked from the pictures already in this world (anything uploaded on another page, as a handout or in More › Files) with “Use an existing image”. The picture isn’t copied, so one portrait can be on several pages. Players see it once the page is revealed to them, just like an uploaded one.',
  assets:
    'Every file in this world: map images, portraits and handouts. Each one says whether players can see it, and why. Players get a file when something they can see uses it: the world’s cover, the picture on a page they can read, a map they can see, a picture in text they read (not in a GM-only passage), a handout, or what’s on their screens. Hide that and the file goes with it. A file nothing like that uses goes to players only if you mark it “Players can see this”. The full picture of a fogged map, and your copy of a map with secrets on it, never go to players.',
  loot:
    'What the party has: the stash, what each player character carries and the party’s coin. Set "Carried by" on any item page. Players see the revealed items and the coins in the purse; things an NPC, shop or place holds are listed only for you.',
  lootSteps: 'Use − and + to take coins out of the purse or put them in, by the amount in the box (1 to start with). Click the number to type a new total instead. What other people carry, and items nobody does, are folded under “Everything else in the world”.',
  importPages:
    'Bring pages in from Obsidian (or any folder of plain-text notes), a Kanka export or a World Anvil export. Everything arrives as 🔒 GM only, so you can tidy up before revealing anything.',
  lookup:
    'Search the open rules and fan wikis for the game you’re playing: it starts on the game system of the campaign on the Desk (set in that campaign’s settings), or the world’s default game system if the campaign has none, and you can pick another game for a while. It covers the D&D 5e System Reference Documents (spells, monsters, magic items, rules), the Daggerheart SRD (built into the app, so it works offline), the Forgotten Realms Wiki, PathfinderWiki, Starfinder Wiki, and the Lovecraft, Cyberpunk and White Wolf wikis. Open a result to read it. The GM can keep it as a new page (🔒 GM only until you reveal it) or add it to a page you already have; a line at the bottom says where it came from and its licence, so keep it if you share the page. Players can search and read too (More › Look it up), but nothing they find is saved. Games whose rules aren’t free to copy (Pathfinder’s Archives of Nethys, D&D Beyond, Shadowdark…) get links that open the right site in a new tab.',
  importSheet:
    'Bring a character in from another tool. A file: Foundry VTT’s Export Data (any game), a Hero Lab portfolio (.por) or XML statblock, a Fantasy Grounds character export, Shadowdarklings’ JSON, D&D Beyond, Pathbuilder or DiceCloud data, or a fillable PDF sheet. A link: a public D&D Beyond or DiceCloud character, or Pathbuilder’s Export JSON. Anything else (Hero Lab Online, Demiplane, Roll20, notes): paste the sheet’s text and Claude sorts it. Gear becomes item pages the character carries. Import again after a level-up to update the same page; your GM notes and secrets stay as they are.',
  importNotes:
    'Turn your own notes into pages. Add photos or scans of your notebook (one page per photo, flat and in good light), or paste notes you typed, then Claude reads them and sorts out the people, places, factions, items, quests and sessions. It leaves out memes, doodles and table jokes, and lists words it couldn’t read and questions about what a note means: answer them and read again if you like. You look over every page first: untick any, fix a name, or add the notes to a page you already have. Claude guesses which pages your players already know (ticked 👁, shown to them); untick any to keep it 🔒 GM only. Secrets always go into GM notes. Free with “Open in Claude” or “Open in ChatGPT” (add the photos in the chat yourself), or one click with your API key, about 5 to 10 US cents a page of notes.',
  exportMarkdown: 'Download every page as plain-text (Markdown) files in folders, ready to open in Obsidian or any notes app. GM notes and secrets are included, so keep it to yourself.',
  discord:
    'Post recaps and session dates to your group’s Discord channel. In Discord: Server settings, Integrations, Webhooks, New webhook, then copy its link here. The link is kept on this device only.',
  backup: 'Save the whole world, with its uploaded files, as one .zip file. Session recordings are only in it if you tick “Include session recordings”, and they stay on the device that made them, even with sync on, so back them up too. Keep a backup even if sync is on. Older .json backups still import. Importing (Import backup… on your worlds) always adds a new world and never changes one you have; if the name is taken, the copy is called “Name (2)”.',

  // Sharing and players
  cloudSync:
    'Sign in to keep this world in step across your devices. Your world is still saved on each device, so it works offline and catches up when you reconnect. If two devices change the same page at once, both sets of changes are kept where they don’t overlap; where they do, the other version is kept in the page’s history.',
  moving:
    'The web app moved from braydenm32.github.io to its own web address. Your browser keeps each web address’s saved worlds apart, so “Move my worlds” copies everything saved here (worlds, files, recordings, page history and this device’s settings) to the new web address. Your worlds stay here too, but once they’ve moved the old address forgets its AI keys, tokens and sign-in, so no other page there can read them. Afterwards the old web address just sends you to the new one, and old invite and share links keep working.',
  deleteAccount:
    'Removes your account and everything stored with it in the cloud: worlds you own, their files and links, and your notes and characters in other people’s worlds. Worlds on this device are kept, so you can still use them without an account.',
  socialLogin:
    'Sign in with your Google or Facebook account instead of a password. If you already made an account with the same email, you’ll land in that same account. Not available in the desktop app yet, so use email there.',
  shareLink: 'A public, read-only wiki of everything you’ve revealed to the whole table. No account needed, so it suits people outside your group. GM-only things are removed before anything is sent. Players should join with the invite link instead.',
  wiki: 'A read-only wiki of this world, shared by its GM. It shows only what the GM has revealed to everyone, and updates as they add to it.',
  players:
    'Invite your players with a link. They sign in, join, claim their character and keep notes. They only ever receive what you’ve revealed to them. Someone’s name came out wrong (or as the invite link)? “Rename” by their name fixes it for everyone; players can change their own name in the Common Room under Me.',
  playerNotes:
    '“My notes” are private to you. “Group notes” are shared with the whole party, and your GM can read them. “My notes” save when you click away. “Group notes” show as they will read: type a line in the box and press “Add a line”, or use “Edit the whole notebook” to rewrite them. If someone else changed the group notes while you were typing, nothing is lost: you choose to keep both, yours or theirs.',
  scratchpad:
    'For anything that isn’t about one page: plans, names, clues. Keep your own notes (My notes) or write in the party’s shared Group notes.',
  gmPlayerNotes:
    'What your players have written together in Group notes. Only they can edit it, and their private notes stay private.',
  coGM:
    'A co-GM sees and edits everything in this world, secrets included, from their own account. Only you can invite or remove co-GMs, manage players and links, or delete the cloud copy. Each co-GM link works once: make a new one for each co-GM.',
  schedule:
    'Suggest a few dates for the next session. Players who joined mark each one yes, maybe or no, and you book the one that works. Booking puts the date on the next session you haven’t played (making one if there is none), and players see it there. Times show in each person’s own time zone.',
  nextSession: 'The session in hand, with its stage (Planned, Preparing, Playing, Played), its date, how many scenes and clues you’ve written, and one main button for what comes next: prepare it, start playing, wrap it up, or plan the one after.',
  endSession:
    'The Wrap up checklist: what’s done and what’s left before you mark the session played. First, “End the live session”: players stop seeing the session as being played and whatever is on their screens comes off, the in-game time too (handouts stay in Handouts), with Undo. It shows as done once the session isn’t live and nothing is on their screens, and isn’t counted for a session that never went live. Then: what happened written down, the recording transcribed, the recap written, your pages updated, the session revealed to players, the world’s date moved on. “Mark as played” then gets the next session ready, carrying over the clues they didn’t find and the scenes they didn’t reach (and, for a session made now, where the party is).',
  partyNotPlaying:
    'Characters marked dead, missing or captured on their page stay out of the Lectern’s party list and “Add the party”, so the table only shows who’s playing. Tap “Show” to see them for a moment. Their pages, the Atlas and what players see are unchanged.',
  partyCampaign: 'When a world has more than one group, pick which campaign this character plays in. The campaign page and the Lectern’s “Add the party” then only show that group.',
  trackAsThread: 'Quests are what the players know they’re doing. A thread is your own tracker for it: how pressing it is, and a warning when it goes cold.',
  claimRequests: 'A player asked to play one of your characters. Approve it and they can edit that character’s sheet and read passages written for them. Until you do, they don’t get its turns or roll calls at the table.',
  gettingStarted: 'Seven first steps for a new world, each with a button to the place where it’s done. Each one ticks itself when it’s done (the two optional ones can be skipped; bringing in notes ticks the first, pages you type yourself don’t), and the card stays on the Desk until all seven are ticked or you press Hide. More › Getting started brings it back, in any world. It’s remembered on this device. The example worlds don’t show it unless you bring it back.',
  inbox:
    'Everything your players sent that waits on you, oldest first: questions, what their characters do between sessions (downtime), asking to play a character, and new characters they wrote up. Answer each one right here. Deleting, approving and turning down wait a few seconds with Undo before they reach the player. The number on Desk and Inbox counts what’s still waiting.',
  comingUp: 'The next few sessions of each running campaign, with their stage. A campaign is one group’s story in this world; “+ Campaign” starts another.',
  openQuests: 'The quests still open in this world, whichever campaign they belong to. Open one to see its steps and rewards.',
  recentChanges: 'The pages you changed or added most recently, newest first, to pick up where you left off.',
  deskParty: 'The player characters in the session’s campaign, with their armour class and hit points when their pages have them.',
  worldLoading: 'A world’s pictures and maps arrive after its pages: drawn (the example worlds), downloaded or unpacked from a backup. Look around meanwhile; each one appears as soon as it’s ready.',
  yourWorlds: 'Worlds you made, kept on this device (and in the cloud if you switch on sync). Worlds you play in and the example worlds have shelves of their own.',
  home: 'Each world is kept on this device. Sign in to sync your worlds across devices, invite players, or open worlds you play in.',
  myName: 'The name the GM and the other players see you by: next to your character, in group notes and in the GM’s list of players. Typed it wrong when you joined? Change it here and everyone sees the new name. Your GM can rename you too.',
  joining: 'An invite link from your GM lets you join their world as a player. Paste it here if it opened somewhere else, sign in, type the name the table should call you (your name, not the link), and you’re in. You can change the name later in the Common Room under Me.',
  questions:
    'Ask your GM something privately: about a page, or anything at all. Only your GM (and any co-GM) sees your question, and only you see the answer.',
  editCharacter:
    'Keep your character’s details up to date: the one-line summary, stats and anything you want to write about them. Your GM sees your changes and can change them back.',
  character: 'Who plays this character. Players ask to play their character from here, and you approve it (here or in World settings) before it counts, so nobody can take someone else’s character or their secrets. You can release a claim later.',
  roomNow:
    'Now changes with the game. Before a session: when you play next, what happened last time and what the party is doing. While your GM runs the session live: the scene, whose turn it is, dice everyone sees, a quiet word to the GM and the X-card, with your character’s numbers right under the scene (tap your HP to change it). At any other time a small Dice card at the foot keeps dice in reach. After a game, until the day of the next one: last time’s recap first, then the loot and the Group notes.',
  roomMe: 'Your character at a glance: the numbers that matter, what you carry, passages only you can read, and your own notes. “Edit my character” lets you update the sheet, or fill it in from a character sheet file.',
  roomParty: 'Everyone in the party, who plays them and what each one carries, plus the party’s purse, the stash you share and how far your name has spread. Party loot has every item with its notes.',
  tableRules:
    'What your table agreed before playing. Lines never happen in the game; veils can happen, but off screen. The X-card tells your GM, without your name, that something isn’t OK.',
  tableLink:
    'Once you go live with this session, players’ Common Room shows which session is on, the scene (only if its page is revealed), the music, your timers and the turn order once combat starts. HP, conditions and your notes never go, and anyone from a page players haven’t seen shows as “Enemy 1” or “Ally 2”. Their rolls and signals (“I’d like to do something”, “I need a break”) come to you here and pop up wherever you are in the app.',
  inspiration:
    'Inspiration or hero points: tap + to hand one out. Players see how many they have in their Common Room and on their character page, and can ask to use one; you’ll get a pop-up with “Use it”.',
  newCharacter:
    'Write up the character you’d like to play and send it to your GM. They can approve it (it becomes your character, ready to play) or get back to you with a note. A note they write when approving shows at the top of your Common Room.',
  newCharacterGm:
    'A player wrote up a character they’d like to play. Approve it and the app makes a player character page from it, revealed and already theirs. Or turn it down with a note saying why. A note you write reaches the player either way.',
  gmReply: 'Add a line to your players’ Group notes, signed “GM”: a nudge, a reminder of something they saw, an answer to a question they wrote down. They see it next time they look.',
  leapYears:
    'Every so many years, chosen months get extra days: February’s 29th, or a festival that only happens in leap years (give it 0 days and 1 leap day, like Shieldmeet). Tick “festival” for days between months, like Midwinter: their dates read “Midwinter” or “3rd day of Needfest”. To line a moon up with a published calendar, set a date it was full.',
  timers:
    'Countdowns for the table: a fuse burning, a ritual finishing, a time limit on a puzzle. Tap a length to start one (name it first if you like). When it runs out it beeps and says so in a note, wherever you are in the app. Players see your timers on the Players’ screen (a TV) and, while you’re live, in their Common Room, unless you hide one with the eye.',
  tableDice: 'While your GM is running the session live, rolls here show up for the whole table: the other players and your GM see who rolled what. At other times the dice are just for you.',
  tableSignals:
    'A quiet word to your GM without interrupting: they get a pop-up with your character’s name, and you see when they’ve noticed. For something you’d rather not say out loud, use the X-card instead.',
  aiTools: 'Keys for transcription, recaps and the Claude tools, and the voice for reading recaps aloud. They stay on this device and are never in worlds or backups, unless you save the keys to your account.',
  archivist:
    'Claude, reading your own world. Ask it anything (“who would want the party dead?”) and it looks up the pages it needs, then answers with links, saying when something is secret. Or have it check your notes for contradictions. Uses your Anthropic API key, or “Open in Claude” or “Open in ChatGPT” for free with your own account there.',
  continuity:
    'Claude reads your pages and sessions and lists where they disagree: someone dead on one page and alive on another, dates that don’t add up, names spelled two ways. Each comes with a suggested fix. Tick “Done” once you’ve dealt with one. Checking the whole world reads everything, so it costs more than checking one page and its neighbours.',
  prepHelper:
    'Claude reads the last two sessions, the party, open threads and running clocks, and suggests a strong start, likely scenes, secrets and clues, and who to have ready. Untick what you don’t want; the rest goes onto your prep sheet, and the people to have ready are linked to the session so they’re at hand in the Lectern.',
  prepIdeas:
    'Your own plans, before Claude’s: where the party is heading next, and any new threads, quests, clues or people you want in. Claude builds its suggestions around them instead of guessing. They’re saved with this session (GM only, never shown to players), so they’re still here next time you ask.',
  prepFeedback:
    'Players’ stars and wishes about the last two sessions are their own words, so they go to Claude only when you tick this. It starts unticked for each session, and stays as you left it until you close this tab. Players are told on the form that their GM may share them with Claude.',
  flavour:
    'Claude dresses up what you rolled so it fits your world: a short read-aloud description, rumours tied to people and places you already have, and one secret (kept GM only when you save).',
  npcLines:
    'Say what’s happening and Claude writes four lines this character might say, in their voice, using what their page says about them. Keep the ones you like in your GM notes.',
  spotlight:
    'Who got time at the table. With a transcript that tells speakers apart, it shows how long each person talked; it also counts how often each character came up (in the transcript, or in your recap and the notes you wrote during play without one). Worked out on this device; nothing is sent anywhere.',
  readAloud: 'Reads recaps aloud with your device’s own voices: free, private, and GM-only passages are never read, nor passages meant only for some characters, not even yours (the whole table would hear them). Pick a voice and speed here.',
  newCharacterName:
    'Secret passages written “for” a character reach whoever plays a character with that full name or first name. If the new character shares a name with another, those secrets would reach both players, so give one of them a different name.',
  pageVisibility:
    'Says who can read this page now: GM only, players, or a few players you revealed it to. Click it to change that. Before anything is revealed you see what players will get (and what stays hidden: GM notes, GM-only passages and details), and a note at the bottom offers Undo afterwards. Hiding a page you also revealed to some players by name leaves it with them, unless you choose “Hide from … too”.',
  pageJumps: 'A long page gets this row: tap a part to go straight to it. Back from a page you opened comes back to where you were.',
  seenMarks: 'In your lists, an open eye marks what players can read, a lock what’s GM only, and a half-shut eye a GM-only page revealed to a few players. The filter and tag you pick stay in the web address, so Back from a page returns to the same list.',
  pageDrafts:
    'Nothing you type here is lost. Save writes it; if you leave another way (a link, Back, another screen) your changes are saved for you, with Undo in the note at the bottom. Closing the tab asks first, and what you typed is also kept on this device. A new page is only added to the world once you write something and save or leave; Cancel, or leaving it untouched, leaves nothing behind. Saving only writes what you changed, so edits made meanwhile by a co-GM or a player are kept.',
  pagePicker: 'Start typing a name to find a page, then click it or press Enter. The ones in the current scene are listed first.',
  goLive:
    'Opening the Lectern doesn’t show players anything. Tick “Go live to players” in the Start playing box, or press it here at any time: their Common Room then shows this session as being played, with the scene, music, timers and turn order. A “Live” badge stays at the top of every screen until you press Stop, or “End the live session” in Wrap up.',
  fightBar: 'On a phone, this bar stays at the top while a fight is on. Tap the name to jump to them in the initiative list.',
  lecternKeys:
    'With a keyboard: N or → for the next turn, B or ← to go back, D to roll a d20, and ? for this list. They don’t work while you’re typing in a box.',
  pinNames:
    'Names shows each pin’s name beside it (regions and drawn places get theirs once you zoom in). Each map remembers the setting and where you were looking on this device. When the party is somewhere on the map, its pin is ringed in blue and a button takes you to it. Players only get names for the pins they can see. On a phone, Tools holds the rest of the toolbar.',
  fogRoom:
    'Click inside a room to uncover just that room, right up to its walls. It stops at walls drawn across the room and at doors, gates and bars, so click in the next room to open that one too. Secret rooms are left alone until you mark their door as found. With Cover chosen, it covers the room again. Only on maps with rooms drawn in the map builder.',
  keysInAccount:
    'Keeps your AssemblyAI and Anthropic keys in your Warded Atlas account, so any device you sign in on gets them without pasting, and signing out takes them off that device again. No other user can read them, and they never go into worlds, backups, share links or anything players or co-GMs receive. They are stored as plain text in the app’s database, which only the person who runs the app looks after, so set a monthly spending limit in the Anthropic Console. On a shared computer, keys someone else typed in stay theirs: they never go into your account, and come back when you sign out. Untick to take them out of your account.',
  keepAtAssembly:
    'Once a cloud transcript is saved in your world, the app deletes it from AssemblyAI, so your table’s talk isn’t kept by another company. A transcript you start over, or one still being made when you delete its session (or its campaign, or the whole world), is deleted there too; if a delete doesn’t go through, the app tries again each time you open a session’s recordings on this device. Tick this to leave a copy in your AssemblyAI account instead (for example, to look at it on their website). Applies on this device only.',
  openInChat:
    'The free way to use Claude, or ChatGPT if you prefer it. “Open in Claude” opens a new Claude chat in another tab with everything already typed in (on a phone, the Claude app opens if you have it); “Open in ChatGPT” does the same there. Send it, copy the whole reply, and paste it back into the box here. Anything very long (a big world, a long transcript) is too much to type in for you (the text travels in the web address, which has a limit): the chat opens empty and everything is copied, so just paste it in (Ctrl+V, or press and hold, then Paste). It is always copied as well, in case the box comes up empty. “Copy” only copies, for any other AI chat. Photos of notes can’t be sent this way: add them in the chat yourself. Uses your own Claude or ChatGPT account, under its own privacy settings.',
  claudeJobs:
    'Claude keeps writing when you go to another page: a note at the top says “Claude is writing…”, then “Claude finished”, and takes you back to it. If you leave the page while it writes, you choose to keep it writing or stop it. Closing the tab or the app stops it. Small jobs (flavour, NPC lines, Archivist questions) use Claude Sonnet 5.5, quicker and half the price; recaps, contradiction checks and prep use Claude Opus 5.5.',
  secretNames:
    'Players can read this text, and it links to a GM-only page, so that page’s name goes to them with it. A label like [[Lord Vexis|the stranger]] only changes the words on screen: the name still travels with the text. Move the link into a GM-only passage, or reveal the page. This is only a warning; nothing is blocked.',
  backupRecordings:
    'Recordings can be very large. Leave this unticked for a small backup that has everything except the audio; transcripts, bookmarks and the rest of each session are kept. Tick it to keep the audio too. Recordings are never sent to the cloud, so a backup is the only other copy.',
  lecternSearch:
    'Type to find a panel (“initiative”, “dice”, “music”) or a page by name. Only the matching panels show, opened, and matching pages appear above them with their GM notes and buttons to add them to the scene. Click a panel’s title to fold it away; this device remembers which you folded. “Fold all” leaves just the titles.',
  wantedPages:
    'Names you’ve written as [[links]] in pages or sessions that no page answers to yet, most mentioned first. Pick one and choose a type to make its page (it starts as GM only). You can also click a grey dashed link anywhere to make its page.',
  partyGlance:
    'Every character in one table, with the details you choose as columns: AC, Passive Perception, Languages, Darkvision, anything from their pages. Choose columns once and they show here and at the Lectern. This table is GM only.',
  gmScreen:
    'Your own GM screen. Pin pages you look up every session (house rules, a monster, a random table) to read them here, save rolls you make again and again (“Goblin attack d20+4”) as buttons, and ask the Archivist a question without leaving the Lectern. It’s GM only.',
  names:
    'Names for people, places, taverns and ships, in eight styles (Common, Elvish, Dwarvish, Orcish, Halfling, Northern, Southern, Infernal). “Like my world’s names” learns from the names already in your world (your NPCs for people, your locations for places) and makes up new ones that sound the same. Press More for another batch.',
  treasure:
    'Roll a pile of treasure, from pocket change to a dragon’s hoard: coins, gems, art and odd things, sometimes something magical. “Give to the party” says what players will see, then puts the coins in the party’s purse and the rest in the party stash, where players can see it. Gem and art values are in gold pieces; change anything afterwards on Party loot.',
  starterTables:
    'Ready-made random tables (rumours, plot hooks, road and wilderness encounters, dungeon dressing, trinkets, NPC quirks, town events) to get you rolling. They start as GM only, and you can change, add or remove any line.',
  objectives:
    'The steps to finish this quest. Players see the ones with an open eye and can follow the ticks as you make them. A step with a closed eye is GM only (a hidden goal, a twist) until you click the eye to reveal it.',
  rewards:
    'What finishing the quest is worth. A reward is GM only until you click its eye to reveal it. “Give to the party” puts any coins in its text (like “200 gp”) into the party’s purse and its item into the party stash, and reveals it to players.',
  downtime:
    'Tell your GM what your character does between sessions: training, research, crafting, visiting someone, working a job. Only your GM (and any co-GM) sees it, and their answer appears here, for you alone.',
  callForRoll:
    'Ask the table for a roll. Type a line like “@all roll perception 15” (everyone rolls Perception, DC 15), “@Wren @Silas stealth dc 12 secret” or “@all d20+2 strength”, or fill in the boxes. While you’re live, the players asked get a Roll button with their bonus filled in from their character’s details, and their results land here, marked pass or fail. Roll for anyone who isn’t online. “Secret” keeps results from the other players; “Tell them the DC” shows it. Press Done to clear it.',
  sceneCards:
    'Give a planned scene everything it needs: where it happens, read-aloud text, who’s there, sounds to play, one of this session’s fights, a picture or page to show players, and GM-only pages to reveal. At the Lectern, ▶ Start on the scene does it all at once and ticks it as played (it asks before revealing anything).',
  ruler:
    'Measure a route: click points along it on the map and the total distance shows, with how many days it takes on foot, riding, by wagon or by ship. On a battle map drawn here, one square is 5 feet. GM: if the map has no scale yet, measure something you know the length of and name it.',
  ping:
    'Point at a spot on the map. Everyone looking at the same map (you and your players, while you’re live) sees a pulsing ring there for a few seconds, with your name.',
  mapScale:
    'How far the map is from its left edge to its right, so the ruler can measure distances and travel time. You can also set it with the ruler: measure a road or river you know the length of and name it.',
  seasons:
    'Name your world’s seasons and when each starts; “Use the usual four” places spring, summer, autumn and winter like Earth’s. The season shows with the date, and with the climate it decides the weather you roll. Players see the season and the weather.',
  journey:
    'Run a trip day by day. Say where to, how far (or use a route you measured with the map ruler) and how fast. “Next day on the road” moves the world’s date on, rolls the weather (a blizzard or gale halves the day), checks for an encounter on a table of yours and counts down rations. “Rest a day” does the same without moving.',
  highlights:
    'The best bits of a session: memorable moments, lines worth quoting and playful awards (“Bravest Fool”). Players see them with the session’s recap and in the Common Room. When Claude writes the recap it suggests some; tick the ones to keep.',
  storySoFar:
    'A catch-up of the whole campaign, for players before a session and for anyone joining late. Write it yourself, or have Claude write it from the player recaps (never from your GM notes). Players also get every session’s recap underneath, in order.',
  lecternNotes:
    'What happened in this session, the same box as on Wrap up. Add a line with the time from the quick note at the top (it goes at the end), or press Edit to change it. Your plan, written before the game, is folded underneath to read. Both are GM only.',
  planNotes:
    'Your plan for this session, written before the game: what might happen, who they could meet, what to remember. It stays as you wrote it once you play; what really happened goes in “What happened”. Notes from before there were two boxes are all here. GM only: players never get it.',
  whatHappened:
    'What really happened at the table: who they met, what they chose, what’s left hanging. The Lectern’s quick notes land here as you play, and a summary from Claude is added here. This is the box Wrap up means by “write down what happened”. GM only: players never get it (they read the recap).',
  inspirationPlayer:
    'Inspiration or hero points your GM has given you. Tap “Use one” to ask to spend one: your GM gets a pop-up and says yes at the table.',
  // The first ten minutes, and between sessions
  welcome: 'The big button opens Vael Ardith, the full example with a campaign ready to run, at its Start here tour of the world and the app. Its pages open in a moment; its maps and pictures are drawn after that, and a note in the top bar counts them in. For a quicker look, the small sample, The Shattered Coast, opens at once but has no tour. Or start your own world: it asks for a name, and you can bring in notes from Obsidian, Kanka or World Anvil.',
  installApp: 'Put the Warded Atlas on your home screen and it opens like an app, full screen, straight to your table. It’s the same as the website, kept up to date; nothing extra to download from a store. Hold the icon for shortcuts to the Common Room.',
  inlineRolls: 'Write roll:1d8+3 anywhere in a page’s text and it shows as a small dice button: press it to roll, and the result appears beside it. {{Blackwood encounters}} rolls on your table of that name. Players get the buttons too, but only in text they can read. While a session is being played, you can add a roll to its notes.',
  pagePrompts: 'Questions to get a new page going, different for people, places, factions, items, quests and the rest. Answer one and it goes into the description under the question as a heading. Questions that ask for a secret (marked with a lock) go into GM notes instead, so players never see the answer. Change or delete anything afterwards.',
  starterTemplates: 'Three ready-made starting points (a person, a town and a quest), each with the questions worth answering as headings. The secret ones (“Their secret”, “The twist”) sit in GM notes, so players never see what you write there. Add them, change them, or make your own with “Save as template” on any page.',
  whoWasThere: 'Tick the player characters who were at the table. Everyone starts ticked. It goes into the recap and highlights Claude writes (no moments for someone who wasn’t there), Spotlight, and players see it with the recap. Players whose characters weren’t there aren’t asked for downtime.',
  starsWishes: 'For a few days after a game, each player can send one star (something they loved) and one wish (something they’d like more of) about last session. They’re signed with the player’s name, not anonymous, and only the GM and any co-GM read them, in the Inbox under that session. The form tells players their GM may share them with Claude: the prep helper sends them only if you tick “Include players’ feedback”.',
  sessionNotes: 'Your own notes on one session, under its recap: what you want to remember, theories, names. Only you can see them. They’re kept with your other notes and come with you to any device you sign in on.',
  addToCalendar: 'Puts the booked game night in your calendar, down as four hours: a calendar file opens in Apple Calendar, Outlook and most phones, or add it to Google Calendar. If the date moves, add it again. A repeating game night (every other Friday, say) isn’t offered yet: book each one as it comes.',
  revealOn: 'A GM-only page can reveal itself on a date and time you pick: the letter arrives on Friday, the rumour spreads after the festival. From then on every player can read it, even if your app is closed. Until then it stays GM only, with the date by its lock. It needs cloud sync and your players invited; revealing it by hand before then works as usual.',
  groupPost: 'Your players won’t know there’s something new unless they look. This copies a short line and the link to their Common Room for your group chat, or opens your phone’s Share sheet (WhatsApp, Messages…). With a Discord webhook set up in World settings it posts there too. Only that line goes out, never the recap, the answer or the page itself.',
  exampleStartHere: 'Vael Ardith comes with four guides written for new GMs: Start Here, the GM’s chapter for the campaign, the clocks and a Player’s Guide. They’re ordinary pages, so you can read them as players would too.',
  recentPages: 'The pages you opened lately on this device, newest first. They’re also the first thing in the search box (Ctrl+K) before you type.',
  duplicate: 'Make a new page that starts as a copy of this one, with “(copy)” after the name. It starts GM only, and who the original was revealed to doesn’t come along.',
  pictureTitle: 'Players aren’t told the name of a page or map they can’t see, so its picture (or a file named after it) goes out as “A picture”, or whatever you call it here (“A hooded stranger”). Want them to know who it is? Reveal the page, then show it. In the list of pictures, a lock marks one whose page or map players can’t see. The same goes for scene cards and boards: what players see a picture called is under it.',
  beingRecorded: 'Your GM’s app is recording the sound of this session, usually for notes afterwards, and it says so here for as long as it records. The recording stays on your GM’s device unless they send it to AssemblyAI (in the US) to be typed up. A transcript is kept with the world for its GMs (co-GMs too), and may be sent to Anthropic (in the US) to draft a recap. Players never get the recording or the transcript. Not happy being recorded? Say so to your GM.',
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
    const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 12))
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
