import {z} from "zod";
import {docify} from "../utils/docify";

export const ComparisonOperatorSchema = z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]).describe(
	docify(`
			A numeric or comparable-value operator.

			eq: equals
			neq: does not equal
			gt: greater than
			gte: greater than or equal to
			lt: less than
			lte: less than or equal to
		`),
);

export const StringComparisonOperatorSchema = z
	.enum(["eq", "neq", "includes", "starts-with", "ends-with"])
	.describe(
		docify(`
			A string comparison operator.

			eq: exactly equals the value.
			neq: does not equal the value.
			includes: contains the value somewhere inside the string.
			starts-with: begins with the value.
			ends-with: ends with the value.
		`),
	);

export const FlagConditionSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z.literal("flag").describe("Checks a boolean world flag."),
			operation: z
				.literal("equals")
				.describe("Checks whether a flag equals a specific boolean value."),
			flag: z.string().min(1).describe("The id of the flag to check, such as kitchen.appleOnTable."),
			value: z
				.boolean()
				.default(true)
				.describe("The required boolean value for the flag. Defaults to true."),
		}),

		z.object({
			type: z.literal("flag").describe("Checks a boolean world flag."),
			operation: z
				.literal("exists")
				.describe("Checks whether the flag exists in game state, regardless of its value."),
			flag: z.string().min(1).describe("The id of the flag to check."),
		}),

		z.object({
			type: z.literal("flag").describe("Checks a boolean world flag."),
			operation: z
				.literal("missing")
				.describe("Checks whether the flag does not exist in game state."),
			flag: z.string().min(1).describe("The id of the flag to check."),
		}),
	])
	.describe(
		docify(`
			Checks boolean world flags.

			Use flags for simple true/false world state, puzzle state, story state,
			or any custom boolean value an author wants to track.

			Examples:
			- kitchen.applePlacedOnTable is true
			- rats.haveArrived is false
			- guard.hasSeenPlayer exists
			- mirror.hasBeenBroken does not exist
		`),
	);

export const CounterConditionSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z.literal("counter").describe("Checks a numeric counter."),
			operation: z.literal("compare").describe("Compares a counter against one numeric value."),
			counter: z
				.string()
				.min(1)
				.describe("The id of the counter to check, such as rats.turnsUntilArrival."),
			operator: ComparisonOperatorSchema.describe(
				"The comparison operator used to compare the counter against the target value.",
			),
			value: z.number().describe("The numeric value to compare the counter against."),
		}),

		z.object({
			type: z.literal("counter").describe("Checks a numeric counter."),
			operation: z
				.literal("between")
				.describe("Checks whether a counter is between two values, inclusive by default."),
			counter: z.string().min(1).describe("The id of the counter to check."),
			min: z.number().describe("The lower bound for the counter."),
			max: z.number().describe("The upper bound for the counter."),
			inclusive: z
				.boolean()
				.default(true)
				.describe("If true, the min and max values count as passing values."),
		}),

		z.object({
			type: z.literal("counter").describe("Checks a numeric counter."),
			operation: z.literal("exists").describe("Checks whether a counter exists in game state."),
			counter: z.string().min(1).describe("The id of the counter to check."),
		}),

		z.object({
			type: z.literal("counter").describe("Checks a numeric counter."),
			operation: z
				.literal("missing")
				.describe("Checks whether a counter does not exist in game state."),
			counter: z.string().min(1).describe("The id of the counter to check."),
		}),
	])
	.describe(
		docify(`
			Checks numeric world counters.

			Use counters for quantities, progress, timers, repeated actions, puzzle steps,
			suspicion, trust, noise, or anything that needs more than true/false state.

			Examples:
			- guard.suspicion greater than 50
			- door.knocks equals 3
			- ratsFedCount is between 2 and 5
		`),
	);

