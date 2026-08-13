import {z} from "zod";
import {docify} from "@/schemas/utils/docify";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {CompassDirectionSchema, DirectionSchema} from "./directionSchema";

export const ComparisonOperatorSchema = editor.select(
	z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]),
	{
		title: "Operator",
		options: [
			{label: "Equals", value: "eq"},
			{label: "Does not equal", value: "neq"},
			{label: "Greater than", value: "gt"},
			{label: "Greater than or equal", value: "gte"},
			{label: "Less than", value: "lt"},
			{label: "Less than or equal", value: "lte"},
		],
	},
);

export const ConditionReferenceSchema = editor.object(
	{
		type: z.literal("condition-ref"),
		conditionId: editor.reference("condition", {title: "Saved condition"}),
	},
	{title: "Use saved condition"},
);

export const WorldConditionSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation("flag-is", {
				label: "A world flag has a value",
				description: "Check whether a stored world fact is true or false.",
				keywords: ["boolean", "state", "remembered", "marked", "switch"],
				situations: [
					"after a choice was made",
					"once a puzzle is solved",
					"while a trap is armed",
					"if the ground was disturbed",
				],
				example: "The ground-disturbed flag is true.",
			}),
			flag: editor.flagKey({title: "Flag", commandVariableType: "boolean"}),
			value: editor
				.boolean({
					title: "Value",
					commandVariableType: "boolean",
					features: {labels: {on: "True", off: "False"}},
				})
				.default(true),
		}),
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation(["flag-exists", "flag-missing"], {
				"flag-exists": {
					label: "A world flag exists",
					description: "Check that a world fact has been stored, regardless of its value.",
					keywords: ["defined", "created", "present", "state"],
					situations: [
						"after something happened at least once",
						"once a secret was discovered",
						"when a choice has been recorded",
					],
				},
				"flag-missing": {
					label: "A world flag is missing",
					description: "Check that a world fact has never been stored or was forgotten.",
					keywords: ["undefined", "absent", "not created", "state"],
					situations: [
						"before anything has happened",
						"the first time only",
						"until a secret is discovered",
					],
				},
			}),
			flag: editor.flagKey({title: "Flag"}),
		}),
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation("counter-compare", {
				label: "Compare a counter",
				description: "Compare a stored number with an exact value.",
				keywords: ["number", "score", "count", "greater", "less", "equals"],
				situations: [
					"after three attempts",
					"when the score reaches ten",
					"if health falls below zero",
					"when a timer expires",
				],
			}),
			counter: editor.counterKey({title: "Counter", commandVariableType: "number"}),
			operator: ComparisonOperatorSchema,
			value: editor.number({title: "Value", commandVariableType: "number"}),
		}),
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation("counter-between", {
				label: "A counter is in a range",
				description: "Check whether a stored number falls between a minimum and maximum.",
				keywords: ["number", "range", "between", "score", "count"],
				situations: [
					"while health is in a safe range",
					"during the middle of a countdown",
					"when progress is between two stages",
				],
			}),
			counter: editor.counterKey({title: "Counter", commandVariableType: "number"}),
			min: editor.number({title: "Minimum", commandVariableType: "number"}),
			max: editor.number({title: "Maximum", commandVariableType: "number"}),
			inclusive: editor.boolean({title: "Inclusive"}).default(true),
		}),
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation("counter-compare-counter", {
				label: "Compare two counters",
				description: "Compare one stored number directly with another stored number.",
				keywords: ["numbers", "variables", "score", "versus", "greater", "less"],
				situations: [
					"when one team's score passes another",
					"if damage is greater than armor",
					"when collected items reach a changing target",
					"compare two stored puzzle values",
				],
			}),
			leftCounter: editor.counterKey({title: "Left counter"}),
			operator: ComparisonOperatorSchema,
			rightCounter: editor.counterKey({title: "Right counter"}),
		}),
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation(["counter-exists", "counter-missing"], {
				"counter-exists": {
					label: "A counter exists",
					description: "Check that a stored number has been created.",
					keywords: ["defined", "present", "number", "score", "count"],
					situations: [
						"after counting has started",
						"once a score has been recorded",
						"when a timer was initialized",
					],
				},
				"counter-missing": {
					label: "A counter is missing",
					description: "Check that a stored number has never been created or was forgotten.",
					keywords: ["undefined", "absent", "number", "score", "count"],
					situations: [
						"before counting starts",
						"when no score exists yet",
						"before a timer is initialized",
					],
				},
			}),
			counter: editor.counterKey({title: "Counter", commandVariableType: "number"}),
		}),
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation(
				[
					"text-is",
					"text-is-not",
					"text-starts-with",
					"text-does-not-start-with",
					"text-ends-with",
					"text-does-not-end-with",
					"text-contains",
					"text-does-not-contain",
				],
				{
					"text-is": {
						label: "Saved text equals",
						description: "Check for an exact text value.",
						keywords: ["string", "answer", "name", "password", "matches"],
						situations: [
							"when the player gave the correct password",
							"if a remembered answer is exact",
							"when a chosen name matches",
						],
					},
					"text-is-not": {
						label: "Saved text does not equal",
						description: "Check that saved text differs from an exact value.",
						keywords: ["string", "answer", "name", "password", "different"],
						situations: [
							"when the password is wrong",
							"if a remembered answer differs",
							"when a chosen name does not match",
						],
					},
					"text-starts-with": {
						label: "Saved text starts with",
						description: "Check the beginning of a saved text value.",
						keywords: ["prefix", "string", "begins", "answer"],
						situations: [
							"when a code begins with a prefix",
							"if an answer starts with a title",
							"when saved input begins correctly",
						],
					},
					"text-does-not-start-with": {
						label: "Saved text does not start with",
						description: "Reject a particular beginning of saved text.",
						keywords: ["prefix", "string", "begins", "answer"],
						situations: [
							"when a code lacks a prefix",
							"if an answer starts incorrectly",
							"when saved input has another beginning",
						],
					},
					"text-ends-with": {
						label: "Saved text ends with",
						description: "Check the ending of a saved text value.",
						keywords: ["suffix", "string", "ending", "answer"],
						situations: [
							"when a code ends with a suffix",
							"if an answer has the required ending",
							"when saved input finishes correctly",
						],
					},
					"text-does-not-end-with": {
						label: "Saved text does not end with",
						description: "Reject a particular ending of saved text.",
						keywords: ["suffix", "string", "ending", "answer"],
						situations: [
							"when a code lacks a suffix",
							"if an answer has the wrong ending",
							"when saved input finishes differently",
						],
					},
					"text-contains": {
						label: "Saved text contains",
						description: "Find text anywhere inside a saved value.",
						keywords: ["substring", "includes", "string", "answer"],
						situations: [
							"when an answer mentions a secret word",
							"if a journal entry contains a clue",
							"when saved input includes any phrase",
						],
					},
					"text-does-not-contain": {
						label: "Saved text does not contain",
						description: "Check that text does not occur inside a saved value.",
						keywords: ["substring", "excludes", "string", "answer"],
						situations: [
							"when an answer omits a secret word",
							"if a journal entry lacks a clue",
							"when saved input excludes a phrase",
						],
					},
				},
			),
			text: editor.textKey({title: "Text variable", commandVariableType: "string"}),
			value: editor.input({title: "Value", commandVariableType: "string"}),
		}),
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation(
				["text-is-empty", "text-is-not-empty", "text-exists", "text-missing"],
				{
					"text-is-empty": {
						label: "Saved text is empty",
						description: "Check that an existing text value contains no characters.",
						keywords: ["blank", "string", "answer", "zero length"],
						situations: [
							"when the player submitted nothing",
							"if a response was left blank",
							"when a saved note has no text",
						],
					},
					"text-is-not-empty": {
						label: "Saved text is not empty",
						description: "Check that an existing text value contains something.",
						keywords: ["filled", "string", "answer", "has value"],
						situations: [
							"after the player entered an answer",
							"if a response contains anything",
							"when a saved note has text",
						],
					},
					"text-exists": {
						label: "Saved text exists",
						description: "Check that a text value has been created.",
						keywords: ["defined", "present", "string", "answer"],
						situations: [
							"after a name was recorded",
							"once the player supplied text",
							"when a password attempt exists",
						],
					},
					"text-missing": {
						label: "Saved text is missing",
						description: "Check that a text value has never been created or was forgotten.",
						keywords: ["undefined", "absent", "string", "answer"],
						situations: [
							"before a name is recorded",
							"until the player supplies text",
							"when no password was attempted",
						],
					},
				},
			),
			text: editor.textKey({title: "Text variable", commandVariableType: "string"}),
		}),
	]),
	{title: "World state", description: "Checks world flags, counters, and saved text."},
);

