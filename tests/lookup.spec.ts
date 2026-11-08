import { PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib'
import { expect, open, test, type Page } from './fixtures'
import { putBack } from './lib/records'

/**
 * Look it up and the newer character sheet readers, on a laptop. The tests never reach the real
 * sites (nothing leaves the machine), so each answers for Open5e or the wiki itself, the way those
 * sites answer. Each test removes the pages it made.
 */

type Stored = {
  id: string
  worldId?: string
  name?: string
  type?: string
  body?: string
  fields?: { key: string; value: string }[]
  customType?: string
}

function rows(page: Page, table: string) {
  return page.evaluate(
    (table) =>
      new Promise<Stored[]>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const all = req.result.transaction(table, 'readonly').objectStore(table).getAll()
          all.onsuccess = () => resolve(all.result as Stored[])
          all.onerror = () => reject(all.error)
        }
      }),
    table,
  )
}
const made = async (page: Page, worldId: string, before: Set<string>, name: string) =>
  (await rows(page, 'entities')).filter((e) => e.worldId === worldId && !before.has(e.id) && e.name === name)
/** The pages there are now, so a test removes only the ones it made (never an example page that shares a name). */
const pagesNow = async (page: Page) => new Set((await rows(page, 'entities')).map((e) => e.id))
const forget = async (page: Page, worldId: string, before: Set<string>) => {
  const ids = (await rows(page, 'entities')).filter((e) => e.worldId === worldId && !before.has(e.id)).map((e) => e.id)
  if (ids.length)
    await putBack(
      page,
      'entities',
      ids.map((id): [string, null] => [id, null]),
    )
}

const json = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  headers: { 'access-control-allow-origin': '*' },
  body: JSON.stringify(body),
})

test('Look it up finds a spell in the D&D SRD and keeps it as a page with its credit', async ({ page, world }) => {
  const asked: string[] = []
  await page.route('https://api.open5e.com/**', (route) => {
    const url = new URL(route.request().url())
    asked.push(url.pathname + url.search)
    if (url.pathname === '/v2/spells/')
      return route.fulfill(
        json({
          count: 2,
          results: [
            {
              key: 'srd-2024_fireball',
              name: 'Fireball',
              document: {
                key: 'srd-2024',
                name: 'System Reference Document 5.2',
              },
              desc: 'A bright streak flashes from you to a point you choose within range and then blossoms into an explosion of flame.',
              higher_level: 'The damage increases by 1d6 for each spell slot level above 3.',
              level: 3,
              school: { name: 'Evocation', key: 'evocation' },
              range_text: '150 feet',
              concentration: false,
              classes: [{ name: 'Sorcerer' }, { name: 'Wizard' }],
            },
            // Another book's spell, which this source leaves out.
            {
              key: 'other_fireball',
              name: 'Fireball of Elsewhere',
              document: { key: 'tob' },
              desc: 'Not this one.',
            },
          ],
        }),
      )
    if (url.pathname === '/v2/rules/') return route.fulfill({ status: 404, body: '' })
    return route.fulfill(json({ count: 0, results: [] }))
  })
  await open(page, `/w/${world.slug}/lookup`)
  const before = await pagesNow(page)
  try {
    await expect(page.getByRole('heading', { name: 'Look it up', level: 1 })).toBeVisible()
    // The example world plays no one game, so it starts on the 2024 rules.
    await expect(page.getByRole('combobox', { name: 'Game' })).toHaveValue('D&D 5e (2024)')
    await page.getByRole('searchbox', { name: 'Look up' }).fill('fireball')
    await page.locator('.lookup-search').getByRole('button', { name: 'Search' }).click()
    const results = page.getByRole('list', { name: 'Results' })
    await expect(results.getByRole('button', { name: 'Fireball', exact: true })).toBeVisible()
    await expect(results).not.toContainText('Elsewhere')
    expect(asked.some((a) => a.startsWith('/v2/spells/') && a.includes('document__key__in=srd-2024'))).toBe(true)

    await results.getByRole('button', { name: 'Fireball', exact: true }).click()
    await expect(page.locator('.lookup-result')).toContainText('blossoms into an explosion')
    await expect(page.locator('.lookup-result')).toContainText('System Reference Document 5.2')
    await page.getByRole('button', { name: 'Make the page' }).click()
    await expect(page.getByRole('heading', { name: 'Fireball', level: 1 })).toBeVisible()
    const [spell] = await made(page, world.id, before, 'Fireball')
    expect(spell.type).toBe('lore')
    expect(spell.body).toContain('### At higher levels')
    expect(spell.body).toContain('Creative Commons Attribution 4.0')
    expect(spell.fields).toEqual(
      expect.arrayContaining([
        { key: 'Level', value: '3' },
        { key: 'School', value: 'Evocation' },
        { key: 'Classes', value: 'Sorcerer, Wizard' },
      ]),
    )
  } finally {
    await forget(page, world.id, before)
  }
})

