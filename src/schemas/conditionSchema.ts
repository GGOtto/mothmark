import {z} from "zod";
import {docify} from "../utils/docify";
import {
	editorBoolean,
	editorCondition,
	editorCounterKey,
	editorDirection,
	editorDiscriminatedUnion,
	editorEntityId,
	editorFlagKey,
	editorInput,
	editorNonNegativeInteger,
	editorNumber,
	editorObject,
	editorPositiveInteger,
	editorSelect,
	editorStringList,
	editorConditionList,
	editorRichText,
} from "@/schemas/editorSchemaHelpers";

export const ComparisonOperatorSchema = editorSelect(
	z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]),
	{
		title: "Operator",
		description: docify(`
			A numeric or comparable-value operator.

			eq: equals
			neq: does not equal
			gt: greater than
			gte: greater than or equal to
			lt: less than
			lte: less than or equal to
		`),
		options: [
			{
				label: "Equals",
				value: "eq",
				description: "The current value must equal the target value.",
			},
			{
				label: "Does Not Equal",
				value: "neq",
				description: "The current value must not equal the target value.",
			},
			{
				label: "Greater Than",
				value: "gt",
				description: "The current value must be greater than the target value.",
			},
			{
				label: "Greater Than or Equal",
				value: "gte",
				description: "The current value must be greater than or equal to the target value.",
			},
			{
				label: "Less Than",
				value: "lt",
				description: "The current value must be less than the target value.",
			},
			{
				label: "Less Than or Equal",
				value: "lte",
				description: "The current value must be less than or equal to the target value.",
			},
		],
	},
);

export const StringComparisonOperatorSchema = editorSelect(
	z.enum(["eq", "neq", "includes", "starts-with", "ends-with"]),
	{
		title: "String Operator",
		description: docify(`
			A string comparison operator.

			eq: exactly equals the value.
			neq: does not equal the value.
			includes: contains the value somewhere inside the string.
			starts-with: begins with the value.
			ends-with: ends with the value.
		`),
		options: [
			{
				label: "Equals",
				value: "eq",
				description: "The current string must exactly equal the target value.",
			},
			{
				label: "Does Not Equal",
				value: "neq",
				description: "The current string must not equal the target value.",
			},
			{
				label: "Includes",
				value: "includes",
				description: "The current string must contain the target value.",
			},
			{
				label: "Starts With",
				value: "starts-with",
				description: "The current string must begin with the target value.",
			},
			{
				label: "Ends With",
				value: "ends-with",
				description: "The current string must end with the target value.",
			},
		],
	},
);

const ConditionIdentitySchema = z.object({
	id: editorInput({
		title: "Condition ID",
		description: "Stable world-unique identifier used when reusing this condition.",
		advanced: true,
	}).optional(),
	name: editorInput({
		title: "Condition Name",
		description: "Display name shown in condition lists and reuse pickers.",
	}).optional(),
	allowMultipleUsesInWorld: editorBoolean({
		title: "Allow multiple uses in world",
		description: "When checked, this condition can be selected from other condition lists.",
		features: {
			display: "checkbox",
			labels: {
				on: "Allow multiple uses in world",
				off: "Allow multiple uses in world",
			},
		},
		layout: {
			width: "full",
			order: 3,
		},
	}).default(false),
});

