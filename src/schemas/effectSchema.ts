import {z} from "zod";
import {ConditionSchema} from "./conditionSchema";

export const EffectTimingSchema = z
	.discriminatedUnion("type", [
		z.object({
			type: z
				.literal("immediate")
				.describe("Runs the scheduled effect or event as soon as it is processed."),
		}),

		z.object({
			type: z
				.literal("after-turns")
				.describe("Runs the scheduled effect or event after a number of player turns."),
			turns: z
				.number()
				.int()
				.positive()
				.describe("The number of turns to wait before running the scheduled effect or event."),
		}),

		z.object({
			type: z
				.literal("at-turn")
				.describe(
					"Runs the scheduled effect or event when the global turn count reaches a specific value.",
				),
			turn: z
				.number()
				.int()
				.nonnegative()
				.describe("The global turn count at which this scheduled effect or event should run."),
		}),

		z.object({
			type: z
				.literal("every-turns")
				.describe("Runs the scheduled effect or event repeatedly every set number of turns."),
			turns: z
				.number()
				.int()
				.positive()
				.describe("How many turns should pass between each repeated run."),
			limit: z
				.number()
				.int()
				.positive()
				.optional()
				.describe(
					"The maximum number of times this repeated effect or event may run. If omitted, it may repeat until cancelled.",
				),
		}),
	])
	.describe("Defines when a scheduled effect or authored event should run.");

export type EffectTiming = z.infer<typeof EffectTimingSchema>;

export const MessageEffectSchema = z
	.discriminatedUnion("messageType", [
		z.object({
			type: z.literal("message").describe("Displays or modifies player-facing text."),
			messageType: z.literal("show").describe("Shows a specific message to the player."),
			text: z.string().min(1).describe("The exact message text to show to the player."),
		}),

		z.object({
			type: z.literal("message").describe("Displays or modifies player-facing text."),
			messageType: z
				.literal("random")
				.describe("Shows one random message from a list of possible options."),
			options: z
				.array(z.string().min(1))
				.min(1)
				.describe("The possible messages that may be randomly selected and shown to the player."),
		}),

		z.object({
			type: z.literal("message").describe("Displays or modifies player-facing text."),
			messageType: z
				.literal("append-room-description")
				.describe("Adds extra text to the current room description output."),
			text: z.string().min(1).describe("The text to append to the room description."),
		}),
	])
	.describe("An effect that outputs text or modifies descriptive text shown to the player.");

export const FlagEffectSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z.literal("flag").describe("Changes a boolean world or game-state flag."),
			operation: z.literal("set").describe("Sets a flag to a specific boolean value."),
			flag: z
				.string()
				.min(1)
				.describe("The unique flag key to update, such as 'kitchen.appleOnTable'."),
			value: z.boolean().describe("The boolean value to assign to the flag."),
		}),

		z.object({
			type: z.literal("flag").describe("Changes a boolean world or game-state flag."),
			operation: z
				.literal("toggle")
				.describe("Flips a flag from true to false, or from false to true."),
			flag: z.string().min(1).describe("The unique flag key to toggle."),
		}),

		z.object({
			type: z.literal("flag").describe("Changes a boolean world or game-state flag."),
			operation: z.literal("clear").describe("Removes or resets a flag from the game state."),
			flag: z.string().min(1).describe("The unique flag key to clear."),
		}),
	])
	.describe(
		"An effect that changes boolean flags used by conditions, descriptions, commands, and events.",
	);

export const CounterEffectSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z.literal("counter").describe("Changes a numeric game-state counter."),
			operation: z.literal("set").describe("Sets a counter to a specific number."),
			counter: z
				.string()
				.min(1)
				.describe("The unique counter key to update, such as 'library.timesVisited'."),
			value: z.number().describe("The exact numeric value to assign to the counter."),
		}),

		z.object({
			type: z.literal("counter").describe("Changes a numeric game-state counter."),
			operation: z.literal("increase").describe("Increases a counter by a specific amount."),
			counter: z.string().min(1).describe("The unique counter key to increase."),
			amount: z.number().describe("The amount to add to the counter."),
		}),

		z.object({
			type: z.literal("counter").describe("Changes a numeric game-state counter."),
			operation: z.literal("decrease").describe("Decreases a counter by a specific amount."),
			counter: z.string().min(1).describe("The unique counter key to decrease."),
			amount: z.number().describe("The amount to subtract from the counter."),
		}),

		z.object({
			type: z.literal("counter").describe("Changes a numeric game-state counter."),
			operation: z
				.literal("reset")
				.describe("Resets a counter back to its default value, usually zero."),
			counter: z.string().min(1).describe("The unique counter key to reset."),
		}),

		z.object({
			type: z.literal("counter").describe("Changes a numeric game-state counter."),
			operation: z
				.literal("clamp")
				.describe("Restricts a counter so it stays between a minimum and maximum value."),
			counter: z.string().min(1).describe("The unique counter key to clamp."),
			min: z.number().describe("The minimum allowed value for the counter."),
			max: z.number().describe("The maximum allowed value for the counter."),
		}),
	])
	.describe(
		"An effect that changes numeric counters used by puzzles, repeated actions, timers, and conditions.",
	);