test('Look it up reads a wiki article, its infobox and licence, and says when a site can’t be reached', async ({ page, world }) => {
  await page.route('https://forgottenrealms.fandom.com/api.php**', (route) => {
    const p = new URL(route.request().url()).searchParams
    expect(p.get('origin')).toBe('*')
    if (p.get('meta') === 'siteinfo')
      return route.fulfill(
        json({
          query: {
            general: {
              server: 'https://forgottenrealms.fandom.com',
              articlepath: '/wiki/$1',
            },
            rightsinfo: {
              url: 'https://www.fandom.com/licensing',
              text: 'CC-BY-SA',
            },
          },
        }),
      )
    if (p.get('list') === 'search')
      return route.fulfill(
        json({
          query: {
            search: [
              {
                title: 'Phandalin',
                snippet: 'A <span class="searchmatch">town</span> on the Triboar Trail.',
              },
            ],
          },
        }),
      )
    if (p.get('action') === 'parse')
      return route.fulfill(
        json({
          parse: {
            title: 'Phandalin',
            displaytitle: 'Phandalin',
            text: `<div class="mw-parser-output"><aside class="portable-infobox"><div class="pi-data"><h3 class="pi-data-label">Region</h3><div class="pi-data-value">Sword Coast North</div></div><div class="pi-data"><h3 class="pi-data-label">Population</h3><div class="pi-data-value">500<sup class="reference">[1]</sup></div></div></aside><p><b>Phandalin</b> was a frontier town in the foothills of the Sword Mountains.<sup class="reference">[2]</sup></p><table><tr><td>a table</td></tr></table><div class="mw-heading mw-heading2"><h2>History</h2></div><p>It was rebuilt by settlers.</p><div class="mw-heading mw-heading2"><h2>References</h2></div><ol><li>A book</li></ol></div>`,
          },
        }),
      )
    return route.fulfill(json({}))
  })
  await open(page, `/w/${world.slug}/lookup`)
  const before = await pagesNow(page)
  try {
    await page.getByRole('combobox', { name: 'Game' }).selectOption('D&D 5e (2014)')
    await page.getByRole('group', { name: 'Where to look' }).getByRole('button', { name: 'Forgotten Realms Wiki' }).click()
    // The rules this game keeps behind a login are a link to the site, never copied.
    await expect(page.locator('.lookup-links').getByRole('link', { name: /D&D Beyond/ })).toHaveAttribute('target', '_blank')
    await page.getByRole('searchbox', { name: 'Look up' }).fill('phandalin')
    await page.locator('.lookup-search').getByRole('button', { name: 'Search' }).click()
    await expect(page.getByRole('list', { name: 'Results' })).toContainText('A town on the Triboar Trail.')
    await page.getByRole('button', { name: 'Phandalin', exact: true }).click()
    const result = page.locator('.lookup-result')
    await expect(result).toContainText('frontier town in the foothills')
    await expect(result).toContainText('Sword Coast North')
    await expect(result).not.toContainText('a table')
    await expect(result).not.toContainText('A book')
    await expect(result.getByRole('link', { name: 'CC-BY-SA' })).toHaveAttribute('href', 'https://www.fandom.com/licensing')
    await page.getByRole('button', { name: 'Make the page' }).click()
    await expect(page.getByRole('heading', { name: 'Phandalin', level: 1 })).toBeVisible()
    const [town] = await made(page, world.id, before, 'Phandalin')
    // An infobox with a region and a population makes it a place.
    expect(town.type).toBe('location')
    expect(town.fields).toEqual([
      { key: 'Region', value: 'Sword Coast North' },
      { key: 'Population', value: '500' },
    ])
    expect(town.body).toContain('https://forgottenrealms.fandom.com/wiki/Phandalin')

    // A wiki that can't be reached says so plainly (this test answers for no other site).
    await open(page, `/w/${world.slug}/lookup`)
    await page.getByRole('combobox', { name: 'Game' }).selectOption('Cyberpunk RED')
    await page.getByRole('searchbox', { name: 'Look up' }).fill('arasaka')
    await page.locator('.lookup-search').getByRole('button', { name: 'Search' }).click()
    await expect(page.getByText('Couldn’t reach Cyberpunk Wiki.')).toBeVisible()
    // A game whose rules aren't free to copy only offers links.
    await page.getByRole('combobox', { name: 'Game' }).selectOption('Shadowdark')
    await expect(page.getByRole('searchbox', { name: 'Look up' })).toBeDisabled()
    await expect(page.locator('.lookup-links')).toContainText('aren’t free to copy')
  } finally {
    await forget(page, world.id, before)
  }
})

