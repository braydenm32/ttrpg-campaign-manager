---
version: 3 # raise by one to offer everyone with an older copy of the example a fresh one
name: Vael Ardith
system: Any system (5e notes for the GM)
color: "#6b4a2b"
cover: cover
campaign:
  name: The Lantern Gutters
  description: Eight sessions, levels 1 to 5. The Ninth Lantern’s pay doesn’t come, a drowned man walks out of the ford, and the flame that has burned for nine years starts to gutter. Everyone wants the lantern. Only the PCs can learn what it really is.
calendar:
  preset: custom
  months:
    - { name: Hollowfrost, days: 30 }
    - { name: Thawmere, days: 30 }
    - { name: Seedwake, days: 30 }
    - { name: Bloomtide, days: 30 }
    - { name: Greenreach, days: 30 }
    - { name: Highsun, days: 30 }
    - { name: Emberwane, days: 30 }
    - { name: Reaping, days: 30 }
    - { name: Ashfall, days: 30 }
    - { name: Leafrot, days: 30 }
    - { name: Frostcall, days: 30 }
    - { name: Longnight, days: 30 }
  weekdays:
    - Ironday
    - Coinday
    - Hearthday
    - Tideday
    - Wardday
    - Restday
  era: AW
  moons:
    - { name: Pallas, cycle: 30, offset: 14 } # full on the 15th of every month
    - { name: The Ember, cycle: 23, offset: 1084215 } # the red moon: full on 16 Ashfall 3011, two nights after the campaign opens
  holidays: # dated feasts and holy days; the Saint's Lamp and the Unveiling move with the moons, so they are not listed. See Feasts, Fasts and Holy Days.
    - { name: Long Hold, day: 1 Hollowfrost }
    - { name: Sowing, day: 1 Seedwake }
    - { name: Stake Day, day: 7 Seedwake }
    - { name: Greening, day: 1 Bloomtide }
    - { name: The Turning and the Quay-Moot, day: 7 Bloomtide }
    - { name: Firstfire, day: 1 Highsun }
    - { name: Crownfast, day: 15 Highsun }
    - { name: Shadow-Count, day: 2 Emberwane }
    - { name: Anvil Night, day: 30 Emberwane }
    - { name: Eye-Night, day: 17 Reaping }
    - { name: Last Sheaf, day: 30 Reaping }
    - { name: "Tally's Day", day: 3 Ashfall }
    - { name: Cinders Muster, day: 14 Ashfall }
    - { name: Doorsnight, day: 1 Leafrot }
    - { name: The Culling, day: 30 Leafrot }
    - { name: Stonefast, day: 1 Frostcall }
    - { name: Rope Day, day: 6 Frostcall }
    - { name: "Widows' Walk", day: 20 Frostcall }
    - { name: Lastwater, day: 23 Frostcall }
    - { name: The Reckoning, day: 1 Longnight }
    - { name: Hearthnight, day: 30 Longnight }
  today: 14 Ashfall 3011 # the date in the world when the campaign starts
ages: # the parts of history on the timeline; events pick one with "age: <key>"
  - key: myth
    name: Before the Count
    span: myth, tens of thousands of years
    summary: The gods wake, the Sleeper dreams, and Tharos takes mortal lovers. Every people tells it differently, and none of them agree.
  - key: wards
    name: The Age of Wards
    span: 0 to 940 AW
    summary: The Nine kill a god and bury it under the land, and the years are counted from that day. The Lithic kingdom of Ul-Tarran rises around the wards, and slowly turns to stone.
  - key: crowns
    name: The Age of Crowns
    span: 940 to 1740 AW
    summary: Human kingdoms rise and fight along the Ardis. The Shellbacks come to the southern bays, and the seven ports sign their first Concord.
  - key: imperial
    name: The Imperial Age
    span: 1740 to 2981 AW
    summary: "Twelve centuries of emperors at Caer Ardith: roads, laws, an orc soldier caste bred for war, and debts that never stop growing."
  - key: ashen
    name: The Ashen Age
    span: 2981 AW to now
    summary: The Emperor is murdered, the war for his empty throne burns for twenty-one years, and at Cinders the land itself catches fire. A red moon has hung in the sky ever since.
safety:
  lines:
    - Sexual content shown on screen (desire stays behind a closed door)
    - Harm to children described in detail
    - Torture played out step by step
  veils:
    - Sex and seduction (fade to black)
    - Torture and executions (summarised, not dwelt on)
    - Body horror from the Sleeper’s dreams (described briefly)
    - Suicide and self-harm
  notes: "An example for a mature campaign. Vael Ardith is grim: death is plain, soldiers swear, and desire is part of the story. Agree your own lines and veils at session zero, and use the X-card freely. Nobody needs to explain why."
  xcard: true
partyCoin:
  - { name: Silver, amount: 0 }
  - { name: Copper, amount: 14 }
---

A continent pinned shut by nine ancient wards, nine years after a war that broke an empire. In Cinderford, on the edge of the ash, an unpaid mercenary company guards a lantern that has never gone out. Tonight it gutters.
