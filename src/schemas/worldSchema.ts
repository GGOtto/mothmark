import {z} from "zod";
import {ConditionSchema} from "./conditionSchema";
import {AuthorCommandSchema} from "./authoredCommandSchema";
import {AuthoredEventSchema} from "./effectSchema";
import {docify} from "../utils/docify";

export const IdSchema = z
	.string()
	.min(1)
	.describe("A stable unique id used by schemas, conditions, effects, and editor references.");

export const AliasListSchema = z
	.array(z.string().min(1))
	.default([])
	.describe("Alternative names the player can use to refer to this entity.");

export const TagListSchema = z
	.array(z.string().min(1))
	.default([])
	.describe("Tags used for grouping, filtering, command scopes, and condition/effect targeting.");

export const StateValueSchema = z
	.union([z.string(), z.number(), z.boolean(), z.null()])
	.describe("A simple serializable state value.");

export const ConditionalTextSchema = z
	.object({
		text: z
			.string()
			.min(1)
			.describe("The text that will be used when all required conditions are met."),
		when: z
			.array(ConditionSchema)
			.default([])
			.describe("Conditions that must all be true before this text can be used."),
	})
	.describe("Text that is only used when a set of conditions are met.");

export const DirectionSchema = z
	.enum(["n", "ne", "e", "se", "s", "sw", "w", "nw", "up", "down", "in", "out"])
	.describe(
		docify(`
			A direction used for room exits and return exits.

			Compass directions are useful for map-style worlds.
			Vertical and contextual directions support movement like up, down, in, and out.
		`),
	);

export const PathwaySchema = z
	.enum(["no-way", "two-way", "forwards", "backwards"])
	.default("two-way")
	.describe("Controls whether travel is allowed through a connection, and in which direction.");

export const PointSchema = z
	.object({
		x: z.number().describe("The horizontal position of the point."),
		y: z.number().describe("The vertical position of the point."),
	})
	.describe("A two-dimensional position used by the editor layout.");

export const DescriptionSchema = z
	.object({
		default: z
			.string()
			.default("")
			.describe("The description that will be displayed if no other conditions are met."),
		variants: z
			.array(ConditionalTextSchema)
			.default([])
			.describe("Description variants that can replace the description if conditions are met."),
	})
	.describe("A default description with optional conditional variants.");

export const EntityVisibilitySchema = z
	.object({
		visibleWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The entity is only visible when all of these conditions pass."),
		hiddenWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The entity is hidden when any of these conditions pass."),
	})
	.describe(
		docify(`
			Shared visibility rules for rooms, items, features, NPCs, topics, and exits.

			Use visibleWhen for unlockable/discoverable content.
			Use hiddenWhen for content that disappears after state changes.
		`),
	);

export const DefaultEntityVisibility = {
	visibleWhen: [],
	hiddenWhen: [],
} satisfies z.infer<typeof EntityVisibilitySchema>;

export const InteractionRuleSchema = z
	.object({
		allowedWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The interaction is allowed only when all of these conditions pass."),
		blockedWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The interaction is blocked when any of these conditions pass."),
		failureMessage: z
			.string()
			.default("")
			.describe("Optional message shown when this interaction is blocked."),
	})
	.describe("Reusable rules for whether an interaction is currently allowed.");

export const DefaultInteractionRule = {
	allowedWhen: [],
	blockedWhen: [],
	failureMessage: "",
} satisfies z.infer<typeof InteractionRuleSchema>;

export const ObjectStateDefaultsSchema = z
	.object({
		open: z
			.boolean()
			.optional()
			.describe("Initial open state for an object, door, feature, or container."),
		locked: z
			.boolean()
			.optional()
			.describe("Initial locked state for an object, door, feature, or container."),
		lit: z.boolean().optional().describe("Initial lit state for an object, item, or feature."),
		broken: z.boolean().optional().describe("Initial broken state for an object, item, or feature."),
		clean: z
			.boolean()
			.optional()
			.describe("Initial clean state for an object, item, surface, or feature."),
		custom: z
			.record(z.string(), StateValueSchema)
			.default({})
			.describe("Custom object state values, such as freshness, fuel, sealed, sticky, or charged."),
	})
	.describe(
		docify(`
			Initial built-in and custom object state.

			These values seed gameState.objectStates and can be checked by object-state
			conditions or changed by object-state effects.
		`),
	);