test('character sheets from Hero Lab, Fantasy Grounds and Shadowdarklings come in', async ({ page, world }) => {
  const heroLab = (name: string) =>
    `<character name="${name}" role="pc"><race racetext="Half-Elf"/><alignment name="Neutral Good"/><classes level="5" summary="Bard 5"><class name="Bard" level="5"/></classes><attributes><attribute name="Strength"><attrvalue modified="10"/><attrbonus text="+0"/></attribute><attribute name="Charisma"><attrvalue modified="18"/><attrbonus text="+4"/></attribute></attributes><health hitpoints="33"/><armorclass ac="15"/><feats><feat name="Lingering Performance"><description>Songs last longer.</description></feat></feats><gear><item name="Lute" quantity="1"/></gear><melee><weapon name="Rapier" quantity="1"/></melee></character>`
  const portfolio = `<?xml version="1.0"?><document signature="Hero Lab Statblock"><public>${heroLab('Sheet Test Lyra')}</public></document>`
  const fg = `<?xml version="1.0" encoding="utf-8"?><root version="4.1"><character><name type="string">Sheet Test Brom</name><race type="string">Dwarf</race><classes><id-00001><name type="string">Fighter</name><level type="number">3</level></id-00001></classes><abilities><strength><score type="number">16</score><bonus type="number">3</bonus></strength></abilities><hp><total type="number">28</total></hp><defenses><ac><total type="number">18</total></ac></defenses><inventorylist><id-00001><name type="string">Warhammer</name><count type="number">1</count><carried type="number">2</carried></id-00001><id-00002><name type="string">Spare boots</name><count type="number">1</count><carried type="number">0</carried></id-00002></inventorylist></character></root>`
  const sd = {
    name: 'Sheet Test Wren',
    ancestry: 'Halfling',
    class: 'Thief',
    level: 2,
    title: 'Footpad',
    alignment: 'Neutral',
    stats: { STR: 8, DEX: 16, CON: 12, INT: 10, WIS: 11, CHA: 13 },
    maxHitPoints: 7,
    armorClass: 14,
    gear: [{ name: 'Thieves’ tools', quantity: 1 }],
    bonuses: [{ name: 'Backstab' }],
    goldRemaining: 12,
  }
  const importFile = async (name: string, mimeType: string, body: string) => {
    await open(page, `/w/${world.slug}/settings?tab=data`)
    await page.getByRole('button', { name: 'Import character sheet' }).click()
    await page.locator('.sheet-way input[type=file]').setInputFiles({ name, mimeType, buffer: Buffer.from(body) })
  }
  await open(page, `/w/${world.slug}/settings?tab=data`)
  const before = await pagesNow(page)
  try {
    await importFile('lyra.xml', 'application/xml', portfolio)
    await expect(page.getByText('from Hero Lab')).toBeVisible()
    await expect(page.locator('.sheet-fields')).toContainText('18 (+4)')
    await page.getByRole('button', { name: 'Add the character' }).click()
    await expect(page.getByRole('heading', { name: 'Sheet Test Lyra', level: 1 })).toBeVisible()

    await importFile('brom.xml', 'text/xml', fg)
    await expect(page.getByText('from Fantasy Grounds')).toBeVisible()
    await expect(page.locator('.sheet-fields')).toContainText('16 (+3)')
    await page.getByRole('button', { name: 'Add the character' }).click()
    await expect(page.getByRole('heading', { name: 'Sheet Test Brom', level: 1 })).toBeVisible()

    await importFile('wren.json', 'application/json', JSON.stringify(sd))
    await expect(page.getByText('from Shadowdarklings')).toBeVisible()
    await page.getByRole('button', { name: 'Add the character' }).click()
    await expect(page.getByRole('heading', { name: 'Sheet Test Wren', level: 1 })).toBeVisible()

    const pages = (await rows(page, 'entities')).filter((e) => e.worldId === world.id && !before.has(e.id))
    const lyra = pages.find((e) => e.name === 'Sheet Test Lyra')!
    expect(lyra.fields).toEqual(
      expect.arrayContaining([
        { key: 'HP', value: '33' },
        { key: 'AC', value: '15' },
      ]),
    )
    expect(lyra.body).toContain('Lingering Performance')
    // Gear comes in as item pages; Fantasy Grounds' "not carried" things stay at home.
    expect(pages.map((e) => e.name)).toEqual(expect.arrayContaining(['Lute', 'Rapier', 'Warhammer', 'Thieves’ tools']))
    expect(pages.some((e) => e.name === 'Spare boots')).toBe(false)
  } finally {
    await forget(page, world.id, before)
  }
})