const itemBooleanStateOperations = [
	"is-visible",
	"is-reachable",
	"is-known",
	"is-carried",
	"is-hidden",
	"is-destroyed",
	"is-examined",
	"is-listed",
	"is-open",
	"is-locked",
	"location-is-hidden",
	"location-is-destroyed",
] as const;

export const ItemConditionSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation(itemBooleanStateOperations, {
					"is-visible": {
						label: "An item is visible",
						description: "Check whether the player can currently see an item.",
						keywords: ["see", "shown", "line of sight", "perception"],
						situations: [
							"only if the player can see it",
							"when an object is exposed",
							"before describing a visible clue",
						],
					},
					"is-reachable": {
						label: "An item is reachable",
						description: "Check whether the player can currently interact with an item.",
						keywords: ["access", "touch", "available", "nearby"],
						situations: [
							"only if the player can touch it",
							"when an object is within reach",
							"before interacting with a nearby tool",
						],
					},
					"is-known": {
						label: "An item is known",
						description: "Check whether the player has learned that an item exists.",
						keywords: ["discovered", "remembered", "seen", "awareness"],
						situations: [
							"after discovering a secret object",
							"once the player learns about it",
							"when an unseen clue becomes known",
						],
					},
					"is-carried": {
						label: "An item is carried",
						description: "Check whether an item is in the player's inventory.",
						keywords: ["inventory", "holding", "has", "taken"],
						situations: [
							"if the player has the key",
							"while carrying a tool",
							"after picking something up",
						],
					},
					"is-hidden": {
						label: "An item is hidden",
						description: "Check the item's own hidden location state.",
						keywords: ["concealed", "buried", "invisible", "unavailable"],
						situations: [
							"while treasure is buried",
							"before a hidden clue is revealed",
							"when an object is concealed",
						],
					},
					"is-destroyed": {
						label: "An item is destroyed",
						description: "Check whether an item has been removed from play.",
						keywords: ["removed", "consumed", "broken", "gone"],
						situations: [
							"after an object is consumed",
							"when a prop has been broken",
							"once an item is removed from play",
						],
					},
					"is-examined": {
						label: "An item was examined",
						description: "Check whether the player has examined an item.",
						keywords: ["inspected", "looked at", "read", "searched"],
						situations: [
							"after reading the note",
							"once the player searches an object",
							"when a clue has been inspected",
						],
					},
					"is-listed": {
						label: "An item is listed in its parent",
						description: "Check whether the item is marked for its parent listing.",
						keywords: ["parent listing", "room listing", "container", "shown", "mentioned"],
						situations: [
							"when an object should be mentioned beneath its parent",
							"if an item appears in a room or open container listing",
							"before changing an item's automatic listing state",
						],
					},
					"is-open": {
						label: "An item is open",
						description: "Check an openable item's current open or closed state.",
						keywords: ["opened", "closed", "container", "door", "lid"],
						situations: [
							"only while the chest is open",
							"after opening a door",
							"before accessing a container's contents",
						],
					},
					"is-locked": {
						label: "An item is locked",
						description: "Check a lockable item's current locked or unlocked state.",
						keywords: ["unlocked", "key", "secured", "door", "container"],
						situations: [
							"while the door is locked",
							"before a key is used",
							"when a container is secured",
						],
					},
					"location-is-hidden": {
						label: "An item's location is hidden",
						description: "Check whether an enclosing location makes the item hidden.",
						keywords: ["inside hidden", "container", "ancestor", "concealed", "buried"],
						situations: [
							"while an item is inside a buried container",
							"when a closed location conceals its contents",
							"before uncovering a nested object",
						],
					},
					"location-is-destroyed": {
						label: "An item's location is destroyed",
						description: "Check whether an enclosing location has been removed from play.",
						keywords: ["inside destroyed", "container", "ancestor", "removed", "gone"],
						situations: [
							"when a containing object was destroyed",
							"after a container and its contents leave play",
							"while an item is trapped in a removed location",
						],
					},
				}),
				itemId: editor.reference("item", {title: "Item"}),
				value: editor.boolean({title: "Expected"}).default(true),
			},
			{title: "Check state"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation(["is-in-current-room", "is-in-inventory"], {
					"is-in-current-room": {
						label: "An item is in the current room",
						description: "Check whether an item is directly located where the player is.",
						keywords: ["here", "nearby", "location", "room"],
						situations: [
							"when the object is here",
							"only if a clue is in this room",
							"before interacting with local scenery",
						],
					},
					"is-in-inventory": {
						label: "An item is in inventory",
						description: "Check whether an item is directly carried by the player.",
						keywords: ["carried", "holding", "has", "taken"],
						situations: [
							"if the player has an object directly",
							"while a tool is in inventory",
							"after taking a quest item",
						],
					},
				}),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Check location"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation("is-in-room", {
					label: "An item is in a room",
					description: "Check whether an item is directly in a particular room.",
					keywords: ["location", "where", "placed", "room"],
					situations: [
						"when an object was left in a particular room",
						"if treasure is stored at a location",
						"before moving an item between rooms",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
				roomId: editor.reference("room", {title: "Room"}),
			},
			{title: "In room"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation("is-inside", {
					label: "An item is inside another",
					description: "Check whether an item is directly inside a particular container.",
					keywords: ["container", "stored", "inserted", "buried", "hole"],
					situations: [
						"when treasure is buried in a hole",
						"if a key is inside a box",
						"after placing an object in a container",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
				parentItemId: editor.reference("item", {title: "Container"}),
			},
			{title: "Inside item"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation("is-on", {
					label: "An item is on another",
					description: "Check whether an item is directly on a particular surface.",
					keywords: ["surface", "placed", "resting", "stacked"],
					situations: [
						"when an object rests on an altar",
						"if a tool is on a workbench",
						"after stacking something on a surface",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
				parentItemId: editor.reference("item", {title: "Surface"}),
			},
			{title: "On item"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation("has-behavior", {
					label: "An item has a behavior",
					description:
						"Check whether an item supports take, contain, open, lock, door, surface, or use behavior.",
					keywords: [
						"takeable",
						"container",
						"surface",
						"openable",
						"lockable",
						"door",
						"usable",
						"capability",
					],
					situations: [
						"only if an object can be taken",
						"when something can hold other items",
						"if a prop can be opened locked or used",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
				behavior: editor.select(
					z.enum(["takeable", "container", "surface", "openable", "lockable", "door", "usable"]),
					{title: "Behavior"},
				),
				value: editor.boolean({title: "Expected"}).default(true),
			},
			{title: "Has behavior"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation("has-tag", {
					label: "An item has a tag",
					description: "Check authored classification on an item.",
					keywords: ["label", "category", "marked", "property"],
					situations: [
						"when an object belongs to a category",
						"if a weapon has the sharp tag",
						"only for items marked as quest objects",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
				tag: editor.input({title: "Tag"}).trim().min(1),
				value: editor.boolean({title: "Expected"}).default(true),
			},
			{title: "Has tag"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation("contents-empty", {
					label: "An item's contents are empty",
					description: "Check whether nothing is inside or on an item.",
					keywords: ["container", "surface", "nothing", "vacant", "hole"],
					situations: [
						"when a hole contains nothing",
						"if a chest has been emptied",
						"before placing something on a clear surface",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
				placement: editor.select(z.enum(["inside", "on", "either"]), {title: "Placement"}),
				value: editor.boolean({title: "Expected"}).default(true),
			},
			{title: "Contents empty"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation("contains-item", {
					label: "An item contains another item",
					description: "Check for a particular item inside or on another.",
					keywords: ["container", "surface", "holds", "stored", "buried"],
					situations: [
						"when a hole contains buried treasure",
						"if a box holds the key",
						"after placing an object on a pedestal",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
				containedItemId: editor.reference("item", {title: "Contained item"}),
				placement: editor.select(z.enum(["inside", "on", "either"]), {title: "Placement"}),
			},
			{title: "Contains item"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation("contains-tag", {
					label: "An item contains a tagged item",
					description: "Check for any inside or on-top item with a particular tag.",
					keywords: ["container", "surface", "holds", "category", "any item"],
					situations: [
						"when a container holds any weapon",
						"if a surface has a quest item on it",
						"after collecting one item of a category",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
				tag: editor.input({title: "Tag"}).trim().min(1),
				placement: editor.select(z.enum(["inside", "on", "either"]), {title: "Placement"}),
			},
			{title: "Contains tagged item"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation(["capacity-is-empty", "capacity-is-full"], {
					"capacity-is-empty": {
						label: "An item has all capacity free",
						description: "Check whether a container or surface is using none of its size capacity.",
						keywords: ["empty", "space", "container", "surface", "size"],
						situations: [
							"when a container has all its space free",
							"before filling an empty shelf",
							"if nothing uses an object's capacity",
						],
					},
					"capacity-is-full": {
						label: "An item has no capacity left",
						description: "Check whether a container or surface has reached its size capacity.",
						keywords: ["full", "space", "container", "surface", "size"],
						situations: [
							"when a backpack cannot hold more",
							"if a shelf has reached capacity",
							"before rejecting another item",
						],
					},
				}),
				itemId: editor.reference("item", {title: "Item"}),
				placement: editor.select(z.enum(["inside", "on"]), {title: "Placement"}),
				value: editor.boolean({title: "Expected"}).default(true),
			},
			{title: "Check capacity"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation("can-fit-item", {
					label: "An item can fit inside or on another",
					description: "Check remaining capacity against a candidate item's size.",
					keywords: ["capacity", "space", "container", "surface", "size"],
					situations: [
						"before putting a large object in a small box",
						"when checking whether luggage has room",
						"if an item fits on a crowded surface",
					],
				}),
				itemId: editor.reference("item", {title: "Container or surface"}),
				candidateItemId: editor.reference("item", {title: "Item to fit"}),
				placement: editor.select(z.enum(["inside", "on"]), {title: "Placement"}),
			},
			{title: "Can fit item"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation("can-be-unlocked-by", {
					label: "A key can unlock an item",
					description: "Check whether a particular item is an accepted key for a lock.",
					keywords: ["key", "lock", "unlock", "fits"],
					situations: [
						"when testing the correct key",
						"before unlocking a chest",
						"if a key fits a particular door",
					],
				}),
				itemId: editor.reference("item", {title: "Lock"}),
				keyItemId: editor.reference("item", {title: "Key"}),
			},
			{title: "Can be unlocked by"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation("controls-connection", {
					label: "A door controls a connection",
					description: "Check whether a door item is linked to a passage, optionally a specific one.",
					keywords: ["door", "exit", "passage", "connection", "controls"],
					situations: [
						"when a door belongs to this passage",
						"if a lever controls an exit",
						"before synchronizing a doorway",
					],
				}),
				itemId: editor.reference("item", {title: "Door"}),
				connectionId: editor.reference("connection", {title: "Connection"}).optional(),
				value: editor.boolean({title: "Expected"}).default(true),
			},
			{title: "Controls connection"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation("connection-is-passable", {
					label: "A door's connection is passable",
					description: "Check whether the passage controlled by a door can currently be traversed.",
					keywords: ["door", "exit", "passage", "open", "unlocked", "blocked"],
					situations: [
						"when a doorway can be crossed",
						"if an open door leaves the passage usable",
						"before allowing travel through a controlled exit",
					],
				}),
				itemId: editor.reference("item", {title: "Door"}),
				connectionId: editor.reference("connection", {title: "Connection"}).optional(),
				value: editor.boolean({title: "Expected"}).default(true),
			},
			{title: "Connection is passable"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation("flag-is", {
					label: "An item flag has a value",
					description: "Check whether a fact stored on one item is true or false.",
					keywords: ["boolean", "state", "remembered", "marked", "property"],
					situations: [
						"while a trap item is armed",
						"after a device has been activated",
						"if an object-specific puzzle is solved",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
				flag: editor.string({title: "Flag"}).min(1),
				value: editor
					.boolean({
						title: "Value",
						commandVariableType: "boolean",
						features: {labels: {on: "True", off: "False"}},
					})
					.default(true),
			},
			{title: "Item flag is"},
		),
		editor.object(
			{
				type: z.literal("item"),
				operation: editor.logicOperation(["flag-exists", "flag-missing"], {
					"flag-exists": {
						label: "An item flag exists",
						description: "Check that a fact has been stored on an item.",
						keywords: ["defined", "present", "state", "property"],
						situations: [
							"after an object was changed at least once",
							"when a device has stored local state",
							"once an item's secret has been recorded",
						],
					},
					"flag-missing": {
						label: "An item flag is missing",
						description: "Check that a fact has not been stored on an item.",
						keywords: ["undefined", "absent", "state", "property"],
						situations: [
							"before an object has ever changed",
							"when a device has no local state",
							"until an item's secret is recorded",
						],
					},
				}),
				itemId: editor.reference("item", {title: "Item"}),
				flag: editor.string({title: "Flag"}).min(1),
			},
			{title: "Check item flag"},
		),
	]),
	{
		title: "Item",
		description: "Checks an item's state, location, contents, behavior, relationships, or flags.",
	},
);

export const ItemCollectionScopeSchema = editor.select(
	z.enum(["world", "current-room", "inventory", "contents"]),
	{
		title: "Search in",
		options: [
			{label: "Every item", value: "world"},
			{label: "Current room", value: "current-room"},
			{label: "Player inventory", value: "inventory"},
			{label: "Item contents", value: "contents"},
		],
	},
);

const itemCollectionFields = {
	scope: ItemCollectionScopeSchema,
	containerId: editor.reference("item", {title: "Containing item"}).optional(),
	placement: editor
		.select(z.enum(["inside", "on", "both"]), {
			title: "Placement",
			options: [
				{label: "Inside", value: "inside"},
				{label: "On", value: "on"},
				{label: "Inside or on", value: "both"},
			],
		})
		.default("both"),
	tag: editor
		.input({title: "Matching tag", placeholder: "Leave empty to match every item"})
		.optional(),
	includeNested: editor
		.boolean({
			title: "Include nested items",
			description: "Also match items inside matched contents.",
		})
		.default(true),
};

export const ItemCollectionConditionSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("items"),
			operation: editor.logicOperation(["matching-exists", "matching-missing"], {
				"matching-exists": {
					label: "Any matching item exists",
					description: "Check whether at least one item matches a tag and location query.",
					keywords: ["find", "query", "any", "tag", "collection", "dynamic"],
					situations: [
						"if any torch remains in this room",
						"when the player carries any food",
						"if a buried item exists in the hole",
						"find an item by tag without naming it",
					],
				},
				"matching-missing": {
					label: "No matching item exists",
					description: "Check that no item matches a tag and location query.",
					keywords: ["none", "absent", "query", "tag", "collection", "dynamic"],
					situations: [
						"when every fire has been removed",
						"if the player carries no weapons",
						"when a container has no quest items",
					],
				},
			}),
			...itemCollectionFields,
		}),
		z.object({
			type: z.literal("items"),
			operation: editor.logicOperation("matching-count", {
				label: "Count matching items",
				description: "Compare the number of items matching a tag and location query.",
				keywords: ["count", "quantity", "how many", "collection", "query", "dynamic"],
				situations: [
					"when three gems are in the bowl",
					"if the player carries enough coins",
					"after every torch in the room is found",
					"count buried items in a hole",
				],
			}),
			...itemCollectionFields,
			operator: ComparisonOperatorSchema,
			value: editor.number({title: "Count"}).int().nonnegative(),
		}),
		z.object({
			type: z.literal("items"),
			operation: editor.logicOperation("matching-total-size", {
				label: "Compare matching items' total size",
				description: "Add the size of matching authored items and compare the total.",
				keywords: ["capacity", "weight", "size", "sum", "collection", "inventory"],
				situations: [
					"when carried equipment is too heavy",
					"if a container holds enough material",
					"compare the total size of treasure in a room",
				],
			}),
			...itemCollectionFields,
			operator: ComparisonOperatorSchema,
			value: editor.number({title: "Size units"}).int().nonnegative(),
		}),
		z.object({
			type: z.literal("items"),
			operation: editor.logicOperation("all-matching-have-flag", {
				label: "Every matching item has a flag value",
				description: "Check a boolean state across every item returned by a query.",
				keywords: ["all", "every", "flag", "collection", "query", "state"],
				situations: [
					"when every torch is extinguished",
					"if all traps in the room are disarmed",
					"after every carried clue is examined",
					"check a state across matching objects",
				],
			}),
			...itemCollectionFields,
			flag: editor.string({title: "Flag"}).min(1),
			value: editor.boolean({title: "Value"}).default(true),
			requireMatch: editor
				.boolean({
					title: "Require at least one match",
					description: "Fail instead of passing vacuously when no items match.",
				})
				.default(true),
		}),
	]),
	{title: "Item collection", description: "Queries changing groups of items by location and tag."},
);

export const RoomConditionSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("room"),
			operation: editor.logicOperation(["current-has-tag", "current-missing-tag"], {
				"current-has-tag": {
					label: "The current room has a tag",
					description: "Check authored classification on the room the player occupies.",
					keywords: ["here", "location", "outside", "indoors", "category", "marked"],
					situations: [
						"only allow digging while outside",
						"when the player is somewhere dark",
						"if the current location is underwater",
						"while standing in a dangerous area",
					],
					example: "Only allow digging when the current room has the outside tag.",
				},
				"current-missing-tag": {
					label: "The current room is missing a tag",
					description: "Check that the player's room lacks authored classification.",
					keywords: ["here", "location", "not outside", "indoors", "category", "unmarked"],
					situations: [
						"prevent digging while indoors",
						"when the current place is not safe",
						"unless the player is in a dark area",
					],
				},
			}),
			tag: editor.input({title: "Room tag"}).min(1),
		}),
		z.object({
			type: z.literal("room"),
			operation: editor.logicOperation("flag-is", {
				label: "A room flag has a value",
				description: "Check whether a fact stored on one room is true or false.",
				keywords: ["boolean", "state", "remembered", "disturbed", "marked", "property"],
				situations: [
					"when the ground here was disturbed",
					"after a trap was triggered in this room",
					"if this location has been searched",
					"while the lights are on here",
				],
			}),
			roomId: editor.reference("room", {title: "Room"}),
			flag: editor.string({title: "Flag"}).min(1),
			value: editor
				.boolean({
					title: "Value",
					commandVariableType: "boolean",
					features: {labels: {on: "True", off: "False"}},
				})
				.default(true),
		}),
		z.object({
			type: z.literal("room"),
			operation: editor.logicOperation("current-flag-is", {
				label: "A current-room flag has a value",
				description: "Check state on whichever room the player currently occupies.",
				keywords: ["here", "current room", "flag", "local state", "dynamic"],
				situations: [
					"if the ground here was disturbed",
					"while this room's trap is armed",
					"when the current location has been searched",
					"reuse one command in many rooms",
				],
			}),
			flag: editor.string({title: "Flag"}).min(1),
			value: editor.boolean({title: "Value"}).default(true),
		}),
		z.object({
			type: z.literal("room"),
			operation: editor.logicOperation(["flag-exists", "flag-missing"], {
				"flag-exists": {
					label: "A room flag exists",
					description: "Check that a fact has been stored on a room.",
					keywords: ["defined", "present", "state", "property"],
					situations: [
						"after something first happened in this room",
						"when this location has stored state",
						"once a room-specific event was recorded",
					],
				},
				"flag-missing": {
					label: "A room flag is missing",
					description: "Check that a fact has not been stored on a room.",
					keywords: ["undefined", "absent", "state", "property"],
					situations: [
						"on the first visit before anything happens",
						"when this location has no stored state",
						"until a room-specific event is recorded",
					],
				},
			}),
			roomId: editor.reference("room", {title: "Room"}),
			flag: editor.string({title: "Flag"}).min(1),
		}),
	]),
	{title: "Room", description: "Checks current-room tags or a room's flags."},
);

export const PlayerConditionSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation(["is-in-room", "is-not-in-room"], {
				"is-in-room": {
					label: "The player is in a room",
					description: "Check the player's current location against a particular room.",
					keywords: ["location", "where", "here", "occupies"],
					situations: [
						"while the player is in the cellar",
						"only at a particular destination",
						"when an event happens in one room",
					],
				},
				"is-not-in-room": {
					label: "The player is not in a room",
					description: "Check that the player is somewhere other than a particular room.",
					keywords: ["location", "where", "elsewhere", "absent"],
					situations: [
						"while the player is away from the cellar",
						"unless the player is at a forbidden location",
						"when an event should happen elsewhere",
					],
				},
			}),
			roomId: editor.reference("room", {title: "Room"}),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation(["is-alive", "is-dead"], {
				"is-alive": {
					label: "The player is alive",
					description: "Check that the playthrough has not ended in death.",
					keywords: ["alive", "living", "death", "game over"],
					situations: [
						"while the player can still act",
						"before applying a fatal consequence",
						"only continue for a living player",
					],
				},
				"is-dead": {
					label: "The player is dead",
					description: "Check whether the playthrough is currently in its death state.",
					keywords: ["dead", "death", "game over", "revive"],
					situations: [
						"after a fatal trap",
						"when a revival should happen",
						"show a death-specific outcome",
					],
				},
			}),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation(
				["has-won", "has-not-won", "game-has-ended", "game-is-continuing"],
				{
					"has-won": {
						label: "The player has won",
						description: "Check whether a win has been awarded, even if play is continuing.",
						keywords: ["win", "won", "victory", "success"],
						situations: [
							"after the player wins",
							"unlock post-victory content",
							"react to a completed objective while play continues",
						],
					},
					"has-not-won": {
						label: "The player has not won",
						description: "Check that no win has been awarded yet.",
						keywords: ["win", "not won", "victory", "unfinished"],
						situations: [
							"before the main objective is complete",
							"while victory remains possible",
							"prevent awarding the same win twice",
						],
					},
					"game-has-ended": {
						label: "The game has ended",
						description: "Check whether a terminal ending has stopped further play.",
						keywords: ["end game", "ended", "terminal", "finished"],
						situations: [
							"after a final ending",
							"when no more commands should run",
							"record terminal completion",
						],
					},
					"game-is-continuing": {
						label: "The game is still continuing",
						description: "Check that no terminal ending has stopped play.",
						keywords: ["continue", "active", "not ended", "play"],
						situations: [
							"while commands can still be entered",
							"before a final ending",
							"allow post-victory exploration",
						],
					},
				},
			),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation(["is-frozen", "is-unfrozen"], {
				"is-frozen": {
					label: "Player commands are blocked",
					description: "Check whether the player is frozen or stunned.",
					keywords: ["frozen", "stunned", "blocked", "cannot act"],
					situations: [
						"while a cutscene blocks input",
						"when the player is trapped",
						"during a temporary stun",
					],
				},
				"is-unfrozen": {
					label: "Player commands are allowed",
					description: "Check that the player is not frozen or stunned.",
					keywords: ["active", "unfrozen", "can act", "input"],
					situations: [
						"when the player can act normally",
						"after a stun ends",
						"before accepting an interaction",
					],
				},
			}),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation("facing-is", {
				label: "The player is facing a direction",
				description: "Check the player's current compass orientation.",
				keywords: ["facing", "orientation", "direction", "north", "turn"],
				situations: [
					"only works while facing north",
					"look toward a sound before acting",
					"align a directional puzzle",
				],
			}),
			direction: CompassDirectionSchema,
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation("turn-compare", {
				label: "Compare the current turn",
				description: "Compare the playthrough's turn number with a value.",
				keywords: ["turn", "time", "elapsed", "timer", "count"],
				situations: [
					"after ten turns",
					"before time runs out",
					"on a particular turn",
					"pace a turn-based event",
				],
			}),
			operator: ComparisonOperatorSchema,
			value: editor.number({title: "Turn"}).int().nonnegative(),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation(["is-equipped", "is-not-equipped"], {
				"is-equipped": {
					label: "The player has an item equipped",
					description: "Check whether a carried item is currently marked as equipped.",
					keywords: ["wearing", "equipped", "armor", "tool"],
					situations: [
						"only while wearing armor",
						"when a tool is equipped",
						"unlock an action from equipped gear",
					],
				},
				"is-not-equipped": {
					label: "The player does not have an item equipped",
					description: "Check that an item is not currently equipped.",
					keywords: ["not wearing", "unequipped", "armor", "tool"],
					situations: [
						"when armor is not worn",
						"before equipping a tool",
						"block an action without equipped gear",
					],
				},
			}),
			itemId: editor.reference("item", {title: "Item"}),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation("can-carry", {
				label: "The player can carry an item",
				description: "Check the item's size against the player's remaining carrying capacity.",
				keywords: ["carry", "capacity", "inventory", "weight", "fit"],
				situations: [
					"before giving the player a heavy item",
					"when inventory has enough capacity",
					"prevent taking too much equipment",
				],
			}),
			itemId: editor.reference("item", {title: "Item"}),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation("previous-room-is", {
				label: "The previous room was",
				description: "Check the room occupied immediately before the latest successful move.",
				keywords: ["previous room", "came from", "back", "history"],
				situations: [
					"send the player back",
					"react based on where they came from",
					"remember the previous location",
				],
			}),
			roomId: editor.reference("room", {title: "Previous room"}),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation(["entered-room-this-turn", "left-room-this-turn"], {
				"entered-room-this-turn": {
					label: "The player entered a room this turn",
					description:
						"True only during the turn in which the player successfully entered the selected room.",
					keywords: ["enter", "arrival", "transition", "trigger", "room"],
					situations: [
						"trigger every time a room is entered",
						"spring a trap on arrival",
						"start music when entering",
					],
				},
				"left-room-this-turn": {
					label: "The player left a room this turn",
					description:
						"True only during the turn in which the player successfully left the selected room.",
					keywords: ["leave", "departure", "transition", "trigger", "room"],
					situations: [
						"trigger after leaving a room",
						"close a door behind the player",
						"start a pursuit on departure",
					],
				},
			}),
			roomId: editor.reference("room", {title: "Room"}),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation(["last-command-succeeded", "last-command-failed"], {
				"last-command-succeeded": {
					label: "The command succeeded this turn",
					description: "Check whether this turn matched and ran an authored command behavior.",
					keywords: ["command", "success", "action", "outcome", "trigger"],
					situations: [
						"after any successful command",
						"reward a valid action",
						"trigger an event after command success",
					],
				},
				"last-command-failed": {
					label: "The command failed this turn",
					description: "Check whether this turn could not match and run an authored command behavior.",
					keywords: ["command", "failure", "invalid", "error", "trigger"],
					situations: [
						"after an invalid command",
						"count failed attempts",
						"offer help after command failure",
					],
				},
			}),
		}),
	]),
	{title: "Player", description: "Checks the player's current state or location."},
);

export const EventConditionSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("event"),
			operation: editor.logicOperation(["is-scheduled", "is-cancelled", "is-enabled", "is-disabled"], {
				"is-scheduled": {
					label: "An event is scheduled",
					description: "Check whether an event is present in the live event queue.",
					keywords: ["event", "scheduled", "pending", "queue"],
					situations: [
						"while a fuse is burning",
						"if an alarm is pending",
						"before scheduling an event twice",
					],
				},
				"is-cancelled": {
					label: "An event is not scheduled",
					description: "Check that an event is absent from the live event queue.",
					keywords: ["event", "cancelled", "absent", "queue"],
					situations: [
						"after a fuse is defused",
						"when an alarm was cancelled",
						"if a delayed consequence is no longer pending",
					],
				},
				"is-enabled": {
					label: "An event is enabled",
					description: "Check whether a queued event can currently run.",
					keywords: ["event", "enabled", "active", "running"],
					situations: [
						"while an alarm is active",
						"if a repeating event can run",
						"before disabling a timer",
					],
				},
				"is-disabled": {
					label: "An event is disabled",
					description: "Check whether a queued event is paused.",
					keywords: ["event", "disabled", "paused", "inactive"],
					situations: [
						"while an alarm is paused",
						"after disabling a repeating event",
						"before resuming a timer",
					],
				},
			}),
			eventId: editor.reference("event", {title: "Event"}),
		}),
		z.object({
			type: z.literal("event"),
			operation: editor.logicOperation("cooldown-is-ready", {
				label: "An event's wait is complete",
				description: "Check whether enough turns have elapsed for a queued event to run again.",
				keywords: ["event", "cooldown", "ready", "timer", "wait"],
				situations: [
					"when a repeating trap can fire again",
					"after an event cooldown",
					"when a delayed event becomes eligible",
				],
			}),
			eventId: editor.reference("event", {title: "Event"}),
		}),
	]),
	{title: "Event", description: "Checks the live state of delayed and repeating events."},
);

export const NavigationConditionSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("navigation"),
			operation: editor.logicOperation("exit-is-open", {
				label: "An exit is open",
				description:
					"Check whether movement in a direction is currently available from the player's room.",
				keywords: ["passage", "direction", "unblocked", "unlocked", "can go", "movement"],
				situations: [
					"when the player can escape north",
					"only if a passage is available",
					"before suggesting a usable direction",
					"if a route is not blocked",
				],
			}),
			direction: DirectionSchema,
		}),
	]),
	{title: "Navigation", description: "Checks available movement from the player's current room."},
);

