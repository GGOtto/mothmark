import {WorldSchema} from "../../schemas/worldSchema";

const rawWorld = {
	startRoomId: "gate",
	rooms: [
		{
			id: "gate",
			name: "Gate",
			identify: {aliases: [], tags: []},
			position: {
				x: 100,
				y: 180,
			},
			description: {
				default:
					"A bent Gate leans in the dark. Moss clings to the wall. Paths lead east, south, and northwest.",
				variants: [],
			},
			features: [
				{
					id: "gate",
					name: "Gate",
					aliases: ["bars"],
					description: {
						default: "The gate is old, bent, and cold to the touch.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "moss",
					name: "Moss",
					aliases: ["green"],
					description: {
						default: "The moss is slick and bright in the cracks.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "rune",
					name: "Rune",
					aliases: ["mark"],
					description: {
						default: "The rune is cut deep into the stone. Its shape points east.",
						variants: [],
					},
					listedInRoom: true,
					activeWhen: [],
				},
			],
		},
		{
			id: "hall",
			name: "Hall",
			identify: {aliases: [], tags: []},
			position: {
				x: 260,
				y: 180,
			},
			description: {
				default:
					"A low Hall smells of dust and rain. Chalk and Door fill the walls. Ways run north, east, south, and west.",
				variants: [],
			},
			features: [
				{
					id: "map",
					name: "Map",
					aliases: ["mark"],
					description: {
						default: "The map is scratched into the wall. One mark is fresher than the rest.",
						variants: [],
					},
					listedInRoom: true,
					activeWhen: [],
				},
				{
					id: "chalk",
					name: "Chalk",
					aliases: ["dust"],
					description: {
						default: "The chalk is worn to a nub. White dust coats your fingers.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "door",
					name: "Door",
					aliases: ["arch"],
					description: {
						default: "The door is only an arch now, but old hinge scars remain.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
			],
		},
		{
			id: "well",
			name: "Well",
			identify: {aliases: [], tags: []},
			position: {
				x: 260,
				y: 60,
			},
			description: {
				default:
					"A dry Well opens under a cracked roof. A Crank and Pail wait nearby. Paths lead east and south.",
				variants: [],
			},
			features: [
				{
					id: "well",
					name: "Well",
					aliases: ["shaft"],
					description: {
						default: "The well drops into dark stone. It smells cold and dry.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "rope",
					name: "Rope",
					aliases: ["line"],
					description: {
						default: "The rope is stiff with age, but it still holds a careful knot.",
						variants: [],
					},
					listedInRoom: true,
					activeWhen: [],
				},
				{
					id: "crank",
					name: "Crank",
					aliases: ["winch"],
					description: {
						default: "The crank turns a little, then sticks.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "pail",
					name: "Pail",
					aliases: ["can"],
					description: {
						default: "The pail is dry. A split runs down one side.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
			],
		},
		{
			id: "loft",
			name: "Loft",
			identify: {aliases: [], tags: []},
			position: {
				x: 420,
				y: 60,
			},
			description: {
				default:
					"A timber Loft hangs over the ruin. A Nest and Beam sit in the dust. Ways lead west and south.",
				variants: [],
			},
			features: [
				{
					id: "lamp",
					name: "Lamp",
					aliases: ["light"],
					description: {
						default: "The lamp has no flame, but the glass is warm.",
						variants: [],
					},
					listedInRoom: true,
					activeWhen: [],
				},
				{
					id: "nest",
					name: "Nest",
					aliases: ["twigs"],
					description: {
						default: "The nest is made of twigs, thread, and gray lint.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "beam",
					name: "Beam",
					aliases: ["wood"],
					description: {
						default: "The beam bends under old weight but has not split.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
			],
		},
		{
			id: "vault",
			name: "Vault",
			identify: {aliases: [], tags: []},
			position: {
				x: 420,
				y: 180,
			},
			description: {
				default:
					"A narrow Vault waits behind a stone arch. A Seal and Plate sit on clean stone. Ways lead west, south, and southeast.",
				variants: [],
			},
			features: [
				{
					id: "box",
					name: "Box",
					aliases: ["chest"],
					description: {
						default: "The box is shut. A small notch marks the lid.",
						variants: [],
					},
					listedInRoom: true,
					activeWhen: [],
				},
				{
					id: "seal",
					name: "Seal",
					aliases: ["stamp"],
					description: {
						default: "The seal is pressed into black wax.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "plate",
					name: "Plate",
					aliases: ["disk"],
					description: {
						default: "The plate is brass, dull, and set flush with the floor.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
			],
		},
		{
			id: "den",
			name: "Den",
			identify: {aliases: [], tags: []},
			position: {
				x: 260,
				y: 300,
			},
			description: {
				default:
					"A cramped Den sits below the hall. A Desk, Ash, and Shelf crowd the room. Ways lead north and east.",
				variants: [],
			},
			features: [
				{
					id: "desk",
					name: "Desk",
					aliases: ["table"],
					description: {
						default: "The desk is scarred with small knife cuts.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "ash",
					name: "Ash",
					aliases: ["dust"],
					description: {
						default: "The ash is cold. A thin groove runs through it.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "shelf",
					name: "Shelf",
					aliases: ["rack"],
					description: {
						default: "The shelf sags, but a few pegs still hold.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
			],
		},
		{
			id: "cell",
			name: "Cell",
			identify: {aliases: [], tags: []},
			position: {
				x: 420,
				y: 300,
			},
			description: {
				default:
					"A bare Cell holds a cold draft. A Lock and Ring mark the wall. Ways lead north, west, and east.",
				variants: [],
			},
			features: [
				{
					id: "key",
					name: "Key",
					aliases: ["iron"],
					description: {
						default: "The key is dark with rust. It still has sharp teeth.",
						variants: [],
					},
					listedInRoom: true,
					activeWhen: [],
				},
				{
					id: "lock",
					name: "Lock",
					aliases: ["latch"],
					description: {
						default: "The lock is cracked open. Rust fills the seam.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "ring",
					name: "Ring",
					aliases: ["hook"],
					description: {
						default: "The ring is set deep into the wall.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
			],
		},
		{
			id: "pit",
			name: "Pit",
			identify: {aliases: [], tags: []},
			position: {
				x: 100,
				y: 300,
			},
			description: {
				default:
					"A shallow Pit cuts through the floor. A Bone and Root cross the dust. The only clear way leads north.",
				variants: [],
			},
			features: [
				{
					id: "coin",
					name: "Coin",
					aliases: ["gold"],
					description: {
						default: "The coin is thin and worn smooth.",
						variants: [],
					},
					listedInRoom: true,
					activeWhen: [],
				},
				{
					id: "bone",
					name: "Bone",
					aliases: ["rib"],
					description: {
						default: "The bone is small, clean, and split at one end.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "root",
					name: "Root",
					aliases: ["vine"],
					description: {
						default: "The root pokes through the stone like a dark cord.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
			],
		},
		{
			id: "fold",
			name: "Fold",
			identify: {aliases: [], tags: []},
			position: {
				x: 580,
				y: 300,
			},
			description: {
				default:
					"A folded room leans sideways. A Line and Pin mark the crease. Ways lead north, northwest, and west.",
				variants: [],
			},
			features: [
				{
					id: "line",
					name: "Line",
					aliases: ["crease"],
					description: {
						default: "The line bends across wall and floor without breaking.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "pin",
					name: "Pin",
					aliases: ["tack"],
					description: {
						default: "The pin is brass. It holds nothing you can see.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "glass",
					name: "Glass",
					aliases: ["shard"],
					description: {
						default: "A shard of glass shows the Gate from the wrong angle.",
						variants: [],
					},
					listedInRoom: true,
					activeWhen: [],
				},
			],
		},
		{
			id: "knot",
			name: "Knot",
			identify: {aliases: [], tags: []},
			position: {
				x: 580,
				y: 60,
			},
			description: {
				default:
					"A Knot of passages crosses itself. A Loop and Nail sit where the paths should meet. Ways lead south and west.",
				variants: [],
			},
			features: [
				{
					id: "loop",
					name: "Loop",
					aliases: ["coil"],
					description: {
						default: "The loop twists back through a crack that is too small for it.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "nail",
					name: "Nail",
					aliases: ["spike"],
					description: {
						default: "The nail has been hammered through a painted arrow.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "thread",
					name: "Thread",
					aliases: ["string"],
					description: {
						default: "A black thread runs from the floor into the ceiling.",
						variants: [],
					},
					listedInRoom: true,
					activeWhen: [],
				},
			],
		},
		{
			id: "hush",
			name: "Hush",
			identify: {aliases: [], tags: []},
			position: {
				x: 90,
				y: 60,
			},
			description: {
				default:
					"A quiet Hush sits where no north room should be. A Veil and Bell hang still. Ways lead southeast and east.",
				variants: [],
			},
			features: [
				{
					id: "veil",
					name: "Veil",
					aliases: ["cloth"],
					description: {
						default: "The veil is thin enough to see through, but it hides the room behind you.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "bell",
					name: "Bell",
					aliases: ["chime"],
					description: {
						default: "The bell has no clapper. It rings only in your jaw.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
				{
					id: "note",
					name: "Note",
					aliases: ["paper"],
					description: {
						default: "A damp note says: west is not always west.",
						variants: [],
					},
					listedInRoom: true,
					activeWhen: [],
				},
			],
		},
	],
	connections: [
		{
			id: "gate-hall",
			fromRoomId: {type: "room", id: "gate"},
			toRoomId: {type: "room", id: "hall"},
			direction: "e",
			returnDirection: "w",
			pathway: "two-way",
		},
		{
			id: "gate-pit",
			fromRoomId: {type: "room", id: "gate"},
			toRoomId: {type: "room", id: "pit"},
			direction: "s",
			returnDirection: "n",
			pathway: "two-way",
		},
		{
			id: "hall-well",
			fromRoomId: {type: "room", id: "hall"},
			toRoomId: {type: "room", id: "well"},
			direction: "n",
			returnDirection: "s",
			pathway: "two-way",
		},
		{
			id: "hall-den",
			fromRoomId: {type: "room", id: "hall"},
			toRoomId: {type: "room", id: "den"},
			direction: "s",
			returnDirection: "n",
			pathway: "two-way",
		},
		{
			id: "hall-vault",
			fromRoomId: {type: "room", id: "hall"},
			toRoomId: {type: "room", id: "vault"},
			direction: "e",
			returnDirection: "w",
			pathway: "two-way",
		},
		{
			id: "well-loft",
			fromRoomId: {type: "room", id: "well"},
			toRoomId: {type: "room", id: "loft"},
			direction: "e",
			returnDirection: "w",
			pathway: "two-way",
		},
		{
			id: "loft-vault",
			fromRoomId: {type: "room", id: "loft"},
			toRoomId: {type: "room", id: "vault"},
			direction: "s",
			returnDirection: "n",
			pathway: "forwards",
		},
		{
			id: "den-cell",
			fromRoomId: {type: "room", id: "den"},
			toRoomId: {type: "room", id: "cell"},
			direction: "e",
			returnDirection: "w",
			pathway: "two-way",
		},
		{
			id: "vault-cell",
			fromRoomId: {type: "room", id: "vault"},
			toRoomId: {type: "room", id: "cell"},
			direction: "s",
			returnDirection: "n",
			pathway: "two-way",
		},
		{
			id: "gate-hush",
			fromRoomId: {type: "room", id: "gate"},
			toRoomId: {type: "room", id: "hush"},
			direction: "nw",
			returnDirection: "se",
			pathway: "two-way",
		},
		{
			id: "hush-knot",
			fromRoomId: {type: "room", id: "hush"},
			toRoomId: {type: "room", id: "knot"},
			direction: "e",
			returnDirection: "w",
			pathway: "two-way",
		},
		{
			id: "knot-fold",
			fromRoomId: {type: "room", id: "knot"},
			toRoomId: {type: "room", id: "fold"},
			direction: "s",
			returnDirection: "n",
			pathway: "two-way",
		},
		{
			id: "vault-fold",
			fromRoomId: {type: "room", id: "vault"},
			toRoomId: {type: "room", id: "fold"},
			direction: "se",
			returnDirection: "nw",
			pathway: "two-way",
		},
		{
			id: "cell-fold",
			fromRoomId: {type: "room", id: "cell"},
			toRoomId: {type: "room", id: "fold"},
			direction: "e",
			returnDirection: "w",
			pathway: "two-way",
		},
	],
};

export const world = WorldSchema.parse(rawWorld);