export const CurrentRoomConditionSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z.literal("current-room").describe("Checks the player's current room."),
			operation: z
				.literal("is")
				.describe("Checks whether the player is currently in a specific room."),
			roomId: z.string().min(1).describe("The room id to compare against."),
		}),

		z.object({
			type: z.literal("current-room").describe("Checks the player's current room."),
			operation: z
				.literal("is-not")
				.describe("Checks whether the player is not currently in a specific room."),
			roomId: z.string().min(1).describe("The room id to compare against."),
		}),

		z.object({
			type: z.literal("current-room").describe("Checks the player's current room."),
			operation: z.literal("has-tag").describe("Checks whether the current room has a specific tag."),
			tag: z.string().min(1).describe("The room tag to check for."),
		}),

		z.object({
			type: z.literal("current-room").describe("Checks the player's current room."),
			operation: z
				.literal("missing-tag")
				.describe("Checks whether the current room does not have a specific tag."),
			tag: z.string().min(1).describe("The room tag to check for."),
		}),
	])
	.describe(
		docify(`
			Checks the player's current room or tags on the current room.

			Examples:
			- Player is in kitchen
			- Player is not in cellar
			- Current room has tag outdoors
		`),
	);

export const RoomHistoryConditionSchema = z
	.object({
		type: z.literal("room-history").describe("Checks whether a room has been visited or viewed."),
		roomId: z.string().min(1).describe("The room id to check."),
		history: z.enum(["visited", "viewed"]).describe("The kind of room history to check."),
		value: z.boolean().default(true).describe("The required history state. Defaults to true."),
	})
	.describe(
		docify(`
			Checks room history.

			Use visited when the player has entered the room.
			Use viewed when the room description has been shown or discovered.

			Examples:
			- Kitchen has been visited
			- Cellar has not been viewed
		`),
	);

export const FeatureExaminedConditionSchema = z
	.object({
		type: z.literal("feature-examined").describe("Checks whether a room feature has been examined."),
		roomId: z.string().min(1).describe("The id of the room containing the feature."),
		featureId: z.string().min(1).describe("The id of the feature to check."),
		value: z.boolean().default(true).describe("The required examined state. Defaults to true."),
	})
	.describe(
		docify(`
			Checks whether a specific feature in a specific room has been examined.

			Examples:
			- Kitchen table has been examined
			- Mirror has not been examined
		`),
	);

export const InventoryConditionSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z.literal("inventory").describe("Checks the player's inventory."),
			operation: z.literal("has-item").describe("Checks whether the player has a specific item."),
			itemId: z.string().min(1).describe("The item id to check for."),
		}),

		z.object({
			type: z.literal("inventory").describe("Checks the player's inventory."),
			operation: z
				.literal("missing-item")
				.describe("Checks whether the player does not have a specific item."),
			itemId: z.string().min(1).describe("The item id to check for."),
		}),

		z.object({
			type: z.literal("inventory").describe("Checks the player's inventory."),
			operation: z
				.literal("has-all-items")
				.describe("Checks whether the player has every listed item."),
			itemIds: z.array(z.string().min(1)).min(1).describe("The item ids the player must all have."),
		}),

		z.object({
			type: z.literal("inventory").describe("Checks the player's inventory."),
			operation: z
				.literal("has-any-item")
				.describe("Checks whether the player has at least one listed item."),
			itemIds: z
				.array(z.string().min(1))
				.min(1)
				.describe("The item ids where at least one must be in inventory."),
		}),

		z.object({
			type: z.literal("inventory").describe("Checks the player's inventory."),
			operation: z
				.literal("contains-tag")
				.describe("Checks whether the player's inventory contains any item with a specific tag."),
			tag: z.string().min(1).describe("The item tag to check for."),
		}),

		z.object({
			type: z.literal("inventory").describe("Checks the player's inventory."),
			operation: z
				.literal("missing-tag")
				.describe("Checks whether the player's inventory contains no item with a specific tag."),
			tag: z.string().min(1).describe("The item tag to check for."),
		}),

		z.object({
			type: z.literal("inventory").describe("Checks the player's inventory."),
			operation: z
				.literal("count")
				.describe("Compares the number of items in the player's inventory."),
			operator: ComparisonOperatorSchema.describe(
				"The comparison operator used against the inventory count.",
			),
			value: z.number().int().nonnegative().describe("The inventory count to compare against."),
		}),

		z.object({
			type: z.literal("inventory").describe("Checks the player's inventory."),
			operation: z
				.literal("tag-count")
				.describe("Compares the number of inventory items with a specific tag."),
			tag: z.string().min(1).describe("The item tag to count."),
			operator: ComparisonOperatorSchema.describe(
				"The comparison operator used against the tagged inventory count.",
			),
			value: z.number().int().nonnegative().describe("The tagged item count to compare against."),
		}),
	])
	.describe(
		docify(`
			Checks the player's inventory.

			Examples:
			- Player has apple
			- Player does not have lantern
			- Player has all required keys
			- Player has any item tagged food
			- Player inventory count equals 3
		`),
	);