export const InventoryEffectSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z.literal("inventory").describe("Changes the player's inventory."),
			operation: z.literal("add").describe("Adds an item to the player's inventory."),
			itemId: z.string().min(1).describe("The id of the item to add to the player's inventory."),
		}),

		z.object({
			type: z.literal("inventory").describe("Changes the player's inventory."),
			operation: z.literal("remove").describe("Removes an item from the player's inventory."),
			itemId: z.string().min(1).describe("The id of the item to remove from the player's inventory."),
		}),

		z.object({
			type: z.literal("inventory").describe("Changes the player's inventory."),
			operation: z
				.literal("remove-all-with-tag")
				.describe("Removes every inventory item that has a specific tag."),
			tag: z
				.string()
				.min(1)
				.describe("The item tag used to decide which inventory items should be removed."),
		}),

		z.object({
			type: z.literal("inventory").describe("Changes the player's inventory."),
			operation: z.literal("replace").describe("Replaces one inventory item with another."),
			fromItemId: z.string().min(1).describe("The id of the inventory item to remove."),
			toItemId: z.string().min(1).describe("The id of the inventory item to add in its place."),
		}),
	])
	.describe("An effect that adds, removes, or replaces items in the player's inventory.");

export const ItemLocationEffectSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z.literal("move-to-room").describe("Moves an item to a specific room."),
			itemId: z.string().min(1).describe("The id of the item to move."),
			roomId: z.string().min(1).describe("The id of the room where the item should be moved."),
		}),

		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z
				.literal("move-to-current-room")
				.describe("Moves an item to the player's current room."),
			itemId: z.string().min(1).describe("The id of the item to move into the current room."),
		}),

		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z
				.literal("place-on-surface")
				.describe("Places an item on a surface, such as a table, shelf, desk, or altar."),
			itemId: z.string().min(1).describe("The id of the item to place."),
			surfaceId: z.string().min(1).describe("The id of the surface where the item should be placed."),
		}),

		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z
				.literal("place-in-container")
				.describe("Places an item inside a container, such as a box, chest, drawer, or bag."),
			itemId: z.string().min(1).describe("The id of the item to place."),
			containerId: z
				.string()
				.min(1)
				.describe("The id of the container where the item should be placed."),
		}),

		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z.literal("give-to-npc").describe("Moves an item into an NPC's possession."),
			itemId: z.string().min(1).describe("The id of the item to give to the NPC."),
			npcId: z.string().min(1).describe("The id of the NPC who should receive the item."),
		}),

		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z
				.literal("hide")
				.describe(
					"Hides an item so it is no longer discoverable or visible through normal interactions.",
				),
			itemId: z.string().min(1).describe("The id of the item to hide."),
		}),

		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z
				.literal("reveal")
				.describe("Reveals a hidden item so it can be discovered or interacted with again."),
			itemId: z.string().min(1).describe("The id of the item to reveal."),
		}),

		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z
				.literal("destroy")
				.describe("Removes an item from the game world permanently or semi-permanently."),
			itemId: z.string().min(1).describe("The id of the item to destroy."),
		}),

		z.object({
			type: z.literal("item-location").describe("Changes where an item exists in the world."),
			operation: z.literal("create").describe("Creates or spawns an item into the game world."),
			itemId: z.string().min(1).describe("The id of the item to create or spawn."),
			locationId: z
				.string()
				.min(1)
				.optional()
				.describe(
					"The optional id of the room, surface, container, NPC, or other location where the item should appear.",
				),
		}),
	])
	.describe("An effect that moves, hides, reveals, creates, or destroys items in the world.");

