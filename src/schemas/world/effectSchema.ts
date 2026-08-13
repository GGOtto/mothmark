import {z} from "zod";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {entityFlagMutationError} from "./entityFlagDefinitions";
import {CompassDirectionSchema, DirectionSchema} from "./directionSchema";
import {ConditionSchema, ItemCollectionScopeSchema, type Condition} from "./conditionSchema";
import type {ID} from "@/utils/idUtils";

export const EffectReferenceSchema = editor.object(
	{
		type: z.literal("effect-ref"),
		effectId: editor.reference("effect", {title: "Saved effect"}),
	},
	{title: "Use saved effect"},
);

export const MessageEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("message"),
			operation: editor.logicOperation("show", {
				label: "Show a message",
				description: "Show authored text to the player.",
				keywords: ["say", "print", "narrate", "feedback", "text"],
				situations: [
					"warn the player about a trap",
					"describe a new discovery",
					"confirm that an action worked",
					"say the ground has been disturbed",
				],
				example: "Tell the player that the ground looks disturbed.",
			}),
			message: editor.textarea({
				title: "Message",
				placeholder: "Enter the message shown to the player",
			}),
		}),
		z.object({
			type: z.literal("message"),
			operation: editor.logicOperation("show-random", {
				label: "Show a random message",
				description: "Choose one of several messages each time the effect runs.",
				keywords: ["variation", "random", "one of", "flavor text"],
				situations: [
					"vary repeated ambient descriptions",
					"choose a random reaction",
					"make repeated attempts feel different",
				],
			}),
			messages: editor.stringList({title: "Messages"}),
		}),
		z.object({
			type: z.literal("message"),
			operation: editor.logicOperation("append-to-last", {
				label: "Extend the last message",
				description: "Add text to the most recent player-facing message.",
				keywords: ["append", "continue", "combine", "newline", "inline"],
				situations: [
					"add a consequence to the previous result",
					"continue a generated room description",
					"combine several outcomes into one response",
				],
			}),
			message: editor.textarea({title: "Description text"}),
			format: editor.select(z.enum(["inline", "newline"]), {title: "Format"}, "newline"),
		}),
		z.object({
			type: z.literal("message"),
			operation: editor.logicOperation("describe-current-room", {
				label: "Describe the current room",
				description: "Show the current room description using normal visit-shortening rules.",
				keywords: ["look", "room", "location", "refresh", "redisplay"],
				situations: [
					"look again after the room changes",
					"show the destination after teleporting",
					"refresh the scene after revealing something",
				],
			}),
			allowShorten: editor
				.boolean({
					title: "Allow shortened",
					description: "Allow the description to be shortened if the room is already visited.",
				})
				.default(true),
		}),
		z.object({
			type: z.literal("message"),
			operation: editor.logicOperation("list-available-exits", {
				label: "List available exits",
				description: "Tell the player which directions can currently be used.",
				keywords: ["directions", "movement", "where can I go", "passages"],
				situations: [
					"show routes after opening a door",
					"tell the player where they can go",
					"list escape directions during a puzzle",
				],
			}),
		}),
		z.object({
			type: z.literal("message"),
			operation: editor.logicOperation("show-command-help", {
				label: "Show command help",
				description: "Show the built-in guidance for available player commands.",
				keywords: ["help", "instructions", "commands", "tutorial"],
				situations: [
					"teach controls at the beginning",
					"remind the player what commands work",
					"offer help after repeated mistakes",
				],
			}),
		}),
		z.object({
			type: z.literal("message"),
			operation: editor.logicOperation("list-inventory", {
				label: "List the player's inventory",
				description: "Build a message from the items the player is currently carrying.",
				keywords: ["inventory", "carrying", "items", "dynamic list"],
				situations: ["show what the player carries", "inventory command", "review collected objects"],
			}),
			emptyMessage: editor.message({title: "Empty message"}).default("You are carrying nothing."),
		}),
		z.object({
			type: z.literal("message"),
			operation: editor.logicOperation("list-contents", {
				label: "List an item's current contents",
				description: "Build a message from the items currently inside or on another item.",
				keywords: ["contents", "container", "surface", "dynamic list", "inside"],
				situations: [
					"show what is buried in a hole",
					"list objects inside a chest",
					"describe items on a table",
				],
			}),
			itemId: editor.reference("item", {title: "Item"}),
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
			emptyMessage: editor.message({title: "Empty message"}).default("It is empty."),
		}),
		z.object({
			type: z.literal("message"),
			operation: editor.logicOperation(["show-counter", "show-saved-text"], {
				"show-counter": {
					label: "Show a saved number",
					description: "Show the current value of a world counter.",
					keywords: ["counter", "score", "number", "dynamic message"],
					situations: [
						"show the current score",
						"report remaining turns",
						"display a changing quantity",
					],
				},
				"show-saved-text": {
					label: "Show saved text",
					description: "Show the current value of a world text variable.",
					keywords: ["text", "journal", "name", "dynamic message"],
					situations: [
						"repeat the player's chosen name",
						"show a saved journal entry",
						"display a remembered answer",
					],
				},
			}),
			variable: editor.input({title: "Variable"}).min(1),
			prefix: editor.input({title: "Prefix"}).default(""),
			suffix: editor.input({title: "Suffix"}).default(""),
		}),
	]),
	{
		title: "Message effect",
		description: "Shows text, player guidance, or the current room description.",
	},
);