export const DefaultObjectStateDefaults = {
	custom: {},
} satisfies z.infer<typeof ObjectStateDefaultsSchema>;

export const ItemLocationSchema = z
	.discriminatedUnion("type", [
		z.object({
			type: z.literal("inventory").describe("The item starts in the player's inventory."),
		}),

		z.object({
			type: z.literal("room").describe("The item starts loose in a room."),
			roomId: IdSchema.describe("The room where the item starts."),
		}),

		z.object({
			type: z.literal("container").describe("The item starts inside a container."),
			containerId: IdSchema.describe("The container where the item starts."),
		}),

		z.object({
			type: z.literal("surface").describe("The item starts on a surface."),
			surfaceId: IdSchema.describe("The surface where the item starts."),
		}),

		z.object({
			type: z.literal("npc").describe("The item starts held by an NPC."),
			npcId: IdSchema.describe("The NPC who starts with the item."),
		}),

		z.object({
			type: z.literal("hidden").describe("The item starts hidden from normal discovery."),
			locationId: IdSchema.optional().describe(
				"Optional room, object, surface, container, or NPC associated with the hidden item.",
			),
		}),

		z.object({
			type: z.literal("destroyed").describe("The item starts destroyed or unavailable."),
		}),
	])
	.describe(
		docify(`
			Where an item starts before game state changes.

			Effects can later move items between inventory, rooms, containers, surfaces,
			NPCs, hidden state, and destroyed state.
		`),
	);

export const ItemSchema = z
	.object({
		id: IdSchema.describe("The unique id used to identify this item."),
		name: z.string().min(1).describe("The display name of the item."),
		aliases: AliasListSchema.describe("Alternative names the player can use for this item."),
		tags: TagListSchema.describe(
			"Tags used to group this item, such as food, key, tool, weapon, or quest-item.",
		),

		description: DescriptionSchema.describe(
			"The description shown when the player examines this item.",
		),

		initialLocation: ItemLocationSchema.default({type: "hidden"}).describe(
			"Where this item starts in the world.",
		),

		portable: z.boolean().default(true).describe("Whether the player can normally take this item."),
		visibleWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The item is visible only when all of these conditions pass."),
		takeableWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The item can be taken only when all of these conditions pass."),
		usableWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The item can be used only when all of these conditions pass."),

		takeRule: InteractionRuleSchema.default(DefaultInteractionRule).describe(
			"Optional detailed rule for taking this item.",
		),
		useRule: InteractionRuleSchema.default(DefaultInteractionRule).describe(
			"Optional detailed rule for using this item.",
		),

		state: ObjectStateDefaultsSchema.default(DefaultObjectStateDefaults).describe(
			"Initial object state for this item.",
		),
	})
	.describe(
		docify(`
			A portable or world-placed item.

			Items can be in inventory, rooms, containers, surfaces, held by NPCs,
			hidden, or destroyed. Authored commands, conditions, and effects refer
			to items by id.
		`),
	);

export const RoomFeatureKindSchema = z
	.enum(["feature", "container", "surface", "door", "exit", "decoration", "hazard"])
	.default("feature")
	.describe(
		docify(`
			The kind of room feature.

			feature:
			A normal interactable object that cannot be picked up.

			container:
			Can contain items, such as a chest, cabinet, drawer, box, or bag.

			surface:
			Can have items placed on it, such as a table, shelf, desk, altar, or counter.

			door:
			A feature that may control movement or locked/unlocked state.

			exit:
			A visible destination or passage.

			decoration:
			Mostly descriptive, but still targetable if desired.

			hazard:
			A dangerous or stateful room feature.
		`),
	);

