import type { ExWorld } from '../types'

const MONTHS = ['Hollowfrost', 'Thawmere', 'Seedwake', 'Bloomtide', 'Greenreach', 'Highsun', 'Emberwane', 'Reaping', 'Ashfall', 'Leafrot', 'Frostcall', 'Longnight']

export const WORLD: ExWorld = {
  name: 'Vael Ardith',
  description:
    'A continent pinned shut by nine ancient wards, nine years after a war that broke an empire. In Cinderford, on the edge of the ash, an unpaid mercenary company guards a lantern that has never gone out. Tonight it gutters.',
  system: 'Any system (5e notes for the GM)',
  color: '#6b4a2b',
  cover: 'cover',
  calendar: {
    preset: 'custom',
    months: MONTHS.map((name) => ({ name, days: 30 })),
    weekdays: ['Ironday', 'Coinday', 'Hearthday', 'Tideday', 'Wardday', 'Restday'],
    era: 'AW',
    moons: [
      // Pallas is full on the 15th of every month.
      { name: 'Pallas', cycle: 30, offset: 14 },
      // The Ember is full on 16 Ashfall 3011, two nights after the campaign opens.
      { name: 'The Ember', cycle: 23, offset: 3011 * 360 + 8 * 30 + 15 },
    ],
    // The app counts months from 0: 8 is Ashfall.
    today: { year: 3011, month: 8, day: 14 },
  },
  ages: [
    {
      key: 'myth',
      name: 'Before the Count',
      span: 'myth, tens of thousands of years',
      summary: 'The gods wake, the Sleeper dreams, and Tharos takes mortal lovers. Every people tells it differently, and none of them agree.',
    },
    {
      key: 'wards',
      name: 'The Age of Wards',
      span: '0 to 940 AW',
      summary: 'The Nine kill a god and bury it under the land, and the years are counted from that day. The Lithic kingdom of Ul-Tarran rises around the wards, and slowly turns to stone.',
    },
    {
      key: 'crowns',
      name: 'The Age of Crowns',
      span: '940 to 1740 AW',
      summary: 'Human kingdoms rise and fight along the Ardis. The Shellbacks come to the southern bays, and the seven ports sign their first Concord.',
    },
    {
      key: 'imperial',
      name: 'The Imperial Age',
      span: '1740 to 2981 AW',
      summary: 'Twelve centuries of emperors at Caer Ardith: roads, laws, an orc soldier caste bred for war, and debts that never stop growing.',
    },
    {
      key: 'ashen',
      name: 'The Ashen Age',
      span: '2981 AW to now',
      summary: 'The Emperor is murdered, the war for his empty throne burns for twenty-one years, and at Cinders the land itself catches fire. A red moon has hung in the sky ever since.',
    },
  ],
  safety: {
    lines: ['Sexual content shown on screen (desire stays behind a closed door)', 'Harm to children described in detail', 'Torture played out step by step'],
    veils: ['Sex and seduction (fade to black)', 'Torture and executions (summarised, not dwelt on)', 'Body horror from the Sleeper’s dreams (described briefly)', 'Suicide and self-harm'],
    notes:
      'An example for a mature campaign. Vael Ardith is grim: death is plain, soldiers swear, and desire is part of the story. Agree your own lines and veils at session zero, and use the X-card freely. Nobody needs to explain why.',
    xcard: true,
  },
  partyCoin: [
    { name: 'Silver', amount: 0 },
    { name: 'Copper', amount: 14 },
  ],
  campaign: {
    name: 'The Lantern Gutters',
    description:
      'Eight sessions, levels 1 to 5. The Ninth Lantern’s pay doesn’t come, a drowned man walks out of the ford, and the flame that has burned for nine years starts to gutter. Everyone wants the lantern. Only the PCs can learn what it really is.',
  },
}