export const ObjectStateEffectSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z
				.literal("object-state")
				.describe("Changes the state of a world object, feature, container, surface, door, or item."),
			operation: z
				.enum([
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
				])
				.describe("The state change to apply to the object."),
			objectId: z.string().min(1).describe("The id of the object whose state should change."),
		}),

		z.object({
			type: z
				.literal("object-state")
				.describe("Changes the state of a world object, feature, container, surface, door, or item."),
			operation: z.literal("set-custom").describe("Sets a custom state key on an object."),
			objectId: z.string().min(1).describe("The id of the object whose custom state should change."),
			key: z.string().min(1).describe("The custom state key to set on the object."),
			value: z
				.union([z.string(), z.number(), z.boolean(), z.null()])
				.describe("The custom value to assign to the object's state key."),
		}),
	])
	.describe(
		"An effect that changes object state, such as opening, locking, breaking, lighting, or setting custom state values.",
	);

export const RoomEffectSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z.literal("room").describe("Changes room-level state or moves the player between rooms."),
			operation: z.literal("move-player").describe("Moves the player directly to a specific room."),
			roomId: z.string().min(1).describe("The id of the room where the player should be moved."),
		}),

		z.object({
			type: z.literal("room").describe("Changes room-level state or moves the player between rooms."),
			operation: z
				.literal("set-description-variant")
				.describe("Forces or selects a specific description variant for a room."),
			roomId: z
				.string()
				.min(1)
				.describe("The id of the room whose description variant should change."),
			variantId: z
				.string()
				.min(1)
				.describe("The id of the description variant to activate or select."),
		}),

		z.object({
			type: z.literal("room").describe("Changes room-level state or moves the player between rooms."),
			operation: z
				.enum(["reveal-exit", "hide-exit", "lock-exit", "unlock-exit"])
				.describe("Changes whether an exit is visible or usable."),
			roomId: z.string().min(1).describe("The id of the room containing the exit."),
			direction: z
				.string()
				.min(1)
				.describe("The direction of the exit to modify, such as 'n', 'south', or 'up'."),
		}),

		z.object({
			type: z.literal("room").describe("Changes room-level state or moves the player between rooms."),
			operation: z.literal("add-tag").describe("Adds a tag to a room."),
			roomId: z.string().min(1).describe("The id of the room that should receive the tag."),
			tag: z.string().min(1).describe("The room tag to add."),
		}),

		z.object({
			type: z.literal("room").describe("Changes room-level state or moves the player between rooms."),
			operation: z.literal("remove-tag").describe("Removes a tag from a room."),
			roomId: z.string().min(1).describe("The id of the room that should lose the tag."),
			tag: z.string().min(1).describe("The room tag to remove."),
		}),
	])
	.describe("An effect that changes rooms, room descriptions, room tags, or room exits.");

export const NpcEffectSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z
				.literal("npc")
				.describe("Changes an NPC's location, behavior, relationship, or dialogue state."),
			operation: z.literal("move-to-room").describe("Moves an NPC to a specific room."),
			npcId: z.string().min(1).describe("The id of the NPC to move."),
			roomId: z.string().min(1).describe("The id of the room where the NPC should be moved."),
		}),

		z.object({
			type: z
				.literal("npc")
				.describe("Changes an NPC's location, behavior, relationship, or dialogue state."),
			operation: z
				.literal("move-to-current-room")
				.describe("Moves an NPC to the player's current room."),
			npcId: z.string().min(1).describe("The id of the NPC to move into the current room."),
		}),

		z.object({
			type: z
				.literal("npc")
				.describe("Changes an NPC's location, behavior, relationship, or dialogue state."),
			operation: z.literal("remove").describe("Removes an NPC from the active game world."),
			npcId: z.string().min(1).describe("The id of the NPC to remove."),
		}),

		z.object({
			type: z
				.literal("npc")
				.describe("Changes an NPC's location, behavior, relationship, or dialogue state."),
			operation: z.literal("set-mood").describe("Sets the NPC's current mood or emotional state."),
			npcId: z.string().min(1).describe("The id of the NPC whose mood should change."),
			mood: z
				.string()
				.min(1)
				.describe("The new mood value for the NPC, such as 'friendly', 'afraid', or 'angry'."),
		}),

		z.object({
			type: z
				.literal("npc")
				.describe("Changes an NPC's location, behavior, relationship, or dialogue state."),
			operation: z
				.literal("increase-trust")
				.describe("Increases an NPC's trust, affinity, or relationship score."),
			npcId: z.string().min(1).describe("The id of the NPC whose trust should increase."),
			amount: z.number().describe("The amount of trust to add."),
		}),

		z.object({
			type: z
				.literal("npc")
				.describe("Changes an NPC's location, behavior, relationship, or dialogue state."),
			operation: z
				.literal("decrease-trust")
				.describe("Decreases an NPC's trust, affinity, or relationship score."),
			npcId: z.string().min(1).describe("The id of the NPC whose trust should decrease."),
			amount: z.number().describe("The amount of trust to subtract."),
		}),

		z.object({
			type: z
				.literal("npc")
				.describe("Changes an NPC's location, behavior, relationship, or dialogue state."),
			operation: z
				.enum(["make-hostile", "make-friendly", "start-dialogue", "end-dialogue"])
				.describe("The NPC behavior or dialogue change to apply."),
			npcId: z.string().min(1).describe("The id of the NPC to update."),
		}),
	])
	.describe(
		"An effect that changes NPC placement, mood, trust, hostility, friendliness, or dialogue state.",
	);

