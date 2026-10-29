import { localDate } from './sessions'
import { CALENDAR_PRESETS } from './calendar'
import { blankEntity, db, newId, type Entity, type Pin } from './db'

/** A small ready-made world so new users can click around before building their own. */
export async function loadSampleWorld(): Promise<string> {
  const worldId = newId()
  const now = Date.now()
  const E = (type: Entity['type'], name: string, extra: Partial<Entity> = {}): Entity => ({
    ...blankEntity(worldId, type, name),
    ...extra,
  })

  const coast = E('location', 'The Shattered Coast', {
    visibility: 'players',
    summary: 'A storm-wracked coastline of fishing towns, sea caves and old ruins',
    body: 'Three centuries after [[The Sundering]], the waves of the Grey Sea still break against the ruins of the old empire. [[Saltmere]] is the largest town, and the road north-east climbs to [[Greywatch Keep]]. Fishing folk keep to the shore, and most of them will tell you the deep forest inland is best left alone.',
  })
  const saltmere = E('location', 'Saltmere', {
    visibility: 'players',
    parentId: coast.id,
    summary: 'Busy fishing town built on stilts over the tidal flats',
    body: 'Smells of tar and fish, and the boards creak underfoot at every tide. Ruled by the Harbourmaster, with the [[Tidewardens]] as his guard. Good places to start are the tavern, [[The Salty Anchor]], and the fishing fleet’s berths at [[The Stilt Docks]].\n\n:::gm\nThe town sits on top of a sealed vault from the old empire. The tremors are getting worse.\n:::',
    fields: [
      { key: 'Population', value: '~2,400' },
      { key: 'Ruler', value: 'Harbourmaster Corvin Vane' },
    ],
    tags: ['town'],
  })
  const keep = E('location', 'Greywatch Keep', {
    visibility: 'players',
    parentId: coast.id,
    summary: 'A crumbling fortress guarding the pass through the Ashspine Mountains',
    body: 'A square grey keep with half its roof fallen in, standing where the road squeezes between two cliffs. A dozen [[Tidewardens]] hold it through the summer, and in winter the snow closes the pass and the keep stands empty. Travellers shelter in the dry corner of the courtyard and swear the walls hum when the wind is right.',
    tags: ['fortress'],
  })
  const wood = E('location', 'Whisperwood', {
    visibility: 'players',
    parentId: coast.id,
    summary: 'Ancient forest where voices are heard between the trees',
    body: 'Birch and old oak grow thick enough to keep the sea wind out, and the quiet under them feels heavy. Hunters say the voices sound like someone you know, calling you by a name you do not use. Most of them turn back at the second stream.\n\n:::gm\nThe voices are a lure laid by the [[Choir of the Deep]]. Wren’s brother Tobin followed them and now lives in a Choir camp in a clearing a day in, half-convinced he belongs there. He can be talked out of it, but not while his new friends are watching.\n:::',
    tags: ['wilderness'],
  })
  const lighthouse = E('location', 'The Drowned Lighthouse', {
    parentId: coast.id,
    summary: 'A ruined lighthouse, lit again by someone. Players have not found it yet.',
    body: 'Lair of the [[Choir of the Deep]]. A strange pale light burns in the lamp room each night, and the cellars flood and drain with the tide. The missing boats from [[The Missing Fishermen]] are moored in the cellar.',
    tags: ['dungeon'],
  })
  const docks = E('location', 'The Stilt Docks', {
    visibility: 'players',
    parentId: saltmere.id,
    summary: 'Where the fishing fleet ties up',
    body: 'Forty berths on tarred stilts, where the fleet comes in at dusk and the catch is gutted on the planks while gulls scream overhead. One empty berth belongs to the Hale family’s boat, the *Gull’s Promise*; her mooring rope has been cut clean through, and the anchor has been cut loose too.',
  })
  const temple = E('location', 'Temple of the Tides', {
    visibility: 'players',
    parentId: saltmere.id,
    summary: 'Shrine to the sea goddess Thalassa',
    body: 'A low white shrine with a bell that rings at every high tide. Sister Maren tends it, and fishermen leave a coin or a silver fish in the offering bowl before they sail. Lately the bowl has been found empty every morning, and the sister is not sure who is taking it. Dedicated to [[Thalassa]].',
  })
  const tavern = E('shop', 'The Salty Anchor', {
    visibility: 'players',
    parentId: saltmere.id,
    summary: 'Tavern, smoky, loud and full of dockhands',
    body: 'Run by [[Marta Copperkettle]]. A low room of black beams, with a fire that never goes out and a fisherman in the corner with a pale coral-coloured scar across his forearm, who does not like being asked about it.\n\n### Menu\n- House ale: 4 cp\n- Fish pie: 4 cp\n- Room: 5 sp a night\n\n### Rumours\n- The fleet has been coming home early.\n- Lights have been seen out on the water after dark.\n- The harbourmaster is buying up all the silver.\n\n:::gm\nThe fleet is coming home early because the crews are afraid. The lights are real: they are the relit [[The Drowned Lighthouse]]. The silver is also true: Corvin needs it for the vault door.\n:::',
    tags: ['tavern'],
  })
  const smith = E('shop', 'Anvil & Ember', {
    visibility: 'players',
    parentId: docks.id,
    summary: 'Smithy on the docks, hot, loud and fair',
    body: 'Run by [[Dorn Ironfoot]]. The forge roars from dawn, and hooks, harpoons and boat nails hang on the wall in neat rows. Dorn mends tools for the fleet first and sells blades to anyone who has the coin.\n\n### Stock\n- Longsword: 15 gp\n- Shield: 10 gp\n- Harpoon: 5 gp',
  })
  const marta = E('npc', 'Marta Copperkettle', {
    visibility: 'players',
    parentId: tavern.id,
    summary: 'Warm and gossipy halfling innkeeper',
    body: 'Knows everyone’s business, and will happily trade it for a drink or a good story. She has lost three regulars to the sea this month and wants to know why.\n\n:::gm\n**Secret:** she passes gossip to Captain Marsh of the [[Tidewardens]], who suspects the harbourmaster.\n:::',
  })
  const dorn = E('npc', 'Dorn Ironfoot', {
    visibility: 'players',
    parentId: smith.id,
    summary: 'Gruff but fair dwarven smith',
    body: 'Dorn mends hooks and harpoons for the fleet and sells swords to anyone who does not ask what for. He lost two cousins to the sea and will not take work from anyone who sings the Choir’s hymns.',
  })
  const corvin = E('npc', 'Corvin Vane', {
    visibility: 'players',
    parentId: saltmere.id,
    aliases: ['the Harbourmaster'],
    summary: 'Harbourmaster of Saltmere, smooth and ambitious',
    gmNotes: 'Secretly a member of the [[Choir of the Deep]]. Wants the vault opened.',
  })
  // A few relationships and a clock, to show off the relationship web and progress clocks.
  marta.relations = [{ id: newId(), to: corvin.id, kind: 'rival of', known: true, note: 'Old business quarrel' }]
  const wardens = E('faction', 'Tidewardens', {
    visibility: 'players',
    summary: 'The town guard and harbour militia of Saltmere',
    body: 'Led by Captain Idris Marsh, a tired, careful woman who walks the docks every evening. They answer to the harbourmaster on paper.',
  })
  const choir = E('faction', 'Choir of the Deep', {
    summary: 'A cult that worships something beneath the waves',
    body: 'They believe the old empire’s vault holds the thing they worship. Their token is a ring of living coral, and the harbourmaster is buying silver for them because the vault’s door is said to open only to that metal.',
    clocks: [{ id: newId(), name: 'The vault beneath Saltmere is opened', segments: 6, filled: 2 }],
  })
  corvin.relations = [{ id: newId(), to: choir.id, kind: 'member of' }]
  const thalassa = E('deity', 'Thalassa', {
    visibility: 'players',
    summary: 'Goddess of the sea, storms and safe harbour',
    body: 'Sailors pray to her before they cast off and leave her a coin when they return. She is shown as a tall woman with seaweed hair and a lantern in her hand.',
  })
  const sundering = E('event', 'The Sundering', {
    visibility: 'players',
    eventEra: 'pre',
    eventDate: '312 years ago',
    eventOrder: 1,
    parentId: coast.id,
    summary: 'The cataclysm that broke the old empire and drowned half the coast',
  })
  const founding = E('event', 'Founding of Saltmere', {
    visibility: 'players',
    eventEra: 'pre',
    eventDate: '280 years ago',
    eventOrder: 2,
    parentId: saltmere.id,
    summary: 'Refugees build a town on stilts over the flats',
  })
  const relit = E('event', 'The lighthouse is relit', {
    eventEra: 'pre',
    eventDate: '1 month ago',
    eventOrder: 3,
    parentId: lighthouse.id,
    summary: 'The Choir begins its ritual',
  })
  const arrival = E('event', 'The party arrives in Saltmere', {
    visibility: 'players',
    eventEra: 'campaign',
    eventDate: 'Day 1',
    eventOrder: 4,
    parentId: saltmere.id,
    summary: 'The heroes come in out of a storm and find shelter at the Salty Anchor',
  })
  const quest = E('quest', 'The Missing Fishermen', {
    visibility: 'players',
    questStatus: 'active',
    parentId: saltmere.id,
    summary: 'Three boats went out and never came back. Marta asked the party to look into it.',
    body: 'Marta’s regulars are gone and the fleet is frightened. Start by asking around the docks, where one boat’s anchor was cut, and watch the water at night.\n\n:::gm\nThe three boats were lured by the new light at [[The Drowned Lighthouse]] and are moored in its cellar. The crews are alive but charmed by the [[Choir of the Deep]], and will fight to stay until the lamp is put out.\n:::',
    fields: [
      { key: 'Given by', value: 'Marta Copperkettle' },
      { key: 'Reward', value: '30 sp and the best room at the Salty Anchor for free' },
    ],
  })
  const pc = E('pc', 'Wren Thistle', {
    visibility: 'players',
    summary: 'Half-elf ranger, looking for her lost brother',
    body: 'Lean and weather-browned, with a green cloak and an easy way of watching a room. She wants to find her brother Tobin, who went into the woods and did not come out. She carries a short bow and a carved wooden bird he made her.',
    fields: [
      { key: 'Player', value: '(player name)' },
      { key: 'Class', value: 'Ranger 3' },
    ],
  })

  const sessionId = newId()
  const ring = E('thread', 'Corvin’s coral ring', {
    raisedIn: sessionId,
    threadStatus: 'active',
    threadUrgency: 'high',
    summary: 'Wren spotted [[Corvin Vane]] wearing a ring of living coral.',
    body: 'The players are suspicious and want to know where it came from.\n\n:::gm\nIt marks him as a member of [[Choir of the Deep]]. If they press him, he’ll lie and say it was a gift from [[Thalassa]]’s temple.\n:::',
  })
  const brother = E('thread', 'Wren’s missing brother', {
    threadUrgency: 'low',
    summary: '[[Wren Thistle]] is looking for her brother, last seen near [[Whisperwood]].',
  })
  const tremors = E('thread', 'Why are the tremors getting worse?', {
    visibility: 'players',
    raisedIn: sessionId,
    summary: 'Townsfolk in [[Saltmere]] keep mentioning small earthquakes.',
  })
  const entities = [ring, brother, tremors, coast, saltmere, keep, wood, lighthouse, docks, temple, tavern, smith, marta, dorn, corvin, wardens, choir, thalassa, sundering, founding, relit, arrival, quest, pc]

  // The region map is drawn in the classic style, from a drawing that stays editable in the map builder.
  const [{ shatteredCoast, saltmere: saltmereTown, COAST_W, COAST_H, SALTMERE_W, SALTMERE_H }, { renderClassic, classicBlob, loadMapFonts }] = await Promise.all([
    import('./sampleMap'),
    import('./mapArt/classic'),
  ])
  await loadMapFonts()
  const regionDrawing = shatteredCoast()
  const townDrawing = saltmereTown()
  const [regionBlob, townBlob] = await Promise.all([classicBlob(renderClassic(regionDrawing, COAST_W, COAST_H)), classicBlob(renderClassic(townDrawing, SALTMERE_W, SALTMERE_H))])
  const ext = (b: Blob) => (b.type === 'image/webp' ? 'webp' : 'jpg')

  const regionImg = newId()
  const townImg = newId()
  const regionMap = newId()
  const townMap = newId()
  const pin = (p: Omit<Pin, 'id' | 'worldId' | 'note' | 'color' | 'visibility'> & Partial<Pin>): Pin => ({
    id: newId(),
    worldId,
    note: '',
    color: '#e0b354',
    visibility: 'players',
    ...p,
  })

  await db.transaction('rw', [db.worlds, db.entities, db.assets, db.maps, db.pins, db.campaigns, db.sessions], async () => {
    await db.worlds.add({
      id: worldId,
      name: 'The Shattered Coast',
      description: 'A small sample world to explore. Try the map, switch to Player view, and open Saltmere and its tavern, the Salty Anchor.',
      sample: true,
      system: 'System agnostic',
      createdAt: now,
      updatedAt: now,
      calendar: {
        ...structuredClone(CALENDAR_PRESETS.custom.calendar),
        months: ['Deepwinter', 'Thaw', 'Seedtide', 'Stormtide', 'Brightsun', 'Highsun', 'Harvest', 'Saltfall', 'Greymist', 'Frostcome', 'Longdark', 'Yearsend'].map((name) => ({ name, days: 30 })),
        today: { year: 312, month: 3, day: 14 },
        era: 'AS',
      },
      safety: { lines: ['Harm to children'], veils: ['Torture'], notes: 'Anyone can call a break at any time.', xcard: true },
    })
    await db.entities.bulkAdd(entities)
    await db.assets.bulkAdd([
      { id: regionImg, worldId, name: `Shattered Coast map.${ext(regionBlob)}`, mime: regionBlob.type, size: regionBlob.size, blob: regionBlob, tags: ['map', 'drawn'], visibility: 'players', createdAt: now },
      { id: townImg, worldId, name: `Saltmere map.${ext(townBlob)}`, mime: townBlob.type, size: townBlob.size, blob: townBlob, tags: ['map', 'drawn'], visibility: 'players', createdAt: now },
    ])
    await db.maps.bulkAdd([
      { id: regionMap, worldId, name: 'The Shattered Coast', imageId: regionImg, width: COAST_W, height: COAST_H, visibility: 'players', locationId: coast.id, drawing: regionDrawing, createdAt: now },
      { id: townMap, worldId, name: 'Saltmere', imageId: townImg, width: SALTMERE_W, height: SALTMERE_H, visibility: 'players', locationId: saltmere.id, drawing: townDrawing, createdAt: now },
    ])
    // Map coordinates are [y, x] with y measured from the bottom of the image.
    await db.pins.bulkAdd([
      pin({ mapId: regionMap, label: 'Saltmere', kind: 'point', position: [1000 - 640, 560], entityId: saltmere.id, childMapId: townMap }),
      pin({ mapId: regionMap, label: 'Greywatch Keep', kind: 'point', position: [1000 - 200, 820], entityId: keep.id }),
      pin({ mapId: regionMap, label: 'The Drowned Lighthouse', kind: 'point', position: [1000 - 730, 285], entityId: lighthouse.id, visibility: 'gm', color: '#d9534f' }),
      pin({
        mapId: regionMap,
        label: 'Whisperwood',
        kind: 'region',
        color: '#5cb85c',
        entityId: wood.id,
        points: [
          [1000 - 330, 980],
          [1000 - 280, 1180],
          [1000 - 380, 1330],
          [1000 - 540, 1290],
          [1000 - 560, 1060],
          [1000 - 450, 960],
        ],
      }),
      pin({ mapId: townMap, label: 'The Salty Anchor', kind: 'point', position: [800 - 380, 520], entityId: tavern.id }),
      pin({ mapId: townMap, label: 'Temple of the Tides', kind: 'point', position: [800 - 600, 820], entityId: temple.id }),
      pin({ mapId: townMap, label: 'The Stilt Docks', kind: 'point', position: [800 - 600, 380], entityId: docks.id }),
      pin({ mapId: townMap, label: 'Anvil & Ember', kind: 'point', position: [800 - 560, 560], entityId: smith.id }),
      pin({ mapId: townMap, label: 'Harbourmaster’s office', kind: 'point', position: [800 - 470, 260], entityId: corvin.id, note: 'Corvin Vane works here most days.' }),
    ])
    const campaignId = newId()
    await db.campaigns.add({ id: campaignId, worldId, name: 'Tides of the Choir', description: 'Something stirs beneath Saltmere.', system: 'System agnostic', status: 'active', createdAt: now })
    await db.sessions.add({
      id: sessionId,
      worldId,
      campaignId,
      number: 1,
      title: 'Arrival in Saltmere',
      date: localDate(),
      worldDate: { year: 312, month: 3, day: 14 },
      notes: 'Party met [[Marta Copperkettle]] at [[The Salty Anchor]]. Took the [[The Missing Fishermen]] quest.\n\nLoose thread: Wren noticed [[Corvin Vane]] wearing a strange coral ring.',
      recap: 'The party arrived in [[Saltmere]] in a storm and found shelter at [[The Salty Anchor]]. Marta told them about the missing fishing boats.',
      visibility: 'players',
      entityIds: [marta.id, tavern.id, quest.id],
      recordings: [],
      createdAt: now,
    })
  })
  return worldId
}