export const RoomFeatureSchema = z
	.object({
		id: IdSchema.describe("The unique id used to identify this room feature."),
		name: z.string().min(1).describe("The display name of the room feature."),
		aliases: AliasListSchema.describe(
			"Alternative names the player can use to refer to this feature.",
		),
		tags: TagListSchema.describe("Tags used to group this feature."),

		kind: RoomFeatureKindSchema.describe("The feature's interaction category."),

		description: DescriptionSchema.describe(
			"The description shown when the player examines or interacts with this feature.",
		),

		listedInRoom: z
			.boolean()
			.default(false)
			.describe(
				"Controls whether the feature is listed separately in the room output. Features can still be mentioned in the room description when this is false.",
			),

		activeWhen: z
			.array(ConditionSchema)
			.default([])
			.describe(
				"The feature is not listed or interacted with unless all of these conditions are true.",
			),
		visibleWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The feature is visible only when all of these conditions pass."),
		usableWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The feature can be used only when all of these conditions pass."),

		examineSetsFlag: z
			.string()
			.min(1)
			.optional()
			.describe(
				"Optional flag set when this feature is examined. Useful for feature-examined conditions.",
			),

		capacity: z
			.number()
			.int()
			.positive()
			.optional()
			.describe("Optional maximum number of items this container or surface can hold."),

		initialItems: z
			.array(IdSchema)
			.default([])
			.describe(
				"Item ids initially inside this container or on this surface. Prefer item.initialLocation as the source of truth when possible.",
			),

		state: ObjectStateDefaultsSchema.default(DefaultObjectStateDefaults).describe(
			"Initial object state for this feature.",
		),
	})
	.describe(
		docify(`
			A room feature is an interactable thing inside a room that the player usually
			cannot pick up.

			Features cover scenery, containers, surfaces, doors, exits, hazards, and
			other room-local objects.
		`),
	);

export const RoomSchema = z
	.object({
		id: IdSchema.describe("The unique id used to identify this room."),
		name: z.string().min(1).describe("The display name of the room."),
		aliases: AliasListSchema.describe("Alternative names for this room."),
		tags: TagListSchema.describe(
			"Tags used to group this room, such as indoors, outdoors, safe, dark, or kitchen.",
		),

		position: PointSchema.describe("The room's position in the editor canvas."),

		description: DescriptionSchema.describe(
			"The description shown when the player enters or looks around this room.",
		),

		shortDescription: z
			.string()
			.default("")
			.describe("Optional shorter description used after the room has already been visited."),

		features: z
			.array(RoomFeatureSchema)
			.default([])
			.describe("Interactive room features that exist inside this room."),

		visitedFlag: z
			.string()
			.min(1)
			.optional()
			.describe("Optional flag set when the player visits this room."),
		viewedFlag: z
			.string()
			.min(1)
			.optional()
			.describe("Optional flag set when this room's description is shown."),

		activeWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The room is available only when all of these conditions pass."),
		visibleWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The room can be discovered or referenced only when all of these conditions pass."),
	})
	.describe("A location in the world that the player can visit.");

export const ConnectionSchema = z
	.object({
		id: IdSchema.describe("The unique id used to identify this connection."),

		fromRoomId: IdSchema.describe("The id of the room where this connection starts."),
		toRoomId: IdSchema.describe("The id of the room where this connection leads."),

		direction: DirectionSchema.describe(
			"The direction the player uses to travel from the starting room to the destination room.",
		),
		returnDirection: DirectionSchema.describe(
			"The direction the player uses to travel back from the destination room to the starting room.",
		),

		aliases: AliasListSchema.describe(
			"Alternative words or phrases that can trigger travel through this connection.",
		),

		pathway: PathwaySchema.describe(
			"Controls whether this connection can be traveled both ways, only forwards, only backwards, or not at all.",
		),

		description: z.string().default("").describe("Optional description of the exit or passage."),
		blockedMessage: z
			.string()
			.default("")
			.describe("Optional message shown when this connection exists but cannot be traveled."),

		visibleWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The connection is visible only when all of these conditions pass."),
		travelAllowedWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The connection can be traveled only when all of these conditions pass."),
		lockedWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The connection is considered locked when any of these conditions pass."),

		state: ObjectStateDefaultsSchema.default(DefaultObjectStateDefaults).describe(
			"Initial state for this connection or exit, such as locked or open.",
		),
	})
	.describe(
		docify(`
			A directional link between two rooms.

			Connections are used by movement commands and may also be referenced by
			authored commands, conditions, and effects.
		`),
	);