export const WorldEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation("set-flag", {
				label: "Set a world flag",
				description: "Store a true or false fact for later conditions.",
				keywords: ["remember", "boolean", "state", "switch", "mark"],
				situations: [
					"set a trap",
					"arm an alarm",
					"remember a player choice",
					"mark a puzzle solved",
					"record that the ground was disturbed",
				],
				example: "Remember that the ground has been disturbed.",
			}),
			flag: editor.flagKey({title: "Flag"}),
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
			operation: editor.logicOperation("toggle-flag", {
				label: "Toggle a world flag",
				description: "Reverse a stored true or false world fact.",
				keywords: ["flip", "switch", "boolean", "state"],
				situations: [
					"flip a light switch",
					"alternate a mechanism between two states",
					"toggle whether an alarm is armed",
				],
			}),
			flag: editor.flagKey({title: "Flag"}),
		}),
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation("delete-flag", {
				label: "Forget a world flag",
				description: "Remove a stored world fact entirely.",
				keywords: ["delete", "clear", "reset", "forget", "state"],
				situations: [
					"forget that a choice was made",
					"reset a one-time event",
					"remove an initialized state completely",
				],
			}),
			flag: editor.flagKey({title: "Flag"}),
		}),
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation("set-counter", {
				label: "Set a counter",
				description: "Store an exact number for later conditions.",
				keywords: ["number", "score", "count", "progress", "turns"],
				situations: [
					"start a countdown",
					"set the player's score",
					"jump puzzle progress to a stage",
					"record an exact number of attempts",
				],
			}),
			counter: editor.counterKey({title: "Counter"}),
			value: editor.number({title: "Value", commandVariableType: "number"}),
		}),
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation(["increase-counter", "decrease-counter"], {
				"increase-counter": {
					label: "Increase a counter",
					description: "Add an amount to a stored number.",
					keywords: ["add", "increment", "score", "count", "progress"],
					situations: [
						"award points",
						"count another attempt",
						"advance a quest stage",
						"tick a timer forward",
					],
				},
				"decrease-counter": {
					label: "Decrease a counter",
					description: "Subtract an amount from a stored number.",
					keywords: ["subtract", "decrement", "score", "count", "progress"],
					situations: [
						"remove points",
						"spend a limited resource",
						"count down remaining turns",
						"reduce health or stamina",
					],
				},
			}),
			counter: editor.counterKey({title: "Counter"}),
			amount: editor.number({title: "Amount", commandVariableType: "number"}).default(1),
		}),
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation("delete-counter", {
				label: "Forget a counter",
				description: "Remove a stored number entirely.",
				keywords: ["delete", "clear", "reset", "forget", "number"],
				situations: [
					"remove a timer entirely",
					"forget the previous score",
					"reset an optional count to missing",
				],
			}),
			counter: editor.counterKey({title: "Counter"}),
		}),
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation("set-text", {
				label: "Set saved text",
				description: "Store text that later logic can inspect or replace.",
				keywords: ["remember", "string", "name", "answer", "password"],
				situations: [
					"remember the player's name",
					"store a typed password",
					"save a custom answer",
					"record a chosen destination",
				],
			}),
			text: editor.textKey({title: "Text variable"}),
			value: editor.textarea({title: "Value", commandVariableType: "string"}),
		}),
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation("delete-text", {
				label: "Forget saved text",
				description: "Remove a stored text value entirely.",
				keywords: ["delete", "clear", "reset", "forget", "string"],
				situations: [
					"forget a previous password attempt",
					"clear a stored player answer",
					"remove an optional name or note",
				],
			}),
			text: editor.textKey({title: "Text variable"}),
		}),
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation(
				["copy-counter", "add-counter", "subtract-counter", "multiply-counter", "divide-counter"],
				{
					"copy-counter": {
						label: "Copy a counter",
						description: "Replace one counter with another counter's value.",
						keywords: ["copy", "number", "variable", "assign"],
						situations: [
							"copy a changing target score",
							"save a counter checkpoint",
							"set one value from another",
						],
					},
					"add-counter": {
						label: "Add one counter to another",
						description: "Add a stored number to another stored number.",
						keywords: ["add", "sum", "number", "arithmetic"],
						situations: [
							"add a bonus counter to score",
							"combine two resource totals",
							"increase health by stored healing power",
						],
					},
					"subtract-counter": {
						label: "Subtract one counter from another",
						description: "Subtract a stored number from another stored number.",
						keywords: ["subtract", "difference", "number", "arithmetic"],
						situations: [
							"apply stored damage to health",
							"spend a changing cost",
							"subtract armor from damage",
						],
					},
					"multiply-counter": {
						label: "Multiply by another counter",
						description: "Multiply a counter by another stored number.",
						keywords: ["multiply", "product", "number", "arithmetic"],
						situations: [
							"apply a changing score multiplier",
							"scale damage by power",
							"calculate a puzzle product",
						],
					},
					"divide-counter": {
						label: "Divide by another counter",
						description:
							"Divide a counter by another stored number; division by zero leaves it unchanged.",
						keywords: ["divide", "ratio", "number", "arithmetic"],
						situations: [
							"split a score by a party count",
							"calculate a changing ratio",
							"reduce a value by a stored divisor",
						],
					},
				},
			),
			counter: editor.counterKey({title: "Destination counter"}),
			sourceCounter: editor.counterKey({title: "Source counter"}),
		}),
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation("clamp-counter", {
				label: "Keep a counter within a range",
				description: "Raise or lower a stored number so it remains between minimum and maximum values.",
				keywords: ["clamp", "minimum", "maximum", "health", "range"],
				situations: [
					"keep health between zero and one hundred",
					"cap a score",
					"prevent a resource becoming negative",
				],
			}),
			counter: editor.counterKey({title: "Counter"}),
			min: editor.number({title: "Minimum"}),
			max: editor.number({title: "Maximum"}),
		}),
		z.object({
			type: z.literal("world"),
			operation: editor.logicOperation(
				["copy-text", "append-text", "prepend-text", "append-saved-text", "prepend-saved-text"],
				{
					"copy-text": {
						label: "Copy saved text",
						description: "Replace one text variable with another text variable's value.",
						keywords: ["copy", "text", "string", "assign"],
						situations: ["copy a player name", "save a journal checkpoint", "reuse a remembered answer"],
					},
					"append-text": {
						label: "Append text",
						description: "Add authored text to the end of a saved text value.",
						keywords: ["append", "journal", "concatenate", "text"],
						situations: ["add a journal entry", "extend an inscription", "build a message over time"],
					},
					"prepend-text": {
						label: "Prepend text",
						description: "Add authored text to the beginning of a saved text value.",
						keywords: ["prepend", "prefix", "concatenate", "text"],
						situations: [
							"add a title before saved text",
							"prefix a journal",
							"build text from the front",
						],
					},
					"append-saved-text": {
						label: "Append another saved text",
						description: "Add one text variable's value to the end of another.",
						keywords: ["concatenate", "combine", "variables", "text"],
						situations: [
							"combine two journal entries",
							"join a first and last name",
							"build text from saved pieces",
						],
					},
					"prepend-saved-text": {
						label: "Prepend another saved text",
						description: "Add one text variable's value to the beginning of another.",
						keywords: ["concatenate", "combine", "variables", "text"],
						situations: [
							"prefix text with a saved title",
							"combine saved text in reverse order",
							"build a phrase from variables",
						],
					},
				},
			),
			text: editor.textKey({title: "Destination text"}),
			value: editor.textarea({title: "Authored text"}).optional(),
			sourceText: editor.textKey({title: "Source text"}).optional(),
		}),
	]),
	{title: "World state", description: "Changes world flags, counters, and saved text."},
);