export const SingleConditionSchema = editor.discriminatedUnion(
	z.discriminatedUnion("type", [
		WorldConditionSchema,
		ItemConditionSchema,
		ItemCollectionConditionSchema,
		RoomConditionSchema,
		PlayerConditionSchema,
		NavigationConditionSchema,
		EventConditionSchema,
	]),
	{title: "Condition"},
);

export type SingleCondition = z.infer<typeof SingleConditionSchema>;
export type ConditionReference = z.infer<typeof ConditionReferenceSchema>;
export type ConditionGroup = {
	type: "group";
	operation: "all" | "any" | "none";
	conditions: Condition[];
};
export type ConditionDefinition = SingleCondition | ConditionGroup;
export type Condition = ConditionDefinition | ConditionReference;

export const DefaultConditionGroup: ConditionGroup = {
	type: "group",
	operation: "all",
	conditions: [],
};

export const ConditionGroupSchema: z.ZodType<ConditionGroup> = z.lazy(() =>
	editor.object(
		{
			type: z.literal("group"),
			operation: editor.select(z.enum(["all", "any", "none"]), {
				title: "Operation",
				options: [
					{label: "All conditions pass", value: "all"},
					{label: "Any condition passes", value: "any"},
					{label: "No conditions pass", value: "none"},
				],
			}),
			conditions: z.array(ConditionSchema),
		},
		{title: "Group", description: "Combines multiple conditions."},
	),
);

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
	z.union([SingleConditionSchema, ConditionGroupSchema, ConditionReferenceSchema]),
);

export const SavedConditionSchema = z.object({
	identity: editor.id("condition"),
	name: editor.input({title: "Condition name"}).default(""),
	condition: editor.condition(z.union([SingleConditionSchema, ConditionGroupSchema]), {
		title: "Condition",
	}),
});

export type SavedCondition = z.infer<typeof SavedConditionSchema>;

export const ConditionalTextSchema = editor.object(
	{
		when: editor.conditionControl(ConditionSchema, {title: "Conditions"}),
		text: editor.textarea({title: "Text"}).default(""),
	},
	{
		title: "Conditional text",
		description: docify(`Text shown when all referenced room or item conditions pass.`),
	},
);

export type ConditionalText = z.infer<typeof ConditionalTextSchema>;

// TODO: Reintroduce NPC, quest, event, time, randomness, and authored-command conditions with those domains.