/**
 * A PDF made the way D&D Beyond makes its sheets now: the boxes sit on the page but aren't listed in
 * the PDF's form, and long text is written as hex broken over lines.
 */
async function beyondPdf(boxes: [string, string][]) {
  const doc = await PDFDocument.create()
  const page = doc.addPage()
  const hex = (text: string) => {
    const units = [...text].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('')
    const all = `FEFF${units}`.toUpperCase()
    // A line break after an odd number of hex digits, as D&D Beyond writes them.
    return PDFHexString.of(`${all.slice(0, 101)}\n${all.slice(101)}`)
  }
  const refs = boxes.map(([name, value]) =>
    doc.context.register(
      doc.context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        FT: 'Tx',
        Rect: [0, 0, 10, 10],
        T: PDFString.of(name),
        V: value.length > 30 ? hex(value) : PDFString.of(value),
      }),
    ),
  )
  page.node.set(PDFName.of('Annots'), doc.context.obj(refs))
  return Buffer.from(await doc.save())
}

test('a D&D Beyond PDF, whose boxes aren’t in the PDF’s form, comes in whole', async ({ page, world }) => {
  await open(page, `/w/${world.slug}/settings?tab=data`)
  const before = await pagesNow(page)
  const pdf = await beyondPdf([
    ['CharacterName', 'Sheet Test Vhorand'],
    ['CLASS  LEVEL', 'Paladin 7'],
    ['RACE', 'Mountain Dwarf'],
    ['STR', '20'],
    ['STRmod', '+5'],
    ['ST Strength', '+9'],
    ['AthleticsProf', 'P'],
    ['Athletics', '+8'],
    ['AthleticsMod', 'STR'],
    ['Wpn Name', 'Maul'],
    ['Wpn1 AtkBonus', '+8'],
    ['Wpn1 Damage', '2d6+5 Bludgeoning'],
    ['FeaturesTraits1', '=== PALADIN FEATURES ===\nLay On Hands. You have a pool of healing power that replenishes when you'],
    ['FeaturesTraits2', 'finish a Long Rest.'],
    ['Eq Name0', 'Sheet Test Tower Shield'],
    ['Eq Qty0', '1'],
    ['Eq Weight0', '6 lb.'],
    ['spellHeader0', '=== 1st LEVEL ==='],
    ['spellName0', 'Bless'],
    ['spellSource0', 'Paladin'],
    ['GP', '233'],
    ['CharacterName2', 'Sheet Test Vhorand'],
  ])
  try {
    await page.getByRole('button', { name: 'Import character sheet' }).click()
    await page.locator('.sheet-way input[type=file]').setInputFiles({
      name: 'player_161676672.pdf',
      mimeType: 'application/pdf',
      buffer: pdf,
    })
    await expect(page.getByText('from PDF sheet')).toBeVisible()
    await expect(page.locator('.sheet-fields')).toContainText('20 (+5)')
    await page.getByRole('button', { name: 'Add the character' }).click()
    await expect(page.getByRole('heading', { name: 'Sheet Test Vhorand', level: 1 })).toBeVisible()
    const made = (await rows(page, 'entities')).filter((e) => e.worldId === world.id && !before.has(e.id))
    const pc = made.find((e) => e.name === 'Sheet Test Vhorand')!
    expect(pc.fields).toEqual(
      expect.arrayContaining([
        { key: 'Str', value: '20 (+5)' },
        { key: 'Saves', value: 'Str +9' },
        { key: 'Species', value: 'Mountain Dwarf' },
      ]),
    )
    expect(pc.body).toContain('pool of healing power that replenishes when you finish a Long Rest.')
    expect(pc.body).toContain('Athletics +8 (proficient)')
    expect(pc.body).toContain('**Maul** +8 to hit, 2d6+5 Bludgeoning')
    expect(pc.body).toContain('**1st level:** Bless')
    expect(pc.body).not.toContain('Eq Weight')
    expect(made.map((e) => e.name)).toContain('Sheet Test Tower Shield')
  } finally {
    await forget(page, world.id, before)
  }
})