export const NpcDispositionSchema = z
	.enum(["neutral", "friendly", "hostile", "afraid", "asleep", "unavailable"])
	.default("neutral")
	.describe("The NPC's starting broad behavior or relationship state.");

export const NpcScheduleEntrySchema = z
	.object({
		id: IdSchema.describe("Unique id for this schedule entry."),
		roomId: IdSchema.describe("The room where the NPC should be for this schedule entry."),
		when: z
			.array(ConditionSchema)
			.default([])
			.describe("Conditions that activate this schedule entry."),
	})
	.describe("A conditional NPC schedule entry.");

export const NpcSchema = z
	.object({
		id: IdSchema.describe("The unique id used to identify this NPC."),
		name: z.string().min(1).describe("The display name of the NPC."),
		aliases: AliasListSchema.describe("Alternative names the player can use for this NPC."),
		tags: TagListSchema.describe("Tags used to group this NPC."),

		description: DescriptionSchema.describe(
			"The description shown when the player examines this NPC.",
		),

		initialRoomId: IdSchema.optional().describe(
			"The room where this NPC starts. Omit if the NPC starts unavailable or hidden.",
		),

		initialMood: z.string().default("neutral").describe("The NPC's starting mood value."),
		initialDisposition: NpcDispositionSchema.describe("The NPC's starting broad disposition."),
		initialTrust: z.number().default(0).describe("The NPC's starting trust or affinity score."),

		initialInventory: z.array(IdSchema).default([]).describe("Item ids this NPC starts with."),

		visibleWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The NPC is visible only when all of these conditions pass."),
		talkableWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The NPC can be spoken to only when all of these conditions pass."),

		knownTopics: z.array(IdSchema).default([]).describe("Topic ids this NPC can discuss."),

		schedule: z
			.array(NpcScheduleEntrySchema)
			.default([])
			.describe("Optional conditional room schedule for this NPC."),

		state: ObjectStateDefaultsSchema.default(DefaultObjectStateDefaults).describe(
			"Custom NPC state values beyond mood, trust, and disposition.",
		),
	})
	.describe(
		docify(`
			A non-player character.

			NPCs support location, mood, disposition, awareness, inventory,
			conversation topics, hostility, trust, and schedules.
		`),
	);

export const TopicSchema = z
	.object({
		id: IdSchema.describe("The unique id used to identify this conversation topic."),
		name: z.string().min(1).describe("The display name of this topic."),
		aliases: AliasListSchema.describe("Alternative names or phrases for this topic."),
		tags: TagListSchema.describe("Tags used to group this topic."),

		description: z
			.string()
			.default("")
			.describe("Editor-facing description of what this topic represents."),

		knownByDefault: z
			.boolean()
			.default(false)
			.describe("Whether the player knows this topic at the start of the game."),
		knownWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("The topic becomes known when all of these conditions pass."),
	})
	.describe(
		docify(`
			A conversation or knowledge topic.

			Topics are used by speech commands such as:
			- ask cook about rats
			- tell guard about lantern
			- say the mothmark password
		`),
	);

export const QuestObjectiveSchema = z
	.object({
		id: IdSchema.describe("The unique id for this quest objective."),
		name: z.string().min(1).describe("The display name of this objective."),
		description: z
			.string()
			.default("")
			.describe("Editor-facing notes or player-facing objective description."),

		completeWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("Conditions that mark this objective complete."),
		visibleWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("Conditions that make this objective visible."),
	})
	.describe("A single objective within a quest.");