export const HasItemConditionSchema = z
	.object({
		type: z.literal("has-item").describe("Checks the player's inventory."),
		itemId: z.string().min(1).describe("The item id to check for."),
		negate: z
			.boolean()
			.default(false)
			.describe("If true, this condition passes when the player does not have the item."),
	})
	.describe(
		docify(`
			Legacy shorthand for checking whether the player has an item.

			Prefer InventoryConditionSchema for new authored commands, especially when
			checking multiple items, tags, or inventory counts.
		`),
	);

export const ItemLocationConditionSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z
				.literal("in-inventory")
				.describe("Checks whether an item is in the player's inventory."),
			itemId: z.string().min(1).describe("The item id to check."),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z
				.literal("in-current-room")
				.describe("Checks whether an item is in the player's current room."),
			itemId: z.string().min(1).describe("The item id to check."),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z.literal("in-room").describe("Checks whether an item is in a specific room."),
			itemId: z.string().min(1).describe("The item id to check."),
			roomId: z.string().min(1).describe("The room id to check against."),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z.literal("on-surface").describe("Checks whether an item is on a specific surface."),
			itemId: z.string().min(1).describe("The item id to check."),
			surfaceId: z.string().min(1).describe("The surface id to check against."),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z
				.literal("in-container")
				.describe("Checks whether an item is inside a specific container."),
			itemId: z.string().min(1).describe("The item id to check."),
			containerId: z.string().min(1).describe("The container id to check against."),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z
				.literal("held-by-npc")
				.describe("Checks whether an item is held by a specific NPC."),
			itemId: z.string().min(1).describe("The item id to check."),
			npcId: z.string().min(1).describe("The NPC id to check against."),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z.literal("hidden").describe("Checks whether an item is hidden."),
			itemId: z.string().min(1).describe("The item id to check."),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z.literal("destroyed").describe("Checks whether an item has been destroyed."),
			itemId: z.string().min(1).describe("The item id to check."),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z
				.literal("visible")
				.describe("Checks whether an item is currently visible to the player."),
			itemId: z.string().min(1).describe("The item id to check."),
		}),

		z.object({
			type: z.literal("item-location").describe("Checks where an item exists in the world."),
			operation: z
				.literal("reachable")
				.describe("Checks whether an item is currently reachable by the player."),
			itemId: z.string().min(1).describe("The item id to check."),
		}),
	])
	.describe(
		docify(`
			Checks where an item is located or whether the player can see/reach it.

			Examples:
			- Apple is on table
			- Key is inside drawer
			- Lantern is in inventory
			- Apple is visible to player
			- Coin is reachable by player
		`),
	);