export const ItemEffectSchema = editor
	.discriminatedUnion(
		z.discriminatedUnion("operation", [
			editor.object(
				{
					type: z.literal("item"),
					operation: editor.logicOperation("set-name", {
						label: "Rename an item",
						description: "Change the name players use to see and target an item.",
						keywords: ["name", "rename", "identify", "disguise"],
						situations: [
							"reveal an object's true name",
							"disguise an item under another identity",
							"rename a crafted or repaired object",
						],
					}),
					value: editor.input({title: "Name"}),
					itemId: editor.reference("item", {title: "Item"}),
				},
				{title: "Set name"},
			),
			editor.object(
				{
					type: z.literal("item"),
					operation: editor.logicOperation("set-examine-text", {
						label: "Change an item's examine text",
						description: "Replace the detailed text shown when this item is examined.",
						keywords: ["description", "inspect", "look", "read", "change text"],
						situations: [
							"show damage after an item breaks",
							"change a clue after it is read",
							"describe a device in its new state",
						],
					}),
					value: editor.richText({title: "Examine text"}),
					itemId: editor.reference("item", {title: "Item"}),
				},
				{title: "Set examine text"},
			),
			editor.object(
				{
					type: z.literal("item"),
					operation: editor.logicOperation("set-listing-text", {
						label: "Change an item's room listing",
						description: "Replace the short text used when the item appears in a room.",
						keywords: ["room text", "listing", "appearance", "description"],
						situations: [
							"show disturbed ground in the room",
							"change how scenery is introduced",
							"update a prop's short visible description",
						],
					}),
					value: editor.textarea({title: "Room listing text"}),
					itemId: editor.reference("item", {title: "Item"}),
				},
				{title: "Set room listing text"},
			),
			editor.object(
				{
					type: z.literal("item"),
					operation: editor.logicOperation(["add-alias", "remove-alias", "add-tag", "remove-tag"], {
						"add-alias": {
							label: "Add an item alias",
							description: "Let players target an item by another name.",
							keywords: ["synonym", "noun", "parser", "name"],
							situations: [
								"let a revealed object use its true name",
								"accept a newly learned nickname",
								"make a crafted item targetable by another noun",
							],
						},
						"remove-alias": {
							label: "Remove an item alias",
							description: "Stop accepting an alternate item name.",
							keywords: ["synonym", "noun", "parser", "name"],
							situations: [
								"stop accepting an obsolete item name",
								"remove a disguise's old nickname",
								"forget an alternate parser noun",
							],
						},
						"add-tag": {
							label: "Add an item tag",
							description: "Add authored classification used by logic and targeting.",
							keywords: ["label", "classify", "mark", "property"],
							situations: [
								"mark an object as evidence",
								"classify an item as flammable",
								"make a prop eligible for targeted logic",
							],
						},
						"remove-tag": {
							label: "Remove an item tag",
							description: "Remove authored classification from an item.",
							keywords: ["label", "classify", "unmark", "property"],
							situations: [
								"remove an item's temporary classification",
								"stop treating an object as evidence",
								"clear a tag after transformation",
							],
						},
					}),
					value: editor.input({title: "Value"}).trim().min(1),
					itemId: editor.reference("item", {title: "Item"}),
				},
				{title: "Change alias or tag"},
			),
			editor.object(
				{
					type: z.literal("item"),
					operation: editor.logicOperation("move-to-room", {
						label: "Move an item to a room",
						description: "Place an item directly in a chosen room.",
						keywords: ["relocate", "spawn", "teleport", "location"],
						situations: [
							"spawn an object in another room",
							"send a package to a destination",
							"move treasure when a puzzle changes",
						],
					}),
					roomId: editor.reference("room", {title: "Room"}),
					itemId: editor.reference("item", {title: "Item"}),
				},
				{title: "Move to room"},
			),
			editor.object(
				{
					type: z.literal("item"),
					operation: editor.logicOperation(["move-to-inventory", "move-to-current-room"], {
						"move-to-inventory": {
							label: "Move an item to inventory",
							description: "Place an item directly in the player's inventory without action checks.",
							keywords: ["give", "carry", "inventory", "relocate"],
							situations: [
								"reward the player with an item",
								"give a tool without normal take checks",
								"return a quest object directly to inventory",
							],
						},
						"move-to-current-room": {
							label: "Move an item here",
							description: "Place an item directly in the player's current room.",
							keywords: ["drop", "spawn", "current room", "relocate"],
							situations: [
								"make an object appear here",
								"drop a reward at the player's feet",
								"return an item to the current scene",
							],
						},
					}),
					itemId: editor.reference("item", {title: "Item"}),
				},
				{title: "Move directly"},
			),
			editor.object(
				{
					type: z.literal("item"),
					operation: editor.logicOperation("place-inside", {
						label: "Place an item inside another",
						description: "Put an item directly inside a container.",
						keywords: ["container", "insert", "store", "bury", "hole"],
						situations: [
							"bury treasure in a hole",
							"hide evidence inside a container",
							"load an object into a machine",
							"store a key in a box",
						],
						example: "Place the locket inside a dug hole item.",
						note:
							"This is a low-level relocation and bypasses container, capacity, open-state, and cycle checks. Use the validated placement effect for ordinary physical interactions.",
					}),
					itemId: editor.reference("item", {title: "Item"}),
					containerId: editor.reference("item", {title: "Container"}),
				},
				{title: "Place inside item"},
			),
			editor.object(
				{
					type: z.literal("item"),
					operation: editor.logicOperation("place-on", {
						label: "Place an item on another",
						description: "Put an item directly on a surface.",
						keywords: ["surface", "set down", "display", "stack"],
						situations: [
							"place an offering on an altar",
							"display an object on a shelf",
							"stack a tool on a workbench",
						],
						note:
							"This is a low-level relocation and bypasses surface, capacity, and cycle checks. Use the validated placement effect for ordinary physical interactions.",
					}),
					itemId: editor.reference("item", {title: "Item"}),
					surfaceId: editor.reference("item", {title: "Surface"}),
				},
				{title: "Place on item"},
			),
			editor.object(
				{
					type: z.literal("item"),
					operation: editor.logicOperation(["place-inside-validated", "place-on-validated"], {
						"place-inside-validated": {
							label: "Safely place an item inside",
							description:
								"Move an item inside only when the destination is an open container with enough capacity and no containment cycle.",
							keywords: ["container", "validated", "safe", "capacity", "cycle"],
							situations: [
								"bury an item only if it fits",
								"transfer one item without bypassing container rules",
								"place an object safely inside",
							],
						},
						"place-on-validated": {
							label: "Safely place an item on a surface",
							description:
								"Move an item onto a surface only when it has enough capacity and no containment cycle.",
							keywords: ["surface", "validated", "safe", "capacity", "cycle"],
							situations: [
								"place an offering only if it fits",
								"transfer one item without bypassing surface rules",
								"place an object safely on top",
							],
						},
					}),
					itemId: editor.reference("item", {title: "Item"}),
					destinationItemId: editor.reference("item", {title: "Destination"}),
				},
				{title: "Validated placement"},
			),
			editor.object(
				{
					type: z.literal("item"),
					operation: editor.logicOperation(["hide", "reveal", "destroy", "restore-start-location"], {
						hide: {
							label: "Hide an item",
							description: "Keep an item in state but make its location hidden.",
							keywords: ["conceal", "invisible", "unavailable", "bury"],
							situations: [
								"bury an object out of sight",
								"conceal a clue until later",
								"make treasure temporarily unavailable",
							],
						},
						reveal: {
							label: "Reveal an item",
							description: "Make a hidden item available at its current location.",
							keywords: ["show", "discover", "uncover", "dig up"],
							situations: [
								"dig up buried treasure",
								"uncover a hidden clue",
								"make a secret object appear",
							],
						},
						destroy: {
							label: "Destroy an item",
							description: "Remove an item from play while retaining its state.",
							keywords: ["remove", "delete", "consume", "break"],
							situations: [
								"consume a one-use ingredient",
								"break an object permanently",
								"remove evidence from play",
							],
						},
						"restore-start-location": {
							label: "Restore an item to its start",
							description: "Return an item to its authored starting location.",
							keywords: ["reset", "respawn", "return", "restore"],
							situations: [
								"reset a puzzle prop",
								"respawn a reusable object",
								"return lost equipment to its original place",
							],
						},
					}),
					itemId: editor.reference("item", {title: "Item"}),
				},
				{title: "Change item location status"},
			),
			editor.object(
				{
					type: z.literal("item"),
					operation: editor.logicOperation(
						[
							"set-open",
							"set-closed",
							"set-locked",
							"set-unlocked",
							"set-examined",
							"set-unexamined",
							"set-listed",
							"set-unlisted",
						],
						{
							"set-open": {
								label: "Mark an item open",
								description: "Directly set an openable item to open.",
								keywords: ["open", "container", "door", "state"],
								situations: [
									"open a secret compartment directly",
									"leave a door open after a cutscene",
									"expose a container's contents without player action",
								],
							},
							"set-closed": {
								label: "Mark an item closed",
								description: "Directly set an openable item to closed.",
								keywords: ["close", "container", "door", "state"],
								situations: [
									"slam a door shut",
									"close a container after a trap triggers",
									"seal a lid without player action",
								],
							},
							"set-locked": {
								label: "Mark an item locked",
								description: "Directly set a lockable item to locked.",
								keywords: ["lock", "key", "door", "state"],
								situations: [
									"lock a door behind the player",
									"secure a chest after an alarm",
									"make a container require its key",
								],
							},
							"set-unlocked": {
								label: "Mark an item unlocked",
								description: "Directly set a lockable item to unlocked.",
								keywords: ["unlock", "key", "door", "state"],
								situations: [
									"unlock a door after solving a puzzle",
									"release a chest without using a key",
									"make a secured container accessible",
								],
							},
							"set-examined": {
								label: "Mark an item examined",
								description: "Record that the player has examined an item.",
								keywords: ["inspect", "seen", "known", "state"],
								situations: [
									"credit a clue as already inspected",
									"skip a first-examine interaction",
									"record that an object was searched",
								],
							},
							"set-unexamined": {
								label: "Mark an item unexamined",
								description: "Clear the item's examined state.",
								keywords: ["inspect", "unseen", "forget", "state"],
								situations: [
									"make an examine interaction repeatable",
									"forget that a clue was inspected",
									"reset an object's first-look state",
								],
							},
							"set-listed": {
								label: "Include an item in room listings",
								description: "Make an item appear in automatic room item lists.",
								keywords: ["show", "visible", "room listing", "state"],
								situations: [
									"mention a newly important object in the room",
									"add scenery to automatic room output",
									"show a revealed clue in the item list",
								],
							},
							"set-unlisted": {
								label: "Omit an item from room listings",
								description: "Keep an item targetable but omit it from automatic room item lists.",
								keywords: ["hide listing", "scenery", "room listing", "state"],
								situations: [
									"keep scenery targetable but unmentioned",
									"remove a collected clue from room output",
									"hide clutter from the automatic item list",
								],
							},
						},
					),
					itemId: editor.reference("item", {title: "Item"}),
				},
				{title: "Set item state"},
			),
			editor.object(
				{
					type: z.literal("item"),
					operation: editor.logicOperation(["empty-into-room", "empty-into-inventory"], {
						"empty-into-room": {
							label: "Empty contents into a room",
							description: "Move selected contents into the item's room.",
							keywords: ["dump", "spill", "unpack", "container", "surface"],
							situations: [
								"spill a bag onto the floor",
								"dump a chest's contents into its room",
								"scatter objects from a broken container",
							],
						},
						"empty-into-inventory": {
							label: "Empty contents into inventory",
							description: "Move selected contents directly to the player's inventory.",
							keywords: ["collect", "unpack", "take all", "container", "surface"],
							situations: [
								"collect every item from a cache",
								"give the player all contents at once",
								"unpack a reward bundle into inventory",
							],
						},
					}),
					itemId: editor.reference("item", {title: "Item"}),
					placement: editor.select(z.enum(["inside", "on", "both"]), {title: "Contents"}),
				},
				{title: "Empty contents"},
			),
			editor.object(
				{
					type: z.literal("item"),
					operation: editor.logicOperation("move-contents", {
						label: "Move an item's contents",
						description: "Transfer inside or on-top contents to another item.",
						keywords: ["transfer", "container", "surface", "all contents"],
						situations: [
							"pour one container into another",
							"move a pile between surfaces",
							"transfer every stored object to a destination",
						],
					}),
					itemId: editor.reference("item", {title: "Item"}),
					destinationItemId: editor.reference("item", {title: "Destination item"}),
					placement: editor.select(z.enum(["inside", "on"]), {title: "Placement"}),
				},
				{title: "Move contents"},
			),
			editor.object(
				{
					type: z.literal("item"),
					operation: editor.logicOperation("reset-state", {
						label: "Reset an item to its authored state",
						description:
							"Restore the item's initial presentation, location, tags, aliases, open state, lock state, and flags.",
						keywords: ["reset", "restore", "repair", "respawn", "initial state"],
						situations: [
							"repair a destroyed object completely",
							"reset a puzzle prop",
							"restore an item after a scene restarts",
							"replace an item with a fresh authored copy",
						],
					}),
					itemId: editor.reference("item", {title: "Item"}),
				},
				{title: "Reset item"},
			),
			editor.object(
				{
					type: z.literal("item"),
					operation: editor.logicOperation("apply-item-template", {
						label: "Transform an item from a template",
						description:
							"Copy another authored item's presentation, tags, aliases, flags, and open or locked state while keeping this item's identity and location.",
						keywords: ["transform", "template", "craft", "repair", "change form"],
						situations: [
							"turn raw material into a crafted form",
							"repair an item into its working appearance",
							"transform an object without moving it",
							"copy a pre-authored item state",
						],
					}),
					itemId: editor.reference("item", {title: "Item to transform"}),
					templateItemId: editor.reference("item", {title: "Template item"}),
				},
				{title: "Transform item"},
			),
			editor.object(
				{
					type: z.literal("item"),
					operation: editor.logicOperation(
						[
							"append-examine-text",
							"prepend-examine-text",
							"append-listing-text",
							"prepend-listing-text",
						],
						{
							"append-examine-text": {
								label: "Append to examine text",
								description: "Add text to the end of an item's detailed description.",
								keywords: ["append", "description", "writing", "inscription"],
								situations: [
									"add writing to an inscription",
									"record new damage on an object",
									"extend an examined journal",
								],
							},
							"prepend-examine-text": {
								label: "Prepend to examine text",
								description: "Add text to the beginning of an item's detailed description.",
								keywords: ["prepend", "description", "writing", "inscription"],
								situations: [
									"add a warning before an inscription",
									"prefix an object's description",
									"insert the newest note first",
								],
							},
							"append-listing-text": {
								label: "Append to room listing",
								description: "Add text to the end of an item's room listing.",
								keywords: ["append", "listing", "room text", "appearance"],
								situations: [
									"add that the ground looks disturbed",
									"extend a changing scenery line",
									"show another visible detail",
								],
							},
							"prepend-listing-text": {
								label: "Prepend to room listing",
								description: "Add text to the beginning of an item's room listing.",
								keywords: ["prepend", "listing", "room text", "appearance"],
								situations: [
									"prefix a warning to scenery",
									"put a status before an item listing",
									"add an important visible detail first",
								],
							},
						},
					),
					itemId: editor.reference("item", {title: "Item"}),
					value: editor.textarea({title: "Text"}),
				},
				{title: "Extend item text"},
			),
			z.object({
				type: z.literal("item"),
				operation: editor.logicOperation("set-flag", {
					label: "Set an item flag",
					description: "Store a true or false fact on one item.",
					keywords: ["remember", "state", "property", "boolean", "mark"],
					situations: [
						"set a trap on an item",
						"mark a device as activated",
						"remember that this object was repaired",
						"arm a particular mechanism",
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
			}),
			z.object({
				type: z.literal("item"),
				operation: editor.logicOperation(["toggle-flag", "delete-flag"], {
					"toggle-flag": {
						label: "Toggle an item flag",
						description: "Reverse a true or false fact stored on an item.",
						keywords: ["flip", "switch", "state", "property"],
						situations: [
							"flip an individual device state",
							"toggle whether this trap is armed",
							"alternate an object's mode",
						],
					},
					"delete-flag": {
						label: "Forget an item flag",
						description: "Remove a fact stored on an item.",
						keywords: ["clear", "reset", "delete", "state", "property"],
						situations: [
							"reset an object's local history",
							"forget that this device changed",
							"remove a temporary item state",
						],
					},
				}),
				itemId: editor.reference("item", {title: "Item"}),
				flag: editor.string({title: "Flag"}).min(1),
			}),
		]),
		{
			title: "Item",
			description: "Directly changes an item's presentation, location, state, contents, or flags.",
		},
	)
	.superRefine((effect, ctx) => {
		if (!("flag" in effect) || !effect.operation.endsWith("-flag")) return;
		const operation = effect.operation.replace("-flag", "") as "set" | "toggle" | "delete";
		const message = entityFlagMutationError("item", effect.flag, operation);
		if (message) ctx.addIssue({code: "custom", message, path: ["flag"]});
	});

const itemCollectionEffectFields = {
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
	includeNested: editor.boolean({title: "Include nested items"}).default(true),
};

export const ItemCollectionEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("items"),
			operation: editor.logicOperation("instantiate", {
				label: "Create an item from a template",
				description:
					"Create a new runtime item instance from an authored item, with a unique identity and working behaviors.",
				keywords: ["spawn", "create", "clone", "instantiate", "template", "dynamic"],
				situations: [
					"dig a new hole at runtime",
					"create another coin",
					"spawn a fresh replacement item",
					"make arbitrarily many copies of an authored object",
				],
			}),
			templateItemId: editor.reference("item", {title: "Item template"}),
			destination: editor
				.select(z.enum(["template-location", "current-room", "inventory"]), {
					title: "Create at",
					options: [
						{label: "Template's authored location", value: "template-location"},
						{label: "Current room", value: "current-room"},
						{label: "Player inventory", value: "inventory"},
					],
				})
				.default("current-room"),
		}),
		z.object({
			type: z.literal("items"),
			operation: editor.logicOperation(
				["move-matching-to-current-room", "move-matching-to-inventory", "destroy-matching"],
				{
					"move-matching-to-current-room": {
						label: "Move matching items to the current room",
						description: "Move every queried item directly into the room the player occupies.",
						keywords: ["bulk", "move", "room", "collection", "query"],
						situations: [
							"dig up every buried item",
							"spill selected contents into the room",
							"move tagged objects to wherever the player is",
						],
					},
					"move-matching-to-inventory": {
						label: "Move matching items to inventory",
						description: "Move every queried item directly into the player's inventory.",
						keywords: ["bulk", "take all", "inventory", "collection", "query"],
						situations: [
							"collect every coin",
							"give all matching rewards",
							"move selected contents into inventory",
						],
					},
					"destroy-matching": {
						label: "Destroy matching items",
						description: "Destroy every item returned by a location and tag query.",
						keywords: ["bulk", "destroy", "remove", "collection", "query"],
						situations: [
							"extinguish every temporary flame",
							"remove all debris in a room",
							"consume every matching ingredient",
						],
					},
				},
			),
			...itemCollectionEffectFields,
		}),
		z.object({
			type: z.literal("items"),
			operation: editor.logicOperation("move-matching-to-room", {
				label: "Move matching items to a room",
				description: "Move every queried item to one authored room.",
				keywords: ["bulk", "move", "room", "collection", "query"],
				situations: [
					"send every guard token to another room",
					"move all weather props outdoors",
					"transfer matching objects to a fixed destination",
				],
			}),
			...itemCollectionEffectFields,
			roomId: editor.reference("room", {title: "Destination room"}),
		}),
		z.object({
			type: z.literal("items"),
			operation: editor.logicOperation(["place-matching-inside", "place-matching-on"], {
				"place-matching-inside": {
					label: "Put matching items inside",
					description:
						"Place each queried item inside a destination when normal capacity and cycle checks allow it.",
					keywords: ["bulk", "container", "validated", "collection", "move"],
					situations: [
						"bury selected items in a hole",
						"transfer matching contents safely",
						"put all ingredients in a container",
					],
				},
				"place-matching-on": {
					label: "Put matching items on a surface",
					description:
						"Place each queried item on a destination when normal capacity and cycle checks allow it.",
					keywords: ["bulk", "surface", "validated", "collection", "move"],
					situations: [
						"put every offering on an altar",
						"arrange tagged objects on a table",
						"transfer matching items safely to a surface",
					],
				},
			}),
			...itemCollectionEffectFields,
			destinationItemId: editor.reference("item", {title: "Destination item"}),
		}),
		z.object({
			type: z.literal("items"),
			operation: editor.logicOperation(["add-tag-to-matching", "remove-tag-from-matching"], {
				"add-tag-to-matching": {
					label: "Add a tag to matching items",
					description: "Classify every item returned by a query.",
					keywords: ["bulk", "tag", "mark", "collection", "query"],
					situations: [
						"mark every nearby trap as discovered",
						"classify all carried food as spoiled",
						"tag selected items for another event",
					],
				},
				"remove-tag-from-matching": {
					label: "Remove a tag from matching items",
					description: "Remove classification from every item returned by a query.",
					keywords: ["bulk", "tag", "unmark", "collection", "query"],
					situations: [
						"clear temporary tags from a scene",
						"mark all fires as no longer burning",
						"remove a quest label from matching objects",
					],
				},
			}),
			...itemCollectionEffectFields,
			value: editor.input({title: "Tag"}).min(1),
		}),
		z.object({
			type: z.literal("items"),
			operation: editor.logicOperation("set-flag-on-matching", {
				label: "Set a flag on matching items",
				description: "Set the same boolean state on every item returned by a query.",
				keywords: ["bulk", "flag", "state", "collection", "query"],
				situations: [
					"extinguish every torch",
					"arm every trap in a room",
					"mark all matching clues as examined",
					"change a whole collection at once",
				],
			}),
			...itemCollectionEffectFields,
			flag: editor.string({title: "Flag"}).min(1),
			value: editor.boolean({title: "Value"}).default(true),
		}),
		z.object({
			type: z.literal("items"),
			operation: editor.logicOperation(
				["set-name-on-matching", "set-examine-text-on-matching", "set-listing-text-on-matching"],
				{
					"set-name-on-matching": {
						label: "Rename matching items",
						description: "Give every queried item the same runtime name.",
						keywords: ["bulk", "rename", "collection", "query", "dynamic"],
						situations: [
							"rename the hole in the current room",
							"identify every matching artifact",
							"change a group of disguises",
						],
					},
					"set-examine-text-on-matching": {
						label: "Change matching items' examine text",
						description: "Replace detailed text on every queried item.",
						keywords: ["bulk", "description", "collection", "query", "dynamic"],
						situations: [
							"show damage on every matching object",
							"change all trap descriptions",
							"update queried scenery details",
						],
					},
					"set-listing-text-on-matching": {
						label: "Change matching items' room listing",
						description: "Replace room listing text on every queried item.",
						keywords: ["bulk", "listing", "room text", "collection", "query"],
						situations: [
							"say the ground here is disturbed",
							"change a current-room hole without naming it",
							"update every matching scenery line",
						],
					},
				},
			),
			...itemCollectionEffectFields,
			value: editor.textarea({title: "Text"}),
		}),
	]),
	{
		title: "Item collection",
		description: "Changes dynamic groups of items selected by location and tag.",
	},
);

