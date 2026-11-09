/* The rulebooks' recommended kingdoms, transcribed from the owner's screenshots of the Dominion wiki. Each set is its name, the expansion(s) it is for, its ten Kingdom cards by name
   (a split pile is written as its pile, e.g. Catapult/Rocks), the landscapes it uses, and the extra material it asks for (`extras`: setup the table must add, which Game night works out
   from the cards anyway). The wiki's Harem is the catalog's Farm (the owner's copy is printed Harem; Intrigue's second edition calls it Farm). A name here must exist in the catalog: tests/dominion/recommended.test.js checks every one. */
const S = (name, sets, cards, landscapes = [], extras = []) => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name, sets, cards: cards.split(/,\s*/), landscapes, extras });

export const RECOMMENDED = [
  S('First Game', ['Base'], 'Cellar, Market, Merchant, Militia, Mine, Moat, Remodel, Smithy, Village, Workshop'),
  S('Size Distortion', ['Base'], 'Artisan, Bandit, Bureaucrat, Chapel, Festival, Gardens, Sentry, Throne Room, Witch, Workshop'),
  S('Deck Top', ['Base'], 'Artisan, Bureaucrat, Council Room, Festival, Harbinger, Laboratory, Moneylender, Sentry, Vassal, Village'),
  S('Sleight of Hand', ['Base'], 'Cellar, Council Room, Festival, Gardens, Harbinger, Library, Militia, Poacher, Smithy, Throne Room'),
  S('Improvements', ['Base'], 'Artisan, Cellar, Market, Merchant, Mine, Moat, Moneylender, Poacher, Remodel, Witch'),
  S('Silver & Gold', ['Base'], 'Bandit, Bureaucrat, Chapel, Harbinger, Laboratory, Merchant, Mine, Moneylender, Throne Room, Vassal'),

  S('Underlings', ['Base', 'Intrigue'], 'Cellar, Festival, Library, Sentry, Vassal, Courtier, Diplomat, Minion, Nobles, Pawn'),
  S('Grand Scheme', ['Base', 'Intrigue'], 'Artisan, Council Room, Market, Militia, Workshop, Bridge, Mill, Mining Village, Patrol, Shanty Town'),
  S('Deconstruction', ['Base', 'Intrigue'], 'Bandit, Mine, Remodel, Throne Room, Village, Diplomat, Farm, Lurker, Replace, Swindler'),

  S('Reach for Tomorrow', ['Base', 'Seaside'], 'Artisan, Cellar, Council Room, Vassal, Village, Cutpurse, Lookout, Monkey, Sea Witch, Treasure Map'),
  S('Repetition', ['Base', 'Seaside'], 'Festival, Harbinger, Militia, Remodel, Workshop, Caravan, Outpost, Pirate, Sea Chart, Treasury'),

  S('Biggest Money', ['Base', 'Prosperity'], 'Artisan, Harbinger, Laboratory, Mine, Moneylender, Bank, Crystal Ball, Grand Market, Mint, Tiara', [], ['Colony']),
  S("The King's Army", ['Base', 'Prosperity'], 'Bureaucrat, Council Room, Merchant, Moat, Village, Collection, Expand, King\'s Court, Rabble, Vault', [], ['Colony']),

  S('Bounty of the Hunt', ['Base', 'Cornucopia & Guilds'], 'Cellar, Festival, Militia, Moneylender, Smithy, Ferryman, Horn of Plenty, Hunting Party, Joust, Menagerie', [], ['Ferryman pile: Farrier']),
  S('Gilding the Lily', ['Base', 'Cornucopia & Guilds'], 'Library, Merchant, Market, Remodel, Sentry, Candlestick Maker, Footpad, Plaza, Remake, Young Witch', [], ['Bane: Vassal']),

  S('Happy Trails', ['Base', 'Hinterlands'], 'Cellar, Library, Moneylender, Throne Room, Workshop, Berserker, Highway, Nomads, Oasis, Trail'),
  S('Adventures Abroad', ['Base', 'Hinterlands'], 'Festival, Laboratory, Remodel, Sentry, Vassal, Crossroads, Fool\'s Gold, Guard Dog, Souk, Witch\'s Hut'),

  S('High and Low', ['Base', 'Dark Ages'], 'Cellar, Moneylender, Throne Room, Witch, Workshop, Hermit, Hunting Grounds, Mystic, Poor House, Wandering Minstrel', [], ['Shelters']),
  S('Chivalry and Revelry', ['Base', 'Dark Ages'], 'Festival, Gardens, Laboratory, Library, Remodel, Altar, Knights, Rats, Scavenger, Squire', [], ['Shelters']),

  S('Everything in Moderation', ['Base', 'Empires'], 'Cellar, Library, Remodel, Village, Workshop, Enchantress, Forum, Legionary, Overlord, Temple', ['Windfall', 'Orchard']),
  S('Silver Bullets', ['Base', 'Empires'], 'Bureaucrat, Gardens, Laboratory, Market, Moneylender, Catapult/Rocks, Charm, Farmers’ Market, Groundskeeper, Patrician/Emporium', ['Conquest', 'Aqueduct']),

  S('It Takes a Villager', ['Base', 'Renaissance'], 'Market, Merchant, Mine, Smithy, Vassal, Acting Troupe, Cargo Ship, Recruiter, Seer, Treasurer', ['Road Network']),
  S('Capture the Flag', ['Base', 'Renaissance'], 'Cellar, Festival, Harbinger, Remodel, Workshop, Flag Bearer, Lackeys, Scholar, Swashbuckler, Villain', ['Barracks', 'Pageant']),

  S('Pony Express', ['Base', 'Menagerie'], 'Artisan, Cellar, Market, Mine, Village, Barge, Destrier, Paddock, Stockpile, Supplies', ['Stampede', 'Way of the Seal']),
  S('Garden of Cats', ['Base', 'Menagerie'], 'Bandit, Gardens, Harbinger, Merchant, Moat, Black Cat, Displace, Sanctuary, Scrap, Snowy Village', ['Toil', 'Way of the Mole']),

  S('Basic Looting', ['Base', 'Plunder'], 'Cellar, Market, Mine, Moat, Vassal, Frigate, Harbor Village, Maroon, Pilgrim, Sack of Loot', [{ name: 'Tireless', on: 'Harbor Village' }]),
  S('Voodoo', ['Base', 'Plunder'], 'Artisan, Bureaucrat, Festival, Moneylender, Remodel, Buried Treasure, First Mate, Flagship, Gondola, Shaman', ['Maelstrom', { name: 'Cursed', on: 'Festival' }]),

  S('Victory Dance', ['Intrigue'], 'Baron, Courtier, Duke, Farm, Ironworks, Masquerade, Mill, Nobles, Patrol, Replace'),
  S('The Plot Thickens', ['Intrigue'], 'Conspirator, Ironworks, Lurker, Mining Village, Pawn, Secret Passage, Steward, Swindler, Torturer, Trading Post'),
  S('Best Wishes', ['Intrigue'], 'Baron, Conspirator, Courtyard, Diplomat, Duke, Secret Passage, Shanty Town, Torturer, Upgrade, Wishing Well'),

  S('A Star to Steer By', ['Intrigue', 'Seaside'], 'Courtier, Diplomat, Secret Passage, Swindler, Wishing Well, Bazaar, Lookout, Monkey, Tide Pools, Treasure Map'),
  S('Shore Patrol', ['Intrigue', 'Seaside'], 'Patrol, Pawn, Replace, Shanty Town, Trading Post, Cutpurse, Island, Lighthouse, Sea Chart, Wharf'),

  S('Paths to Victory', ['Intrigue', 'Prosperity'], 'Baron, Farm, Pawn, Shanty Town, Upgrade, Bishop, Collection, Magnate, Monument, Peddler', [], ['Colony']),
  S('Lucky Seven', ['Intrigue', 'Prosperity'], 'Baron, Mining Village, Patrol, Upgrade, Wishing Well, Bank, Expand, Forge, King\'s Court, Tiara', [], ['Colony']),

  S('The Spice of Life', ['Intrigue', 'Cornucopia & Guilds'], 'Courtier, Courtyard, Diplomat, Mining Village, Replace, Fairgrounds, Horn of Plenty, Joust, Remake, Young Witch', [], ['Bane: Wishing Well']),
  S('Tricks of the Trade', ['Intrigue', 'Cornucopia & Guilds'], 'Conspirator, Masquerade, Mill, Nobles, Secret Passage, Butcher, Herald, Journeyman, Soothsayer, Stonemason'),

  S('Money for Nothing', ['Intrigue', 'Hinterlands'], 'Patrol, Pawn, Replace, Shanty Town, Torturer, Cartographer, Jack of All Trades, Tunnel, Weaver, Wheelwright'),
  S("The Duke's Ball", ['Intrigue', 'Hinterlands'], 'Conspirator, Duke, Farm, Masquerade, Upgrade, Guard Dog, Inn, Scheme, Trail, Wheelwright'),

  S('Prophecy', ['Intrigue', 'Dark Ages'], 'Baron, Conspirator, Nobles, Secret Passage, Wishing Well, Armory, Ironmonger, Mystic, Rebuild, Vagrant', [], ['Shelters']),
  S('Invasion', ['Intrigue', 'Dark Ages'], 'Diplomat, Farm, Swindler, Torturer, Upgrade, Beggar, Marauder, Rogue, Squire, Urchin', [], ['Shelters']),

  S('Delicious Torture', ['Intrigue', 'Empires'], 'Baron, Bridge, Farm, Ironworks, Torturer, Castles, Crown, Enchantress, Sacrifice, Settlers/Bustling Village', ['Banquet', 'Arena']),
  S('Buddy System', ['Intrigue', 'Empires'], 'Masquerade, Mining Village, Nobles, Pawn, Trading Post, Archive, Capital, Catapult/Rocks, Engineer, Forum', ['Salt the Earth', 'Wolf Den']),

  S('Memento Mori', ['Intrigue', 'Renaissance'], 'Ironworks, Lurker, Patrol, Swindler, Upgrade, Experiment, Flag Bearer, Patron, Recruiter, Silk Merchant', ['Citadel']),
  S('Clockwork Court', ['Intrigue', 'Renaissance'], 'Courtier, Mining Village, Nobles, Replace, Steward, Acting Troupe, Inventor, Research, Scepter, Scholar', ['Fleet', 'Sinister Plot']),

  S('Dog & Pony Show', ['Intrigue', 'Menagerie'], 'Mill, Nobles, Pawn, Torturer, Upgrade, Camel Train, Cavalry, Goatherd, Paddock, Sheepdog', ['Commerce', 'Way of the Horse']),
  S('Explosions', ['Intrigue', 'Menagerie'], 'Courtyard, Diplomat, Lurker, Replace, Wishing Well, Animal Fair, Bounty Hunter, Coven, Hunting Lodge, Scrap', ['Populate', 'Way of the Squirrel']),

  S('Breaking Eggs', ['Intrigue', 'Plunder'], 'Courtier, Farm, Mining Village, Nobles, Replace, Buried Treasure, Jewelled Egg, Mapmaker, Maroon, Quartermaster', [{ name: 'Reckless', on: 'Maroon' }]),
  S('Landlubbers', ['Intrigue', 'Plunder'], 'Conspirator, Mill, Pawn, Secret Passage, Wishing Well, Cutthroat, Fortune Hunter, Pendant, Pilgrim, Wealthy Village', ['Avoid', { name: 'Friendly', on: 'Conspirator' }]),

  S('High Seas', ['Seaside'], 'Bazaar, Blockade, Caravan, Corsair, Haven, Island, Lookout, Pirate, Warehouse, Wharf'),
  S('Buried Treasure', ['Seaside'], 'Astrolabe, Cutpurse, Fishing Village, Lighthouse, Monkey, Outpost, Sailor, Sea Chart, Tactician, Treasure Map'),

  S('Exploding Kingdom', ['Seaside', 'Prosperity'], 'Fishing Village, Lookout, Outpost, Tactician, Wharf, Bishop, City, Grand Market, King\'s Court, Quarry', [], ['Colony']),
  S('Pirate Bay', ['Seaside', 'Prosperity'], 'Astrolabe, Corsair, Monkey, Native Village, Treasury, Charlatan, Hoard, Investment, Magnate, Mint', [], ['Colony']),

  S('Collecting', ['Seaside', 'Cornucopia & Guilds'], 'Blockade, Fishing Village, Monkey, Smugglers, Tide Pools, Fairgrounds, Farmhands, Farrier, Footpad, Hunting Party'),
  S('Island Builder', ['Seaside', 'Cornucopia & Guilds'], 'Island, Native Village, Salvager, Sea Chart, Treasury, Advisor, Baker, Merchant Guild, Plaza, Stonemason'),

  S('Travelers', ['Seaside', 'Hinterlands'], 'Cutpurse, Island, Lookout, Merchant Ship, Warehouse, Cartographer, Crossroads, Farmland, Souk, Stables'),
  S('Runners', ['Seaside', 'Hinterlands'], 'Bazaar, Blockade, Caravan, Smugglers, Sailor, Berserker, Cauldron, Guard Dog, Nomads, Wheelwright'),

  S('Watery Graves', ['Seaside', 'Dark Ages'], 'Corsair, Native Village, Salvager, Treasure Map, Treasury, Count, Graverobber, Hermit, Rats, Scavenger', [], ['Shelters']),
  S('Peasants', ['Seaside', 'Dark Ages'], 'Fishing Village, Haven, Island, Lighthouse, Warehouse, Armory, Band of Misfits, Forager, Poor House, Vagrant', [], ['Shelters']),

  S('Boxed In', ['Seaside', 'Empires'], 'Salvager, Smugglers, Tactician, Warehouse, Wharf, Castles, Chariot Race, Encampment/Plunder, Enchantress, Gladiator/Fortune', ['Tax', 'Wall']),
  S('King of the Sea', ['Seaside', 'Empires'], 'Corsair, Haven, Native Village, Pirate, Sea Witch, Archive, Farmers’ Market, Overlord, Temple, Wild Hunt', ['Delve', 'Fountain']),

  S('Free Shipping', ['Seaside', 'Renaissance'], 'Blockade, Island, Outpost, Smugglers, Wharf, Acting Troupe, Cargo Ship, Lackeys, Research, Spices', ['Innovation']),
  S('Digging for Treasure', ['Seaside', 'Renaissance'], 'Astrolabe, Caravan, Native Village, Salvager, Treasure Map, Border Guard, Flag Bearer, Inventor, Sculptor, Swashbuckler', ['Crop Rotation', 'Silos']),

  S('Innsmouth', ['Seaside', 'Menagerie'], 'Caravan, Fishing Village, Lighthouse, Pirate, Tide Pools, Animal Fair, Barge, Coven, Groom, Sheepdog', ['Invest', 'Way of the Goat']),
  S('Ruritania', ['Seaside', 'Menagerie'], 'Astrolabe, Outpost, Tactician, Tide Pools, Warehouse, Bounty Hunter, Cavalry, Falconer, Sleigh, Village Green', ['Alliance', 'Way of the Monkey']),

  S('Wine-dark Seas', ['Seaside', 'Plunder'], 'Astrolabe, Caravan, Fishing Village, Sailor, Sea Witch, Cabin Boy, Cage, Enlarge, Frigate, Rope', [{ name: 'Cheap', on: 'Frigate' }]),
  S('Treasure Island', ['Seaside', 'Plunder'], 'Corsair, Island, Lookout, Sea Chart, Treasure Map, Abundance, Buried Treasure, Crew, Longship, Stowaway', ['Launch', { name: 'Inherited', on: 'Treasure Map' }]),

  S('Beginners', ['Prosperity'], 'Bank, Clerk, Crystal Ball, Expand, Magnate, Monument, Rabble, Tiara, Watchtower, Worker\'s Village', [], ['Colony']),
  S('Friendly Interactive', ['Prosperity'], 'Bishop, City, Collection, Forge, Hoard, Peddler, Tiara, Vault, War Chest, Worker\'s Village', [], ['Colony']),

  S('Detours', ['Prosperity', 'Cornucopia & Guilds'], 'Clerk, Crystal Ball, Forge, Hoard, Magnate, Farmhands, Horn of Plenty, Jester, Joust, Remake', [], ['Colony']),
  S('Quarrymen', ['Prosperity', 'Cornucopia & Guilds'], 'Charlatan, City, Expand, Grand Market, Quarry, Baker, Butcher, Candlestick Maker, Merchant Guild, Soothsayer', [], ['Colony']),

  S('Instant Gratification', ['Prosperity', 'Hinterlands'], 'Bishop, Expand, Hoard, Mint, Watchtower, Berserker, Cauldron, Haggler, Oasis, Trail', [], ['Colony']),
  S('Treasure Trove', ['Prosperity', 'Hinterlands'], 'Bank, Clerk, Crystal Ball, Monument, Tiara, Cauldron, Develop, Fool\'s Gold, Guard Dog, Inn', [], ['Colony']),

  S("One Man's Trash", ['Prosperity', 'Dark Ages'], 'Anvil, City, Crystal Ball, Magnate, War Chest, Counterfeit, Forager, Market Square, Pillage, Squire', [], ['Colony', 'Shelters']),
  S('Honor Among Thieves', ['Prosperity', 'Dark Ages'], 'Collection, Forge, Hoard, Quarry, Watchtower, Bandit Camp, Marauder, Procession, Rogue, Squire', [], ['Colony', 'Shelters']),

  S('Big Time', ['Prosperity', 'Empires'], 'Bank, Forge, Grand Market, Investment, Tiara, Capital, Gladiator/Fortune, Patrician/Emporium, Royal Blacksmith, Villa', ['Dominate', 'Obelisk'], ['Colony']),   // the rulebook does not say which pile Obelisk uses
  S('Gilded Gates', ['Prosperity', 'Empires'], 'Anvil, Collection, Mint, Peddler, War Chest, Chariot Race, City Quarter, Encampment/Plunder, Groundskeeper, Wild Hunt', ['Basilica', 'Palace'], ['Colony']),

  S('Dreamers of Dreams', ['Prosperity', 'Renaissance'], 'Charlatan, Monument, Vault, Watchtower, Worker\'s Village, Cargo Ship, Old Witch, Priest, Scepter, Scholar', ['Academy'], ['Colony']),
  S('Movers and Shakers', ['Prosperity', 'Renaissance'], 'Bank, City, Grand Market, Investment, Rabble, Hideout, Patron, Research, Treasurer, Villain', ['Capitalism', 'Citadel'], ['Colony']),

  S('Limited Time Offer', ['Prosperity', 'Menagerie'], 'Anvil, Grand Market, Mint, Peddler, Worker\'s Village, Destrier, Displace, Fisherman, Supplies, Wayfarer', ['Desperation', 'Way of the Frog'], ['Colony']),
  S('Otter Chaos', ['Prosperity', 'Menagerie'], 'City, Clerk, Monument, Quarry, War Chest, Animal Fair, Camel Train, Hunting Lodge, Mastermind, Paddock', ['Reap', 'Way of the Otter'], ['Colony']),

  S('Pretty Trinkets', ['Prosperity', 'Plunder'], 'Bank, Crystal Ball, Investment, Tiara, War Chest, Figurine, Jewelled Egg, King\'s Cache, Rope, Silver Mine', [{ name: 'Fated', on: 'Rope' }], ['Colony']),
  S('Buying Happiness', ['Prosperity', 'Plunder'], 'Anvil, Bishop, Clerk, Magnate, Worker\'s Village, Cage, Mining Road, Pendant, Stowaway, Swamp Shacks', ['Looting', { name: 'Fawning', on: 'Magnate' }], ['Colony']),

  S('Misfortune', ['Cornucopia & Guilds'], 'Advisor, Candlestick Maker, Carnival, Fairgrounds, Farmhands, Horn of Plenty, Infirmary, Jester, Merchant Guild, Soothsayer'),
  S('Baking Contest', ['Cornucopia & Guilds'], 'Baker, Farrier, Hamlet, Herald, Hunting Party, Joust, Menagerie, Remake, Shop, Stonemason'),

  S('Blue Harvest', ['Cornucopia & Guilds', 'Hinterlands'], 'Farrier, Ferryman, Hamlet, Horn of Plenty, Joust, Fool\'s Gold, Trail, Tunnel, Weaver, Witch\'s Hut', [], ['Ferryman pile: Guard Dog']),
  S('Exchanges', ['Cornucopia & Guilds', 'Hinterlands'], 'Butcher, Herald, Soothsayer, Stonemason, Young Witch, Border Village, Cauldron, Develop, Stables, Trader', [], ['Bane: Oasis']),

  S('Dark Carnival', ['Cornucopia & Guilds', 'Dark Ages'], 'Fairgrounds, Ferryman, Hamlet, Horn of Plenty, Menagerie, Cultist, Death Cart, Hermit, Junk Dealer, Knights', [], ['Ferryman pile: Fortress', 'Shelters']),
  S('Stoneground', ['Cornucopia & Guilds', 'Dark Ages'], 'Advisor, Farrier, Plaza, Shop, Stonemason, Hunting Grounds, Ironmonger, Marauder, Procession, Rogue', [], ['Shelters']),

  S('Zookeepers', ['Cornucopia & Guilds', 'Empires'], 'Ferryman, Jester, Menagerie, Remake, Shop, Groundskeeper, Overlord, Sacrifice, Settlers/Bustling Village, Wild Hunt', ['Annex', 'Colonnade'], ['Ferryman pile: Villa']),
  S('Cash Flow', ['Cornucopia & Guilds', 'Empires'], 'Baker, Carnival, Herald, Infirmary, Soothsayer, Castles, City Quarter, Engineer, Gladiator/Fortune, Royal Blacksmith', ['Baths', 'Mountain Pass']),

  S('Combo Corner', ['Cornucopia & Guilds', 'Renaissance'], 'Farrier, Ferryman, Horn of Plenty, Jester, Stonemason, Ducat, Experiment, Hideout, Sculptor, Seer', ['Canal'], ['Ferryman pile: Mountain Village']),
  S('Filling the Coffers', ['Cornucopia & Guilds', 'Renaissance'], 'Baker, Butcher, Farrier, Merchant Guild, Plaza, Priest, Recruiter, Spices, Swashbuckler, Treasurer', ['City Gate', 'Star Chart']),

  S('Living in Exile', ['Cornucopia & Guilds', 'Menagerie'], 'Farmhands, Footpad, Hamlet, Infirmary, Journeyman, Gatekeeper, Hostelry, Livery, Scrap, Stockpile', ['Enclave', 'Way of the Mule']),
  S('Thrill of the Hunt', ['Cornucopia & Guilds', 'Menagerie'], 'Butcher, Carnival, Hamlet, Hunting Party, Joust, Black Cat, Bounty Hunter, Camel Train, Mastermind, Village Green', ['Pursue', 'Way of the Rat']),

  S('Of Heralds and Hunters', ['Cornucopia & Guilds', 'Plunder'], 'Fairgrounds, Herald, Infirmary, Soothsayer, Stonemason, Cabin Boy, Flagship, Fortune Hunter, Pendant, Pickaxe', [{ name: 'Inspiring', on: 'Fortune Hunter' }]),
  S('Through the Swamp', ['Cornucopia & Guilds', 'Plunder'], 'Baker, Hamlet, Horn of Plenty, Menagerie, Merchant Guild, Cage, Pilgrim, Swamp Shacks, Taskmaster, Tools', ['Journey', { name: 'Patient', on: 'Pilgrim' }]),

  S('Introduction', ['Hinterlands'], 'Cartographer, Crossroads, Develop, Jack of All Trades, Margrave, Nomads, Oasis, Spice Merchant, Stables, Weaver'),
  S('Bargains', ['Hinterlands'], 'Border Village, Cauldron, Fool\'s Gold, Haggler, Highway, Scheme, Souk, Trader, Trail, Wheelwright'),

  S('Far From Home', ['Hinterlands', 'Dark Ages'], 'Cartographer, Develop, Fool\'s Gold, Weaver, Witch\'s Hut, Catacombs, Count, Feodum, Fortress, Wandering Minstrel', [], ['Shelters']),
  S('Expeditions', ['Hinterlands', 'Dark Ages'], 'Highway, Nomads, Oasis, Scheme, Spice Merchant, Altar, Catacombs, Ironmonger, Poor House, Storeroom', [], ['Shelters']),

  S('Simple Plans', ['Hinterlands', 'Empires'], 'Border Village, Cauldron, Haggler, Stables, Wheelwright, Catapult/Rocks, Enchantress, Forum, Patrician/Emporium, Villa', ['Donate', 'Labyrinth']),
  S('Expansion', ['Hinterlands', 'Empires'], 'Farmland, Oasis, Spice Merchant, Stables, Tunnel, Castles, Charm, Encampment/Plunder, Engineer, Legionary', ['Battlefield', 'Fountain']),

  S('Sweetened Deals', ['Hinterlands', 'Renaissance'], 'Develop, Guard Dog, Haggler, Spice Merchant, Witch\'s Hut, Flag Bearer, Lackeys, Mountain Village, Silk Merchant, Spices', ['Silos']),
  S('A Penny Saved', ['Hinterlands', 'Renaissance'], 'Berserker, Border Village, Oasis, Souk, Trader, Ducat, Patron, Scepter, Seer, Swashbuckler', ['Barracks', 'Guildhall']),

  S('Big Blue', ['Hinterlands', 'Menagerie'], 'Trader, Trail, Tunnel, Weaver, Witch\'s Hut, Black Cat, Falconer, Sheepdog, Sleigh, Village Green', ['Banish', 'Way of the Turtle']),
  S('Intersection', ['Hinterlands', 'Menagerie'], 'Develop, Farmland, Nomads, Stables, Wheelwright, Cardinal, Hostelry, Livery, Mastermind, Supplies', ['Gamble', 'Way of the Mouse'], ['Card for Mouse: Crossroads']),

  S('Desert Dreams', ['Hinterlands', 'Plunder'], 'Haggler, Nomads, Oasis, Souk, Weaver, Enlarge, Grotto, Harbor Village, Mapmaker, Pendant', [{ name: 'Reckless', on: 'Nomads' }]),
  S('Viking Schemes', ['Hinterlands', 'Plunder'], 'Berserker, Cauldron, Fool\'s Gold, Scheme, Stables, Cabin Boy, Crew, Crucible, Frigate, Wealthy Village', ['Scrounge', { name: 'Rich', on: 'Berserker' }]),

  S('Grim Parade', ['Dark Ages'], 'Armory, Band of Misfits, Catacombs, Cultist, Forager, Fortress, Hunting Grounds, Knights, Market Square, Procession', [], ['Shelters']),
  S('Playing Chess With Death', ['Dark Ages'], 'Bandit Camp, Graverobber, Junk Dealer, Mystic, Pillage, Rats, Sage, Scavenger, Storeroom, Vagrant', [], ['Shelters']),

  S('Tomb of the Rat King', ['Dark Ages', 'Empires'], 'Death Cart, Fortress, Pillage, Rats, Storeroom, Castles, Chariot Race, City Quarter, Legionary, Sacrifice', ['Advance', 'Tomb'], ['Shelters']),
  S('Triumph of the Bandit King', ['Dark Ages', 'Empires'], 'Bandit Camp, Catacombs, Hunting Grounds, Market Square, Procession, Capital, Charm, Engineer, Groundskeeper, Legionary', ['Triumph', 'Defiled Shrine'], ['Shelters']),
  S("The Squire's Ritual", ['Dark Ages', 'Empires'], 'Feodum, Hermit, Ironmonger, Rogue, Squire, Archive, Catapult/Rocks, Crown, Patrician/Emporium, Settlers/Bustling Village', ['Ritual', 'Museum'], ['Shelters']),

  S('Stargazing', ['Dark Ages', 'Renaissance'], 'Hermit, Mystic, Procession, Sage, Wandering Minstrel, Border Guard, Patron, Seer, Silk Merchant, Swashbuckler', ['Star Chart'], ['Shelters']),
  S('Sewer Rats', ['Dark Ages', 'Renaissance'], 'Count, Counterfeit, Cultist, Graverobber, Rats, Flag Bearer, Improve, Lackeys, Mountain Village, Research', ['Crop Rotation', 'Sewers'], ['Shelters']),

  S('Friendly Carnage', ['Dark Ages', 'Menagerie'], 'Altar, Beggar, Catacombs, Fortress, Market Square, Animal Fair, Cardinal, Falconer, Goatherd, Hunting Lodge', ['Ride', 'Way of the Camel'], ['Shelters']),
  S('Gift Horses', ['Dark Ages', 'Menagerie'], 'Hunting Grounds, Pillage, Rats, Sage, Squire, Camel Train, Destrier, Displace, Paddock, Scrap', ['Bargain', 'Way of the Butterfly'], ['Shelters']),

  S("Dad's Rats", ['Dark Ages', 'Plunder'], 'Death Cart, Poor House, Rats, Squire, Vagrant, First Mate, Maroon, Rope, Search, Shaman', [{ name: 'Inherited', on: 'Rats' }], ['Shelters']),
  S('Ravagers', ['Dark Ages', 'Plunder'], 'Counterfeit, Forager, Ironmonger, Pillage, Storeroom, Cutthroat, Enlarge, Grotto, King\'s Cache, Trickster', ['Invasion', { name: 'Tireless', on: 'Forager' }], ['Shelters']),

  S('Basic Intro', ['Empires'], 'Castles, Chariot Race, City Quarter, Engineer, Farmers’ Market, Forum, Legionary, Patrician/Emporium, Sacrifice, Villa', ['Wedding', 'Tower']),
  S('Advanced Intro', ['Empires'], 'Archive, Capital, Catapult/Rocks, Crown, Enchantress, Gladiator/Fortune, Groundskeeper, Royal Blacksmith, Settlers/Bustling Village, Temple', ['Arena', 'Triumphal Arch']),

  S('Exploring the City', ['Empires', 'Renaissance'], 'City Quarter, Farmers’ Market, Groundskeeper, Sacrifice, Wild Hunt, Cargo Ship, Experiment, Mountain Village, Priest, Sculptor', ['Exploration', 'Battlefield']),
  S('Navigating the Sewers', ['Empires', 'Renaissance'], 'Chariot Race, Enchantress, Gladiator/Fortune, Patrician/Emporium, Villa, Acting Troupe, Flag Bearer, Improve, Old Witch, Scepter', ['Ritual', 'Sewers']),

  S('No Money Down', ['Empires', 'Menagerie'], 'Catapult/Rocks, City Quarter, Crown, Engineer, Villa, Animal Fair, Cavalry, Sleigh, Stockpile, Wayfarer', ['Advance', 'Way of the Pig']),
  S('Detours and Shortcuts', ['Empires', 'Menagerie'], 'Enchantress, Overlord, Sacrifice, Settlers/Bustling Village, Wild Hunt, Camel Train, Fisherman, Gatekeeper, Sanctuary, Snowy Village', ['Transport', 'Triumphal Arch']),

  S('City Builders', ['Empires', 'Plunder'], 'City Quarter, Farmers’ Market, Groundskeeper, Patrician/Emporium, Wild Hunt, Abundance, Crucible, Frigate, Taskmaster, Tools', ['Museum', { name: 'Nearby', on: 'Patrician/Emporium' }]),
  S('Plenty', ['Empires', 'Plunder'], 'Charm, Crown, Enchantress, Gladiator/Fortune, Sacrifice, Figurine, Landing Party, Mining Road, Rope, Wealthy Village', ['Prosper', { name: 'Friendly', on: 'Figurine' }]),

  S('Overture', ['Renaissance'], 'Acting Troupe, Experiment, Flag Bearer, Hideout, Improve, Inventor, Lackeys, Old Witch, Seer, Treasurer', ['Fair']),
  S('Prelude', ['Renaissance'], 'Border Guard, Cargo Ship, Ducat, Mountain Village, Priest, Recruiter, Sculptor, Silk Merchant, Swashbuckler, Villain', ['Citadel', 'Star Chart']),

  S('Biding Time', ['Renaissance', 'Menagerie'], 'Ducat, Priest, Recruiter, Scepter, Swashbuckler, Cavalry, Coven, Displace, Fisherman, Goatherd', ['Sinister Plot', 'Way of the Turtle']),
  S('Villager Madness', ['Renaissance', 'Menagerie'], 'Border Guard, Flag Bearer, Patron, Silk Merchant, Spices, Cardinal, Groom, Kiln, Livery, Wayfarer', ['Demand', 'Academy']),

  S('Circle of Life', ['Renaissance', 'Plunder'], 'Acting Troupe, Experiment, Patron, Scholar, Swashbuckler, Frigate, Jewelled Egg, Pickaxe, Search, Shaman', ['Cathedral', { name: 'Inspiring', on: 'Scholar' }]),
  S('Mirror Masters', ['Renaissance', 'Plunder'], 'Border Guard, Cargo Ship, Flag Bearer, Seer, Spices, Crucible, Gondola, Quartermaster, Taskmaster, Trickster', ['Mirror', { name: 'Fated', on: 'Spices' }]),

  S('Intro to Horses', ['Menagerie'], 'Animal Fair, Barge, Destrier, Goatherd, Hostelry, Livery, Paddock, Scrap, Sheepdog, Supplies', ['Enhance', 'Way of the Sheep']),
  S('Intro to Exile', ['Menagerie'], 'Black Cat, Bounty Hunter, Camel Train, Cardinal, Falconer, Mastermind, Sanctuary, Snowy Village, Stockpile, Wayfarer', ['March', 'Way of the Worm']),

  S('Going Home', ['Menagerie', 'Plunder'], 'Barge, Gatekeeper, Kiln, Snowy Village, Supplies, Gondola, Landing Party, Mapmaker, Secluded Shrine, Silver Mine', ['Way of the Squirrel', { name: 'Cheap', on: 'Gatekeeper' }]),
  S('Going Big', ['Menagerie', 'Plunder'], 'Animal Fair, Camel Train, Mastermind, Sanctuary, Sheepdog, Enlarge, Grotto, Harbor Village, Sack of Loot, Siren', ['Peril', { name: 'Nearby', on: 'Animal Fair' }]),

  S('Flotsam', ['Plunder'], 'Abundance, Crucible, First Mate, Fortune Hunter, Jewelled Egg, Landing Party, Mining Road, Secluded Shrine, Silver Mine, Wealthy Village', [{ name: 'Hasty', on: 'First Mate' }]),
  S('Jetsam', ['Plunder'], 'Crew, Cutthroat, Gondola, Grotto, Longship, Pickaxe, Quartermaster, Search, Siren, Stowaway', ['Prepare', { name: 'Pious', on: 'Grotto' }]),
];