export const EventEffectSchema = z
	.discriminatedUnion("operation", [
		z.object({
			type: z.literal("event").describe("Schedules, cancels, delays, or repeats authored events."),
			operation: z
				.literal("schedule")
				.describe("Schedules an authored event to run at a later time or immediately."),
			eventId: z.string().min(1).describe("The id of the authored event to schedule."),
			instanceId: z
				.string()
				.min(1)
				.optional()
				.describe(
					"An optional unique id for this scheduled event instance. Use this when you may need to cancel or delay this exact instance later.",
				),
			timing: EffectTimingSchema.describe("When the authored event should run."),
			cancelIf: z
				.array(ConditionSchema)
				.default([])
				.describe("Conditions that cancel this scheduled event instance before it runs."),
			tags: z
				.array(z.string().min(1))
				.default([])
				.describe("Tags used to organize, find, or cancel groups of scheduled event instances."),
		}),

		z.object({
			type: z.literal("event").describe("Schedules, cancels, delays, or repeats authored events."),
			operation: z
				.literal("cancel")
				.describe("Cancels one scheduled event instance by its instance id."),
			instanceId: z
				.string()
				.min(1)
				.describe("The unique id of the scheduled event instance to cancel."),
		}),

		z.object({
			type: z.literal("event").describe("Schedules, cancels, delays, or repeats authored events."),
			operation: z
				.literal("cancel-by-event-id")
				.describe("Cancels all scheduled instances of a specific authored event."),
			eventId: z
				.string()
				.min(1)
				.describe("The authored event id whose scheduled instances should be cancelled."),
		}),

		z.object({
			type: z.literal("event").describe("Schedules, cancels, delays, or repeats authored events."),
			operation: z
				.literal("cancel-with-tag")
				.describe("Cancels all scheduled event instances that have a specific tag."),
			tag: z.string().min(1).describe("The tag used to find scheduled event instances to cancel."),
		}),

		z.object({
			type: z.literal("event").describe("Schedules, cancels, delays, or repeats authored events."),
			operation: z
				.literal("delay")
				.describe("Pushes a scheduled event instance further into the future."),
			instanceId: z
				.string()
				.min(1)
				.describe("The unique id of the scheduled event instance to delay."),
			turns: z
				.number()
				.int()
				.positive()
				.describe("The number of additional turns to delay the scheduled event instance."),
		}),

		z.object({
			type: z.literal("event").describe("Schedules, cancels, delays, or repeats authored events."),
			operation: z
				.literal("repeat")
				.describe("Schedules an authored event to repeat every set number of turns."),
			eventId: z.string().min(1).describe("The id of the authored event to repeat."),
			everyTurns: z
				.number()
				.int()
				.positive()
				.describe("How many turns should pass between each repeated run."),
			limit: z
				.number()
				.int()
				.positive()
				.optional()
				.describe(
					"The maximum number of times the event may repeat. If omitted, it repeats until cancelled.",
				),
			cancelIf: z
				.array(ConditionSchema)
				.default([])
				.describe("Conditions that cancel this repeating scheduled event."),
			tags: z
				.array(z.string().min(1))
				.default([])
				.describe("Tags used to organize, find, or cancel this repeating scheduled event."),
		}),
	])
	.describe(
		"An effect that manages authored events, including scheduling, cancellation, delays, and repeating effects.",
	);

export const FlowEffectSchema = z
	.discriminatedUnion("operation", [
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
			turns: z.number().int().positive().default(1).describe("The number of extra turns to consume."),
		}),
	])
	.describe("An effect that controls parser flow, generic fallback behavior, and turn consumption.");

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
	id?: string;
	effects: Effect[];
};

export type ConditionalEffect = {
	type: "conditional";
	when: z.infer<typeof ConditionSchema>[];
	then: Effect[];
	otherwise: Effect[];
};

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
	| ConditionalEffect;

