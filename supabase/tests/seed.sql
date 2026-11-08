-- A made-up world for security_audit.sql, with one of everything players get or must not get: pages
-- with links, nicknames and secret passages, a timeline with ages, random tables, maps (fogged, with a
-- GM copy), pins, sessions, reputation, files, something being shown and handouts. Rows are shaped as
-- the app writes them (src/cloud/sync.ts: each row's id and world id are also inside it).
--
-- People:  GM a1 (owns "Test Realm" and the example world), co-GM a2 "Dana", GM a3 (owns another world),
--          players b1 "Alice" (plays Wren Ashford), b2 "Bob" (Silas Vane), b3 "Cara" (asked to play Mira,
--          not approved yet), example-world players b4 (Varra) and b5 (Quorl), and c1..c4 with no worlds
--          (c2 "Dave", c3 "Erin" and c4 "Finn" join in checks.sql).

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'gm@example.com'),
  ('00000000-0000-4000-8000-0000000000a2', 'cogm@example.com'),
  ('00000000-0000-4000-8000-0000000000a3', 'gm2@example.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'alice@example.com'),
  ('00000000-0000-4000-8000-0000000000b2', 'bob@example.com'),
  ('00000000-0000-4000-8000-0000000000b3', 'cara@example.com'),
  ('00000000-0000-4000-8000-0000000000b4', 'vera@example.com'),
  ('00000000-0000-4000-8000-0000000000b5', 'quinn@example.com'),
  ('00000000-0000-4000-8000-0000000000c1', 'stranger@example.com'),
  ('00000000-0000-4000-8000-0000000000c2', 'joiner@example.com'),
  ('00000000-0000-4000-8000-0000000000c3', 'joiner2@example.com'),
  ('00000000-0000-4000-8000-0000000000c4', 'joiner3@example.com');

insert into public.cloud_worlds (id, owner, name, share_token, invite_token) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1', 'Test Realm', 'w1-share-token-0123456789abcdef', 'w1-invite-token-0123456789abcdef'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000a1', 'Vael Ardith', 'va-share-token-0123456789abcdef', 'va-invite-token-0123456789abcdef'),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-0000000000a3', 'Other World', null, null);
insert into public.gm_invites (world_id, token) values ('10000000-0000-4000-8000-000000000001', 'w1-cogm-token-0123456789abcdef');

insert into public.world_members (world_id, user_id, role, display_name) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a2', 'gm', 'Dana'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'player', 'Alice'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b2', 'player', 'Bob'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b3', 'player', 'Cara'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000b4', 'player', 'Vera'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000b5', 'player', 'Quinn');