/* A recommended set as Game night's kingdom items, found in `catalog` (the one the Collection shows, so a switched-off expansion's cards are not in it).
   Returns { items, baneId, missing }: `items` are the cards (a pile named as Catapult/Rocks or Knights is its pile's first card), then the landscapes (a Trait with `on`, its card's id),
   `baneId` the Bane pile's card (when the set names one, its card is in `items` too, as Game night keeps a Bane) and `missing` the names the catalog does not have (the set is not offered then). */
export function itemsOfSet(catalog, set) {
  const missing = [], pileOfName = name => [...catalog.pilesByKey.values()].find(p => p.id === name);
  const cardId = name => {
    const c = catalog.cards.find(x => x.name === name.split('/')[0]);
    if (c) return c.id;
    const p = pileOfName(name); return p ? p.cardIds[0] : null;
  };
  const items = [];
  for (const n of set.cards) { const id = cardId(n); if (id) items.push({ kind: 'card', id }); else missing.push(n); }
  const bane = set.extras.map(e => /^Bane: (.+)$/.exec(e)).find(Boolean);
  let baneId = null;
  if (bane) { baneId = cardId(bane[1]); if (baneId) items.push({ kind: 'card', id: baneId }); else missing.push(bane[1]); }
  for (const l of set.landscapes) {
    const name = l.name || l, found = catalog.landscapes.find(x => x.name === name);
    if (!found) { missing.push(name); continue; }
    const host = l.on ? cardId(l.on) : null;
    items.push(host ? { kind: 'landscape', id: found.id, on: host } : { kind: 'landscape', id: found.id });
  }
  return { items, baneId, missing };
}

/* What the table must add besides the cards, in words, for the list: the extras the rulebook names that Game night's setup notes do not already work out
   (Colony and Shelters come from the cards themselves, a Bane pile is shown as the Bane). */
export const extrasNote = set => set.extras.filter(e => !/^Bane: /.test(e));
