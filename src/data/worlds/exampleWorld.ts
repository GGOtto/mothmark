import {WorldSchema} from "../../schemas/worldSchema";

function feature(
	id: string,
	name: string,
	aliases: string[],
	description: string,
	listedInRoom = true,
) {
	return {
		id,
		name,
		aliases,
		tags: ["room-feature"],
		description: {default: description, variants: []},
		listedInRoom,
		activeWhen: [],
	};
}

function room(
	id: string,
	name: string,
	x: number,
	y: number,
	description: string,
	features: ReturnType<typeof feature>[],
) {
	return {
		id,
		name,
		aliases: id === "dungeon-entrance" ? ["entrance", "stairs"] : [],
		tags: ["dungeon", y < 100 ? "upper-level" : y > 250 ? "lower-level" : "main-level"],
		position: {x, y},
		description: {default: description, variants: []},
		features,
	};
}

function connection(
	id: string,
	fromRoomId: string,
	toRoomId: string,
	direction: "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw" | "up" | "down" | "in" | "out",
	returnDirection: "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw" | "up" | "down" | "in" | "out",
	pathway: "two-way" | "forwards" | "backwards" | "no-way" = "two-way",
) {
	return {
		id,
		fromRoomId: {type: "room" as const, id: fromRoomId},
		toRoomId: {type: "room" as const, id: toRoomId},
		direction,
		returnDirection,
		pathway,
	};
}

