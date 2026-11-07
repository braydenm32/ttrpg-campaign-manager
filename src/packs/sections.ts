/**
 * The broad headings the map builder's "Your packs" shows pieces under. A pack can have dozens of
 * small groups ("Interiors · Kitchen", "Workshop · Smithy"…), too many to scroll through, so each
 * piece is put under one of a dozen headings, guessed from its name first and then its group. A
 * group none of the guesses fit keeps its own name, so a GM's own small packs still read sensibly.
 */
import type { PackPiece } from '../db'

/** The headings, in the order they're shown. */
export const SECTIONS = [
  'Buildings',
  'Doors, stairs & features',
  'Furniture & lighting',
  'Kitchen & tavern',
  'Chests, crates & treasure',
  'Camp, farm & village',
  'Workshop & waterfront',
  'Temple, magic & crypt',
  'Ruins, bones & traps',
  'Trees & plants',
  'Rocks & water',
  // world maps
  'Mountains & hills',
  'Forests & plants',
  'Towns & landmarks',
  'Sea & map furniture',
  'GM only',
] as const
export type Section = (typeof SECTIONS)[number]

/** By the piece's own name: the first that fits wins, so the more particular come first. */
const BY_NAME: [Section, RegExp][] = [
  // a few names that would otherwise be caught by a word that comes later in them
  ['Furniture & lighting', /\b(bunk bed|beds?)\b/],
  ['Workshop & waterfront', /\bmine cart\b/],
  ['Temple, magic & crypt', /\b(potions?|herbs?)\b/],
  ['Doors, stairs & features', /\b(door|doors|archway|portcullis|gate|trapdoor|stairs?|staircase|ladder|window|gangplank|lever|winch|grate|pillar|pit)\b/],
  ['Ruins, bones & traps', /\b(trap|spikes?|pressure plate|bones?|skull|cobweb|nest|rubble|debris|chains?|manacles|stocks|cage|scorch|ash|charred|splinters|fallen masonry|roof tiles|torn canvas)\b/],
  ['Kitchen & tavern', /\b(kitchen|oven|stove|jugs?|pot|cooking|kettle|pan|plates|cutlery|food|bread|bottles?|bar counter|wine|tavern|fireplace|cutting board)\b/],
  ['Camp, farm & village', /\b(tent|bedroll|campfire|cart|woodpile|wagon|plough|wheelbarrow|trough|beehive|hay|haystack|coop|camp|market stall|signpost|well|fields)\b/],
  ['Workshop & waterfront', /\b(anvil|forge|bellows|grinding|workbench|tools?|tool rack|ingots|lumber|mine cart|anchor|net|mooring|rope|boats?|rowboat|fishing|smithy|pier|ship)\b/],
  ['Temple, magic & crypt', /\b(altar|shrine|temple|pew|font|prayer|statue|grave|gravestone|coffin|sarcophagus|crypt|magic|ritual|portal|orb|alchemy|potion|cauldron|tome|offering)\b/],
  ['Chests, crates & treasure', /\b(chest|crates?|barrels?|sacks?|baskets?|coins?|gems?|treasure|parchment|armour|armor|weapons?|cellar|storage)\b/],
  ['Buildings', /\b(barn|chapel|cottage|house|houses|pavilion|tower|castle|cathedral|gatehouse|guildhall|manor|market|building|hall|keep|bridge|inn)\b/],
  ['Furniture & lighting', /\b(beds?|bunk|cot|chairs?|armchair|stool|sofa|bench|tables?|desk|books?|scrolls?|lectern|shelf|bookshelf|cupboard|wardrobe|cabinet|rug|throne|bathtub|privy|chandelier|candles?|brazier|lamp|lantern|torch)\b/],
  ['Trees & plants', /\b(trees?|canopy|bush|fern|grass|mushrooms?|reeds|flowers?|wildflowers|hedge|log|stump|seaweed|lily|planter|vines?|shrub|moss)\b/],
  ['Rocks & water', /\b(rocks?|boulders?|crystal cluster|stalagmites?|stalactites?|pond|stream|fountain)\b/],
]

/** By its group, for a name none of those fit. */
const BY_GROUP: [Section, RegExp][] = [
  ['GM only', /\bgm\b/],
  ['Ruins, bones & traps', /\b(ruins?|dressing|traps?|prison|debris|decals)\b/],
  ['Doors, stairs & features', /\b(doors?|features|construction|mechanisms?)\b/],
  ['Kitchen & tavern', /\b(kitchen|tavern)\b/],
  ['Furniture & lighting', /\b(interiors?|furnishings|furniture|lighting|bedrooms?|seating|study|bathing)\b/],
  ['Chests, crates & treasure', /\b(objects|storage|containers|loot|treasure)\b/],
  ['Camp, farm & village', /\b(camp|farm|village|settlement)\b/],
  ['Workshop & waterfront', /\b(workshop|waterfront|harbour|harbor|mining|smithy)\b/],
  ['Temple, magic & crypt', /\b(temple|arcane|crypt|alchemy|magic)\b/],
  ['Buildings', /\b(buildings?|castle|houses?)\b/],
  ['Trees & plants', /\b(nature|trees?|plants?|gardens?)\b/],
  ['Rocks & water', /\b(rocks?|water)\b/],
]

/** World maps' pieces, by group: the same headings as the app's own world-map pieces. */
const WORLD: [Section, RegExp][] = [
  ['Mountains & hills', /\b(mountains?|hills?|volcano)\b/],
  ['Forests & plants', /\b(vegetation|forests?|trees?|plants?|marsh)\b/],
  ['Towns & landmarks', /\b(settlements?|landmarks?|symbols?|towns?|cities|city)\b/],
  ['Sea & map furniture', /\b(sea|furniture|compass|cartouche)\b/],
]

/** The heading a piece goes under: one of SECTIONS, or its own group if nothing fits. */
export function sectionOf(p: Pick<PackPiece, 'label' | 'group' | 'scene'>): string {
  const name = (p.label || '').toLowerCase()
  const group = (p.group || '').toLowerCase()
  if (/\bgm\b/.test(group)) return 'GM only'
  if (p.scene === 'world') return (WORLD.find(([, re]) => re.test(group)) ?? WORLD.find(([, re]) => re.test(name)))?.[0] ?? (p.group || 'Pieces')
  return (BY_NAME.find(([, re]) => re.test(name)) ?? BY_GROUP.find(([, re]) => re.test(group)))?.[0] ?? (p.group || 'Pieces')
}

/** Orders headings: the known ones in their order, then any others by name. */
export const sectionOrder = (a: string, b: string) => {
  const i = SECTIONS.indexOf(a as Section)
  const j = SECTIONS.indexOf(b as Section)
  return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || a.localeCompare(b)
}