export const EffectSchema: z.ZodType<Effect> = z.lazy(() =>
	z
		.discriminatedUnion("type", [
			MessageEffectSchema,
			FlagEffectSchema,
			CounterEffectSchema,
			InventoryEffectSchema,
			ItemLocationEffectSchema,
			ObjectStateEffectSchema,
			RoomEffectSchema,
			NpcEffectSchema,
			EventEffectSchema,
			FlowEffectSchema,

			z
				.object({
					type: z.literal("group").describe("Runs multiple effects together as one effect."),
					id: z
						.string()
						.min(1)
						.optional()
						.describe(
							"An optional id for this effect group. Useful for editor labels, debugging, or reusable authored structures.",
						),
					effects: z
						.array(EffectSchema)
						.default([])
						.describe(
							"The effects to run in order. Later effects can depend on state changed by earlier effects.",
						),
				})
				.describe("An effect that groups multiple effects together and runs them in order."),

			z
				.object({
					type: z
						.literal("conditional")
						.describe("Runs different effects depending on whether conditions pass."),
					when: z
						.array(ConditionSchema)
						.default([])
						.describe("The conditions that must pass for the 'then' effects to run."),
					then: z
						.array(EffectSchema)
						.default([])
						.describe("The effects to run when all conditions pass."),
					otherwise: z
						.array(EffectSchema)
						.default([])
						.describe("The effects to run when the conditions do not pass."),
				})
				.describe("An effect that branches into different effects based on game-state conditions."),
		])
		.describe(
			"The universal effect type. Effects are used by authored commands, authored events, and scripted world interactions.",
		),
);

export const AuthoredEventSchema = z
	.object({
		id: z
			.string()
			.min(1)
			.describe(
				"The unique id of this authored event. Event effects reference this id when scheduling, repeating, or cancelling events.",
			),
		name: z
			.string()
			.min(1)
			.describe("The human-readable name of this authored event for the editor."),
		description: z
			.string()
			.default("")
			.describe("Editor-facing notes explaining what this event does and when it should be used."),

		conditions: z
			.array(ConditionSchema)
			.default([])
			.describe(
				"Conditions that must pass when this event tries to run. If these fail, the event does not apply its effects.",
			),
		cancelIf: z
			.array(ConditionSchema)
			.default([])
			.describe(
				"Conditions that cancel this event before it runs. Use this for delayed events that should become invalid if the world changes.",
			),
		effects: z
			.array(EffectSchema)
			.default([])
			.describe("The effects this authored event runs when triggered."),

		tags: z
			.array(z.string().min(1))
			.default([])
			.describe(
				"Tags used to organize this event in the editor or cancel scheduled instances by group.",
			),
		once: z
			.boolean()
			.default(false)
			.describe("Whether this event should only be allowed to run once per playthrough."),
	})
	.describe(
		"A reusable authored event that can be scheduled, delayed, repeated, or cancelled by effects.",
	);

export type AuthoredEvent = z.infer<typeof AuthoredEventSchema>;

export const ScheduledEventInstanceSchema = z
	.object({
		id: z.string().min(1).describe("The unique runtime id for this scheduled event instance."),
		eventId: z.string().min(1).describe("The authored event id this scheduled instance will run."),

		createdAtTurn: z
			.number()
			.int()
			.nonnegative()
			.describe("The global turn count when this event instance was scheduled."),
		triggerAtTurn: z
			.number()
			.int()
			.nonnegative()
			.optional()
			.describe("The global turn count when this event instance should run."),
		remainingTurns: z
			.number()
			.int()
			.nonnegative()
			.optional()
			.describe(
				"The number of turns remaining before this event instance should run. Useful for countdown-style scheduling.",
			),

		repeatEveryTurns: z
			.number()
			.int()
			.positive()
			.optional()
			.describe("How often this scheduled event instance should repeat, measured in turns."),
		repeatLimit: z
			.number()
			.int()
			.positive()
			.optional()
			.describe("The maximum number of times this scheduled event instance may repeat."),
		repeatCount: z
			.number()
			.int()
			.nonnegative()
			.default(0)
			.describe("How many times this scheduled event instance has already repeated."),

		cancelIf: z
			.array(ConditionSchema)
			.default([])
			.describe("Runtime cancellation conditions checked before this scheduled event instance runs."),
		tags: z
			.array(z.string().min(1))
			.default([])
			.describe("Runtime tags used to find, organize, delay, or cancel scheduled event instances."),
	})
	.describe(
		"A runtime scheduled event instance stored in game state, created from an authored event.",
	);

export type ScheduledEventInstance = z.infer<typeof ScheduledEventInstanceSchema>;