export const QuestSchema = z
	.object({
		id: IdSchema.describe("The unique id used to identify this quest."),
		name: z.string().min(1).describe("The display name of this quest."),
		description: z.string().default("").describe("The quest description or editor-facing notes."),

		tags: TagListSchema.describe("Tags used to group this quest."),

		startWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("Conditions that make this quest active."),
		completeWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("Conditions that mark this quest completed."),
		failWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("Conditions that mark this quest failed."),

		objectives: z
			.array(QuestObjectiveSchema)
			.default([])
			.describe("Objectives contained in this quest."),
	})
	.describe(
		docify(`
			A quest or tracked story task.

			Quest conditions can check not-started, active, completed, failed,
			objective-complete, and objective-incomplete states.
		`),
	);

export const InitialObjectStateSchema = z
	.object({
		objectId: IdSchema.describe(
			"The object id whose state should be initialized, such as item:lantern or feature:kitchen.table.",
		),
		state: ObjectStateDefaultsSchema.describe("The initial state values for this object."),
	})
	.describe("Initial state for an arbitrary object id.");

export const InitialFlagSchema = z
	.object({
		flag: IdSchema.describe("The flag key to initialize."),
		value: z.boolean().describe("The starting boolean value for the flag."),
	})
	.describe("A starting flag value.");

export const InitialCounterSchema = z
	.object({
		counter: IdSchema.describe("The counter key to initialize."),
		value: z.number().describe("The starting numeric value for the counter."),
	})
	.describe("A starting counter value.");

export const WorldInitialStateSchema = z
	.object({
		flags: z
			.array(InitialFlagSchema)
			.default([])
			.describe("Boolean flags that should exist when the game starts."),
		counters: z
			.array(InitialCounterSchema)
			.default([])
			.describe("Numeric counters that should exist when the game starts."),
		objectStates: z
			.array(InitialObjectStateSchema)
			.default([])
			.describe("Initial object states that should exist when the game starts."),
		knownTopics: z
			.array(IdSchema)
			.default([])
			.describe("Topic ids the player knows when the game starts."),
		inventory: z
			.array(IdSchema)
			.default([])
			.describe("Item ids the player starts with. Prefer item.initialLocation when possible."),
	})
	.describe(
		docify(`
			World-level initial game state.

			This supplements static entity data and seeds runtime game state values like
			flags, counters, object states, known topics, and starting inventory.
		`),
	);

export const DefaultWorldInitialState = {
	flags: [],
	counters: [],
	objectStates: [],
	knownTopics: [],
	inventory: [],
} satisfies z.infer<typeof WorldInitialStateSchema>;

export const WorldMetadataSchema = z
	.object({
		title: z.string().default("").describe("The title of the world."),
		author: z.string().default("").describe("The author name shown in editor metadata."),
		description: z
			.string()
			.default("")
			.describe("Short editor-facing or player-facing world description."),
		version: z.string().default("0.1.0").describe("The world data version."),
	})
	.describe("Optional world metadata.");

export const DefaultWorldMetadata = {
	title: "",
	author: "",
	description: "",
	version: "0.1.0",
} satisfies z.infer<typeof WorldMetadataSchema>;