export const PlayerEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		editor.object(
			{
				type: z.literal("player"),
				operation: editor.logicOperation("take", {
					label: "Have the player take an item",
					description: "Run the normal take action, including eligibility checks, messages, and hooks.",
					keywords: ["get", "pick up", "carry", "inventory"],
					situations: [
						"make the player pick up a reward",
						"take an item through normal rules",
						"collect an object and run its hooks",
					],
					note: "Use this when the outcome should behave exactly like a player taking the item.",
				}),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Take"},
		),
		editor.object(
			{
				type: z.literal("player"),
				operation: editor.logicOperation("drop", {
					label: "Have the player drop an item",
					description: "Run the normal drop action and place the item in the current room.",
					keywords: ["put down", "inventory", "release", "room"],
					situations: [
						"make the player put down an object",
						"drop carried equipment after a trap",
						"release an item into the current room",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Drop"},
		),
		editor.object(
			{
				type: z.literal("player"),
				operation: editor.logicOperation("examine", {
					label: "Have the player examine an item",
					description: "Run the normal examine action, message, state change, and hooks.",
					keywords: ["inspect", "look at", "read", "search"],
					situations: [
						"make the player read a clue",
						"inspect an object and run examine hooks",
						"search an item through normal rules",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Examine"},
		),
		editor.object(
			{
				type: z.literal("player"),
				operation: editor.logicOperation("open", {
					label: "Have the player open an item",
					description: "Run normal open rules, messages, and hooks.",
					keywords: ["container", "door", "lid", "unseal"],
					situations: [
						"make the player open a door",
						"open a chest and run its hooks",
						"unseal a container through normal rules",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Open"},
		),
		editor.object(
			{
				type: z.literal("player"),
				operation: editor.logicOperation("close", {
					label: "Have the player close an item",
					description: "Run normal close rules, messages, and hooks.",
					keywords: ["container", "door", "lid", "shut"],
					situations: [
						"make the player shut a door",
						"close a chest and run its hooks",
						"replace a lid through normal rules",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Close"},
		),
		editor.object(
			{
				type: z.literal("player"),
				operation: editor.logicOperation("lock", {
					label: "Have the player lock an item",
					description: "Run normal lock rules, messages, and hooks.",
					keywords: ["key", "secure", "door", "container"],
					situations: [
						"make the player secure a door",
						"lock a chest using normal rules",
						"run lock messages and hooks",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
			},
			{title: "Lock"},
		),
		editor.object(
			{
				type: z.literal("player"),
				operation: editor.logicOperation("put-inside", {
					label: "Have the player put an item inside",
					description:
						"Run the normal container, reachability, and capacity checks before placing the item.",
					keywords: ["insert", "container", "store", "bury", "hole"],
					situations: [
						"have the player bury treasure in a hole",
						"put an object in a container with capacity checks",
						"store evidence through the normal command path",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
				containerId: editor.reference("item", {title: "Container"}),
			},
			{title: "Put inside"},
		),
		editor.object(
			{
				type: z.literal("player"),
				operation: editor.logicOperation("put-on", {
					label: "Have the player put an item on a surface",
					description:
						"Run the normal reachability and surface-capacity checks before placing the item.",
					keywords: ["place", "surface", "set down", "stack"],
					situations: [
						"have the player place an offering on an altar",
						"put an object on a surface with capacity checks",
						"stack an item through normal command rules",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
				surfaceId: editor.reference("item", {title: "Surface"}),
			},
			{title: "Put on"},
		),
		editor.object(
			{
				type: z.literal("player"),
				operation: editor.logicOperation("unlock", {
					label: "Have the player unlock an item",
					description: "Run normal key, unlock, message, and hook behavior.",
					keywords: ["key", "open", "door", "container"],
					situations: [
						"make the player use a key on a door",
						"unlock a chest through normal rules",
						"run unlock messages and hooks",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
				keyItemId: editor.reference("item", {title: "Key"}).optional(),
			},
			{title: "Unlock"},
		),
		editor.object(
			{
				type: z.literal("player"),
				operation: editor.logicOperation("use", {
					label: "Have the player use an item",
					description: "Run the item's authored use behavior, optionally against another item.",
					keywords: ["activate", "operate", "apply", "tool", "target"],
					situations: [
						"activate a device",
						"use a tool on another object",
						"operate an item's authored behavior",
					],
				}),
				itemId: editor.reference("item", {title: "Item"}),
				targetItemId: editor.reference("item", {title: "Target"}).optional(),
			},
			{title: "Use"},
		),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation("kill", {
				label: "Kill the player",
				description: "End the current playthrough with an optional custom death message.",
				keywords: ["death", "game over", "lose", "fatal"],
				situations: [
					"kill the player when a trap fires",
					"end the game after a fatal mistake",
					"trigger a custom death scene",
				],
			}),
			customDeathMessage: editor
				.input({title: "Death message", placeholder: "Use the default death message"})
				.optional(),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation("win", {
				label: "Award a win",
				description: "Tell the player they won and record victory without stopping further play.",
				keywords: ["win", "victory", "won", "complete", "continue playing"],
				situations: [
					"award victory but allow exploration",
					"complete the main objective",
					"mark a successful ending without stopping play",
				],
			}),
			message: editor.message({title: "Win message"}).default("You won!"),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation("end-game", {
				label: "End the game",
				description: "Show a final message and stop the playthrough from accepting any more turns.",
				keywords: ["end game", "ending", "stop", "finish", "terminal"],
				situations: [
					"finish after the final scene",
					"stop play at a conclusive ending",
					"close the game after victory or defeat",
				],
			}),
			message: editor.message({title: "Ending message"}).default("The end."),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation("freeze", {
				label: "Prevent player commands",
				description: "Temporarily or indefinitely stop the player from acting.",
				keywords: ["freeze", "disable input", "wait", "stun", "turns"],
				situations: [
					"stun the player for several turns",
					"pause commands during a cutscene",
					"trap the player until another event releases them",
				],
			}),
			freezeMessage: editor
				.input({
					title: "Freeze message",
					description: "The message given to the player when they input anything",
					placeholder: "Optional message while frozen",
				})
				.optional(),
			turns: editor
				.number({
					title: "Turns",
					description:
						"The number of turns the player is frozen for. If unset, the player remains frozen until an effect unfreezes them.",
					placeholder: "No turn limit",
				})
				.optional(),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation("unfreeze", {
				label: "Allow player commands",
				description: "Remove the player's frozen state so commands work again.",
				keywords: ["resume", "enable input", "release", "unstun"],
				situations: [
					"release the player from a trap",
					"resume commands after a cutscene",
					"end a temporary stun",
				],
			}),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation("revive", {
				label: "Revive the player",
				description: "Clear the death state so the playthrough can continue.",
				keywords: ["revive", "resurrect", "alive", "continue", "death"],
				situations: [
					"revive after a delayed rescue",
					"continue after a nonfinal death",
					"undo a fatal state",
				],
			}),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation("respawn", {
				label: "Revive and move the player",
				description: "Clear death and frozen state, then move the player to a chosen room.",
				keywords: ["respawn", "revive", "checkpoint", "room", "death"],
				situations: [
					"respawn at a checkpoint",
					"wake in a safe room after death",
					"return the player after a fatal scene",
				],
			}),
			roomId: editor.reference("room", {title: "Respawn room"}),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation(["equip", "unequip"], {
				equip: {
					label: "Equip an item",
					description: "Mark a carried item as equipped for later conditions.",
					keywords: ["wear", "equip", "armor", "tool"],
					situations: ["wear armor", "equip a tool", "activate abilities from carried gear"],
				},
				unequip: {
					label: "Unequip an item",
					description: "Remove an item from the player's equipped set.",
					keywords: ["remove", "unequip", "armor", "tool"],
					situations: [
						"take off armor",
						"put away an equipped tool",
						"disable gear-dependent abilities",
					],
				},
			}),
			itemId: editor.reference("item", {title: "Item"}),
		}),
		z.object({
			type: z.literal("player"),
			operation: editor.logicOperation(["set-carrying-capacity", "clear-carrying-capacity"], {
				"set-carrying-capacity": {
					label: "Set carrying capacity",
					description: "Limit the total size of items the player can carry.",
					keywords: ["inventory", "capacity", "weight", "limit"],
					situations: [
						"give the player a weight limit",
						"change capacity after equipping a pack",
						"restrict how much can be carried",
					],
				},
				"clear-carrying-capacity": {
					label: "Remove carrying limit",
					description: "Allow the player to carry items without a size limit.",
					keywords: ["inventory", "unlimited", "capacity", "clear"],
					situations: [
						"remove an inventory limit",
						"grant unlimited carrying",
						"clear a temporary weight restriction",
					],
				},
			}),
			capacity: editor.number({title: "Size units"}).int().nonnegative().optional(),
		}),
	]),
	{
		title: "Player",
		description:
			"Performs player actions with their normal rules, messages, and hooks, or changes player state.",
	},
);

export const RoomEffectSchema = editor
	.discriminatedUnion(
		z.discriminatedUnion("operation", [
			z.object({
				type: z.literal("room"),
				operation: editor.logicOperation("set-name", {
					label: "Rename a room",
					description: "Change the room name shown to players.",
					keywords: ["name", "title", "rename", "location"],
					situations: [
						"reveal a location's true name",
						"rename a transformed room",
						"change a place title after discovery",
					],
				}),
				roomId: editor.reference("room", {title: "Room"}),
				value: editor.input({title: "Name"}).min(1),
			}),
			z.object({
				type: z.literal("room"),
				operation: editor.logicOperation("set-description", {
					label: "Change a room description",
					description: "Replace the room's full description.",
					keywords: ["room text", "look", "scene", "appearance"],
					situations: [
						"show that the ground has been disturbed",
						"change a scene after a disaster",
						"describe a room after solving its puzzle",
					],
				}),
				roomId: editor.reference("room", {title: "Room"}),
				value: editor.richText({title: "Description"}),
			}),
			z.object({
				type: z.literal("room"),
				operation: editor.logicOperation("set-short-description", {
					label: "Change a room's revisit text",
					description: "Replace the shortened description used after the room has been visited.",
					keywords: ["short description", "revisit", "room text", "appearance"],
					situations: [
						"change what returning players see",
						"summarize a transformed room on revisit",
						"update brief location text after an event",
					],
				}),
				roomId: editor.reference("room", {title: "Room"}),
				value: editor.textarea({title: "Short description"}),
			}),
			z.object({
				type: z.literal("room"),
				operation: editor.logicOperation(["add-tag", "remove-tag"], {
					"add-tag": {
						label: "Add a room tag",
						description: "Add classification that room conditions can inspect.",
						keywords: ["outside", "indoors", "label", "classify", "mark"],
						situations: [
							"mark a room as outdoors",
							"classify a location as dangerous",
							"make an area eligible for digging",
						],
					},
					"remove-tag": {
						label: "Remove a room tag",
						description: "Remove classification from a room.",
						keywords: ["outside", "indoors", "label", "classify", "unmark"],
						situations: [
							"stop treating a room as outdoors",
							"remove a temporary danger classification",
							"prevent an area from allowing digging",
						],
					},
				}),
				roomId: editor.reference("room", {title: "Room"}),
				tag: editor.input({title: "Tag"}).min(1),
			}),
			z.object({
				type: z.literal("room"),
				operation: editor.logicOperation(["add-alias", "remove-alias"], {
					"add-alias": {
						label: "Add a room alias",
						description: "Let players refer to a room by another name.",
						keywords: ["room", "alias", "synonym", "discovery", "name"],
						situations: [
							"add a discovered name for a room",
							"let an elevator accept a learned floor name",
							"make a location targetable by a new alias",
						],
					},
					"remove-alias": {
						label: "Remove a room alias",
						description: "Stop accepting an alternate room name.",
						keywords: ["room", "alias", "synonym", "remove", "name"],
						situations: [
							"remove an obsolete location name",
							"forget a temporary room nickname",
							"stop accepting a disguised place name",
						],
					},
				}),
				roomId: editor.reference("room", {title: "Room"}),
				value: editor.input({title: "Alias"}).min(1),
			}),
			z.object({
				type: z.literal("room"),
				operation: editor.logicOperation(["set-active", "set-inactive"], {
					"set-active": {
						label: "Activate a room",
						description: "Make a room active for systems that respect room availability.",
						keywords: ["enable", "available", "restore", "location"],
						situations: [
							"make a location available again",
							"restore a disabled area",
							"enable a room after unlocking new content",
						],
					},
					"set-inactive": {
						label: "Deactivate a room",
						description: "Make a room inactive for systems that respect room availability.",
						keywords: ["disable", "unavailable", "remove", "location"],
						situations: [
							"remove a location from active play",
							"disable an area after it collapses",
							"make a room temporarily unavailable",
						],
					},
				}),
				roomId: editor.reference("room", {title: "Room"}),
			}),
			z.object({
				type: z.literal("room"),
				operation: editor.logicOperation("set-flag", {
					label: "Set a room flag",
					description: "Store a true or false fact on one room.",
					keywords: ["remember", "state", "property", "boolean", "mark", "disturbed"],
					situations: [
						"mark this room's ground as disturbed",
						"record that a trap fired here",
						"remember that this location was searched",
						"turn the lights on in one room",
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
				operation: editor.logicOperation(["toggle-flag", "delete-flag"], {
					"toggle-flag": {
						label: "Toggle a room flag",
						description: "Reverse a true or false fact stored on a room.",
						keywords: ["flip", "switch", "state", "property"],
						situations: [
							"toggle the lights in a room",
							"alternate a location's local mechanism",
							"flip whether a room trap is armed",
						],
					},
					"delete-flag": {
						label: "Forget a room flag",
						description: "Remove a fact stored on a room.",
						keywords: ["clear", "reset", "delete", "state", "property"],
						situations: [
							"forget that this room was searched",
							"reset a location-specific event",
							"remove temporary state from one room",
						],
					},
				}),
				roomId: editor.reference("room", {title: "Room"}),
				flag: editor.string({title: "Flag"}).min(1),
			}),
			z.object({
				type: z.literal("room"),
				operation: editor.logicOperation(
					["set-current-flag", "toggle-current-flag", "delete-current-flag"],
					{
						"set-current-flag": {
							label: "Set a flag on the current room",
							description: "Store local state on whichever room the player occupies.",
							keywords: ["here", "current room", "flag", "dynamic", "state"],
							situations: [
								"mark the ground here as disturbed",
								"arm a trap in the current room",
								"reuse one command in every location",
							],
						},
						"toggle-current-flag": {
							label: "Toggle a flag on the current room",
							description: "Reverse local state on whichever room the player occupies.",
							keywords: ["here", "current room", "toggle", "dynamic", "state"],
							situations: [
								"toggle the lights here",
								"flip a local room mechanism",
								"alternate the current room state",
							],
						},
						"delete-current-flag": {
							label: "Forget a flag on the current room",
							description: "Remove local state from whichever room the player occupies.",
							keywords: ["here", "current room", "clear", "dynamic", "state"],
							situations: [
								"reset the room the player is in",
								"clear disturbed ground here",
								"forget local temporary state",
							],
						},
					},
				),
				flag: editor.string({title: "Flag"}).min(1),
				value: editor.boolean({title: "Value"}).default(true).optional(),
			}),
		]),
		{
			title: "Room",
			description: "Directly changes a room's presentation, tags, active state, or flags.",
		},
	)
	.superRefine((effect, ctx) => {
		if (!("flag" in effect) || !effect.operation.endsWith("-flag")) return;
		const operation = effect.operation.replace("-flag", "") as "set" | "toggle" | "delete";
		const message = entityFlagMutationError("room", effect.flag, operation);
		if (message) ctx.addIssue({code: "custom", message, path: ["flag"]});
	});

export const NavigationEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("navigation"),
			operation: editor.logicOperation("move-to-room", {
				label: "Move the player to a room",
				description: "Move directly to a chosen room, independent of direction.",
				keywords: ["teleport", "travel", "enter", "location"],
				situations: [
					"teleport the player to a destination",
					"send the player into a dream scene",
					"move directly after a cutscene",
				],
			}),
			roomId: editor.reference("room", {title: "Room"}),
		}),
		z.object({
			type: z.literal("navigation"),
			operation: editor.logicOperation("move-in-direction", {
				label: "Move in a direction",
				description: "Attempt normal movement from the current room in a chosen direction.",
				keywords: ["go", "travel", "north", "south", "exit"],
				situations: [
					"make the player walk north",
					"attempt escape through an authored exit",
					"move normally and respect blocked passages",
				],
			}),
			direction: DirectionSchema,
		}),
		z.object({
			type: z.literal("navigation"),
			operation: editor.logicOperation("set-facing", {
				label: "Turn the player",
				description: "Change the compass direction the player is facing.",
				keywords: ["face", "turn", "orientation", "direction"],
				situations: [
					"turn the player toward a sound",
					"face a compass direction after entering",
					"change orientation for relative movement",
				],
			}),
			direction: CompassDirectionSchema,
		}),
		z.object({
			type: z.literal("navigation"),
			operation: editor.logicOperation(["lock-exit", "unlock-exit"], {
				"lock-exit": {
					label: "Block one exit",
					description: "Prevent movement through one direction from a room.",
					keywords: ["lock", "close passage", "bar", "direction"],
					situations: [
						"spring a trap that blocks one escape",
						"seal a passage after the player enters",
						"bar travel in one direction",
					],
				},
				"unlock-exit": {
					label: "Unblock one exit",
					description: "Allow movement through one direction from a room.",
					keywords: ["unlock", "open passage", "allow", "direction"],
					situations: [
						"open a secret route",
						"restore one escape direction",
						"allow passage after solving a puzzle",
					],
				},
			}),
			roomId: editor.reference("room", {title: "Room"}),
			direction: DirectionSchema,
		}),
		z.object({
			type: z.literal("navigation"),
			operation: editor.logicOperation(["lock-all-exits", "unlock-all-exits"], {
				"lock-all-exits": {
					label: "Block every exit from a room",
					description: "Prevent movement through all directions from one room.",
					keywords: ["seal", "trap", "lockdown", "all directions"],
					situations: [
						"trap the player in a room",
						"start a lockdown",
						"seal every escape during an encounter",
					],
				},
				"unlock-all-exits": {
					label: "Unblock every exit from a room",
					description: "Allow movement through all authored directions from one room.",
					keywords: ["open", "release", "all directions", "passages"],
					situations: [
						"release the player from a sealed room",
						"end a lockdown",
						"open every escape after an encounter",
					],
				},
			}),
			roomId: editor.reference("room", {title: "Room"}),
		}),
	]),
	{title: "Navigation", description: "Moves or turns the player and changes passage availability."},
);

export const EventEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("event"),
			operation: editor.logicOperation(["schedule", "cancel", "enable", "disable", "reset-cooldown"], {
				schedule: {
					label: "Schedule an event",
					description: "Add or restart an authored event in the live queue.",
					keywords: ["event", "schedule", "delay", "timer", "fuse"],
					situations: [
						"light a fuse from an item hook",
						"schedule an alarm after an action",
						"start a delayed consequence",
					],
				},
				cancel: {
					label: "Cancel an event",
					description: "Remove an event from the live queue.",
					keywords: ["event", "cancel", "stop", "timer", "defuse"],
					situations: ["defuse a pending explosion", "cancel an alarm", "remove a delayed consequence"],
				},
				enable: {
					label: "Enable an event",
					description: "Allow a queued event to run again.",
					keywords: ["event", "enable", "resume", "active"],
					situations: ["resume a paused alarm", "enable a repeating event", "reactivate a timer"],
				},
				disable: {
					label: "Disable an event",
					description: "Pause a queued event without removing it.",
					keywords: ["event", "disable", "pause", "inactive"],
					situations: [
						"silence an alarm temporarily",
						"pause a repeating event",
						"disable background polling",
					],
				},
				"reset-cooldown": {
					label: "Restart an event's wait",
					description: "Start the queued event's wait period again from the current turn.",
					keywords: ["event", "cooldown", "restart", "delay", "timer"],
					situations: [
						"restart a fuse timer",
						"delay an alarm again",
						"reset a repeating trap cooldown",
					],
				},
			}),
			eventId: editor.reference("event", {title: "Event"}),
		}),
		z.object({
			type: z.literal("event"),
			operation: editor.logicOperation("reschedule", {
				label: "Reschedule an event",
				description: "Add or restart an authored event with a new wait duration.",
				keywords: ["event", "reschedule", "delay", "timer", "wait"],
				situations: [
					"change how long a fuse burns",
					"postpone a pending event",
					"schedule a consequence with a dynamic delay",
				],
			}),
			eventId: editor.reference("event", {title: "Event"}),
			wait: editor.number({title: "Wait turns", commandVariableType: "number"}).int().nonnegative(),
		}),
	]),
	{title: "Event", description: "Schedules, pauses, cancels, and restarts authored events."},
);

export type MessageEffect = z.infer<typeof MessageEffectSchema>;
export type WorldStateEffect = z.infer<typeof WorldEffectSchema>;
export type ItemEffect = z.infer<typeof ItemEffectSchema>;
export type ItemCollectionEffect = z.infer<typeof ItemCollectionEffectSchema>;
export type PlayerEffect = z.infer<typeof PlayerEffectSchema>;
export type PlayerItemActionEffect = Extract<PlayerEffect, {itemId: unknown}>;
export type RoomEffect = z.infer<typeof RoomEffectSchema>;
export type NavigationEffect = z.infer<typeof NavigationEffectSchema>;
export type EventEffect = z.infer<typeof EventEffectSchema>;
export type EffectReference = z.infer<typeof EffectReferenceSchema>;

export type EffectGroup = {
	name: string;
	id: ID<"effect">;
	type: "group";
	effects: Effect[];
	allowMultipleUsesInWorld: true;
};

export type ControlEffect =
	| {
			type: "control";
			operation: "when";
			condition: Condition;
			thenEffectId: ID<"effect">;
			otherwiseEffectId?: ID<"effect">;
	  }
	| {
			type: "control";
			operation: "random-branch";
			choices: Array<{weight: number; effectId: ID<"effect">}>;
	  };

export type Effect =
	| MessageEffect
	| WorldStateEffect
	| ItemEffect
	| ItemCollectionEffect
	| PlayerEffect
	| RoomEffect
	| NavigationEffect
	| EventEffect
	| ControlEffect
	| EffectReference;

export const ControlEffectSchema: z.ZodType<ControlEffect> = z.lazy(() =>
	editor.discriminatedUnion(
		z.discriminatedUnion("operation", [
			z.object({
				type: z.literal("control"),
				operation: editor.logicOperation("when", {
					label: "Run effects when a condition passes",
					description:
						"Evaluate state at this point in the sequence, then run the matching nested effects.",
					keywords: ["guard", "if", "success", "failure", "conditional", "transaction"],
					situations: [
						"only bury the hole after placement succeeded",
						"continue only if an earlier action changed state",
						"run recovery effects when an action failed",
						"branch inside an item hook or event",
					],
				}),
				condition: editor.conditionControl(ConditionSchema, {title: "When"}),
				thenEffectId: editor.reference("effect", {title: "Effects when true"}),
				otherwiseEffectId: editor.reference("effect", {title: "Effects when false"}).optional(),
			}),
			z.object({
				type: z.literal("control"),
				operation: editor.logicOperation("random-branch", {
					label: "Choose a weighted random outcome",
					description:
						"Deterministically choose one state-changing effect group using authored weights.",
					keywords: ["random", "weighted", "chance", "branch", "outcome", "replay"],
					situations: [
						"randomly spring one of several traps",
						"choose a state-changing outcome",
						"roll deterministic treasure or weather",
						"give one weighted consequence",
					],
				}),
				choices: editor.array(
					z.object({
						weight: editor.number({title: "Weight"}).positive().default(1),
						effectId: editor.reference("effect", {title: "Effects"}),
					}),
					{title: "Outcomes"},
				),
			}),
		]),
		{
			title: "Control flow",
			description: "Guards effect sequences or chooses a deterministic random branch.",
		},
	),
);

/** A group contains concrete effects or references to other saved groups. */
export const EffectSchema: z.ZodType<Effect> = z.lazy(() =>
	z.union([
		MessageEffectSchema,
		WorldEffectSchema,
		ItemEffectSchema,
		ItemCollectionEffectSchema,
		PlayerEffectSchema,
		RoomEffectSchema,
		NavigationEffectSchema,
		EventEffectSchema,
		ControlEffectSchema,
		EffectReferenceSchema,
	]),
);

export const EffectGroupSchema: z.ZodType<EffectGroup> = editor.effectControl(
	z
		.object({
			name: editor.input({
				title: "Group name",
				description:
					"Generated from the group's effects until you choose a custom name. Use Clear to return to the generated name.",
			}),
			id: editor.id("effect", {title: "Group ID", hidden: true}),
			type: z.literal("group"),
			effects: editor.effects(EffectSchema, {
				title: "Effects",
				description: "Run concrete effects or reference another saved effect group.",
			}),
			allowMultipleUsesInWorld: editor.hidden(z.literal(true).default(true), {
				title: "Stored in world effects",
			}),
		})
		.superRefine((group, ctx) => {
			const selfId =
				typeof group.id === "object" && group.id !== null && "id" in group.id
					? String(group.id.id)
					: String(group.id);
			group.effects.forEach((effect, index) => {
				if (
					effect.type === "effect-ref" &&
					typeof effect.effectId === "object" &&
					effect.effectId !== null &&
					"id" in effect.effectId &&
					String(effect.effectId.id) === selfId
				) {
					ctx.addIssue({
						code: "custom",
						message: "An effect group cannot reference itself.",
						path: ["effects", index, "effectId"],
					});
				}
			});
		}),
	{title: "Effect group", description: "Configure a sequence of effects as one reusable outcome."},
	{name: "", id: "", type: "group", effects: [], allowMultipleUsesInWorld: true},
);

/** Saved effects are always complete groups. */
export const SavedEffectSchema = EffectGroupSchema;
export const EffectUsageSchema = EffectGroupSchema;

// TODO: Restore NPC, event, flow, and time/randomness effects when those domains return.
