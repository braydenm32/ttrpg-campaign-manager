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
    summary: 'A storm-wracked coastline of fishing towns, sea caves and old ruins.',
    body: 'Three centuries after [[The Sundering]], the coast is still littered with ruins of the old empire. [[Saltmere]] is the largest town; the road north leads to [[Greywatch Keep]].',
  })
  const saltmere = E('location', 'Saltmere', {
    visibility: 'players',
    parentId: coast.id,
    summary: 'Busy fishing town built on stilts over the tidal flats.',
    body: 'Smells of tar and fish. Ruled by the [[Tidewardens]].\n\n:::gm\nThe town sits on top of a sealed vault from the old empire. The tremors are getting worse.\n:::',
    fields: [
      { key: 'Population', value: '~2,400' },
      { key: 'Ruler', value: 'Harbourmaster Corvin Vane' },
    ],
    tags: ['town'],
  })
  const keep = E('location', 'Greywatch Keep', {
    visibility: 'players',
    parentId: coast.id,
    summary: 'A crumbling fortress guarding the northern pass.',
    tags: ['fortress'],
  })
  const wood = E('location', 'Whisperwood', {
    visibility: 'players',
    parentId: coast.id,
    summary: 'Ancient forest where voices are heard between the trees.',
    tags: ['wilderness'],
  })
  const lighthouse = E('location', 'The Drowned Lighthouse', {
    parentId: coast.id,
    summary: 'A ruined lighthouse, lit again by someone. Players have not found it yet.',
    body: 'Lair of the [[Choir of the Deep]].',
    tags: ['dungeon'],
  })
  const docks = E('location', 'The Stilt Docks', { visibility: 'players', parentId: saltmere.id, summary: 'Where the fishing fleet ties up.' })
  const temple = E('location', 'Temple of the Tides', { visibility: 'players', parentId: saltmere.id, summary: 'Shrine to the sea goddess Thalassa.', body: 'Dedicated to [[Thalassa]].' })
  const tavern = E('shop', 'The Salty Anchor', {
    visibility: 'players',
    parentId: saltmere.id,
    summary: 'Tavern, smoky, loud and full of dockhands',
    body: 'Run by [[Marta Copperkettle]].\n\n### Menu\n- House ale: 4 cp\n- Fish pie: 4 sp\n- Room: 5 sp a night\n\n### Rumours\n:::gm\n- Lights have been seen at the old lighthouse.\n- The harbourmaster is buying up all the silver.\n:::',
    tags: ['tavern'],
  })
  const smith = E('shop', 'Anvil & Ember', {
    visibility: 'players',
    parentId: docks.id,
    summary: 'Blacksmith',
    body: 'Run by [[Dorn Ironfoot]].\n\n### Stock\n- Longsword: 15 gp\n- Shield: 10 gp\n- Harpoon: 5 gp',
  })
  const marta = E('npc', 'Marta Copperkettle', {
    visibility: 'players',
    parentId: tavern.id,
    summary: 'Warm and gossipy halfling innkeeper',
    body: 'Knows everyone’s business.\n\n:::gm\n**Secret:** informant for the [[Tidewardens]].\n:::',
  })
  const dorn = E('npc', 'Dorn Ironfoot', { visibility: 'players', parentId: smith.id, summary: 'Gruff but fair dwarven smith' })
  const corvin = E('npc', 'Corvin Vane', {
    visibility: 'players',
    parentId: saltmere.id,
    summary: 'Harbourmaster of Saltmere, smooth and ambitious',
    gmNotes: 'Secretly a member of the [[Choir of the Deep]]. Wants the vault opened.',
  })
  // A few relationships and a clock, to show off the relationship web and progress clocks.
  marta.relations = [{ id: newId(), to: corvin.id, kind: 'rival of', known: true, note: 'Old business quarrel' }]
  const wardens = E('faction', 'Tidewardens', { visibility: 'players', summary: 'The town guard and harbour militia of Saltmere.' })
  const choir = E('faction', 'Choir of the Deep', {
    summary: 'A cult that worships something beneath the waves.',
    clocks: [{ id: newId(), name: 'The vault beneath Saltmere is opened', segments: 6, filled: 2 }],
  })
  corvin.relations = [{ id: newId(), to: choir.id, kind: 'member of' }]
  const thalassa = E('deity', 'Thalassa', { visibility: 'players', summary: 'Goddess of the sea, storms and safe harbour.' })
  const sundering = E('event', 'The Sundering', {
    visibility: 'players',
    eventEra: 'pre',
    eventDate: '312 years ago',
    eventOrder: 1,
    parentId: coast.id,
    summary: 'The cataclysm that broke the old empire and drowned half the coast.',
  })
  const founding = E('event', 'Founding of Saltmere', {
    visibility: 'players',
    eventEra: 'pre',
    eventDate: '280 years ago',
    eventOrder: 2,
    parentId: saltmere.id,
    summary: 'Refugees build a town on stilts over the flats.',
  })
  const relit = E('event', 'The lighthouse is relit', {
    eventEra: 'pre',
    eventDate: '1 month ago',
    eventOrder: 3,
    parentId: lighthouse.id,
    summary: 'The Choir begins its ritual.',
  })
  const arrival = E('event', 'The party arrives in Saltmere', {
    visibility: 'players',
    eventEra: 'campaign',
    eventDate: 'Day 1',
    eventOrder: 4,
    parentId: saltmere.id,
  })
  const quest = E('quest', 'The Missing Fishermen', {
    visibility: 'players',
    questStatus: 'active',
    parentId: saltmere.id,
    summary: 'Three boats went out and never came back. Marta asked the party to look into it.',
  })
  const pc = E('pc', 'Wren Thistle', {
    visibility: 'players',
    summary: 'Half-elf ranger, looking for her lost brother',
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

  const regionImg = newId()
  const townImg = newId()
  const regionMap = newId()
  const townMap = newId()
  const svgBlob = (s: string) => new Blob([s], { type: 'image/svg+xml' })
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
      name: 'The Shattered Coast (sample)',
      description: 'A sample world to explore. Try the map, switch to Player view, and open Saltmere.',
      system: 'System agnostic',
      createdAt: now,
      updatedAt: now,
      calendar: { ...structuredClone(CALENDAR_PRESETS.custom.calendar), today: { year: 312, month: 3, day: 14 }, era: 'AS' },
      safety: { lines: ['Harm to children'], veils: ['Torture'], notes: 'Anyone can call a break at any time.', xcard: true },
    })
    await db.entities.bulkAdd(entities)
    await db.assets.bulkAdd([
      { id: regionImg, worldId, name: 'Shattered Coast map.svg', mime: 'image/svg+xml', size: REGION_SVG.length, blob: svgBlob(REGION_SVG), tags: ['map'], visibility: 'players', createdAt: now },
      { id: townImg, worldId, name: 'Saltmere map.svg', mime: 'image/svg+xml', size: TOWN_SVG.length, blob: svgBlob(TOWN_SVG), tags: ['map'], visibility: 'players', createdAt: now },
    ])
    await db.maps.bulkAdd([
      { id: regionMap, worldId, name: 'The Shattered Coast', imageId: regionImg, width: 1600, height: 1000, visibility: 'players', locationId: coast.id, createdAt: now },
      { id: townMap, worldId, name: 'Saltmere', imageId: townImg, width: 1200, height: 800, visibility: 'players', locationId: saltmere.id, createdAt: now },
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
      date: new Date().toISOString().slice(0, 10),
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

const REGION_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
<defs>
<radialGradient id="sea" cx="30%" cy="70%" r="90%"><stop offset="0" stop-color="#2d5f73"/><stop offset="1" stop-color="#173544"/></radialGradient>
<pattern id="waves" width="60" height="30" patternUnits="userSpaceOnUse"><path d="M0 15 q15 -8 30 0 t30 0" fill="none" stroke="#ffffff" stroke-opacity=".07" stroke-width="2"/></pattern>
</defs>
<rect width="1600" height="1000" fill="url(#sea)"/><rect width="1600" height="1000" fill="url(#waves)"/>
<path d="M420 0 L1600 0 L1600 1000 L760 1000 C700 930 640 900 600 820 C560 740 470 720 470 640 C470 560 560 540 540 470 C520 400 400 380 380 300 C360 220 450 160 430 80 Z" fill="#c9b78a" stroke="#8a7650" stroke-width="4"/>
<path d="M450 90 C470 160 380 220 400 300 C420 380 540 400 560 470 C580 540 490 560 490 640 C490 720 580 740 620 820" fill="none" stroke="#e8dcb8" stroke-width="6" stroke-opacity=".6"/>
<path d="M240 700 C280 660 340 680 330 740 C320 800 250 800 240 760 Z" fill="#c9b78a" stroke="#8a7650" stroke-width="3"/>
<path d="M980 330 C1050 270 1200 270 1330 380 C1300 520 1100 580 1060 560 C970 500 950 420 980 330 Z" fill="#6f8f4e" opacity=".85"/>
${Array.from({ length: 40 }, (_, i) => {
  const x = 1000 + ((i * 73) % 300)
  const y = 340 + ((i * 41) % 200)
  return `<path d="M${x} ${y} l10 -22 l10 22 z" fill="#3f6131"/>`
}).join('')}
${Array.from({ length: 9 }, (_, i) => {
  const x = 700 + i * 70
  const y = 140 + (i % 2) * 30
  return `<path d="M${x} ${y + 60} l40 -80 l40 80 z" fill="#8c8270" stroke="#5a5244" stroke-width="3"/><path d="M${x + 28} ${y + 4} l12 -24 l12 24 z" fill="#f2efe6"/>`
}).join('')}
<path d="M560 640 C700 560 760 380 820 200" fill="none" stroke="#7a5a33" stroke-width="5" stroke-dasharray="14 10"/>
<g font-family="Georgia, serif" fill="#3a2e1c" text-anchor="middle">
<text x="1100" y="760" font-size="54" letter-spacing="10" opacity=".55">THE SHATTERED COAST</text>
<text x="200" y="460" font-size="34" fill="#cfe3ea" opacity=".6" font-style="italic">The Grey Sea</text>
<text x="1160" y="470" font-size="26" font-style="italic" fill="#1e3315">Whisperwood</text>
<text x="980" y="110" font-size="26" font-style="italic">Ashspine Mountains</text>
</g>
<g transform="translate(1460 860)" font-family="Georgia, serif" fill="#3a2e1c"><circle r="60" fill="none" stroke="#3a2e1c" stroke-width="2"/><path d="M0 -70 L12 0 L0 70 L-12 0 Z" fill="#3a2e1c"/><text y="-78" text-anchor="middle" font-size="22">N</text></g>
</svg>`

const TOWN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
<rect width="1200" height="800" fill="#2b5566"/>
<path d="M0 0 H1200 V800 H700 C640 700 520 680 420 640 C300 590 200 620 0 560 Z" fill="#cbbd92"/>
<path d="M0 560 C200 620 300 590 420 640 C520 680 640 700 700 800 H0 Z" fill="#a89a74" opacity=".5"/>
${Array.from({ length: 14 }, (_, i) => `<rect x="${330 + i * 22}" y="${560 + (i % 3) * 10}" width="10" height="140" fill="#6b4f2e"/>`).join('')}
<rect x="300" y="580" width="340" height="24" fill="#8a6a40"/>
${Array.from({ length: 36 }, (_, i) => {
  const x = 200 + ((i * 97) % 820)
  const y = 120 + ((i * 59) % 380)
  return `<rect x="${x}" y="${y}" width="${34 + (i % 3) * 10}" height="${26 + (i % 2) * 12}" fill="#9c5b3c" stroke="#5e3522" stroke-width="2"/>`
}).join('')}
<path d="M120 420 C400 380 700 420 1100 300" fill="none" stroke="#e8dcb8" stroke-width="22" stroke-linecap="round"/>
<path d="M600 60 C600 250 560 420 520 600" fill="none" stroke="#e8dcb8" stroke-width="16" stroke-linecap="round"/>
<circle cx="820" cy="600" r="46" fill="#d9d2bf" stroke="#6e6553" stroke-width="4"/>
<g font-family="Georgia, serif" fill="#3a2e1c" text-anchor="middle"><text x="900" y="760" font-size="46" letter-spacing="8" opacity=".6">SALTMERE</text><text x="200" y="720" font-size="24" fill="#d8e8ee" font-style="italic">Tidal Flats</text></g>
</svg>`
