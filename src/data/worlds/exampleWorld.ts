import {WorldSchema} from "../../schemas/world/worldSchema";
import {toID} from "../../utils/idUtils";

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
		description,
		listedInRoom,
	};
}

function room(
	id: string,
	name: string,
	x: number,
	y: number,
	description: string,
	features: ReturnType<typeof feature>[],
	levelTag: "upper-level" | "main-level" | "lower-level" = "main-level",
) {
	return {
		id,
		name,
		aliases: id === "dungeon-entrance" ? ["entrance", "stairs"] : [],
		tags: ["dungeon", levelTag],
		metadata: {position: {x, y}},
		description,
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
		metadata: {},
	};
}

function commandBehavior(id: string, message: string) {
	return {
		id: toID("condition-branch", `${id}-behavior`),
		always: {
			name: `${id} result`,
			id: toID("effect", `${id}-result`),
			type: "group" as const,
			effects: [{type: "message" as const, operation: "show" as const, message}],
			allowMultipleUsesInWorld: true as const,
		},
	};
}

const rawWorld = {
	metadata: {
		title: "The Barrow Below",
		author: "Mothmark",
		description:
			"A compact dungeon of flooded chambers, ruined halls, crypts, and forgotten treasure.",
		version: "0.3.0",
		layers: [
			{
				name: "Lower Crypts",
				layer: -1,
				viewport: {x: 26, y: -120, zoom: 1},
				rooms: [
					{type: "room", id: "fungal-grotto"},
					{type: "room", id: "lower-crypt"},
					{type: "room", id: "ossuary"},
					{type: "room", id: "sunken-vault"},
				],
			},
			{
				name: "Ground Level",
				layer: 0,
				viewport: {x: 34, y: 14, zoom: 1},
				rooms: [
					{type: "room", id: "dungeon-entrance"},
					{type: "room", id: "guardroom"},
					{type: "room", id: "collapsed-gallery"},
					{type: "room", id: "forgotten-shrine"},
					{type: "room", id: "prison-block"},
				],
			},
			{
				name: "Upper Works",
				layer: 1,
				viewport: {x: 12, y: 90, zoom: 1},
				rooms: [
					{type: "room", id: "flooded-cistern"},
					{type: "room", id: "old-armory"},
				],
			},
		],
	},
	startRoomId: toID("room", "dungeon-entrance"),
	deathMessage: "You have died!",
	rooms: [
		room(
			"dungeon-entrance",
			"Dungeon Entrance",
			100,
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
			500,
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
			"upper-level",
		),
		room(
			"guardroom",
			"Guardroom",
			260,
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
			100,
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
			"lower-level",
		),
		room(
			"collapsed-gallery",
			"Collapsed Gallery",
			260,
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
			420,
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
			280,
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
			"lower-level",
		),
		room(
			"old-armory",
			"Old Armory",
			220,
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
			"upper-level",
		),
		room(
			"prison-block",
			"Prison Block",
			580,
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
			460,
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
			"lower-level",
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
			"lower-level",
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
	commands: [
		{
			id: toID("command", "shout"),
			name: "Shout",
			enabled: true,
			patterns: [
				{
					blocks: [
						{
							id: toID("command-block", "shout-verb"),
							type: "phrase",
							matches: ["shout", "yell", "scream"],
						},
					],
				},
			],
			scope: {scope: "global" as const},
			behavior: commandBehavior(
				"shout",
				"Your voice rolls through the barrow and returns as a thin, distant echo.",
			),
		},
		{
			id: toID("command", "say"),
			name: "Say something",
			enabled: true,
			patterns: [
				{
					blocks: [
						{
							id: toID("command-block", "say-verb"),
							type: "phrase",
							matches: ["say", "speak"],
						},
						{
							id: toID("command-block", "say-message"),
							type: "text",
							role: "message",
							mode: "rest" as const,
						},
					],
				},
			],
			scope: {scope: "global" as const},
			behavior: commandBehavior("say", "You say, “{message}”"),
		},
		{
			id: toID("command", "wait-turns"),
			name: "Wait several turns",
			enabled: true,
			patterns: [
				{
					blocks: [
						{
							id: toID("command-block", "wait-verb"),
							type: "phrase",
							matches: ["wait", "pause"],
						},
						{
							id: toID("command-block", "wait-turn-count"),
							type: "number",
							role: "turns",
							numberType: "integer" as const,
							min: 1,
						},
						{
							id: toID("command-block", "wait-turn-unit"),
							type: "phrase",
							matches: ["turn", "turns"],
						},
					],
				},
			],
			scope: {scope: "global" as const},
			behavior: commandBehavior("wait-turns", "You wait for {turns} turns."),
		},
		{
			id: toID("command", "point-direction"),
			name: "Point in a direction",
			enabled: true,
			patterns: [
				{
					blocks: [
						{
							id: toID("command-block", "point-verb"),
							type: "phrase",
							matches: ["point", "gesture"],
						},
						{
							id: toID("command-block", "point-direction"),
							type: "direction",
							role: "direction",
						},
					],
				},
			],
			scope: {scope: "layers" as const, layers: [-1, 0, 1]},
			behavior: commandBehavior("point-direction", "You point {direction}."),
		},
		{
			id: toID("command", "turn-sluice-wheel"),
			name: "Turn the sluice wheel",
			enabled: true,
			patterns: [
				{
					blocks: [
						{
							id: toID("command-block", "turn-wheel-verb"),
							type: "phrase",
							matches: ["turn", "rotate"],
						},
						{
							id: toID("command-block", "turn-wheel-target"),
							type: "target",
							role: "wheel",
							entityTypes: ["feature" as const],
							entityIds: [toID("feature", "iron-wheel")],
							source: "visible" as const,
						},
						{
							id: toID("command-block", "turn-wheel-rotation"),
							type: "choice",
							role: "rotation",
							choices: [
								{
									value: "clockwise",
									label: "Clockwise",
									matches: ["clockwise", "right"],
								},
								{
									value: "counterclockwise",
									label: "Counterclockwise",
									matches: ["counterclockwise", "anticlockwise", "left"],
								},
							],
						},
					],
				},
			],
			scope: {scope: "rooms" as const, roomIds: [toID("room", "flooded-cistern")]},
			behavior: commandBehavior(
				"turn-sluice-wheel",
				"You strain against {wheel.name}, turning it {rotation}.",
			),
		},
		{
			id: toID("command", "place-idol-in-bowl"),
			name: "Place the idol in the offering bowl",
			enabled: true,
			patterns: [
				{
					blocks: [
						{
							id: toID("command-block", "place-idol-verb"),
							type: "phrase",
							matches: ["put", "place", "set"],
						},
						{
							id: toID("command-block", "place-idol-object"),
							type: "target",
							role: "object",
							entityTypes: ["feature" as const],
							entityIds: [toID("feature", "serpent-idol")],
							source: "visible" as const,
						},
						{
							id: toID("command-block", "place-idol-relation"),
							type: "relation",
							relation: "in" as const,
						},
						{
							id: toID("command-block", "place-idol-destination"),
							type: "target",
							role: "destination",
							entityTypes: ["feature" as const],
							entityIds: [toID("feature", "offering-bowl")],
							source: "visible" as const,
						},
					],
				},
			],
			scope: {scope: "rooms" as const, roomIds: [toID("room", "forgotten-shrine")]},
			behavior: commandBehavior(
				"place-idol-in-bowl",
				"As {object.name} settles into {destination.name}, the pale flames bend toward it.",
			),
		},
		{
			id: toID("command", "ring-mortuary-bell"),
			name: "Ring the mortuary bell",
			enabled: true,
			patterns: [
				{
					blocks: [
						{
							id: toID("command-block", "ring-bell-verb"),
							type: "phrase",
							matches: ["ring", "sound"],
						},
						{
							id: toID("command-block", "ring-bell-target"),
							type: "target",
							role: "bell",
							entityTypes: ["feature" as const],
							entityIds: [toID("feature", "mortuary-bell")],
							source: "visible" as const,
						},
					],
				},
			],
			scope: {scope: "layers" as const, layers: [-1]},
			behavior: commandBehavior(
				"ring-mortuary-bell",
				"{bell.name} answers with one low note. Something beneath the floor answers twice.",
			),
		},
		{
			id: toID("command", "write-text"),
			name: "Write text",
			enabled: true,
			patterns: [
				{
					blocks: [
						{
							id: toID("command-block", "write-text-verb"),
							type: "phrase",
							matches: ["write", "inscribe"],
						},
						{
							id: toID("command-block", "write-text-content"),
							type: "text",
							role: "text",
							mode: "rest" as const,
						},
					],
				},
			],
			scope: {scope: "global" as const},
			behavior: commandBehavior("write-text", "You write “{text}”."),
		},
		{
			id: toID("command", "write-on-target"),
			name: "Write on a target",
			enabled: true,
			patterns: [
				{
					blocks: [
						{
							id: toID("command-block", "write-target-verb"),
							type: "phrase",
							matches: ["write", "inscribe"],
						},
						{
							id: toID("command-block", "write-target-relation"),
							type: "relation",
							relation: "on" as const,
						},
						{
							id: toID("command-block", "write-target-target"),
							type: "target",
							role: "target",
							source: "visible" as const,
						},
					],
				},
			],
			scope: {scope: "global" as const},
			behavior: commandBehavior("write-on-target", "You make a careful mark on {target.name}."),
		},
		{
			id: toID("command", "touch-target"),
			name: "Touch a target",
			enabled: true,
			patterns: [
				{
					blocks: [
						{
							id: toID("command-block", "touch-target-verb"),
							type: "phrase",
							matches: ["touch"],
						},
						{
							id: toID("command-block", "touch-target-target"),
							type: "target",
							role: "target",
							source: "visible" as const,
						},
					],
				},
			],
			scope: {scope: "global" as const},
			behavior: commandBehavior("touch-target", "You touch {target.name}."),
		},
		{
			id: toID("command", "touch-abandoned-torch"),
			name: "Touch the abandoned torch",
			enabled: true,
			patterns: [
				{
					blocks: [
						{
							id: toID("command-block", "touch-torch-verb"),
							type: "phrase",
							matches: ["touch"],
						},
						{
							id: toID("command-block", "touch-torch-target"),
							type: "target",
							role: "torch",
							entityIds: [toID("feature", "abandoned-torch")],
							source: "visible" as const,
						},
					],
				},
			],
			scope: {scope: "global" as const},
			behavior: commandBehavior(
				"touch-abandoned-torch",
				"The abandoned torch crumbles at your touch, leaving pitch-black dust on your fingers.",
			),
		},
	],
};

export function createExampleWorld() {
	return WorldSchema.parse({
		...rawWorld,
		commands: rawWorld.commands.map((command) => ({
			...command,
			fallbacks: command.patterns.flatMap((pattern) =>
				pattern.blocks.map((block) => ({
					blockId: block.id,
					behavior: commandBehavior(
						`${command.id.id}-${block.id.id}-fallback`,
						"That command is understood, but part of it does not resolve.",
					),
				})),
			),
		})),
	});
}

export const world = createExampleWorld();