export const ObjectStateConditionSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z
				.literal("object-state")
				.describe("Checks the state of an object, feature, item, door, surface, or container."),
			operation: z
				.enum([
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
				])
				.describe("The built-in object state to check."),
			objectId: z.string().min(1).describe("The object id to check."),
		}),

		z.object({
			type: z
				.literal("object-state")
				.describe("Checks the state of an object, feature, item, door, surface, or container."),
			operation: z
				.literal("contains-item")
				.describe("Checks whether an object or container contains a specific item."),
			objectId: z.string().min(1).describe("The object or container id to check."),
			itemId: z.string().min(1).describe("The item id that should be contained."),
		}),

		z.object({
			type: z
				.literal("object-state")
				.describe("Checks the state of an object, feature, item, door, surface, or container."),
			operation: z
				.literal("missing-item")
				.describe("Checks whether an object or container does not contain a specific item."),
			objectId: z.string().min(1).describe("The object or container id to check."),
			itemId: z.string().min(1).describe("The item id that should not be contained."),
		}),

		z.object({
			type: z
				.literal("object-state")
				.describe("Checks the state of an object, feature, item, door, surface, or container."),
			operation: z
				.literal("surface-has-item")
				.describe("Checks whether a surface has a specific item on it."),
			surfaceId: z.string().min(1).describe("The surface id to check."),
			itemId: z.string().min(1).describe("The item id that should be on the surface."),
		}),

		z.object({
			type: z
				.literal("object-state")
				.describe("Checks the state of an object, feature, item, door, surface, or container."),
			operation: z
				.literal("surface-missing-item")
				.describe("Checks whether a surface does not have a specific item on it."),
			surfaceId: z.string().min(1).describe("The surface id to check."),
			itemId: z.string().min(1).describe("The item id that should not be on the surface."),
		}),

		z.object({
			type: z
				.literal("object-state")
				.describe("Checks the state of an object, feature, item, door, surface, or container."),
			operation: z
				.literal("empty")
				.describe("Checks whether a container, surface, or object has no contained/placed items."),
			objectId: z.string().min(1).describe("The object id to check."),
		}),

		z.object({
			type: z
				.literal("object-state")
				.describe("Checks the state of an object, feature, item, door, surface, or container."),
			operation: z.literal("custom").describe("Checks a custom object state value."),
			objectId: z.string().min(1).describe("The object id to check."),
			key: z.string().min(1).describe("The custom state key to check."),
			operator: z
				.union([StringComparisonOperatorSchema, ComparisonOperatorSchema])
				.describe("The comparison operator to use against the custom value."),
			value: z
				.union([z.string(), z.number(), z.boolean(), z.null()])
				.describe("The custom state value to compare against."),
		}),
	])
	.describe(
		docify(`
			Checks object, feature, item, door, surface, or container state.

			Examples:
			- Door is locked
			- Lantern is lit
			- Mirror is broken
			- Table has apple
			- Chest contains brass key
			- Cabinet is empty
		`),
	);

export const NpcConditionSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z.literal("npc").describe("Checks NPC state."),
			operation: z
				.literal("in-current-room")
				.describe("Checks whether an NPC is in the player's current room."),
			npcId: z.string().min(1).describe("The NPC id to check."),
		}),

		z.object({
			type: z.literal("npc").describe("Checks NPC state."),
			operation: z.literal("in-room").describe("Checks whether an NPC is in a specific room."),
			npcId: z.string().min(1).describe("The NPC id to check."),
			roomId: z.string().min(1).describe("The room id to check against."),
		}),

		z.object({
			type: z.literal("npc").describe("Checks NPC state."),
			operation: z.literal("has-item").describe("Checks whether an NPC has a specific item."),
			npcId: z.string().min(1).describe("The NPC id to check."),
			itemId: z.string().min(1).describe("The item id to check for."),
		}),

		z.object({
			type: z.literal("npc").describe("Checks NPC state."),
			operation: z.literal("mood-is").describe("Checks whether an NPC has a specific mood."),
			npcId: z.string().min(1).describe("The NPC id to check."),
			mood: z.string().min(1).describe("The required NPC mood."),
		}),

		z.object({
			type: z.literal("npc").describe("Checks NPC state."),
			operation: z.literal("trust").describe("Compares an NPC trust value against a number."),
			npcId: z.string().min(1).describe("The NPC id to check."),
			operator: ComparisonOperatorSchema.describe(
				"The comparison operator used against the NPC trust value.",
			),
			value: z.number().describe("The trust value to compare against."),
		}),

		z.object({
			type: z.literal("npc").describe("Checks NPC state."),
			operation: z
				.enum([
					"met-player",
					"not-met-player",
					"hostile",
					"friendly",
					"asleep",
					"awake",
					"can-see-player",
					"cannot-see-player",
				])
				.describe("The built-in NPC state to check."),
			npcId: z.string().min(1).describe("The NPC id to check."),
		}),
	])
	.describe(
		docify(`
			Checks NPC location, inventory, mood, trust, relationship, awareness, and behavior.

			Examples:
			- Cook is in kitchen
			- Guard trust is greater than 20
			- Rat King is hostile
			- Guard can see player
			- Cook has apple
		`),
	);

