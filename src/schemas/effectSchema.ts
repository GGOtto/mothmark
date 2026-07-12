import {z} from "zod";
import {ConditionUsageSchema} from "./conditionSchema";
import {editor} from "@/schemas/editorSchemaHelpers";

const StateValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const EffectIdentitySchema = z.object({
	id: editor
		.id("effect", {
			title: "Effect ID",
			description: "Stable world-unique identifier used when reusing this effect.",
		})
		.optional(),
	name: editor
		.input({
			title: "Effect Name",
			description: "Display name shown in effect lists and reuse pickers.",
		})
		.optional(),
	allowMultipleUsesInWorld: editor
		.boolean({
			title: "Allow multiple uses in world",
			description: "When checked, this effect can be selected from other effect lists.",
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
		})
		.default(false),
});

export const EffectReferenceSchema = editor.object(
	{
		type: z.literal("effect-ref").describe("References an effect stored in the world."),
		effectId: editor.reference("effect", {
			title: "Effect",
			description: "The world effect this usage should run.",
			layout: {
				width: "full",
				order: 1,
			},
		}),
	},
	{
		title: "Effect Reference",
		description: "A usage of an effect stored in the world effect library.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const EffectTimingSchema = editor.discriminatedUnion(
	z.discriminatedUnion("type", [
		z.object({
			type: z
				.literal("immediate")
				.describe("Runs the scheduled effect or event as soon as it is processed."),
		}),

		z.object({
			type: z
				.literal("after-turns")
				.describe("Runs the scheduled effect or event after a number of player turns."),
			turns: editor.positiveInteger({
				title: "Turns",
				description: "The number of turns to wait before running the scheduled effect or event.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z
				.literal("at-turn")
				.describe(
					"Runs the scheduled effect or event when the global turn count reaches a specific value.",
				),
			turn: editor.nonNegativeInteger({
				title: "Turn",
				description: "The global turn count at which this scheduled effect or event should run.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z
				.literal("every-turns")
				.describe("Runs the scheduled effect or event repeatedly every set number of turns."),
			turns: editor.positiveInteger({
				title: "Every Turns",
				description: "How many turns should pass between each repeated run.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			limit: editor
				.positiveInteger({
					title: "Limit",
					description:
						"The maximum number of times this repeated effect or event may run. If omitted, it may repeat until cancelled.",
					layout: {
						width: "half",
						order: 2,
					},
				})
				.optional(),
		}),
	]),
	{
		title: "Effect Timing",
		description: "Defines when a scheduled effect or authored event should run.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export type EffectTiming = z.infer<typeof EffectTimingSchema>;

export const MessageEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("messageType", [
		z.object({
			type: z.literal("message").describe("Displays or modifies player-facing text."),
			messageType: z.literal("show").describe("Shows a specific message to the player."),
			text: editor
				.message({
					title: "Message",
					description: "The exact message text to show to the player.",
					placeholder: "You hear something moving in the walls.",
					required: true,
					layout: {
						width: "full",
						order: 1,
					},
				})
				.min(1),
		}),

		z.object({
			type: z.literal("message").describe("Displays or modifies player-facing text."),
			messageType: z
				.literal("random")
				.describe("Shows one random message from a list of possible options."),
			options: editor.stringList(
				{
					title: "Message Options",
					description: "The possible messages that may be randomly selected and shown to the player.",
					emptyState: {
						emptyTitle: "No messages",
						emptyDescription: "Add at least one possible message.",
						emptyActionLabel: "Add message",
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
			type: z.literal("message").describe("Displays or modifies player-facing text."),
			messageType: z
				.literal("append-room-description")
				.describe("Adds extra text to the current room description output."),
			text: editor
				.message({
					title: "Appended Text",
					description: "The text to append to the room description.",
					placeholder: "A thin trail of dust leads toward the cellar door.",
					required: true,
					layout: {
						width: "full",
						order: 1,
					},
				})
				.min(1),
		}),
	]),
	{
		title: "Message Effect",
		description: "An effect that outputs text or modifies descriptive text shown to the player.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const FlagEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("flag").describe("Changes a boolean world or game-state flag."),
			operation: z.literal("set").describe("Sets a flag to a specific boolean value."),
			flag: editor.flagKey({
				title: "Flag",
				description: "The unique flag key to update, such as kitchen.appleOnTable.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
			value: editor.boolean({
				title: "Value",
				description: "The boolean value to assign to the flag.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("flag").describe("Changes a boolean world or game-state flag."),
			operation: z
				.literal("toggle")
				.describe("Flips a flag from true to false, or from false to true."),
			flag: editor.flagKey({
				title: "Flag",
				description: "The unique flag key to toggle.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("flag").describe("Changes a boolean world or game-state flag."),
			operation: z.literal("clear").describe("Removes or resets a flag from the game state."),
			flag: editor.flagKey({
				title: "Flag",
				description: "The unique flag key to clear.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),
	]),
	{
		title: "Flag Effect",
		description:
			"An effect that changes boolean flags used by conditions, descriptions, commands, and events.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const CounterEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("counter").describe("Changes a numeric game-state counter."),
			operation: z.literal("set").describe("Sets a counter to a specific number."),
			counter: editor.counterKey({
				title: "Counter",
				description: "The unique counter key to update, such as library.timesVisited.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
			value: editor.number({
				title: "Value",
				description: "The exact numeric value to assign to the counter.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("counter").describe("Changes a numeric game-state counter."),
			operation: z.literal("increase").describe("Increases a counter by a specific amount."),
			counter: editor.counterKey({
				title: "Counter",
				description: "The unique counter key to increase.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
			amount: editor.number({
				title: "Amount",
				description: "The amount to add to the counter.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("counter").describe("Changes a numeric game-state counter."),
			operation: z.literal("decrease").describe("Decreases a counter by a specific amount."),
			counter: editor.counterKey({
				title: "Counter",
				description: "The unique counter key to decrease.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
			amount: editor.number({
				title: "Amount",
				description: "The amount to subtract from the counter.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("counter").describe("Changes a numeric game-state counter."),
			operation: z
				.literal("reset")
				.describe("Resets a counter back to its default value, usually zero."),
			counter: editor.counterKey({
				title: "Counter",
				description: "The unique counter key to reset.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("counter").describe("Changes a numeric game-state counter."),
			operation: z
				.literal("clamp")
				.describe("Restricts a counter so it stays between a minimum and maximum value."),
			counter: editor.counterKey({
				title: "Counter",
				description: "The unique counter key to clamp.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
			min: editor.number({
				title: "Minimum",
				description: "The minimum allowed value for the counter.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
			max: editor.number({
				title: "Maximum",
				description: "The maximum allowed value for the counter.",
				layout: {
					width: "half",
					order: 3,
				},
			}),
		}),
	]),
	{
		title: "Counter Effect",
		description:
			"An effect that changes numeric counters used by puzzles, repeated actions, timers, and conditions.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const InventoryEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("inventory").describe("Changes the player's inventory."),
			operation: z.literal("add").describe("Adds an item to the player's inventory."),
			itemId: editor.reference("item", {
				title: "Item",
				description: "The id of the item to add to the player's inventory.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("inventory").describe("Changes the player's inventory."),
			operation: z.literal("remove").describe("Removes an item from the player's inventory."),
			itemId: editor.reference("item", {
				title: "Item",
				description: "The id of the item to remove from the player's inventory.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("inventory").describe("Changes the player's inventory."),
			operation: z
				.literal("remove-all-with-tag")
				.describe("Removes every inventory item that has a specific tag."),
			tag: editor
				.input({
					title: "Tag",
					description: "The item tag used to decide which inventory items should be removed.",
					placeholder: "food",
					required: true,
					layout: {
						width: "full",
						order: 1,
					},
				})
				.min(1),
		}),

		z.object({
			type: z.literal("inventory").describe("Changes the player's inventory."),
			operation: z.literal("replace").describe("Replaces one inventory item with another."),
			fromItemId: editor.reference("item", {
				title: "From Item",
				description: "The id of the inventory item to remove.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			toItemId: editor.reference("item", {
				title: "To Item",
				description: "The id of the inventory item to add in its place.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),
	]),
	{
		title: "Inventory Effect",
		description: "An effect that adds, removes, or replaces items in the player's inventory.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const ItemLocationEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z.literal("move-to-room").describe("Moves an item to a specific room."),
			itemId: editor.reference("item", {
				title: "Item",
				description: "The id of the item to move.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			roomId: editor.reference("room", {
				title: "Room",
				description: "The id of the room where the item should be moved.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z
				.literal("move-to-current-room")
				.describe("Moves an item to the player's current room."),
			itemId: editor.reference("item", {
				title: "Item",
				description: "The id of the item to move into the current room.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z
				.literal("place-on-surface")
				.describe("Places an item on a surface, such as a table, shelf, desk, or altar."),
			itemId: editor.reference("item", {
				title: "Item",
				description: "The id of the item to place.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			surfaceId: editor.reference("surface", {
				title: "Surface",
				description: "The id of the surface where the item should be placed.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z
				.literal("place-in-container")
				.describe("Places an item inside a container, such as a box, chest, drawer, or bag."),
			itemId: editor.reference("item", {
				title: "Item",
				description: "The id of the item to place.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			containerId: editor.reference("container", {
				title: "Container",
				description: "The id of the container where the item should be placed.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z.literal("give-to-npc").describe("Moves an item into an NPC's possession."),
			itemId: editor.reference("item", {
				title: "Item",
				description: "The id of the item to give to the NPC.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			npcId: editor.reference("npc", {
				title: "NPC",
				description: "The id of the NPC who should receive the item.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z
				.literal("hide")
				.describe(
					"Hides an item so it is no longer discoverable or visible through normal interactions.",
				),
			itemId: editor.reference("item", {
				title: "Item",
				description: "The id of the item to hide.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z
				.literal("reveal")
				.describe("Reveals a hidden item so it can be discovered or interacted with again."),
			itemId: editor.reference("item", {
				title: "Item",
				description: "The id of the item to reveal.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z
				.literal("destroy")
				.describe("Removes an item from the game world permanently or semi-permanently."),
			itemId: editor.reference("item", {
				title: "Item",
				description: "The id of the item to destroy.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z.literal("create").describe("Creates or spawns an item into the game world."),
			itemId: editor.reference("item", {
				title: "Item",
				description: "The id of the item to create or spawn.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			locationId: editor
				.input({
					title: "Location ID",
					description:
						"The optional id of the room, surface, container, NPC, or other location where the item should appear.",
					placeholder: "kitchen",
					layout: {
						width: "half",
						order: 2,
					},
				})
				.min(1)
				.optional(),
		}),
	]),
	{
		title: "Item Location Effect",
		description: "An effect that moves, hides, reveals, creates, or destroys items in the world.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const ObjectStateEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z
				.literal("object-state")
				.describe("Changes the state of a world object, feature, container, surface, door, or item."),
			operation: editor.select(
				z.enum([
					"open",
					"close",
					"lock",
					"unlock",
					"light",
					"extinguish",
					"break",
					"repair",
					"clean",
					"dirty",
				]),
				{
					title: "Operation",
					description: "The state change to apply to the object.",
					options: [
						{label: "Open", value: "open"},
						{label: "Close", value: "close"},
						{label: "Lock", value: "lock"},
						{label: "Unlock", value: "unlock"},
						{label: "Light", value: "light"},
						{label: "Extinguish", value: "extinguish"},
						{label: "Break", value: "break"},
						{label: "Repair", value: "repair"},
						{label: "Clean", value: "clean"},
						{label: "Dirty", value: "dirty"},
					],
				},
			),
			objectId: editor.reference("object", {
				title: "Object",
				description: "The id of the object whose state should change.",
				layout: {
					width: "full",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z
				.literal("object-state")
				.describe("Changes the state of a world object, feature, container, surface, door, or item."),
			operation: z.literal("set-custom").describe("Sets a custom state key on an object."),
			objectId: editor.reference("object", {
				title: "Object",
				description: "The id of the object whose custom state should change.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
			key: editor
				.input({
					title: "Key",
					description: "The custom state key to set on the object.",
					placeholder: "freshness",
					required: true,
					layout: {
						width: "half",
						order: 2,
					},
				})
				.min(1),
			value: StateValueSchema.describe("The custom value to assign to the object's state key."),
		}),
	]),
	{
		title: "Object State Effect",
		description:
			"An effect that changes object state, such as opening, locking, breaking, lighting, or setting custom state values.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const RoomEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("room").describe("Changes room-level state or moves the player between rooms."),
			operation: z.literal("move-player").describe("Moves the player directly to a specific room."),
			roomId: editor.reference("room", {
				title: "Room",
				description: "The id of the room where the player should be moved.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("room").describe("Changes room-level state or moves the player between rooms."),
			operation: z
				.literal("set-description-variant")
				.describe("Forces or selects a specific description variant for a room."),
			roomId: editor.reference("room", {
				title: "Room",
				description: "The id of the room whose description variant should change.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			variantId: editor
				.input({
					title: "Variant ID",
					description: "The id of the description variant to activate or select.",
					placeholder: "after-rats-arrive",
					required: true,
					layout: {
						width: "half",
						order: 2,
					},
				})
				.min(1),
		}),

		z.object({
			type: z.literal("room").describe("Changes room-level state or moves the player between rooms."),
			operation: editor.select(z.enum(["reveal-exit", "hide-exit", "lock-exit", "unlock-exit"]), {
				title: "Exit Operation",
				description: "Changes whether an exit is visible or usable.",
				options: [
					{label: "Reveal Exit", value: "reveal-exit"},
					{label: "Hide Exit", value: "hide-exit"},
					{label: "Lock Exit", value: "lock-exit"},
					{label: "Unlock Exit", value: "unlock-exit"},
				],
			}),
			roomId: editor.reference("room", {
				title: "Room",
				description: "The id of the room containing the exit.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
			direction: editor.direction({
				title: "Direction",
				description: "The direction of the exit to modify, such as n, south, or up.",
				layout: {
					width: "half",
					order: 3,
				},
			}),
		}),

		z.object({
			type: z.literal("room").describe("Changes room-level state or moves the player between rooms."),
			operation: z.literal("add-tag").describe("Adds a tag to a room."),
			roomId: editor.reference("room", {
				title: "Room",
				description: "The id of the room that should receive the tag.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			tag: editor
				.input({
					title: "Tag",
					description: "The room tag to add.",
					placeholder: "dark",
					required: true,
					layout: {
						width: "half",
						order: 2,
					},
				})
				.min(1),
		}),

		z.object({
			type: z.literal("room").describe("Changes room-level state or moves the player between rooms."),
			operation: z.literal("remove-tag").describe("Removes a tag from a room."),
			roomId: editor.reference("room", {
				title: "Room",
				description: "The id of the room that should lose the tag.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			tag: editor
				.input({
					title: "Tag",
					description: "The room tag to remove.",
					placeholder: "dark",
					required: true,
					layout: {
						width: "half",
						order: 2,
					},
				})
				.min(1),
		}),
	]),
	{
		title: "Room Effect",
		description: "An effect that changes rooms, room descriptions, room tags, or room exits.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const NpcEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z
				.literal("npc")
				.describe("Changes an NPC's location, behavior, relationship, or dialogue state."),
			operation: z.literal("move-to-room").describe("Moves an NPC to a specific room."),
			npcId: editor.reference("npc", {
				title: "NPC",
				description: "The id of the NPC to move.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			roomId: editor.reference("room", {
				title: "Room",
				description: "The id of the room where the NPC should be moved.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z
				.literal("npc")
				.describe("Changes an NPC's location, behavior, relationship, or dialogue state."),
			operation: z
				.literal("move-to-current-room")
				.describe("Moves an NPC to the player's current room."),
			npcId: editor.reference("npc", {
				title: "NPC",
				description: "The id of the NPC to move into the current room.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z
				.literal("npc")
				.describe("Changes an NPC's location, behavior, relationship, or dialogue state."),
			operation: z.literal("remove").describe("Removes an NPC from the active game world."),
			npcId: editor.reference("npc", {
				title: "NPC",
				description: "The id of the NPC to remove.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z
				.literal("npc")
				.describe("Changes an NPC's location, behavior, relationship, or dialogue state."),
			operation: z.literal("set-mood").describe("Sets the NPC's current mood or emotional state."),
			npcId: editor.reference("npc", {
				title: "NPC",
				description: "The id of the NPC whose mood should change.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			mood: editor
				.input({
					title: "Mood",
					description: "The new mood value for the NPC, such as friendly, afraid, or angry.",
					placeholder: "friendly",
					required: true,
					layout: {
						width: "half",
						order: 2,
					},
				})
				.min(1),
		}),

		z.object({
			type: z
				.literal("npc")
				.describe("Changes an NPC's location, behavior, relationship, or dialogue state."),
			operation: z
				.literal("increase-trust")
				.describe("Increases an NPC's trust, affinity, or relationship score."),
			npcId: editor.reference("npc", {
				title: "NPC",
				description: "The id of the NPC whose trust should increase.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			amount: editor.number({
				title: "Amount",
				description: "The amount of trust to add.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z
				.literal("npc")
				.describe("Changes an NPC's location, behavior, relationship, or dialogue state."),
			operation: z
				.literal("decrease-trust")
				.describe("Decreases an NPC's trust, affinity, or relationship score."),
			npcId: editor.reference("npc", {
				title: "NPC",
				description: "The id of the NPC whose trust should decrease.",
				layout: {
					width: "half",
					order: 1,
				},
			}),
			amount: editor.number({
				title: "Amount",
				description: "The amount of trust to subtract.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z
				.literal("npc")
				.describe("Changes an NPC's location, behavior, relationship, or dialogue state."),
			operation: editor.select(
				z.enum(["make-hostile", "make-friendly", "start-dialogue", "end-dialogue"]),
				{
					title: "NPC Operation",
					description: "The NPC behavior or dialogue change to apply.",
					options: [
						{label: "Make Hostile", value: "make-hostile", tone: "danger"},
						{label: "Make Friendly", value: "make-friendly", tone: "success"},
						{label: "Start Dialogue", value: "start-dialogue"},
						{label: "End Dialogue", value: "end-dialogue"},
					],
				},
			),
			npcId: editor.reference("npc", {
				title: "NPC",
				description: "The id of the NPC to update.",
				layout: {
					width: "full",
					order: 2,
				},
			}),
		}),
	]),
	{
		title: "NPC Effect",
		description:
			"An effect that changes NPC placement, mood, trust, hostility, friendliness, or dialogue state.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const EventEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("event").describe("Schedules, cancels, delays, or repeats authored events."),
			operation: z
				.literal("schedule")
				.describe("Schedules an authored event to run at a later time or immediately."),
			eventId: editor.reference("event", {
				title: "Event",
				description: "The id of the authored event to schedule.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
			instanceId: editor
				.input({
					title: "Instance ID",
					description:
						"An optional unique id for this scheduled event instance. Use this when you may need to cancel or delay this exact instance later.",
					placeholder: "rats-arrive-instance",
					layout: {
						width: "full",
						order: 2,
					},
				})
				.min(1)
				.optional(),
			timing: EffectTimingSchema.describe("When the authored event should run."),
			cancelIf: editor.conditionList(ConditionUsageSchema, {
				title: "Cancel If",
				description: "Conditions that cancel this scheduled event instance before it runs.",
				layout: {
					width: "full",
					order: 4,
				},
			}),
			tags: editor.tagList("events", {
				title: "Tags",
				description: "Tags used to organize, find, or cancel groups of scheduled event instances.",
				layout: {
					width: "full",
					order: 5,
				},
			}),
		}),

		z.object({
			type: z.literal("event").describe("Schedules, cancels, delays, or repeats authored events."),
			operation: z
				.literal("cancel")
				.describe("Cancels one scheduled event instance by its instance id."),
			instanceId: editor
				.input({
					title: "Instance ID",
					description: "The unique id of the scheduled event instance to cancel.",
					placeholder: "rats-arrive-instance",
					required: true,
					layout: {
						width: "full",
						order: 1,
					},
				})
				.min(1),
		}),

		z.object({
			type: z.literal("event").describe("Schedules, cancels, delays, or repeats authored events."),
			operation: z
				.literal("cancel-by-event-id")
				.describe("Cancels all scheduled instances of a specific authored event."),
			eventId: editor.reference("event", {
				title: "Event",
				description: "The authored event id whose scheduled instances should be cancelled.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("event").describe("Schedules, cancels, delays, or repeats authored events."),
			operation: z
				.literal("cancel-with-tag")
				.describe("Cancels all scheduled event instances that have a specific tag."),
			tag: editor
				.input({
					title: "Tag",
					description: "The tag used to find scheduled event instances to cancel.",
					placeholder: "rats",
					required: true,
					layout: {
						width: "full",
						order: 1,
					},
				})
				.min(1),
		}),

		z.object({
			type: z.literal("event").describe("Schedules, cancels, delays, or repeats authored events."),
			operation: z
				.literal("delay")
				.describe("Pushes a scheduled event instance further into the future."),
			instanceId: editor
				.input({
					title: "Instance ID",
					description: "The unique id of the scheduled event instance to delay.",
					placeholder: "rats-arrive-instance",
					required: true,
					layout: {
						width: "half",
						order: 1,
					},
				})
				.min(1),
			turns: editor.positiveInteger({
				title: "Turns",
				description: "The number of additional turns to delay the scheduled event instance.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
		}),

		z.object({
			type: z.literal("event").describe("Schedules, cancels, delays, or repeats authored events."),
			operation: z
				.literal("repeat")
				.describe("Schedules an authored event to repeat every set number of turns."),
			eventId: editor.reference("event", {
				title: "Event",
				description: "The id of the authored event to repeat.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
			everyTurns: editor.positiveInteger({
				title: "Every Turns",
				description: "How many turns should pass between each repeated run.",
				layout: {
					width: "half",
					order: 2,
				},
			}),
			limit: editor
				.positiveInteger({
					title: "Limit",
					description:
						"The maximum number of times the event may repeat. If omitted, it repeats until cancelled.",
					layout: {
						width: "half",
						order: 3,
					},
				})
				.optional(),
			cancelIf: editor.conditionList(ConditionUsageSchema, {
				title: "Cancel If",
				description: "Conditions that cancel this repeating scheduled event.",
				layout: {
					width: "full",
					order: 4,
				},
			}),
			tags: editor.tagList("events", {
				title: "Tags",
				description: "Tags used to organize, find, or cancel this repeating scheduled event.",
				layout: {
					width: "full",
					order: 5,
				},
			}),
		}),
	]),
	{
		title: "Event Effect",
		description:
			"An effect that manages authored events, including scheduling, cancellation, delays, and repeating effects.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const FlowEffectSchema = editor.discriminatedUnion(
	z.discriminatedUnion("operation", [
		z.object({
			type: z.literal("flow").describe("Controls how command processing continues after effects run."),
			operation: z
				.literal("stop-processing")
				.describe(
					"Stops command processing after this effect. Usually used when an authored command fully handled the player's input.",
				),
		}),

		z.object({
			type: z.literal("flow").describe("Controls how command processing continues after effects run."),
			operation: z
				.literal("continue-processing")
				.describe("Allows command processing to continue after this effect."),
		}),

		z.object({
			type: z.literal("flow").describe("Controls how command processing continues after effects run."),
			operation: z
				.literal("run-generic-command-afterward")
				.describe("Runs the normal generic command parser after authored effects are applied."),
		}),

		z.object({
			type: z.literal("flow").describe("Controls how command processing continues after effects run."),
			operation: z
				.literal("prevent-turn-consumption")
				.describe("Prevents this command from consuming a turn."),
		}),

		z.object({
			type: z.literal("flow").describe("Controls how command processing continues after effects run."),
			operation: z
				.literal("consume-extra-turn")
				.describe("Consumes additional turns after this command resolves."),
			turns: editor
				.positiveInteger({
					title: "Turns",
					description: "The number of extra turns to consume.",
					layout: {
						width: "half",
						order: 1,
					},
				})
				.default(1),
		}),
	]),
	{
		title: "Flow Effect",
		description:
			"An effect that controls parser flow, generic fallback behavior, and turn consumption.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export type MessageEffect = z.infer<typeof MessageEffectSchema>;
export type FlagEffect = z.infer<typeof FlagEffectSchema>;
export type CounterEffect = z.infer<typeof CounterEffectSchema>;
export type InventoryEffect = z.infer<typeof InventoryEffectSchema>;
export type ItemLocationEffect = z.infer<typeof ItemLocationEffectSchema>;
export type ObjectStateEffect = z.infer<typeof ObjectStateEffectSchema>;
export type RoomEffect = z.infer<typeof RoomEffectSchema>;
export type NpcEffect = z.infer<typeof NpcEffectSchema>;
export type EventEffect = z.infer<typeof EventEffectSchema>;
export type FlowEffect = z.infer<typeof FlowEffectSchema>;

export type EffectGroup = {
	type: "group";
	id?: import("@/utils/idUtils").ID<"effect">;
	name?: string;
	allowMultipleUsesInWorld?: boolean;
	effects: EffectReference[];
};

export type ConditionalEffect = {
	type: "conditional";
	id?: import("@/utils/idUtils").ID<"effect">;
	name?: string;
	allowMultipleUsesInWorld?: boolean;
	when: z.infer<typeof ConditionUsageSchema>[];
	then: EffectReference[];
	otherwise: EffectReference[];
};

export type EffectReference = z.infer<typeof EffectReferenceSchema>;

export type Effect =
	| MessageEffect
	| FlagEffect
	| CounterEffect
	| InventoryEffect
	| ItemLocationEffect
	| ObjectStateEffect
	| RoomEffect
	| NpcEffect
	| EventEffect
	| FlowEffect
	| EffectGroup
	| ConditionalEffect
	| EffectReference;

const SingleEffectSchema = z.union([
	z.intersection(MessageEffectSchema, EffectIdentitySchema),
	z.intersection(FlagEffectSchema, EffectIdentitySchema),
	z.intersection(CounterEffectSchema, EffectIdentitySchema),
	z.intersection(InventoryEffectSchema, EffectIdentitySchema),
	z.intersection(ItemLocationEffectSchema, EffectIdentitySchema),
	z.intersection(ObjectStateEffectSchema, EffectIdentitySchema),
	z.intersection(RoomEffectSchema, EffectIdentitySchema),
	z.intersection(NpcEffectSchema, EffectIdentitySchema),
	z.intersection(EventEffectSchema, EffectIdentitySchema),
	z.intersection(FlowEffectSchema, EffectIdentitySchema),
]);

export const WorldEffectSchema: z.ZodType<Exclude<Effect, EffectReference>> = z.lazy(() =>
	editor.discriminatedUnion(
		z
			.union([
				SingleEffectSchema,

				editor.object(
					{
						...EffectIdentitySchema.shape,
						type: z.literal("group").describe("Runs multiple effects together as one effect."),
						effects: editor.effects(EffectReferenceSchema, {
							title: "Effects",
							description:
								"The effect references to run in order. Later effects can depend on state changed by earlier effects.",
							layout: {
								width: "full",
								order: 4,
							},
						}),
					},
					{
						title: "Effect Group",
						description: "An effect that groups multiple effects together and runs them in order.",
						duplicate: {
							duplicateBehavior: "with-new-id",
							idField: "id",
							idPrefix: "effect-group",
						},
						summary: {
							enabled: true,
							mode: "deterministic",
						},
					},
				),

				editor.object(
					{
						...EffectIdentitySchema.shape,
						type: z
							.literal("conditional")
							.describe("Runs different effects depending on whether conditions pass."),
						when: editor.conditionList(ConditionUsageSchema, {
							title: "When",
							description: "The conditions that must pass for the then effects to run.",
							layout: {
								width: "full",
								order: 1,
							},
						}),
						then: editor.effects(EffectReferenceSchema, {
							title: "Then",
							description: "The effect references to run when all conditions pass.",
							layout: {
								width: "full",
								order: 2,
							},
						}),
						otherwise: editor.effects(EffectReferenceSchema, {
							title: "Otherwise",
							description: "The effect references to run when the conditions do not pass.",
							layout: {
								width: "full",
								order: 3,
							},
						}),
					},
					{
						title: "Conditional Effect",
						description: "An effect that branches into different effects based on game-state conditions.",
						summary: {
							enabled: true,
							mode: "deterministic",
						},
					},
				),
			])
			.describe(
				"The universal effect type. Effects are used by authored commands, authored events, and scripted world interactions.",
			),
		{
			title: "Effect",
			description:
				"The universal effect type. Effects are used by authored commands, authored events, and scripted world interactions.",
			summary: {
				enabled: true,
				mode: "deterministic",
			},
		},
	),
);

export const EffectSchema: z.ZodType<Effect> = z.lazy(() =>
	editor.discriminatedUnion(
		z
			.union([EffectReferenceSchema, WorldEffectSchema])
			.describe(
				"World effect definitions are stored in the world's effects list. Every usage outside that list should store an effect reference.",
			),
		{
			title: "Effect",
			description:
				"Use world effect definitions in the effect library, and effect references anywhere authored logic needs to change state.",
			summary: {
				enabled: true,
				mode: "deterministic",
			},
		},
	),
);

export const EffectUsageSchema = EffectReferenceSchema;

export const AuthoredEventSchema = editor.object(
	{
		id: editor.id("event", {
			title: "Event ID",
			description:
				"The unique id of this authored event. Event effects reference this id when scheduling, repeating, or cancelling events.",
			required: true,
			layout: {
				width: "half",
				order: 1,
			},
		}),

		name: editor
			.input({
				title: "Name",
				description: "The human-readable name of this authored event for the editor.",
				placeholder: "Rats Arrive",
				required: true,
				layout: {
					width: "half",
					order: 2,
				},
			})
			.min(1),

		description: editor
			.textarea({
				title: "Description",
				description: "Editor-facing notes explaining what this event does and when it should be used.",
				placeholder: "Runs when the rats arrive after the player waits too long.",
				layout: {
					width: "full",
					order: 3,
				},
			})
			.default(""),

		conditions: editor.conditionList(ConditionUsageSchema, {
			title: "Conditions",
			description:
				"Conditions that must pass when this event tries to run. If these fail, the event does not apply its effects.",
			layout: {
				width: "full",
				order: 4,
			},
		}),

		cancelIf: editor.conditionList(ConditionUsageSchema, {
			title: "Cancel If",
			description:
				"Conditions that cancel this event before it runs. Use this for delayed events that should become invalid if the world changes.",
			layout: {
				width: "full",
				order: 5,
			},
		}),

		effects: editor.effects(EffectUsageSchema, {
			title: "Effects",
			description: "The effects this authored event runs when triggered.",
			layout: {
				width: "full",
				order: 6,
			},
		}),

		tags: editor.tagList("events", {
			title: "Tags",
			description:
				"Tags used to organize this event in the editor or cancel scheduled instances by group.",
			layout: {
				width: "full",
				order: 7,
			},
		}),

		once: editor
			.boolean({
				title: "Run Once",
				description: "Whether this event should only be allowed to run once per playthrough.",
				layout: {
					width: "half",
					order: 8,
				},
			})
			.default(false),
	},
	{
		title: "Authored Event",
		description:
			"A reusable authored event that can be scheduled, delayed, repeated, or cancelled by effects.",
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			idPrefix: "event",
		},
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export type AuthoredEvent = z.infer<typeof AuthoredEventSchema>;

export const ScheduledEventInstanceSchema = editor.object(
	{
		id: editor.id("event-instance", {
			title: "Instance ID",
			description: "The unique runtime id for this scheduled event instance.",
			required: true,
			layout: {
				width: "half",
				order: 1,
			},
		}),

		eventId: editor.reference("event", {
			title: "Event",
			description: "The authored event id this scheduled instance will run.",
			layout: {
				width: "half",
				order: 2,
			},
		}),

		createdAtTurn: editor.nonNegativeInteger({
			title: "Created At Turn",
			description: "The global turn count when this event instance was scheduled.",
			layout: {
				width: "half",
				order: 3,
			},
		}),

		triggerAtTurn: editor
			.nonNegativeInteger({
				title: "Trigger At Turn",
				description: "The global turn count when this event instance should run.",
				layout: {
					width: "half",
					order: 4,
				},
			})
			.optional(),

		remainingTurns: editor
			.nonNegativeInteger({
				title: "Remaining Turns",
				description:
					"The number of turns remaining before this event instance should run. Useful for countdown-style scheduling.",
				layout: {
					width: "half",
					order: 5,
				},
			})
			.optional(),

		repeatEveryTurns: editor
			.positiveInteger({
				title: "Repeat Every Turns",
				description: "How often this scheduled event instance should repeat, measured in turns.",
				layout: {
					width: "half",
					order: 6,
				},
			})
			.optional(),

		repeatLimit: editor
			.positiveInteger({
				title: "Repeat Limit",
				description: "The maximum number of times this scheduled event instance may repeat.",
				layout: {
					width: "half",
					order: 7,
				},
			})
			.optional(),

		repeatCount: editor
			.nonNegativeInteger({
				title: "Repeat Count",
				description: "How many times this scheduled event instance has already repeated.",
				layout: {
					width: "half",
					order: 8,
				},
			})
			.default(0),

		cancelIf: editor.conditionList(ConditionUsageSchema, {
			title: "Cancel If",
			description:
				"Runtime cancellation conditions checked before this scheduled event instance runs.",
			layout: {
				width: "full",
				order: 9,
			},
		}),

		tags: editor.tagList("events", {
			title: "Tags",
			description: "Runtime tags used to find, organize, delay, or cancel scheduled event instances.",
			layout: {
				width: "full",
				order: 10,
			},
		}),
	},
	{
		title: "Scheduled Event Instance",
		description:
			"A runtime scheduled event instance stored in game state, created from an authored event.",
		readonly: true,
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export type ScheduledEventInstance = z.infer<typeof ScheduledEventInstanceSchema>;