export const ConditionReferenceSchema = editorObject(
	z.object({
		type: z.literal("condition-ref").describe("References a condition stored in the world."),
		conditionId: editorEntityId("condition", {
			title: "Condition",
			description: "The world condition this usage should evaluate.",
			layout: {
				width: "full",
				order: 1,
			},
		}),
	}),
	{
		title: "Condition Reference",
		description: "A usage of a condition stored in the world condition library.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

const StateValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const FlagConditionSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("flag").describe("Checks a boolean world flag."),
			operation: z
				.literal("equals")
				.describe("Checks whether a flag equals a specific boolean value."),
			flag: editorFlagKey({
				title: "Flag",
				description: "The id of the flag to check, such as kitchen.appleOnTable.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
			value: editorBoolean({
				title: "Value",
				description: "The required boolean value for the flag. Defaults to true.",
				layout: {
					width: "half",
					order: 2,
				},
			}).default(true),
		}),

		z.object({
			type: z.literal("flag").describe("Checks a boolean world flag."),
			operation: z
				.literal("exists")
				.describe("Checks whether the flag exists in game state, regardless of its value."),
			flag: editorFlagKey({
				title: "Flag",
				description: "The id of the flag to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("flag").describe("Checks a boolean world flag."),
			operation: z
				.literal("missing")
				.describe("Checks whether the flag does not exist in game state."),
			flag: editorFlagKey({
				title: "Flag",
				description: "The id of the flag to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),
	]),
	{
		title: "Flag Condition",
		description: docify(`
			Checks boolean world flags.

			Use flags for simple true/false world state, puzzle state, story state,
			or any custom boolean value an author wants to track.

			Examples:
			- kitchen.applePlacedOnTable is true
			- rats.haveArrived is false
			- guard.hasSeenPlayer exists
			- mirror.hasBeenBroken does not exist
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const CounterConditionSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("counter").describe("Checks a numeric counter."),
			operation: z.literal("compare").describe("Compares a counter against one numeric value."),
			counter: editorCounterKey({
				title: "Counter",
				description: "The id of the counter to check, such as rats.turnsUntilArrival.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
			operator: ComparisonOperatorSchema.describe(
				"The comparison operator used to compare the counter against the target value.",
			),
			value: editorNumber({
				title: "Value",
				description: "The numeric value to compare the counter against.",
				layout: {
					width: "half",
					order: 3,
				},
			}),
		}),

		z.object({
			type: z.literal("counter").describe("Checks a numeric counter."),
			operation: z
				.literal("between")
				.describe("Checks whether a counter is between two values, inclusive by default."),
			counter: editorCounterKey({
				title: "Counter",
				description: "The id of the counter to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
			min: editorNumber({
				title: "Minimum",
				description: "The lower bound for the counter.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
			max: editorNumber({
				title: "Maximum",
				description: "The upper bound for the counter.",
				layout: {
					width: "half",
					order: 3,
				},
			}),
			inclusive: editorBoolean({
				title: "Inclusive",
				description: "If true, the min and max values count as passing values.",
				layout: {
					width: "half",
					order: 4,
				},
			}).default(true),
		}),

		z.object({
			type: z.literal("counter").describe("Checks a numeric counter."),
			operation: z.literal("exists").describe("Checks whether a counter exists in game state."),
			counter: editorCounterKey({
				title: "Counter",
				description: "The id of the counter to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("counter").describe("Checks a numeric counter."),
			operation: z
				.literal("missing")
				.describe("Checks whether a counter does not exist in game state."),
			counter: editorCounterKey({
				title: "Counter",
				description: "The id of the counter to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),
	]),
	{
		title: "Counter Condition",
		description: docify(`
			Checks numeric world counters.

			Use counters for quantities, progress, timers, repeated actions, puzzle steps,
			suspicion, trust, noise, or anything that needs more than true/false state.

			Examples:
			- guard.suspicion greater than 50
			- door.knocks equals 3
			- ratsFedCount is between 2 and 5
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const CurrentRoomConditionSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("current-room").describe("Checks the player's current room."),
			operation: z
				.literal("is")
				.describe("Checks whether the player is currently in a specific room."),
			roomId: editorEntityId("room", {
				title: "Room",
				description: "The room id to compare against.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("current-room").describe("Checks the player's current room."),
			operation: z
				.literal("is-not")
				.describe("Checks whether the player is not currently in a specific room."),
			roomId: editorEntityId("room", {
				title: "Room",
				description: "The room id to compare against.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("current-room").describe("Checks the player's current room."),
			operation: z.literal("has-tag").describe("Checks whether the current room has a specific tag."),
			tag: editorInput({
				title: "Tag",
				description: "The room tag to check for.",
				placeholder: "outdoors",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
		}),

		z.object({
			type: z.literal("current-room").describe("Checks the player's current room."),
			operation: z
				.literal("missing-tag")
				.describe("Checks whether the current room does not have a specific tag."),
			tag: editorInput({
				title: "Tag",
				description: "The room tag to check for.",
				placeholder: "outdoors",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
		}),
	]),
	{
		title: "Current Room Condition",
		description: docify(`
			Checks the player's current room or tags on the current room.

			Examples:
			- Player is in kitchen
			- Player is not in cellar
			- Current room has tag outdoors
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const RoomHistoryConditionSchema = editorObject(
	z.object({
		type: z.literal("room-history").describe("Checks whether a room has been visited or viewed."),

		roomId: editorEntityId("room", {
			title: "Room",
			description: "The room id to check.",
			layout: {
				width: "full",
				order: 1,
			},
		}),

		history: editorSelect(z.enum(["visited", "viewed"]), {
			title: "History",
			description: "The kind of room history to check.",
			options: [
				{
					label: "Visited",
					value: "visited",
					description: "The player has entered the room.",
				},
				{
					label: "Viewed",
					value: "viewed",
					description: "The room description has been shown or discovered.",
				},
			],
			layout: {
				width: "half",
				order: 2,
			},
		}),

		value: editorBoolean({
			title: "Value",
			description: "The required history state. Defaults to true.",
			layout: {
				width: "half",
				order: 3,
			},
		}).default(true),
	}),
	{
		title: "Room History Condition",
		description: docify(`
			Checks room history.

			Use visited when the player has entered the room.
			Use viewed when the room description has been shown or discovered.

			Examples:
			- Kitchen has been visited
			- Cellar has not been viewed
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const FeatureExaminedConditionSchema = editorObject(
	z.object({
		type: z.literal("feature-examined").describe("Checks whether a room feature has been examined."),

		roomId: editorEntityId("room", {
			title: "Room",
			description: "The id of the room containing the feature.",
			layout: {
				width: "half",
				order: 1,
			},
		}),

		featureId: editorEntityId("feature", {
			title: "Feature",
			description: "The id of the feature to check.",
			layout: {
				width: "half",
				order: 2,
			},
		}),

		value: editorBoolean({
			title: "Value",
			description: "The required examined state. Defaults to true.",
			layout: {
				width: "half",
				order: 3,
			},
		}).default(true),
	}),
	{
		title: "Feature Examined Condition",
		description: docify(`
			Checks whether a specific feature in a specific room has been examined.

			Examples:
			- Kitchen table has been examined
			- Mirror has not been examined
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const InventoryConditionSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("inventory").describe("Checks the player's inventory."),
			operation: z.literal("has-item").describe("Checks whether the player has a specific item."),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id to check for.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("inventory").describe("Checks the player's inventory."),
			operation: z
				.literal("missing-item")
				.describe("Checks whether the player does not have a specific item."),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id to check for.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("inventory").describe("Checks the player's inventory."),
			operation: z
				.literal("has-all-items")
				.describe("Checks whether the player has every listed item."),
			itemIds: editorStringList(
				{
					title: "Items",
					description: "The item ids the player must all have.",
					emptyState: {
						emptyTitle: "No required items",
						emptyDescription: "Add item ids the player must have.",
						emptyActionLabel: "Add item",
					},
					layout: {
						width: "full",
						order: 1,
					},
				},
				z.array(z.string().min(1)).min(1),
			),
		}),

		z.object({
			type: z.literal("inventory").describe("Checks the player's inventory."),
			operation: z
				.literal("has-any-item")
				.describe("Checks whether the player has at least one listed item."),
			itemIds: editorStringList(
				{
					title: "Items",
					description: "The item ids where at least one must be in inventory.",
					emptyState: {
						emptyTitle: "No possible items",
						emptyDescription: "Add item ids where at least one must be in inventory.",
						emptyActionLabel: "Add item",
					},
					layout: {
						width: "full",
						order: 1,
					},
				},
				z.array(z.string().min(1)).min(1),
			),
		}),

		z.object({
			type: z.literal("inventory").describe("Checks the player's inventory."),
			operation: z
				.literal("contains-tag")
				.describe("Checks whether the player's inventory contains any item with a specific tag."),
			tag: editorInput({
				title: "Tag",
				description: "The item tag to check for.",
				placeholder: "food",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
		}),

		z.object({
			type: z.literal("inventory").describe("Checks the player's inventory."),
			operation: z
				.literal("missing-tag")
				.describe("Checks whether the player's inventory contains no item with a specific tag."),
			tag: editorInput({
				title: "Tag",
				description: "The item tag to check for.",
				placeholder: "food",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
		}),

		z.object({
			type: z.literal("inventory").describe("Checks the player's inventory."),
			operation: z
				.literal("count")
				.describe("Compares the number of items in the player's inventory."),
			operator: ComparisonOperatorSchema.describe(
				"The comparison operator used against the inventory count.",
			),
			value: editorNonNegativeInteger({
				title: "Count",
				description: "The inventory count to compare against.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("inventory").describe("Checks the player's inventory."),
			operation: z
				.literal("tag-count")
				.describe("Compares the number of inventory items with a specific tag."),
			tag: editorInput({
				title: "Tag",
				description: "The item tag to count.",
				placeholder: "food",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
			operator: ComparisonOperatorSchema.describe(
				"The comparison operator used against the tagged inventory count.",
			),
			value: editorNonNegativeInteger({
				title: "Count",
				description: "The tagged item count to compare against.",
				layout: {
					width: "half",
					order: 3,
				},
			}),
		}),
	]),
	{
		title: "Inventory Condition",
		description: docify(`
			Checks the player's inventory.

			Examples:
			- Player has apple
			- Player does not have lantern
			- Player has all required keys
			- Player has any item tagged food
			- Player inventory count equals 3
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const HasItemConditionSchema = editorObject(
	z.object({
		type: z.literal("has-item").describe("Checks the player's inventory."),

		itemId: editorEntityId("item", {
			title: "Item",
			description: "The item id to check for.",
			layout: {
				width: "full",
				order: 1,
			},
		}),

		negate: editorBoolean({
			title: "Negate",
			description: "If true, this condition passes when the player does not have the item.",
			layout: {
				width: "half",
				order: 2,
			},
		}).default(false),
	}),
	{
		title: "Legacy Has Item Condition",
		description: docify(`
			Legacy shorthand for checking whether the player has an item.

			Prefer InventoryConditionSchema for new authored commands, especially when
			checking multiple items, tags, or inventory counts.
		`),
		advanced: true,
		deprecated: true,
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const ItemLocationConditionSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z
				.literal("in-inventory")
				.describe("Checks whether an item is in the player's inventory."),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z
				.literal("in-current-room")
				.describe("Checks whether an item is in the player's current room."),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z.literal("in-room").describe("Checks whether an item is in a specific room."),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id to check.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			roomId: editorEntityId("room", {
				title: "Room",
				description: "The room id to check against.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z.literal("on-surface").describe("Checks whether an item is on a specific surface."),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id to check.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			surfaceId: editorEntityId("surface", {
				title: "Surface",
				description: "The surface id to check against.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z
				.literal("in-container")
				.describe("Checks whether an item is inside a specific container."),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id to check.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			containerId: editorEntityId("container", {
				title: "Container",
				description: "The container id to check against.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z
				.literal("held-by-npc")
				.describe("Checks whether an item is held by a specific NPC."),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id to check.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			npcId: editorEntityId("npc", {
				title: "NPC",
				description: "The NPC id to check against.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z.literal("hidden").describe("Checks whether an item is hidden."),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z.literal("destroyed").describe("Checks whether an item has been destroyed."),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z
				.literal("visible")
				.describe("Checks whether an item is currently visible to the player."),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z
				.literal("reachable")
				.describe("Checks whether an item is currently reachable by the player."),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),
	]),
	{
		title: "Item Location Condition",
		description: docify(`
			Checks where an item is located or whether the player can see/reach it.

			Examples:
			- Apple is on table
			- Key is inside drawer
			- Lantern is in inventory
			- Apple is visible to player
			- Coin is reachable by player
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const ObjectStateConditionSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z
				.literal("object-state")
				.describe("Checks the state of an object, feature, item, door, surface, or container."),
			operation: editorSelect(
				z.enum([
					"open",
					"closed",
					"locked",
					"unlocked",
					"lit",
					"unlit",
					"broken",
					"intact",
					"clean",
					"dirty",
				]),
				{
					title: "State",
					description: "The built-in object state to check.",
					options: [
						{label: "Open", value: "open"},
						{label: "Closed", value: "closed"},
						{label: "Locked", value: "locked"},
						{label: "Unlocked", value: "unlocked"},
						{label: "Lit", value: "lit"},
						{label: "Unlit", value: "unlit"},
						{label: "Broken", value: "broken"},
						{label: "Intact", value: "intact"},
						{label: "Clean", value: "clean"},
						{label: "Dirty", value: "dirty"},
					],
				},
			),
			objectId: editorEntityId("object", {
				title: "Object",
				description: "The object id to check.",
				layout: {
					width: "full",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z
				.literal("object-state")
				.describe("Checks the state of an object, feature, item, door, surface, or container."),
			operation: z
				.literal("contains-item")
				.describe("Checks whether an object or container contains a specific item."),
			objectId: editorEntityId("object", {
				title: "Object",
				description: "The object or container id to check.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id that should be contained.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z
				.literal("object-state")
				.describe("Checks the state of an object, feature, item, door, surface, or container."),
			operation: z
				.literal("missing-item")
				.describe("Checks whether an object or container does not contain a specific item."),
			objectId: editorEntityId("object", {
				title: "Object",
				description: "The object or container id to check.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id that should not be contained.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z
				.literal("object-state")
				.describe("Checks the state of an object, feature, item, door, surface, or container."),
			operation: z
				.literal("surface-has-item")
				.describe("Checks whether a surface has a specific item on it."),
			surfaceId: editorEntityId("surface", {
				title: "Surface",
				description: "The surface id to check.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id that should be on the surface.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z
				.literal("object-state")
				.describe("Checks the state of an object, feature, item, door, surface, or container."),
			operation: z
				.literal("surface-missing-item")
				.describe("Checks whether a surface does not have a specific item on it."),
			surfaceId: editorEntityId("surface", {
				title: "Surface",
				description: "The surface id to check.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id that should not be on the surface.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z
				.literal("object-state")
				.describe("Checks the state of an object, feature, item, door, surface, or container."),
			operation: z
				.literal("empty")
				.describe("Checks whether a container, surface, or object has no contained/placed items."),
			objectId: editorEntityId("object", {
				title: "Object",
				description: "The object id to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z
				.literal("object-state")
				.describe("Checks the state of an object, feature, item, door, surface, or container."),
			operation: z.literal("custom").describe("Checks a custom object state value."),
			objectId: editorEntityId("object", {
				title: "Object",
				description: "The object id to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
			key: editorInput({
				title: "Key",
				description: "The custom state key to check.",
				placeholder: "freshness",
				required: true,
				layout: {
					width: "half",
					order: 2,
				},
			}).min(1),
			operator: z
				.union([StringComparisonOperatorSchema, ComparisonOperatorSchema])
				.describe("The comparison operator to use against the custom value."),
			value: StateValueSchema.describe("The custom state value to compare against."),
		}),
	]),
	{
		title: "Object State Condition",
		description: docify(`
			Checks object, feature, item, door, surface, or container state.

			Examples:
			- Door is locked
			- Lantern is lit
			- Mirror is broken
			- Table has apple
			- Chest contains brass key
			- Cabinet is empty
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const NpcConditionSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("npc").describe("Checks NPC state."),
			operation: z
				.literal("in-current-room")
				.describe("Checks whether an NPC is in the player's current room."),
			npcId: editorEntityId("npc", {
				title: "NPC",
				description: "The NPC id to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("npc").describe("Checks NPC state."),
			operation: z.literal("in-room").describe("Checks whether an NPC is in a specific room."),
			npcId: editorEntityId("npc", {
				title: "NPC",
				description: "The NPC id to check.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			roomId: editorEntityId("room", {
				title: "Room",
				description: "The room id to check against.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("npc").describe("Checks NPC state."),
			operation: z.literal("has-item").describe("Checks whether an NPC has a specific item."),
			npcId: editorEntityId("npc", {
				title: "NPC",
				description: "The NPC id to check.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			itemId: editorEntityId("item", {
				title: "Item",
				description: "The item id to check for.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("npc").describe("Checks NPC state."),
			operation: z.literal("mood-is").describe("Checks whether an NPC has a specific mood."),
			npcId: editorEntityId("npc", {
				title: "NPC",
				description: "The NPC id to check.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			mood: editorInput({
				title: "Mood",
				description: "The required NPC mood.",
				placeholder: "friendly",
				required: true,
				layout: {
					width: "half",
					order: 2,
				},
			}).min(1),
		}),

		z.object({
			type: z.literal("npc").describe("Checks NPC state."),
			operation: z.literal("trust").describe("Compares an NPC trust value against a number."),
			npcId: editorEntityId("npc", {
				title: "NPC",
				description: "The NPC id to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
			operator: ComparisonOperatorSchema.describe(
				"The comparison operator used against the NPC trust value.",
			),
			value: editorNumber({
				title: "Trust",
				description: "The trust value to compare against.",
				layout: {
					width: "half",
					order: 3,
				},
			}),
		}),

		z.object({
			type: z.literal("npc").describe("Checks NPC state."),
			operation: editorSelect(
				z.enum([
					"met-player",
					"not-met-player",
					"hostile",
					"friendly",
					"asleep",
					"awake",
					"can-see-player",
					"cannot-see-player",
					"is-dead",
				]),
				{
					title: "NPC State",
					description: "The built-in NPC state to check.",
					options: [
						{label: "Met Player", value: "met-player"},
						{label: "Not Met Player", value: "not-met-player"},
						{label: "Hostile", value: "hostile"},
						{label: "Friendly", value: "friendly"},
						{label: "Asleep", value: "asleep"},
						{label: "Awake", value: "awake"},
						{label: "Can See Player", value: "can-see-player"},
						{label: "Cannot See Player", value: "cannot-see-player"},
						{label: "Died", value: "is-dead"},
					],
					// TODO: Stuff like this should belong to the schema for npc conditions, but we'll wait on that
				},
			),
			npcId: editorEntityId("npc", {
				title: "NPC",
				description: "The NPC id to check.",
				layout: {
					width: "full",
					order: 2,
				},
			}),
		}),
	]),
	{
		title: "NPC Condition",
		description: docify(`
			Checks NPC location, inventory, mood, trust, relationship, awareness, and behavior.

			Examples:
			- Cook is in kitchen
			- Guard trust is greater than 20
			- Rat King is hostile
			- Guard can see player
			- Cook has apple
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const CommandHistoryConditionSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("command-history").describe("Checks recent player command history."),
			operation: z
				.literal("previous-command-was")
				.describe("Checks whether the immediately previous command matched a command name."),
			commandName: editorInput({
				title: "Command",
				description: "The command name to check, such as examine, sing, knock, or say.",
				placeholder: "examine",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
		}),

		z.object({
			type: z.literal("command-history").describe("Checks recent player command history."),
			operation: z
				.literal("previous-raw-command-was")
				.describe("Checks whether the immediately previous raw command text matches a value."),
			operator: StringComparisonOperatorSchema.default("eq").describe(
				"How to compare the raw command text.",
			),
			value: editorInput({
				title: "Raw Command",
				description: "The raw command text to compare against.",
				placeholder: "knock on door",
				required: true,
				layout: {
					width: "full",
					order: 2,
				},
			}).min(1),
		}),

		z.object({
			type: z.literal("command-history").describe("Checks recent player command history."),
			operation: z
				.literal("previous-target-was")
				.describe(
					"Checks whether the previous command targeted a specific object, item, NPC, feature, topic, or room.",
				),
			targetId: editorEntityId("object", {
				title: "Target",
				description: "The resolved target id to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("command-history").describe("Checks recent player command history."),
			operation: z
				.literal("used-command-before")
				.describe("Checks whether the player has ever used a specific command before."),
			commandName: editorInput({
				title: "Command",
				description: "The command name to check.",
				placeholder: "knock",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
		}),

		z.object({
			type: z.literal("command-history").describe("Checks recent player command history."),
			operation: z
				.literal("never-used-command")
				.describe("Checks whether the player has never used a specific command."),
			commandName: editorInput({
				title: "Command",
				description: "The command name to check.",
				placeholder: "knock",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
		}),

		z.object({
			type: z.literal("command-history").describe("Checks recent player command history."),
			operation: z
				.literal("used-command-within-turns")
				.describe("Checks whether the player used a command within the last N turns."),
			commandName: editorInput({
				title: "Command",
				description: "The command name to check.",
				placeholder: "say",
				required: true,
				layout: {
					width: "half",
					order: 1,
				},
			}).min(1),
			turns: editorPositiveInteger({
				title: "Turns",
				description: "How many turns back to search.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("command-history").describe("Checks recent player command history."),
			operation: z
				.literal("repeated-command")
				.describe("Checks whether the player repeated a command a specific number of times."),
			commandName: editorInput({
				title: "Command",
				description: "The command name to check.",
				placeholder: "knock",
				required: true,
				layout: {
					width: "half",
					order: 1,
				},
			}).min(1),
			count: editorPositiveInteger({
				title: "Count",
				description: "How many times the command must have been repeated.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
			consecutive: editorBoolean({
				title: "Consecutive",
				description: "If true, the repeated commands must be consecutive.",
				layout: {
					width: "half",
					order: 3,
				},
			}).default(true),
		}),

		z.object({
			type: z.literal("command-history").describe("Checks recent player command history."),
			operation: z
				.literal("sequence")
				.describe("Checks whether the player performed a sequence of command names in order."),
			commands: editorStringList(
				{
					title: "Commands",
					description: "The ordered command names that must appear in recent command history.",
					emptyState: {
						emptyTitle: "No command sequence",
						emptyDescription: "Add commands in the order they must appear.",
						emptyActionLabel: "Add command",
					},
					layout: {
						width: "full",
						order: 1,
					},
				},
				z.array(z.string().min(1)).min(1),
			),
			withinTurns: editorPositiveInteger({
				title: "Within Turns",
				description: "Optional maximum number of recent turns to search for the sequence.",
				layout: {
					width: "half",
					order: 2,
				},
			}).optional(),
		}),
	]),
	{
		title: "Command History Condition",
		description: docify(`
			Checks recent command history.

			Use this for rituals, repeated actions, contextual responses, and logic based
			on what the player just did.

			Examples:
			- Previous command was examine mirror
			- Player said password within last 3 turns
			- Player knocked on door 3 times
			- Player performed light candle, ring bell, speak name in order
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const RandomChanceConditionSchema = editorObject(
	z.object({
		type: z.literal("random-chance").describe("Checks whether a random chance succeeds."),

		chance: editorNumber(
			{
				title: "Chance",
				description: "The chance to succeed, from 0 to 1. For example, 0.25 means 25%.",
				layout: {
					width: "half",
					order: 1,
				},
			},
			z.number().min(0).max(1),
		),

		seedKey: editorInput({
			title: "Seed Key",
			description:
				"Optional key used by seeded random systems to make this chance deterministic across saves.",
			placeholder: "rats-arrive",
			layout: {
				width: "half",
				order: 2,
			},
		})
			.min(1)
			.optional(),

		invert: editorBoolean({
			title: "Invert",
			description: "If true, this condition passes when the random chance fails.",
			layout: {
				width: "half",
				order: 3,
			},
		}).default(false),
	}),
	{
		title: "Random Chance Condition",
		description: docify(`
			Checks random chance.

			Use sparingly for authored logic where uncertainty is desirable.

			Examples:
			- 25% chance rats appear
			- 50% chance guard hears player

			If the engine later supports seeded saves, seedKey can make chance checks
			reproducible instead of purely random.
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const QuestConditionSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("quest").describe("Checks quest state."),
			operation: editorSelect(z.enum(["not-started", "active", "completed", "failed"]), {
				title: "Quest Status",
				description: "The quest status to check.",
				options: [
					{label: "Not Started", value: "not-started"},
					{label: "Active", value: "active"},
					{label: "Completed", value: "completed"},
					{label: "Failed", value: "failed"},
				],
			}),
			questId: editorEntityId("quest", {
				title: "Quest",
				description: "The quest id to check.",
				layout: {
					width: "full",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("quest").describe("Checks quest state."),
			operation: z
				.literal("objective-complete")
				.describe("Checks whether a quest objective is complete."),
			questId: editorEntityId("quest", {
				title: "Quest",
				description: "The quest id to check.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			objectiveId: editorEntityId("quest-objective", {
				title: "Objective",
				description: "The objective id to check.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("quest").describe("Checks quest state."),
			operation: z
				.literal("objective-incomplete")
				.describe("Checks whether a quest objective is incomplete."),
			questId: editorEntityId("quest", {
				title: "Quest",
				description: "The quest id to check.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			objectiveId: editorEntityId("quest-objective", {
				title: "Objective",
				description: "The objective id to check.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),
	]),
	{
		title: "Quest Condition",
		description: docify(`
			Checks quest and objective state.

			Examples:
			- Quest Find the Lantern is active
			- Quest Find the Lantern is completed
			- Objective Bring apple to cook is complete
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const ScheduledEventConditionSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("scheduled-event").describe("Checks scheduled event runtime state."),
			operation: z.literal("exists").describe("Checks whether an event instance exists."),
			instanceId: editorInput({
				title: "Instance ID",
				description: "The scheduled event instance id to check.",
				placeholder: "rats-arrive-instance",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
		}),

		z.object({
			type: z.literal("scheduled-event").describe("Checks scheduled event runtime state."),
			operation: z.literal("missing").describe("Checks whether an event instance does not exist."),
			instanceId: editorInput({
				title: "Instance ID",
				description: "The scheduled event instance id to check.",
				placeholder: "rats-arrive-instance",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
		}),

		z.object({
			type: z.literal("scheduled-event").describe("Checks scheduled event runtime state."),
			operation: z
				.literal("event-scheduled")
				.describe("Checks whether any scheduled instance exists for an authored event id."),
			eventId: editorEntityId("event", {
				title: "Event",
				description: "The authored event id to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("scheduled-event").describe("Checks scheduled event runtime state."),
			operation: z
				.literal("event-not-scheduled")
				.describe("Checks whether no scheduled instance exists for an authored event id."),
			eventId: editorEntityId("event", {
				title: "Event",
				description: "The authored event id to check.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("scheduled-event").describe("Checks scheduled event runtime state."),
			operation: z
				.literal("tag-scheduled")
				.describe("Checks whether any scheduled event instance has a specific tag."),
			tag: editorInput({
				title: "Tag",
				description: "The scheduled event tag to check.",
				placeholder: "rats",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
		}),

		z.object({
			type: z.literal("scheduled-event").describe("Checks scheduled event runtime state."),
			operation: z
				.literal("tag-not-scheduled")
				.describe("Checks whether no scheduled event instance has a specific tag."),
			tag: editorInput({
				title: "Tag",
				description: "The scheduled event tag to check.",
				placeholder: "rats",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
		}),
	]),
	{
		title: "Scheduled Event Condition",
		description: docify(`
			Checks scheduled event runtime state.

			Use this to prevent duplicate scheduled events, branch if an event is pending,
			or detect whether delayed consequences are still active.

			Examples:
			- ratsArrive is scheduled
			- no event tagged rats is scheduled
			- appleRots instance is missing
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const TurnConditionSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("turn").describe("Checks the global turn count."),
			operation: z.literal("compare").describe("Compares the global turn count against a value."),
			operator: ComparisonOperatorSchema.describe(
				"The comparison operator used against the turn count.",
			),
			value: editorNonNegativeInteger({
				title: "Turn",
				description: "The turn count to compare against.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("turn").describe("Checks the global turn count."),
			operation: z
				.literal("multiple-of")
				.describe("Checks whether the current turn count is a multiple of a value."),
			value: editorPositiveInteger({
				title: "Multiple",
				description: "The divisor used to check the current turn count.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
		}),
	]),
	{
		title: "Turn Condition",
		description: docify(`
			Checks the global turn count.

			Use this for timed world logic, periodic behavior, or authored conditions that
			depend on how long the player has been playing.

			Examples:
			- Turn count is greater than 10
			- Every 5th turn
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const ResolvedTargetConditionSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z
				.literal("resolved-target")
				.describe("Checks resolved entities from the current parsed command."),
			operation: z
				.literal("object-is")
				.describe("Checks the resolved object/left-side target of the current command."),
			objectId: editorEntityId("object", {
				title: "Object",
				description: "The expected resolved object id.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z
				.literal("resolved-target")
				.describe("Checks resolved entities from the current parsed command."),
			operation: z
				.literal("target-is")
				.describe("Checks the resolved target/right-side target of the current command."),
			targetId: editorEntityId("object", {
				title: "Target",
				description: "The expected resolved target id.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z
				.literal("resolved-target")
				.describe("Checks resolved entities from the current parsed command."),
			operation: z
				.literal("connector-is")
				.describe("Checks the connector used by the current command."),
			connector: editorInput({
				title: "Connector",
				description: "The expected connector, such as on, in, with, to, under, or at.",
				placeholder: "on",
				required: true,
				layout: {
					width: "full",
					order: 1,
				},
			}).min(1),
		}),

		z.object({
			type: z
				.literal("resolved-target")
				.describe("Checks resolved entities from the current parsed command."),
			operation: z.literal("topic-is").describe("Checks the resolved topic from a speech command."),
			topicId: editorEntityId("topic", {
				title: "Topic",
				description: "The expected topic id.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z
				.literal("resolved-target")
				.describe("Checks resolved entities from the current parsed command."),
			operation: z
				.literal("direction-is")
				.describe("Checks the resolved direction from a movement-like command."),
			direction: editorDirection({
				title: "Direction",
				description: "The expected direction, such as n, north, up, or out.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),
	]),
	{
		title: "Resolved Target Condition",
		description: docify(`
			Checks resolved entities from the current command parse.

			Use this when an authored command pattern has an object, connector, target,
			topic, or direction and the rule needs to confirm what the parser resolved.

			Examples:
			- Current command object is apple
			- Current command target is table
			- Current command connector is on
			- Current speech topic is rats
			- Current direction is north
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const SingleConditionSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("type", [
		FlagConditionSchema,
		CounterConditionSchema,
		CurrentRoomConditionSchema,
		RoomHistoryConditionSchema,
		FeatureExaminedConditionSchema,
		InventoryConditionSchema,
		HasItemConditionSchema,
		ItemLocationConditionSchema,
		ObjectStateConditionSchema,
		NpcConditionSchema,
		CommandHistoryConditionSchema,
		RandomChanceConditionSchema,
		QuestConditionSchema,
		ScheduledEventConditionSchema,
		TurnConditionSchema,
		ResolvedTargetConditionSchema,
	]),
	{
		title: "Single Condition",
		description: docify(`
			A single condition expression.

			This is one concrete check, such as a flag value, current room, inventory item,
			item location, examined feature, object state, NPC state, command history,
			random chance, quest state, scheduled event state, turn count, or parsed target.
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export type SingleCondition = z.infer<typeof SingleConditionSchema>;

export type ConditionGroup = {
	type: "group";
	operator: "all" | "any" | "none";
	conditions: ConditionReference[];
};

export type ConditionReference = z.infer<typeof ConditionReferenceSchema>;

export type Condition = SingleCondition | ConditionGroup | ConditionReference;

export const WorldConditionSchema: z.ZodType<SingleCondition | ConditionGroup> = z.lazy(() =>
	editorCondition(
		z
			.union([
				z.intersection(SingleConditionSchema, ConditionIdentitySchema),

				editorObject(
					z.object({
						...ConditionIdentitySchema.shape,
						type: z.literal("group").describe("Groups multiple conditions together."),

						operator: editorSelect(z.enum(["all", "any", "none"]).default("all"), {
							title: "Group Operator",
							description: docify(`
							How this group evaluates its child conditions.

							all: every child condition must pass.
							any: at least one child condition must pass.
							none: no child conditions may pass.
						`),
							options: [
								{
									label: "All",
									value: "all",
									description: "Every child condition must pass.",
								},
								{
									label: "Any",
									value: "any",
									description: "At least one child condition must pass.",
								},
								{
									label: "None",
									value: "none",
									description: "No child conditions may pass.",
								},
							],
						}),

						conditions: z
							.array(ConditionReferenceSchema)
							.default([])
							.describe("Nested child condition references stored in the world condition library."),
					}),
					{
						title: "Condition Group",
						description: docify(`
						A nested condition group.

						Groups allow authors to build parenthesized logic like:
						- all of these are true
						- any of these are true
						- none of these are true

						Groups can contain other groups, so complex condition trees are possible.
					`),
						summary: {
							enabled: true,
							mode: "deterministic",
						},
					},
				),
			])
			.describe(
				docify(`
				A universal condition.

				This can be either a single condition or a nested condition group. Use this
				type anywhere authored logic needs to decide whether something should happen.

				Examples:
				- authored command conditions
				- authored command else branches
				- conditional effects
				- scheduled event requirements
				- scheduled event cancellation rules
				- description variants
				- visibility/takeability/usability rules
			`),
			),
		{
			title: "Condition",
			description: docify(`
				A universal condition.

				This can be either a single condition or a nested condition group. Use this
				type anywhere authored logic needs to decide whether something should happen.
			`),
			summary: {
				enabled: true,
				mode: "deterministic",
			},
		},
	),
);

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
	editorCondition(
		z.union([ConditionReferenceSchema, WorldConditionSchema]).describe(
			docify(`
				A universal condition.

				World condition definitions are stored in the world's conditions list.
				Every usage outside that list should store a condition reference.
			`),
		),
		{
			title: "Condition",
			description: docify(`
				A universal condition.

				Use world condition definitions in the condition library, and condition
				references anywhere authored logic needs to decide whether something should happen.
			`),
			summary: {
				enabled: true,
				mode: "deterministic",
			},
		},
	),
);

export const ConditionUsageSchema = ConditionReferenceSchema;

export const ConditionalTextSchema = editorObject(
	z.object({
		text: editorRichText({
			title: "Variant Text",
			description: "The text that will be used when all required conditions are met.",
			placeholder: "Describe the conditional text...",
			required: true,
			priority: {
				group: "text",
				order: 10,
				pinned: true,
				importance: "primary",
			},
			layout: {
				width: "full",
				order: 1,
				group: "text",
			},
		}).min(1),

		when: editorConditionList(ConditionUsageSchema, {
			title: "Conditions",
			description: "Conditions that must all be true before this text can be used.",
			priority: {
				group: "conditions",
				order: 20,
				importance: "primary",
			},
			disclosure: {
				collapsible: true,
				defaultCollapsed: false,
				preview: "summary",
			},
			layout: {
				width: "full",
				order: 2,
				group: "conditions",
			},
		}),
	}),
	{
		title: "Conditional Text",
		description: "Text that is only used when a set of conditions are met.",
		features: {
			layout: "section",
			groups: [
				{
					id: "text",
					title: "Variant Text",
					description: "Player-facing text for this alternate description.",
					order: 10,
				},
				{
					id: "conditions",
					title: "Conditions",
					description: "When this variant is allowed to replace the default description.",
					order: 20,
				},
			],
		},
		summary: {
			enabled: true,
			mode: "deterministic",
			summaryTemplate: "{text}",
			emptySummary: "No variant text yet",
		},
	},
);

export type ConditionalText = z.infer<typeof ConditionalTextSchema>;