export const CommandHistoryConditionSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z.literal("command-history").describe("Checks recent player command history."),
			operation: z
				.literal("previous-command-was")
				.describe("Checks whether the immediately previous command matched a command name."),
			commandName: z
				.string()
				.min(1)
				.describe("The command name to check, such as examine, sing, knock, or say."),
		}),

		z.object({
			type: z.literal("command-history").describe("Checks recent player command history."),
			operation: z
				.literal("previous-raw-command-was")
				.describe("Checks whether the immediately previous raw command text matches a value."),
			operator: StringComparisonOperatorSchema.default("eq").describe(
				"How to compare the raw command text.",
			),
			value: z.string().min(1).describe("The raw command text to compare against."),
		}),

		z.object({
			type: z.literal("command-history").describe("Checks recent player command history."),
			operation: z
				.literal("previous-target-was")
				.describe(
					"Checks whether the previous command targeted a specific object, item, NPC, feature, topic, or room.",
				),
			targetId: z.string().min(1).describe("The resolved target id to check."),
		}),

		z.object({
			type: z.literal("command-history").describe("Checks recent player command history."),
			operation: z
				.literal("used-command-before")
				.describe("Checks whether the player has ever used a specific command before."),
			commandName: z.string().min(1).describe("The command name to check."),
		}),

		z.object({
			type: z.literal("command-history").describe("Checks recent player command history."),
			operation: z
				.literal("never-used-command")
				.describe("Checks whether the player has never used a specific command."),
			commandName: z.string().min(1).describe("The command name to check."),
		}),

		z.object({
			type: z.literal("command-history").describe("Checks recent player command history."),
			operation: z
				.literal("used-command-within-turns")
				.describe("Checks whether the player used a command within the last N turns."),
			commandName: z.string().min(1).describe("The command name to check."),
			turns: z.number().int().positive().describe("How many turns back to search."),
		}),

		z.object({
			type: z.literal("command-history").describe("Checks recent player command history."),
			operation: z
				.literal("repeated-command")
				.describe("Checks whether the player repeated a command a specific number of times."),
			commandName: z.string().min(1).describe("The command name to check."),
			count: z
				.number()
				.int()
				.positive()
				.describe("How many times the command must have been repeated."),
			consecutive: z
				.boolean()
				.default(true)
				.describe("If true, the repeated commands must be consecutive."),
		}),

		z.object({
			type: z.literal("command-history").describe("Checks recent player command history."),
			operation: z
				.literal("sequence")
				.describe("Checks whether the player performed a sequence of command names in order."),
			commands: z
				.array(z.string().min(1))
				.min(1)
				.describe("The ordered command names that must appear in recent command history."),
			withinTurns: z
				.number()
				.int()
				.positive()
				.optional()
				.describe("Optional maximum number of recent turns to search for the sequence."),
		}),
	])
	.describe(
		docify(`
			Checks recent command history.

			Use this for rituals, repeated actions, contextual responses, and logic based
			on what the player just did.

			Examples:
			- Previous command was examine mirror
			- Player said password within last 3 turns
			- Player knocked on door 3 times
			- Player performed light candle, ring bell, speak name in order
		`),
	);

