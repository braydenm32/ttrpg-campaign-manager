---
name: Who's poisoning the flame?
order: 1
cards:
  - { key: tin, x: 700, y: 420, page: item-oil-tin }
  - { key: sallow, x: 380, y: 180, page: garrick-sallow }
  - { key: mote, x: 80, y: 60, page: ansel-mote }
  - { key: spoons, x: 420, y: 640, page: spoons }
  - { key: widow, x: 1080, y: 160, page: dreaming-widow }
  - { key: seraphine, x: 1350, y: 420, page: seraphine-ashe }
  - { key: tollamund, x: 1100, y: 760, page: tollamund }
  - { key: fennick, x: 760, y: 820, page: fennick }
  - { key: dannic, x: 700, y: 60, page: dannic-rook }
  - { key: n-ash, x: 1080, y: 420, text: The ash in the oil is fine and pale and smells of lake water. Stillwater?, color: "#f6e27a" }
  - { key: n-coin, x: 80, y: 400, text: "Sallow paid for a round with NEW Regency silver, this year's mint. Dannic had the same coin in his purse.", color: "#f6e27a" }
  - { key: n-poster, x: 80, y: 760, text: 'Wanted poster: "last seen on the 12th". He drowned on the 7th. Signed A.M.', color: "#f4a6a6" }
  - { key: n-ledger, x: 1350, y: 760, text: "Fennick's oil ledger: four casks too many burned this quarter. Where did the oil go?", color: "#a6d4f4" }
  - { key: n-note, x: 380, y: 420, text: "Dannic's note: \"S. says one more swap and Im square. Then the clerk wants a word.\"", color: "#f6e27a" }
strings:
  - { from: dannic, to: tin, label: carried }
  - { from: dannic, to: sallow, label: paid by }
  - { from: sallow, to: mote, label: paid by? }
  - { from: n-note, to: sallow, label: '"S."' }
  - { from: n-note, to: mote, label: '"the clerk"?' }
  - { from: n-coin, to: sallow }
  - { from: n-coin, to: mote, label: Regency money }
  - { from: n-poster, to: mote, label: A.M.? }
  - { from: spoons, to: sallow, label: seen near the oil store }
  - { from: spoons, to: tin, label: lying? }
  - { from: n-ash, to: tin }
  - { from: n-ash, to: widow, label: source of the ash? }
  - { from: fennick, to: n-ledger, label: lying? }
  - { from: fennick, to: tollamund, label: owes money to }
  - { from: seraphine, to: tin, label: "wants it lit, not out?" }
  - { from: tollamund, to: tin, label: why would a bank? }
---