export const WorldSchema = z
	.object({
		metadata: WorldMetadataSchema.default(DefaultWorldMetadata).describe(
			"Optional metadata about this world.",
		),

		startRoomId: IdSchema.describe("The id of the room where the player starts."),

		rooms: z.array(RoomSchema).describe("All rooms that exist in the world."),
		connections: z
			.array(ConnectionSchema)
			.default([])
			.describe("All connections between rooms in the world."),

		items: z.array(ItemSchema).default([]).describe("All item definitions in the world."),
		npcs: z.array(NpcSchema).default([]).describe("All NPC definitions in the world."),
		topics: z
			.array(TopicSchema)
			.default([])
			.describe("All known conversation or knowledge topics in the world."),
		quests: z.array(QuestSchema).default([]).describe("All quest definitions in the world."),

		authoredCommands: z
			.array(AuthorCommandSchema)
			.default([])
			.describe("Editor-authored command rules saved as world data."),
		authoredEvents: z
			.array(AuthoredEventSchema)
			.default([])
			.describe("Reusable authored events that commands and other events can schedule."),

		initialState: WorldInitialStateSchema.default(DefaultWorldInitialState).describe(
			"Initial runtime state seeded when a new game starts.",
		),
	})
	.describe(
		docify(`
			A complete playable text adventure world.

			The world schema defines static world data:
			- rooms
			- connections
			- features
			- items
			- NPCs
			- topics
			- quests
			- authored commands
			- authored events
			- initial state

			Runtime-only data, such as currentRoomId, turnCount, scheduledEvents,
			recentCommands, itemLocations, npcLocations, and objectStates, should live
			in GameState rather than directly in the world definition.
		`),
	)
	.superRefine((world, ctx) => {
		const roomIds = new Set<string>();
		const connectionIds = new Set<string>();
		const itemIds = new Set<string>();
		const npcIds = new Set<string>();
		const topicIds = new Set<string>();
		const questIds = new Set<string>();
		const commandIds = new Set<string>();
		const eventIds = new Set<string>();

		const fullFeatureIds = new Set<string>();
		const containerIds = new Set<string>();
		const surfaceIds = new Set<string>();

		for (const [roomIndex, room] of world.rooms.entries()) {
			if (roomIds.has(room.id)) {
				ctx.addIssue({
					code: "custom",
					message: `Duplicate room id: ${room.id}`,
					path: ["rooms", roomIndex, "id"],
				});
			}

			roomIds.add(room.id);

			const roomFeatureIds = new Set<string>();

			for (const [featureIndex, feature] of room.features.entries()) {
				const fullFeatureId = `${room.id}.${feature.id}`;

				if (roomFeatureIds.has(feature.id)) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate feature id ${feature.id} in room ${room.id}`,
						path: ["rooms", roomIndex, "features", featureIndex, "id"],
					});
				}

				roomFeatureIds.add(feature.id);

				if (fullFeatureIds.has(fullFeatureId)) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate full feature id: ${fullFeatureId}`,
						path: ["rooms", roomIndex, "features", featureIndex, "id"],
					});
				}

				fullFeatureIds.add(fullFeatureId);

				if (feature.kind === "container") {
					containerIds.add(feature.id);
					containerIds.add(fullFeatureId);
				}

				if (feature.kind === "surface") {
					surfaceIds.add(feature.id);
					surfaceIds.add(fullFeatureId);
				}
			}
		}

		for (const [connectionIndex, connection] of world.connections.entries()) {
			if (connectionIds.has(connection.id)) {
				ctx.addIssue({
					code: "custom",
					message: `Duplicate connection id: ${connection.id}`,
					path: ["connections", connectionIndex, "id"],
				});
			}

			connectionIds.add(connection.id);
		}

		for (const [itemIndex, item] of world.items.entries()) {
			if (itemIds.has(item.id)) {
				ctx.addIssue({
					code: "custom",
					message: `Duplicate item id: ${item.id}`,
					path: ["items", itemIndex, "id"],
				});
			}

			itemIds.add(item.id);
		}

		for (const [topicIndex, topic] of world.topics.entries()) {
			if (topicIds.has(topic.id)) {
				ctx.addIssue({
					code: "custom",
					message: `Duplicate topic id: ${topic.id}`,
					path: ["topics", topicIndex, "id"],
				});
			}

			topicIds.add(topic.id);
		}

		for (const [npcIndex, npc] of world.npcs.entries()) {
			if (npcIds.has(npc.id)) {
				ctx.addIssue({
					code: "custom",
					message: `Duplicate NPC id: ${npc.id}`,
					path: ["npcs", npcIndex, "id"],
				});
			}

			npcIds.add(npc.id);
		}

		for (const [questIndex, quest] of world.quests.entries()) {
			if (questIds.has(quest.id)) {
				ctx.addIssue({
					code: "custom",
					message: `Duplicate quest id: ${quest.id}`,
					path: ["quests", questIndex, "id"],
				});
			}

			questIds.add(quest.id);

			const objectiveIds = new Set<string>();

			for (const [objectiveIndex, objective] of quest.objectives.entries()) {
				if (objectiveIds.has(objective.id)) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate objective id ${objective.id} in quest ${quest.id}`,
						path: ["quests", questIndex, "objectives", objectiveIndex, "id"],
					});
				}

				objectiveIds.add(objective.id);
			}
		}

		for (const [commandIndex, command] of world.authoredCommands.entries()) {
			if (commandIds.has(command.id)) {
				ctx.addIssue({
					code: "custom",
					message: `Duplicate authored command id: ${command.id}`,
					path: ["authoredCommands", commandIndex, "id"],
				});
			}

			commandIds.add(command.id);
		}

		for (const [eventIndex, event] of world.authoredEvents.entries()) {
			if (eventIds.has(event.id)) {
				ctx.addIssue({
					code: "custom",
					message: `Duplicate authored event id: ${event.id}`,
					path: ["authoredEvents", eventIndex, "id"],
				});
			}

			eventIds.add(event.id);
		}

		if (!roomIds.has(world.startRoomId)) {
			ctx.addIssue({
				code: "custom",
				message: `Starting room id ${world.startRoomId} is not a real room.`,
				path: ["startRoomId"],
			});
		}

		for (const [connectionIndex, connection] of world.connections.entries()) {
			if (!roomIds.has(connection.fromRoomId)) {
				ctx.addIssue({
					code: "custom",
					message: `Connection points from missing room: ${connection.fromRoomId}`,
					path: ["connections", connectionIndex, "fromRoomId"],
				});
			}

			if (!roomIds.has(connection.toRoomId)) {
				ctx.addIssue({
					code: "custom",
					message: `Connection points to missing room: ${connection.toRoomId}`,
					path: ["connections", connectionIndex, "toRoomId"],
				});
			}
		}

		for (const [roomIndex, room] of world.rooms.entries()) {
			for (const [featureIndex, feature] of room.features.entries()) {
				for (const [itemIndex, itemId] of feature.initialItems.entries()) {
					if (!itemIds.has(itemId)) {
						ctx.addIssue({
							code: "custom",
							message: `Feature ${room.id}.${feature.id} references missing initial item: ${itemId}`,
							path: ["rooms", roomIndex, "features", featureIndex, "initialItems", itemIndex],
						});
					}
				}
			}
		}

		for (const [itemIndex, item] of world.items.entries()) {
			if (item.initialLocation.type === "room" && !roomIds.has(item.initialLocation.roomId)) {
				ctx.addIssue({
					code: "custom",
					message: `Item ${item.id} starts in missing room: ${item.initialLocation.roomId}`,
					path: ["items", itemIndex, "initialLocation", "roomId"],
				});
			}

			if (
				item.initialLocation.type === "container" &&
				!containerIds.has(item.initialLocation.containerId)
			) {
				ctx.addIssue({
					code: "custom",
					message: `Item ${item.id} starts in missing container: ${item.initialLocation.containerId}`,
					path: ["items", itemIndex, "initialLocation", "containerId"],
				});
			}

			if (item.initialLocation.type === "surface" && !surfaceIds.has(item.initialLocation.surfaceId)) {
				ctx.addIssue({
					code: "custom",
					message: `Item ${item.id} starts on missing surface: ${item.initialLocation.surfaceId}`,
					path: ["items", itemIndex, "initialLocation", "surfaceId"],
				});
			}

			if (item.initialLocation.type === "npc" && !npcIds.has(item.initialLocation.npcId)) {
				ctx.addIssue({
					code: "custom",
					message: `Item ${item.id} starts with missing NPC: ${item.initialLocation.npcId}`,
					path: ["items", itemIndex, "initialLocation", "npcId"],
				});
			}
		}

		for (const [npcIndex, npc] of world.npcs.entries()) {
			if (npc.initialRoomId && !roomIds.has(npc.initialRoomId)) {
				ctx.addIssue({
					code: "custom",
					message: `NPC ${npc.id} starts in missing room: ${npc.initialRoomId}`,
					path: ["npcs", npcIndex, "initialRoomId"],
				});
			}

			for (const [inventoryIndex, itemId] of npc.initialInventory.entries()) {
				if (!itemIds.has(itemId)) {
					ctx.addIssue({
						code: "custom",
						message: `NPC ${npc.id} starts with missing item: ${itemId}`,
						path: ["npcs", npcIndex, "initialInventory", inventoryIndex],
					});
				}
			}

			for (const [topicIndex, topicId] of npc.knownTopics.entries()) {
				if (!topicIds.has(topicId)) {
					ctx.addIssue({
						code: "custom",
						message: `NPC ${npc.id} references missing topic: ${topicId}`,
						path: ["npcs", npcIndex, "knownTopics", topicIndex],
					});
				}
			}

			for (const [scheduleIndex, scheduleEntry] of npc.schedule.entries()) {
				if (!roomIds.has(scheduleEntry.roomId)) {
					ctx.addIssue({
						code: "custom",
						message: `NPC ${npc.id} schedule points to missing room: ${scheduleEntry.roomId}`,
						path: ["npcs", npcIndex, "schedule", scheduleIndex, "roomId"],
					});
				}
			}
		}

		for (const [inventoryIndex, itemId] of world.initialState.inventory.entries()) {
			if (!itemIds.has(itemId)) {
				ctx.addIssue({
					code: "custom",
					message: `Initial inventory references missing item: ${itemId}`,
					path: ["initialState", "inventory", inventoryIndex],
				});
			}
		}

		for (const [topicIndex, topicId] of world.initialState.knownTopics.entries()) {
			if (!topicIds.has(topicId)) {
				ctx.addIssue({
					code: "custom",
					message: `Initial known topic references missing topic: ${topicId}`,
					path: ["initialState", "knownTopics", topicIndex],
				});
			}
		}
	});

export type Id = z.infer<typeof IdSchema>;
export type Direction = z.infer<typeof DirectionSchema>;
export type Point = z.infer<typeof PointSchema>;
export type Pathway = z.infer<typeof PathwaySchema>;
export type ConditionalText = z.infer<typeof ConditionalTextSchema>;
export type Description = z.infer<typeof DescriptionSchema>;
export type EntityVisibility = z.infer<typeof EntityVisibilitySchema>;
export type InteractionRule = z.infer<typeof InteractionRuleSchema>;
export type ObjectStateDefaults = z.infer<typeof ObjectStateDefaultsSchema>;
export type ItemLocation = z.infer<typeof ItemLocationSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type RoomFeatureKind = z.infer<typeof RoomFeatureKindSchema>;
export type RoomFeature = z.infer<typeof RoomFeatureSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type NpcDisposition = z.infer<typeof NpcDispositionSchema>;
export type NpcScheduleEntry = z.infer<typeof NpcScheduleEntrySchema>;
export type Npc = z.infer<typeof NpcSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type QuestObjective = z.infer<typeof QuestObjectiveSchema>;
export type Quest = z.infer<typeof QuestSchema>;
export type InitialObjectState = z.infer<typeof InitialObjectStateSchema>;
export type InitialFlag = z.infer<typeof InitialFlagSchema>;
export type InitialCounter = z.infer<typeof InitialCounterSchema>;
export type WorldInitialState = z.infer<typeof WorldInitialStateSchema>;
export type WorldMetadata = z.infer<typeof WorldMetadataSchema>;
export type World = z.infer<typeof WorldSchema>;