export const RandomChanceConditionSchema = z
	.object({
		type: z.literal("random-chance").describe("Checks whether a random chance succeeds."),
		chance: z
			.number()
			.min(0)
			.max(1)
			.describe("The chance to succeed, from 0 to 1. For example, 0.25 means 25%."),
		seedKey: z
			.string()
			.min(1)
			.optional()
			.describe(
				"Optional key used by seeded random systems to make this chance deterministic across saves.",
			),
		invert: z
			.boolean()
			.default(false)
			.describe("If true, this condition passes when the random chance fails."),
	})
	.describe(
		docify(`
			Checks random chance.

			Use sparingly for authored logic where uncertainty is desirable.

			Examples:
			- 25% chance rats appear
			- 50% chance guard hears player

			If the engine later supports seeded saves, seedKey can make chance checks
			reproducible instead of purely random.
		`),
	);

export const QuestConditionSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z.literal("quest").describe("Checks quest state."),
			operation: z
				.enum(["not-started", "active", "completed", "failed"])
				.describe("The quest status to check."),
			questId: z.string().min(1).describe("The quest id to check."),
		}),

		z.object({
			type: z.literal("quest").describe("Checks quest state."),
			operation: z
				.literal("objective-complete")
				.describe("Checks whether a quest objective is complete."),
			questId: z.string().min(1).describe("The quest id to check."),
			objectiveId: z.string().min(1).describe("The objective id to check."),
		}),

		z.object({
			type: z.literal("quest").describe("Checks quest state."),
			operation: z
				.literal("objective-incomplete")
				.describe("Checks whether a quest objective is incomplete."),
			questId: z.string().min(1).describe("The quest id to check."),
			objectiveId: z.string().min(1).describe("The objective id to check."),
		}),
	])
	.describe(
		docify(`
			Checks quest and objective state.

			Examples:
			- Quest Find the Lantern is active
			- Quest Find the Lantern is completed
			- Objective Bring apple to cook is complete
		`),
	);

export const ScheduledEventConditionSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z.literal("scheduled-event").describe("Checks scheduled event runtime state."),
			operation: z.literal("exists").describe("Checks whether an event instance exists."),
			instanceId: z.string().min(1).describe("The scheduled event instance id to check."),
		}),

		z.object({
			type: z.literal("scheduled-event").describe("Checks scheduled event runtime state."),
			operation: z.literal("missing").describe("Checks whether an event instance does not exist."),
			instanceId: z.string().min(1).describe("The scheduled event instance id to check."),
		}),

		z.object({
			type: z.literal("scheduled-event").describe("Checks scheduled event runtime state."),
			operation: z
				.literal("event-scheduled")
				.describe("Checks whether any scheduled instance exists for an authored event id."),
			eventId: z.string().min(1).describe("The authored event id to check."),
		}),

		z.object({
			type: z.literal("scheduled-event").describe("Checks scheduled event runtime state."),
			operation: z
				.literal("event-not-scheduled")
				.describe("Checks whether no scheduled instance exists for an authored event id."),
			eventId: z.string().min(1).describe("The authored event id to check."),
		}),

		z.object({
			type: z.literal("scheduled-event").describe("Checks scheduled event runtime state."),
			operation: z
				.literal("tag-scheduled")
				.describe("Checks whether any scheduled event instance has a specific tag."),
			tag: z.string().min(1).describe("The scheduled event tag to check."),
		}),

		z.object({
			type: z.literal("scheduled-event").describe("Checks scheduled event runtime state."),
			operation: z
				.literal("tag-not-scheduled")
				.describe("Checks whether no scheduled event instance has a specific tag."),
			tag: z.string().min(1).describe("The scheduled event tag to check."),
		}),
	])
	.describe(
		docify(`
			Checks scheduled event runtime state.

			Use this to prevent duplicate scheduled events, branch if an event is pending,
			or detect whether delayed consequences are still active.

			Examples:
			- ratsArrive is scheduled
			- no event tagged rats is scheduled
			- appleRots instance is missing
		`),
	);