-- ---------- Test Realm ----------
insert into public.records (world_id, table_name, id, data)
select '10000000-0000-4000-8000-000000000001', t, d->>'id', d from (values
('worlds', $${"id": "10000000-0000-4000-8000-000000000001", "name": "Test Realm", "system": "D&D 5e",
  "description": "Home of [[Duke Orlov|the masked duke]] and [[Brindle Inn|the inn]].",
  "coverId": "a1000000-0000-4000-8000-000000000001", "gmNotes": "World secrets", "gmScreen": {"pinned": ["ent-duke"], "rolls": [{"name": "Assassin (Brother Halm)", "expr": "1d20+5"}]},
  "weather": "Rain", "safety": {"lines": ["spiders"], "veils": ["torture"], "notes": "X-card on", "xcard": true},
  "ages": [
    {"id": "age-visible", "name": "Age of Founding", "span": "0 to 100", "summary": "When the inn was built."},
    {"id": "age-secret", "name": "The Hidden Reign of Vael", "summary": "The Duke has secretly been the lich for 200 years."},
    {"id": "age-campaign", "name": "Age of Ambushes", "summary": "Holds only an event from play."},
    {"id": "age-revealed", "name": "Age of the Pact", "summary": "Only Bob knows of it."},
    {"id": "age-empty", "name": "Empty Age"}],
  "showing": {"id": "show-1", "kind": "image", "title": "The map", "assetId": "a1000000-0000-4000-8000-000000000004", "at": 1},
  "handouts": [
    {"id": "h1", "kind": "image", "title": "A letter", "assetId": "a1000000-0000-4000-8000-000000000008", "at": 1},
    {"id": "h2", "kind": "text", "title": "A note", "text": "Read this: [[Duke Orlov|him]] and [[Old Tom|Tom]].\n:::gm\nsecret handout line\n:::", "at": 2},
    {"id": "h3", "kind": "page", "title": "The inn", "entityId": "ent-inn", "at": 3},
    {"id": "h4", "kind": "page", "title": "The nun", "entityId": "ent-vey", "at": 4},
    {"id": "h5", "kind": "image", "title": "Clean map", "assetId": "a1000000-0000-4000-8000-000000000004", "at": 5},
    {"id": "h6", "kind": "text", "title": "Later", "text": "Not yet", "at": 6, "revealAt": 99999999999999}],
  "createdAt": 1700000000000, "updatedAt": 1700000000000}$$::jsonb),
('campaigns', $${"id": "camp1", "worldId": "10000000-0000-4000-8000-000000000001", "name": "Main", "description": "The duke story", "system": "D&D 5e", "status": "active",
  "storySoFar": "So far we met [[Duke Orlov|a stranger]] at [[Brindle Inn]].\n:::gm\nhidden story\n:::", "schedule": {"day": "friday"}, "booked": ["2026-11-20"], "createdAt": 1700000000000}$$::jsonb),
('campaigns', $${"id": "camp2", "worldId": "10000000-0000-4000-8000-000000000001", "name": "Secret Sequel", "description": "", "visibility": "gm", "createdAt": 1700000000000}$$::jsonb),
('entities', $${"id": "ent-inn", "worldId": "10000000-0000-4000-8000-000000000001", "type": "location", "name": "Brindle Inn", "visibility": "players",
  "summary": "Run by [[Old Tom|the old man]]; [[Duke Orlov|a duke]] visits.",
  "body": "The [[Duke Orlov|hooded stranger]] drinks here. [[Old Tom]] runs it, and [[Masked Lich|Old Tom]] knows more. [[ brindle INN |this place]] is warm. [[Sister Vey]] prays. A [[Nowhere Page|lost link]] and [[Nowhere Page]]. A [[Template NPC|stock villain]].\n![](asset:a1000000-0000-4000-8000-000000000002)\n:::gm\nThe [[Duke Orlov]] is a lich.\n:::",
  "gmNotes": "GM notes about the inn", "tags": ["tavern"], "gmTags": ["secret-hub"],
  "fields": [{"key": "Owner", "value": "[[Duke Orlov|someone]]"}, {"key": "Rooms", "value": "6"}, {"key": "Secret", "value": "[[Duke Orlov]]", "gm": true}],
  "createdAt": 1700000000001, "updatedAt": 1700000000001}$$::jsonb),
('entities', $${"id": "ent-tom", "worldId": "10000000-0000-4000-8000-000000000001", "type": "npc", "name": "Old Tom", "visibility": "players", "aliases": ["Masked Lich", "Tom"],
  "imageId": "a1000000-0000-4000-8000-000000000003", "summary": "", "body": "Pours ale.", "gmNotes": "", "tags": [], "fields": [], "createdAt": 1700000000002, "updatedAt": 1700000000002}$$::jsonb),
('entities', $${"id": "ent-duke", "worldId": "10000000-0000-4000-8000-000000000001", "type": "npc", "name": "Duke Orlov", "visibility": "gm", "revealedTo": ["00000000-0000-4000-8000-0000000000b1"],
  "summary": "", "body": "A lich in disguise. Friends with [[Sister Vey|a nun]].", "gmNotes": "Kill him in act 3", "tags": [], "fields": [], "createdAt": 1700000000003, "updatedAt": 1700000000003}$$::jsonb),
('entities', $${"id": "ent-vey", "worldId": "10000000-0000-4000-8000-000000000001", "type": "npc", "name": "Sister Vey", "visibility": "gm", "summary": "", "body": "Cult leader.", "gmNotes": "", "tags": [], "fields": [], "createdAt": 1700000000004, "updatedAt": 1700000000004}$$::jsonb),
('entities', $${"id": "ent-template", "worldId": "10000000-0000-4000-8000-000000000001", "type": "npc", "name": "Template NPC", "visibility": "players", "template": true, "summary": "", "body": "", "gmNotes": "", "tags": [], "fields": [], "createdAt": 1700000000005, "updatedAt": 1700000000005}$$::jsonb),
('entities', $${"id": "ent-wren", "worldId": "10000000-0000-4000-8000-000000000001", "type": "pc", "name": "Wren Ashford", "visibility": "players",
  "summary": "A ranger", "body": ":::for Wren\nWren knows [[Duke Orlov|the duke]] is a lich.\n:::\nA ranger from the north.",
  "playerBody": ":::foryouForged secret for everyone:::\nMy notes about [[Duke Orlov|my enemy]].\n  :::  FORYOU\nalso forged\n:::\n:::foryou\nold-style forged block\n:::\n![](asset:a1000000-0000-4000-8000-00000000000d)\nend",
  "gmNotes": "", "tags": [], "fields": [{"key": "Class", "value": "Ranger"}], "createdAt": 1700000000006, "updatedAt": 1700000000006}$$::jsonb),
('entities', $${"id": "ent-silas", "worldId": "10000000-0000-4000-8000-000000000001", "type": "pc", "name": "Silas Vane", "visibility": "players", "summary": "", "body": ":::for Silas\nSilas has a secret.\n:::\nA thief.", "gmNotes": "", "tags": [], "fields": [], "createdAt": 1700000000007, "updatedAt": 1700000000007}$$::jsonb),
('entities', $${"id": "ent-mira", "worldId": "10000000-0000-4000-8000-000000000001", "type": "pc", "name": "Mira", "visibility": "players", "summary": "", "body": "", "gmNotes": "", "tags": [], "fields": [], "createdAt": 1700000000008, "updatedAt": 1700000000008}$$::jsonb),
-- Nobody plays Kael yet: a new player claims him in checks.sql.
('entities', $${"id": "ent-kael", "worldId": "10000000-0000-4000-8000-000000000001", "type": "pc", "name": "Kael", "visibility": "players", "summary": "", "body": "", "gmNotes": "", "tags": [], "fields": [{"key": "GM secret", "value": "x", "gm": true}], "createdAt": 1700000000019, "updatedAt": 1700000000019}$$::jsonb),
('entities', $${"id": "ent-crlf", "worldId": "10000000-0000-4000-8000-000000000001", "type": "lore", "name": "Odd Lines", "visibility": "players",
  "body": "a\n:::gm\nSECRET1\n:::\r\r\nSECRET2\n:::\nb", "summary": "", "gmNotes": "", "tags": [], "fields": [], "createdAt": 1700000000009, "updatedAt": 1700000000009}$$::jsonb),
('entities', $${"id": "ent-crlf2", "worldId": "10000000-0000-4000-8000-000000000001", "type": "lore", "name": "Windows Lines", "visibility": "players",
  "body": ":::gm\r\nHIDDEN\r\n:::\r\nshown\r\nline two", "summary": "", "gmNotes": "", "tags": [], "fields": [], "createdAt": 1700000000010, "updatedAt": 1700000000010}$$::jsonb),
('entities', $${"id": "ent-crlf3", "worldId": "10000000-0000-4000-8000-000000000001", "type": "lore", "name": "Lone CR", "visibility": "players",
  "body": "a\n:::gm\nSECRET\r:::\nAFTER\n:::\nb\rc", "summary": "", "gmNotes": "", "tags": [], "fields": [], "createdAt": 1700000000011, "updatedAt": 1700000000011}$$::jsonb),
('entities', $${"id": "ent-table", "worldId": "10000000-0000-4000-8000-000000000001", "type": "table", "name": "Rumours", "visibility": "players", "summary": "", "body": "", "gmNotes": "", "tags": [], "fields": [],
  "entries": ["A goblin", "\u00a0# GM: the lich is the duke", "\ufeff#note", "  # plain note", "\t#tab note", "3x Two goblins", ":::gm secret line:::", "\u3000", "[[Duke Orlov|the duke]] was seen", "", "\u2003\u2003#em space note"],
  "createdAt": 1700000000012, "updatedAt": 1700000000012}$$::jsonb),
('entities', $${"id": "ent-ev1", "worldId": "10000000-0000-4000-8000-000000000001", "type": "event", "name": "The Founding", "visibility": "players", "eventEra": "pre", "eventAge": "age-visible", "eventOrder": 1, "summary": "", "body": "", "gmNotes": "", "tags": [], "fields": [], "createdAt": 1700000000013, "updatedAt": 1700000000013}$$::jsonb),
('entities', $${"id": "ent-ev2", "worldId": "10000000-0000-4000-8000-000000000001", "type": "event", "name": "The Hidden Reign", "visibility": "gm", "eventEra": "pre", "eventAge": "age-secret", "eventOrder": 2, "summary": "", "body": "", "gmNotes": "", "tags": [], "fields": [], "createdAt": 1700000000014, "updatedAt": 1700000000014}$$::jsonb),
('entities', $${"id": "ent-ev3", "worldId": "10000000-0000-4000-8000-000000000001", "type": "event", "name": "The Ambush", "visibility": "players", "eventEra": "campaign", "eventAge": "age-campaign", "eventOrder": 3, "summary": "", "body": "", "gmNotes": "", "tags": [], "fields": [], "createdAt": 1700000000015, "updatedAt": 1700000000015}$$::jsonb),
('entities', $${"id": "ent-ev4", "worldId": "10000000-0000-4000-8000-000000000001", "type": "event", "name": "The Pact", "visibility": "gm", "revealedTo": ["00000000-0000-4000-8000-0000000000b2"], "eventAge": "age-revealed", "eventOrder": 4, "summary": "", "body": "", "gmNotes": "", "tags": [], "fields": [], "createdAt": 1700000000016, "updatedAt": 1700000000016}$$::jsonb),
('entities', $${"id": "ent-quest", "worldId": "10000000-0000-4000-8000-000000000001", "type": "quest", "name": "Find the Duke", "visibility": "players", "questStatus": "active", "summary": "", "body": "", "gmNotes": "", "tags": [], "fields": [],
  "objectives": [{"id": "o1", "text": "Find [[Duke Orlov|the duke]]", "known": true, "done": false}, {"id": "o2", "text": "GM-only step", "known": false}],
  "rewards": [{"id": "r1", "text": "[[Sister Vey|A blessing]]", "known": true, "itemId": "ent-sword"}, {"id": "r2", "text": "Hidden reward", "known": false}],
  "relations": [{"id": "rel1", "to": "ent-tom", "kind": "ally", "known": true, "note": "Owes [[Duke Orlov|someone]] money"}, {"id": "rel2", "to": "ent-duke", "kind": "enemy", "known": true, "note": "x"}, {"id": "rel3", "to": "ent-tom", "kind": "rival", "known": false}],
  "clocks": [{"id": "c1", "name": "Doom", "size": 6, "filled": 2, "known": true}, {"id": "c2", "name": "Hidden clock", "size": 4, "filled": 1, "known": false}],
  "createdAt": 1700000000017, "updatedAt": 1700000000017}$$::jsonb),
('entities', $${"id": "ent-sword", "worldId": "10000000-0000-4000-8000-000000000001", "type": "item", "name": "Old Sword", "visibility": "players", "heldBy": "ent-wren", "summary": "[[Duke Orlov|Its maker]] is unknown.", "body": "", "gmNotes": "", "tags": [], "fields": [], "createdAt": 1700000000018, "updatedAt": 1700000000018}$$::jsonb),
('maps', $${"id": "map-fog", "worldId": "10000000-0000-4000-8000-000000000001", "name": "Fogged Map", "imageId": "a1000000-0000-4000-8000-000000000004", "width": 100, "height": 100, "visibility": "players",
  "fog": {"on": true, "imageId": "a1000000-0000-4000-8000-000000000005", "shapes": []}, "locationId": "ent-inn", "createdAt": 1700000000000}$$::jsonb),
('maps', $${"id": "map-secret", "worldId": "10000000-0000-4000-8000-000000000001", "name": "Drawn Map", "imageId": "a1000000-0000-4000-8000-000000000006", "playerImageId": "a1000000-0000-4000-8000-000000000007",
  "width": 100, "height": 100, "visibility": "players", "drawing": {"shapes": [{"id": "trap", "kind": "label", "text": "Trap!"}]}, "locationId": "ent-vey", "createdAt": 1700000000000}$$::jsonb),
('maps', $${"id": "map-gm", "worldId": "10000000-0000-4000-8000-000000000001", "name": "GM Map", "imageId": "a1000000-0000-4000-8000-00000000000f", "width": 100, "height": 100, "visibility": "gm", "createdAt": 1700000000000}$$::jsonb),
('pins', $${"id": "pin-1", "worldId": "10000000-0000-4000-8000-000000000001", "mapId": "map-secret", "label": "Inn", "entityId": "ent-inn", "kind": "point", "position": [10, 10], "visibility": "players",
  "note": "[[Duke Orlov|A figure]] was seen here.\n:::gm\nsecret pin note\n:::"}$$::jsonb),
('pins', $${"id": "pin-2", "worldId": "10000000-0000-4000-8000-000000000001", "mapId": "map-secret", "label": "Lair", "entityId": "ent-vey", "kind": "point", "position": [20, 20], "visibility": "gm", "note": "the lair"}$$::jsonb),
('pins', $${"id": "pin-3", "worldId": "10000000-0000-4000-8000-000000000001", "mapId": "map-secret", "label": "Chapel", "entityId": "ent-vey", "childMapId": "map-gm", "kind": "point", "position": [30, 30], "visibility": "players", "note": ""}$$::jsonb),
('sessions', $${"id": "s1", "worldId": "10000000-0000-4000-8000-000000000001", "campaignId": "camp1", "number": 1, "title": "The Inn", "date": "2026-01-01", "visibility": "players", "createdAt": 1700000000000,
  "recap": "We met [[Duke Orlov|the masked man]] at [[Brindle Inn]].\n:::gm\nGM recap note\n:::",
  "highlights": [{"id": "hl1", "kind": "quote", "who": "Wren", "text": "[[Sister Vey|The nun]] lied!"}],
  "notes": "GM session notes", "present": ["ent-wren", "ent-vey"], "entityIds": ["ent-inn", "ent-duke"],
  "recordings": [{"assetId": "a1000000-0000-4000-8000-00000000000a"}], "lectern": {"sceneText": "secret scene"}, "prep": {"strongStart": "ambush"}}$$::jsonb),
('sessions', $${"id": "s2", "worldId": "10000000-0000-4000-8000-000000000001", "campaignId": "camp1", "number": 2, "title": "Planned", "date": "2027-01-01", "visibility": "gm", "recap": "", "notes": "", "createdAt": 1700000000000}$$::jsonb),
('sessions', $${"id": "s3", "worldId": "10000000-0000-4000-8000-000000000001", "campaignId": "camp2", "number": 1, "title": "Sequel", "date": "2027-02-01", "visibility": "players", "recap": "sequel recap", "notes": "", "createdAt": 1700000000000}$$::jsonb),
('reputation', $${"id": "rep-party-10000000-0000-4000-8000-000000000001", "worldId": "10000000-0000-4000-8000-000000000001", "of": "party", "reach": 2, "lean": 1, "levels": ["Unknown", "Known", "Famous"],
  "notes": [{"id": "n1", "known": true, "place": "[[Brindle Inn]]", "text": "Liked by [[Duke Orlov|the duke]]", "entityId": "ent-inn"}, {"id": "n2", "known": false, "place": "Secret place", "text": "hidden note"}],
  "history": [{"id": "hh1", "at": 1, "known": true, "fromReach": 1, "reach": 2, "fromLean": 0, "lean": 1, "reason": "Saved [[Old Tom|the innkeeper]] from [[Sister Vey|a nun]]", "sessionId": "s1"}, {"id": "hh2", "at": 2, "known": false, "reason": "secret reason"}],
  "createdAt": 1700000000000, "updatedAt": 1700000000000}$$::jsonb),
('reputation', $${"id": "rep-ent-vey", "worldId": "10000000-0000-4000-8000-000000000001", "of": "ent-vey", "reach": 1, "lean": -1, "notes": [], "history": [], "createdAt": 1700000000000, "updatedAt": 1700000000000}$$::jsonb),
-- Files: the GM's own names and tags must never reach players.
('assets', $${"id": "a1000000-0000-4000-8000-000000000001", "worldId": "10000000-0000-4000-8000-000000000001", "name": "realm-cover.png", "mime": "image/png", "size": 101, "tags": ["cover"], "visibility": "gm", "createdAt": 1700000000000, "updatedAt": 1700000000100}$$::jsonb),
('assets', $${"id": "a1000000-0000-4000-8000-000000000002", "worldId": "10000000-0000-4000-8000-000000000001", "name": "duke-orlov-is-the-lich.png", "mime": "image/png", "size": 102, "tags": ["Duke Orlov"], "visibility": "gm", "createdAt": 1700000000000}$$::jsonb),
('assets', $${"id": "a1000000-0000-4000-8000-000000000003", "worldId": "10000000-0000-4000-8000-000000000001", "name": "masked-lich-portrait.png", "mime": "image/png", "size": 103, "tags": ["secret"], "visibility": "gm", "createdAt": 1700000000000}$$::jsonb),
('assets', $${"id": "a1000000-0000-4000-8000-000000000004", "worldId": "10000000-0000-4000-8000-000000000001", "name": "clean.webp", "mime": "image/webp", "size": 104, "tags": ["map"], "visibility": "gm", "createdAt": 1700000000000}$$::jsonb),
('assets', $${"id": "a1000000-0000-4000-8000-000000000005", "worldId": "10000000-0000-4000-8000-000000000001", "name": "fogged.webp", "mime": "image/webp", "size": 105, "tags": ["map", "fog"], "visibility": "gm", "createdAt": 1700000000000}$$::jsonb),
('assets', $${"id": "a1000000-0000-4000-8000-000000000006", "worldId": "10000000-0000-4000-8000-000000000001", "name": "gm-copy-with-trap.webp", "mime": "image/webp", "size": 106, "tags": ["map"], "visibility": "gm", "createdAt": 1700000000000}$$::jsonb),
('assets', $${"id": "a1000000-0000-4000-8000-000000000007", "worldId": "10000000-0000-4000-8000-000000000001", "name": "players-copy.webp", "mime": "image/webp", "size": 107, "tags": ["map"], "visibility": "gm", "createdAt": 1700000000000}$$::jsonb),
('assets', $${"id": "a1000000-0000-4000-8000-000000000008", "worldId": "10000000-0000-4000-8000-000000000001", "name": "letter-from-the-duke.png", "mime": "image/png", "size": 108, "tags": ["handout"], "visibility": "gm", "createdAt": 1700000000000}$$::jsonb),
('assets', $${"id": "a1000000-0000-4000-8000-000000000009", "worldId": "10000000-0000-4000-8000-000000000001", "name": "public-song.mp3", "mime": "audio/mpeg", "size": 109, "tags": ["music"], "visibility": "players", "createdAt": 1700000000000}$$::jsonb),
('assets', $${"id": "a1000000-0000-4000-8000-00000000000a", "worldId": "10000000-0000-4000-8000-000000000001", "name": "session-1-recording.webm", "mime": "audio/webm", "size": 110, "tags": [], "visibility": "gm", "createdAt": 1700000000000}$$::jsonb),
('assets', $${"id": "a1000000-0000-4000-8000-00000000000b", "worldId": "10000000-0000-4000-8000-000000000001", "name": "handbook.pdf", "mime": "application/pdf", "size": 111, "tags": [], "visibility": "players", "createdAt": 1700000000000, "updatedAt": 123}$$::jsonb),
('assets', $${"id": "a1000000-0000-4000-8000-00000000000c", "worldId": "10000000-0000-4000-8000-000000000001", "name": "mystery", "size": 112, "tags": ["x"], "visibility": "players", "createdAt": 1700000000000}$$::jsonb),
('assets', $${"id": "a1000000-0000-4000-8000-00000000000d", "worldId": "10000000-0000-4000-8000-000000000001", "name": "secret-sketch.png", "mime": "image/png", "size": 113, "tags": [], "visibility": "gm", "createdAt": 1700000000000}$$::jsonb),
('assets', $${"id": "a1000000-0000-4000-8000-00000000000e", "worldId": "10000000-0000-4000-8000-000000000001", "name": "intro.mp4", "mime": "video/mp4", "size": 114, "tags": [], "visibility": "players", "createdAt": 1700000000000}$$::jsonb),
('assets', $${"id": "a1000000-0000-4000-8000-00000000000f", "worldId": "10000000-0000-4000-8000-000000000001", "name": "gm-map.png", "mime": "image/png", "size": 115, "tags": [], "visibility": "gm", "createdAt": 1700000000000}$$::jsonb)
) v(t, d);
-- A deleted page: a tombstone, as the app leaves one.
insert into public.records (world_id, table_name, id, data, deleted) values ('10000000-0000-4000-8000-000000000001', 'entities', 'ent-gone', null, true);

insert into public.character_claims (world_id, entity_id, user_id, approved) values
  ('10000000-0000-4000-8000-000000000001', 'ent-wren', '00000000-0000-4000-8000-0000000000b1', true),
  ('10000000-0000-4000-8000-000000000001', 'ent-silas', '00000000-0000-4000-8000-0000000000b2', true),
  ('10000000-0000-4000-8000-000000000001', 'ent-mira', '00000000-0000-4000-8000-0000000000b3', false);

-- ---------- another GM's world ----------
insert into public.records (world_id, table_name, id, data) values
  ('30000000-0000-4000-8000-000000000003', 'worlds', '30000000-0000-4000-8000-000000000003', '{"id": "30000000-0000-4000-8000-000000000003", "name": "Other World"}'),
  ('30000000-0000-4000-8000-000000000003', 'entities', 'other-page', '{"id": "other-page", "worldId": "30000000-0000-4000-8000-000000000003", "type": "npc", "name": "Other NPC", "visibility": "players"}');