test('the Daggerheart rules come with the app: found, read and kept without asking another site', async ({ page, world }) => {
  const elsewhere: string[] = []
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost')) elsewhere.push(r.url())
  })
  await open(page, `/w/${world.slug}/lookup`)
  const before = await pagesNow(page)
  try {
    await page.getByRole('combobox', { name: 'Game' }).selectOption('Daggerheart')
    await page.getByRole('searchbox', { name: 'Look up' }).fill('acid burrower')
    await page.locator('.lookup-search').getByRole('button', { name: 'Search' }).click()
    const results = page.getByRole('list', { name: 'Results' })
    await expect(results.getByRole('button', { name: 'Acid Burrower', exact: true })).toBeVisible()
    await results.getByRole('button', { name: 'Acid Burrower', exact: true }).click()
    const result = page.locator('.lookup-result')
    await expect(result).toContainText('Spit Acid')
    await expect(result).toContainText('Darrington Press Community Gaming')
    await page.getByRole('button', { name: 'Make the page' }).click()
    await expect(page.getByRole('heading', { name: 'Acid Burrower', level: 1 })).toBeVisible()
    const [burrower] = await made(page, world.id, before, 'Acid Burrower')
    expect(burrower.type).toBe('npc')
    expect(burrower.fields).toEqual(expect.arrayContaining([{ key: 'Difficulty', value: '14' }, { key: 'HP', value: '8' }]))
    // Words from the rules text find the rules too.
    await open(page, `/w/${world.slug}/lookup`)
    await page.getByRole('combobox', { name: 'Game' }).selectOption('Daggerheart')
    await page.getByRole('searchbox', { name: 'Look up' }).fill('vulnerable')
    await page.locator('.lookup-search').getByRole('button', { name: 'Search' }).click()
    await expect(page.getByRole('list', { name: 'Results' }).getByRole('button', { name: 'Conditions', exact: true })).toBeVisible()
    expect(elsewhere).toEqual([])
  } finally {
    await forget(page, world.id, before)
  }
})

test.describe('players', () => {
  test.use({ view: 'player' })
  test('players can look up the rules, but nothing they find is kept', async ({ page, world }) => {
    await open(page, `/w/${world.slug}/lookup`)
    await expect(page.getByRole('heading', { name: 'Look it up', level: 1 })).toBeVisible()
    await page.getByRole('combobox', { name: 'Game' }).selectOption('Daggerheart')
    await page.getByRole('searchbox', { name: 'Look up' }).fill('stress')
    await page.locator('.lookup-search').getByRole('button', { name: 'Search' }).click()
    await page.getByRole('list', { name: 'Results' }).getByRole('button', { name: 'Stress', exact: true }).click()
    await expect(page.locator('.lookup-result')).toContainText('Darrington Press')
    await expect(page.getByRole('button', { name: 'Make the page' })).toHaveCount(0)
    await expect(page.getByText('Keep it as')).toHaveCount(0)
  })
})