export const TurnConditionSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z.literal("turn").describe("Checks the global turn count."),
			operation: z.literal("compare").describe("Compares the global turn count against a value."),
			operator: ComparisonOperatorSchema.describe(
				"The comparison operator used against the turn count.",
			),
			value: z.number().int().nonnegative().describe("The turn count to compare against."),
		}),

		z.object({
			type: z.literal("turn").describe("Checks the global turn count."),
			operation: z
				.literal("multiple-of")
				.describe("Checks whether the current turn count is a multiple of a value."),
			value: z.number().int().positive().describe("The divisor used to check the current turn count."),
		}),
	])
	.describe(
		docify(`
			Checks the global turn count.

			Use this for timed world logic, periodic behavior, or authored conditions that
			depend on how long the player has been playing.

			Examples:
			- Turn count is greater than 10
			- Every 5th turn
		`),
	);

export const ResolvedTargetConditionSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z
				.literal("resolved-target")
				.describe("Checks resolved entities from the current parsed command."),
			operation: z
				.literal("object-is")
				.describe("Checks the resolved object/left-side target of the current command."),
			objectId: z.string().min(1).describe("The expected resolved object id."),
		}),

		z.object({
			type: z
				.literal("resolved-target")
				.describe("Checks resolved entities from the current parsed command."),
			operation: z
				.literal("target-is")
				.describe("Checks the resolved target/right-side target of the current command."),
			targetId: z.string().min(1).describe("The expected resolved target id."),
		}),

		z.object({
			type: z
				.literal("resolved-target")
				.describe("Checks resolved entities from the current parsed command."),
			operation: z
				.literal("connector-is")
				.describe("Checks the connector used by the current command."),
			connector: z
				.string()
				.min(1)
				.describe("The expected connector, such as on, in, with, to, under, or at."),
		}),

		z.object({
			type: z
				.literal("resolved-target")
				.describe("Checks resolved entities from the current parsed command."),
			operation: z.literal("topic-is").describe("Checks the resolved topic from a speech command."),
			topicId: z.string().min(1).describe("The expected topic id."),
		}),

		z.object({
			type: z
				.literal("resolved-target")
				.describe("Checks resolved entities from the current parsed command."),
			operation: z
				.literal("direction-is")
				.describe("Checks the resolved direction from a movement-like command."),
			direction: z.string().min(1).describe("The expected direction, such as n, north, up, or out."),
		}),
	])
	.describe(
		docify(`
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
	);

export const SingleConditionSchema = z
	.discriminatedUnion("type", [
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
	])
	.describe(
		docify(`
			A single condition expression.

			This is one concrete check, such as a flag value, current room, inventory item,
			item location, examined feature, object state, NPC state, command history,
			random chance, quest state, scheduled event state, turn count, or parsed target.
		`),
	);

export type SingleCondition = z.infer<typeof SingleConditionSchema>;

export type ConditionGroup = {
	type: "group";
	operator: "all" | "any" | "none";
	conditions: Condition[];
};

export type Condition = SingleCondition | ConditionGroup;

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
	z
		.union([
			SingleConditionSchema,

			z
				.object({
					type: z.literal("group").describe("Groups multiple conditions together."),
					operator: z
						.enum(["all", "any", "none"])
						.default("all")
						.describe(
							docify(`
								How this group evaluates its child conditions.

								all: every child condition must pass.
								any: at least one child condition must pass.
								none: no child conditions may pass.
							`),
						),
					conditions: z
						.array(ConditionSchema)
						.default([])
						.describe("Nested child conditions. These can be single conditions or more groups."),
				})
				.describe(
					docify(`
						A nested condition group.

						Groups allow authors to build parenthesized logic like:
						- all of these are true
						- any of these are true
						- none of these are true

						Groups can contain other groups, so complex condition trees are possible.
					`),
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
);