const rawWorld = {
	metadata: {
		title: "The Barrow Below",
		author: "Mothmark",
		description:
			"A compact dungeon of flooded chambers, ruined halls, crypts, and forgotten treasure.",
		version: "0.3.0",
	},
	startRoomId: "dungeon-entrance",
	rooms: [
		room(
			"dungeon-entrance",
			"Dungeon Entrance",
			90,
			185,
			"Weathered steps descend beneath a split stone arch. Cold air rises from the dark, carrying the smell of wet earth and old iron.",
			[
				feature(
					"stone-arch",
					"Stone Arch",
					["arch", "doorway"],
					"The arch is carved with worn shields and the faint outline of a crowned serpent.",
				),
				feature(
					"abandoned-torch",
					"Abandoned Torch",
					["torch"],
					"A pitch-soaked torch rests in a wall bracket. It has not been lit in years.",
				),
			],
		),
		room(
			"flooded-cistern",
			"Flooded Cistern",
			170,
			55,
			"Black water covers the lower steps of a round cistern. Drops fall from the vaulted ceiling and send slow rings across the surface.",
			[
				feature(
					"iron-wheel",
					"Iron Sluice Wheel",
					["wheel", "sluice"],
					"The wheel is stiff with rust, but fresh scratches mark its rim.",
				),
				feature(
					"sunken-statue",
					"Sunken Statue",
					["statue", "figure"],
					"A stone knight stands beneath the water with both hands wrapped around an empty scabbard.",
				),
			],
		),
		room(
			"guardroom",
			"Guardroom",
			245,
			175,
			"Overturned bunks and a cracked table crowd this low chamber. A draft stirs old playing cards across the floor.",
			[
				feature(
					"duty-roster",
					"Duty Roster",
					["roster", "ledger"],
					"The final watch was signed in, but no one signed out.",
				),
				feature(
					"weapon-rack",
					"Empty Weapon Rack",
					["rack", "weapons"],
					"Only snapped spear shafts and one badly dented buckler remain.",
				),
			],
		),
		room(
			"fungal-grotto",
			"Fungal Grotto",
			105,
			300,
			"The worked stone gives way to a damp natural cavern. Blue mushrooms grow in thick shelves around a shallow stream.",
			[
				feature(
					"glowcaps",
					"Glowcaps",
					["mushrooms", "fungus"],
					"Their cool blue light brightens whenever footsteps approach from the crypt.",
				),
				feature(
					"burrow",
					"Large Burrow",
					["hole", "tunnel"],
					"Claw marks score the earth around a tunnel too narrow to enter safely.",
				),
			],
		),
		room(
			"collapsed-gallery",
			"Collapsed Gallery",
			335,
			55,
			"Broken pillars lean across a gallery lined with faded battle murals. Rubble forces the passage into a crooked path.",
			[
				feature(
					"battle-mural",
					"Battle Mural",
					["mural", "painting"],
					"The mural shows armored soldiers sealing something enormous beneath the hill.",
				),
				feature(
					"fallen-pillar",
					"Fallen Pillar",
					["pillar", "rubble"],
					"A narrow gap beneath the pillar is polished by frequent passage.",
				),
			],
		),
		room(
			"forgotten-shrine",
			"Forgotten Shrine",
			405,
			175,
			"A small domed shrine stands strangely untouched. Ash surrounds a stone altar, and pale candles burn without giving off heat.",
			[
				feature(
					"serpent-idol",
					"Serpent Idol",
					["idol", "serpent"],
					"The idol's jeweled eyes have been pried out, leaving two deep black sockets.",
				),
				feature(
					"offering-bowl",
					"Offering Bowl",
					["bowl", "offering"],
					"A few tarnished coins lie beneath a layer of gray ash.",
				),
			],
		),
		room(
			"lower-crypt",
			"Lower Crypt",
			290,
			300,
			"Narrow burial niches fill the walls from floor to ceiling. Several stone covers have fallen open, and their occupants are gone.",
			[
				feature(
					"open-niche",
					"Open Burial Niche",
					["niche", "grave"],
					"The niche contains a torn burial shroud and a trail of dried mud.",
				),
				feature(
					"grave-markers",
					"Grave Markers",
					["markers", "names"],
					"Most names have been carefully chiseled away. A few dates remain legible.",
				),
			],
		),
		room(
			"old-armory",
			"Old Armory",
			510,
			65,
			"Rows of stone lockers divide the armory. Rusted chain hangs from ceiling hooks, and the floor is littered with broken arrowheads.",
			[
				feature(
					"sealed-locker",
					"Sealed Locker",
					["locker", "cabinet"],
					"Unlike the others, this locker remains closed with a heavy bronze padlock.",
				),
				feature(
					"practice-dummy",
					"Practice Dummy",
					["dummy", "target"],
					"Deep cuts cover the straw dummy. One recent blade mark crosses the older damage.",
				),
			],
		),
		room(
			"prison-block",
			"Prison Block",
			570,
			190,
			"Iron-barred cells face a central drain. Most doors hang open, but one remains firmly locked at the end of the block.",
			[
				feature(
					"locked-cell",
					"Locked Cell",
					["cell", "door"],
					"Something has scratched a map into the inside of the door with hundreds of tiny lines.",
				),
				feature(
					"jailers-desk",
					"Jailer's Desk",
					["desk"],
					"Rotten papers fill the drawers. A ring-shaped stain marks where the keys once rested.",
				),
			],
		),
		room(
			"ossuary",
			"Ossuary",
			455,
			300,
			"Bones are stacked in careful geometric patterns along the walls. A narrow aisle winds between columns made from skulls and mortar.",
			[
				feature(
					"bone-columns",
					"Bone Columns",
					["columns", "bones"],
					"Several skulls have been turned to face the same dark corner.",
				),
				feature(
					"mortuary-bell",
					"Mortuary Bell",
					["bell"],
					"A cord runs from the bell into a sealed stone coffin beneath the floor.",
				),
			],
		),
		room(
			"sunken-vault",
			"Sunken Vault",
			640,
			300,
			"The vault has settled at an angle, leaving one corner beneath dark water. Iron chests sit on raised platforms around a central plinth.",
			[
				feature(
					"central-plinth",
					"Central Plinth",
					["plinth", "pedestal"],
					"A circular recess in the stone is the right size for a large medallion or seal.",
				),
				feature(
					"iron-chests",
					"Iron Chests",
					["chests", "treasure"],
					"Most have rusted shut. One lid stands open, showing velvet compartments stripped bare.",
				),
			],
		),
	],
	connections: [
		connection("entrance-cistern", "dungeon-entrance", "flooded-cistern", "up", "down"),
		connection("entrance-guardroom", "dungeon-entrance", "guardroom", "e", "w"),
		connection("entrance-grotto", "dungeon-entrance", "fungal-grotto", "s", "n"),
		connection("cistern-guardroom", "flooded-cistern", "guardroom", "se", "nw"),
		connection("cistern-gallery", "flooded-cistern", "collapsed-gallery", "e", "w"),
		connection("guardroom-gallery", "guardroom", "collapsed-gallery", "up", "down"),
		connection("guardroom-shrine", "guardroom", "forgotten-shrine", "e", "w"),
		connection("guardroom-crypt", "guardroom", "lower-crypt", "se", "nw"),
		connection("grotto-crypt", "fungal-grotto", "lower-crypt", "out", "in"),
		connection("gallery-shrine", "collapsed-gallery", "forgotten-shrine", "se", "nw"),
		connection("gallery-armory", "collapsed-gallery", "old-armory", "e", "w"),
		connection("shrine-armory", "forgotten-shrine", "old-armory", "ne", "sw"),
		connection("shrine-prison", "forgotten-shrine", "prison-block", "e", "w"),
		connection("shrine-ossuary", "forgotten-shrine", "ossuary", "down", "up"),
		connection("crypt-ossuary", "lower-crypt", "ossuary", "e", "w"),
		connection("armory-prison", "old-armory", "prison-block", "se", "nw"),
		connection("prison-ossuary", "prison-block", "ossuary", "sw", "ne"),
		connection("prison-vault", "prison-block", "sunken-vault", "down", "up", "forwards"),
		connection("ossuary-vault", "ossuary", "sunken-vault", "e", "w"),
	],
};

export const world = WorldSchema.parse(rawWorld);
