import {z} from "zod";
import {ConditionUsageSchema, WorldConditionSchema} from "./conditionSchema";
import {AuthorCommandSchema} from "./authoredCommandSchema";
import {AuthoredEventSchema, WorldEffectSchema} from "./effectSchema";
import {DescriptionSchema} from "./descriptionSchema";
import {ObjectStateDefaultsSchema, DefaultObjectStateDefaults} from "./objectStateSchema";
import {RoomSchema, ConnectionSchema} from "./roomSchema";
import {docify} from "../utils/docify";
import {idValue, isID} from "../utils/idUtils";
import {
	editorAliasList,
	editorArray,
	editorBoolean,
	editorConditionList,
	editorDiscriminatedUnion,
	editorReference,
	editorFlagKey,
	editorId,
	editorInput,
	editorMessage,
	editorMultiSelect,
	editorNumber,
	editorObject,
	editorSelect,
	editorTagList,
	editorTextarea,
} from "@/schemas/editorSchemaHelpers";

export const IdSchema = editorId("object", {
	title: "ID",
	description: "A stable unique id used by schemas, conditions, effects, and editor references.",
});

export const AliasListSchema = editorAliasList({
	title: "Aliases",
	description: "Alternative names the player can use to refer to this entity.",
});

export const TagListSchema = editorTagList("all", {
	title: "Tags",
	description: "Tags used for grouping, filtering, command scopes, and condition/effect targeting.",
});

export const EntityVisibilitySchema = editorObject(
	z.object({
		visibleWhen: editorConditionList(ConditionUsageSchema, {
			title: "Visible When",
			description: "The entity is only visible when all of these conditions pass.",
			layout: {
				width: "full",
				order: 1,
			},
		}),

		hiddenWhen: editorConditionList(ConditionUsageSchema, {
			title: "Hidden When",
			description: "The entity is hidden when any of these conditions pass.",
			layout: {
				width: "full",
				order: 2,
			},
		}),
	}),
	{
		title: "Entity Visibility",
		description: docify(`
			Shared visibility rules for rooms, items, features, NPCs, topics, and exits.

			Use visibleWhen for unlockable/discoverable content.
			Use hiddenWhen for content that disappears after state changes.
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const DefaultEntityVisibility = {
	visibleWhen: [],
	hiddenWhen: [],
} satisfies z.infer<typeof EntityVisibilitySchema>;

export const InteractionRuleSchema = editorObject(
	z.object({
		allowedWhen: editorConditionList(ConditionUsageSchema, {
			title: "Allowed When",
			description: "The interaction is allowed only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 1,
			},
		}),

		blockedWhen: editorConditionList(ConditionUsageSchema, {
			title: "Blocked When",
			description: "The interaction is blocked when any of these conditions pass.",
			layout: {
				width: "full",
				order: 2,
			},
		}),

		failureMessage: editorMessage({
			title: "Failure Message",
			description: "Optional message shown when this interaction is blocked.",
			placeholder: "You cannot do that right now.",
			layout: {
				width: "full",
				order: 3,
			},
		}).default(""),
	}),
	{
		title: "Interaction Rule",
		description: "Reusable rules for whether an interaction is currently allowed.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const DefaultInteractionRule = {
	allowedWhen: [],
	blockedWhen: [],
	failureMessage: "",
} satisfies z.infer<typeof InteractionRuleSchema>;

export const ItemLocationSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("type", [
		z.object({
			type: z.literal("inventory").describe("The item starts in the player's inventory."),
		}),

		z.object({
			type: z.literal("room").describe("The item starts loose in a room."),
			roomId: editorReference("room", {
				title: "Room",
				description: "The room where the item starts.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("container").describe("The item starts inside a container."),
			containerId: editorReference("container", {
				title: "Container",
				description: "The container where the item starts.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("surface").describe("The item starts on a surface."),
			surfaceId: editorReference("surface", {
				title: "Surface",
				description: "The surface where the item starts.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("npc").describe("The item starts held by an NPC."),
			npcId: editorReference("npc", {
				title: "NPC",
				description: "The NPC who starts with the item.",
				layout: {
					width: "full",
					order: 1,
				},
			}),
		}),

		z.object({
			type: z.literal("hidden").describe("The item starts hidden from normal discovery."),
			locationId: editorInput({
				title: "Associated Location",
				description:
					"Optional room, object, surface, container, or NPC associated with the hidden item.",
				placeholder: "kitchen",
				layout: {
					width: "full",
					order: 1,
				},
			})
				.min(1)
				.optional(),
		}),

		z.object({
			type: z.literal("destroyed").describe("The item starts destroyed or unavailable."),
		}),
	]),
	{
		title: "Item Location",
		description: docify(`
			Where an item starts before game state changes.

			Effects can later move items between inventory, rooms, containers, surfaces,
			NPCs, hidden state, and destroyed state.
		`),
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const ItemSchema = editorObject(
	z.object({
		id: editorId("item", {
			title: "Item ID",
			description: "The unique id used to identify this item.",
			required: true,
			layout: {
				width: "half",
				order: 1,
			},
		}),

		name: editorInput({
			title: "Name",
			description: "The display name of the item.",
			placeholder: "Brass Key",
			required: true,
			layout: {
				width: "half",
				order: 2,
			},
		}).min(1),

		aliases: editorAliasList({
			title: "Aliases",
			description: "Alternative names the player can use for this item.",
			layout: {
				width: "full",
				order: 3,
			},
		}),

		tags: editorTagList("items", {
			title: "Tags",
			description: "Tags used to group this item, such as food, key, tool, weapon, or quest-item.",
			layout: {
				width: "full",
				order: 4,
			},
		}),

		description: DescriptionSchema.describe(
			"The description shown when the player examines this item.",
		),

		initialLocation: ItemLocationSchema.default({type: "hidden"}).describe(
			"Where this item starts in the world.",
		),

		portable: editorBoolean({
			title: "Portable",
			description: "Whether the player can normally take this item.",
			layout: {
				width: "half",
				order: 7,
			},
		}).default(true),

		visibleWhen: editorConditionList(ConditionUsageSchema, {
			title: "Visible When",
			description: "The item is visible only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 8,
			},
		}),

		takeableWhen: editorConditionList(ConditionUsageSchema, {
			title: "Takeable When",
			description: "The item can be taken only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 9,
			},
		}),

		usableWhen: editorConditionList(ConditionUsageSchema, {
			title: "Usable When",
			description: "The item can be used only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 10,
			},
		}),

		takeRule: InteractionRuleSchema.default(DefaultInteractionRule).describe(
			"Optional detailed rule for taking this item.",
		),

		useRule: InteractionRuleSchema.default(DefaultInteractionRule).describe(
			"Optional detailed rule for using this item.",
		),

		state: ObjectStateDefaultsSchema.default(DefaultObjectStateDefaults).describe(
			"Initial object state for this item.",
		),
	}),
	{
		title: "Item",
		description: docify(`
			A portable or world-placed item.

			Items can be in inventory, rooms, containers, surfaces, held by NPCs,
			hidden, or destroyed. Authored commands, conditions, and effects refer
			to items by id.
		`),
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			idPrefix: "item",
		},
	},
);

export const NpcDispositionSchema = editorSelect(
	z.enum(["neutral", "friendly", "hostile", "afraid", "asleep", "unavailable"]).default("neutral"),
	{
		title: "NPC Disposition",
		description: "The NPC's starting broad behavior or relationship state.",
		options: [
			{label: "Neutral", value: "neutral"},
			{label: "Friendly", value: "friendly", tone: "success"},
			{label: "Hostile", value: "hostile", tone: "danger"},
			{label: "Afraid", value: "afraid", tone: "warning"},
			{label: "Asleep", value: "asleep", tone: "quiet"},
			{label: "Unavailable", value: "unavailable", tone: "quiet"},
		],
	},
);

export const NpcScheduleEntrySchema = editorObject(
	z.object({
		id: editorId("npc-schedule-entry", {
			title: "Schedule Entry ID",
			description: "Unique id for this schedule entry.",
			required: true,
			layout: {
				width: "half",
				order: 1,
			},
		}),

		roomId: editorReference("room", {
			title: "Room",
			description: "The room where the NPC should be for this schedule entry.",
			layout: {
				width: "half",
				order: 2,
			},
		}),

		when: editorConditionList(ConditionUsageSchema, {
			title: "When",
			description: "Conditions that activate this schedule entry.",
			layout: {
				width: "full",
				order: 3,
			},
		}),
	}),
	{
		title: "NPC Schedule Entry",
		description: "A conditional NPC schedule entry.",
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			idPrefix: "schedule",
		},
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const NpcSchema = editorObject(
	z.object({
		id: editorId("npc", {
			title: "NPC ID",
			description: "The unique id used to identify this NPC.",
			required: true,
			layout: {
				width: "half",
				order: 1,
			},
		}),

		name: editorInput({
			title: "Name",
			description: "The display name of the NPC.",
			placeholder: "The Cook",
			required: true,
			layout: {
				width: "half",
				order: 2,
			},
		}).min(1),

		aliases: editorAliasList({
			title: "Aliases",
			description: "Alternative names the player can use for this NPC.",
			layout: {
				width: "full",
				order: 3,
			},
		}),

		tags: editorTagList("npcs", {
			title: "Tags",
			description: "Tags used to group this NPC.",
			layout: {
				width: "full",
				order: 4,
			},
		}),

		description: DescriptionSchema.describe(
			"The description shown when the player examines this NPC.",
		),

		initialRoomId: editorReference("room", {
			title: "Initial Room",
			description: "The room where this NPC starts. Omit if the NPC starts unavailable or hidden.",
			required: false,
			layout: {
				width: "half",
				order: 6,
			},
		}),

		initialMood: editorInput({
			title: "Initial Mood",
			description: "The NPC's starting mood value.",
			placeholder: "neutral",
			layout: {
				width: "half",
				order: 7,
			},
		}).default("neutral"),

		initialDisposition: NpcDispositionSchema.describe("The NPC's starting broad disposition."),

		initialTrust: editorNumber({
			title: "Initial Trust",
			description: "The NPC's starting trust or affinity score.",
			layout: {
				width: "half",
				order: 9,
			},
		}).default(0),

		initialInventory: editorMultiSelect({
			title: "Initial Inventory",
			description: "Item ids this NPC starts with.",
			entityType: "item",
			layout: {
				width: "full",
				order: 10,
			},
		}),

		isDead: editorBoolean({
			title: "Is Dead",
			description: "Flag indicating whether the NPC is dead or alive.",
		}).default(true),

		visibleWhen: editorConditionList(ConditionUsageSchema, {
			title: "Visible When",
			description: "The NPC is visible only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 11,
			},
		}),

		talkableWhen: editorConditionList(ConditionUsageSchema, {
			title: "Talkable When",
			description: "The NPC can be spoken to only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 12,
			},
		}),

		diesWhen: editorConditionList(ConditionUsageSchema, {
			title: "Dies When",
			description: "The NPC dies when all these conditions pass.",
			layout: {
				width: "full",
				order: 12,
			},
		}),

		knownTopics: editorMultiSelect({
			title: "Known Topics",
			description: "Topic ids this NPC can discuss.",
			entityType: "topic",
			layout: {
				width: "full",
				order: 13,
			},
		}),

		schedule: editorArray(NpcScheduleEntrySchema, {
			title: "Schedule",
			description: "Optional conditional room schedule for this NPC.",
			emptyState: {
				emptyTitle: "No schedule",
				emptyDescription: "Add conditional schedule entries if this NPC moves around.",
				emptyActionLabel: "Add schedule entry",
			},
			duplicate: {
				duplicateBehavior: "with-new-id",
				idField: "id",
				idPrefix: "schedule",
			},
			layout: {
				width: "full",
				order: 14,
			},
		}),

		state: ObjectStateDefaultsSchema.default(DefaultObjectStateDefaults).describe(
			"Custom NPC state values beyond mood, trust, and disposition.",
		),
	}),
	{
		title: "NPC",
		description: docify(`
			A non-player character.

			NPCs support location, mood, disposition, awareness, inventory,
			conversation topics, hostility, trust, and schedules.
		`),
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			idPrefix: "npc",
		},
	},
);

export const TopicSchema = editorObject(
	z.object({
		id: editorId("topic", {
			title: "Topic ID",
			description: "The unique id used to identify this conversation topic.",
			required: true,
			layout: {
				width: "half",
				order: 1,
			},
		}),

		name: editorInput({
			title: "Name",
			description: "The display name of this topic.",
			placeholder: "Rats",
			required: true,
			layout: {
				width: "half",
				order: 2,
			},
		}).min(1),

		aliases: editorAliasList({
			title: "Aliases",
			description: "Alternative names or phrases for this topic.",
			layout: {
				width: "full",
				order: 3,
			},
		}),

		tags: editorTagList("topics", {
			title: "Tags",
			description: "Tags used to group this topic.",
			layout: {
				width: "full",
				order: 4,
			},
		}),

		description: editorTextarea({
			title: "Description",
			description: "Editor-facing description of what this topic represents.",
			layout: {
				width: "full",
				order: 5,
			},
		}).default(""),

		knownByDefault: editorBoolean({
			title: "Known by Default",
			description: "Whether the player knows this topic at the start of the game.",
			layout: {
				width: "half",
				order: 6,
			},
		}).default(false),

		knownWhen: editorConditionList(ConditionUsageSchema, {
			title: "Known When",
			description: "The topic becomes known when all of these conditions pass.",
			layout: {
				width: "full",
				order: 7,
			},
		}),
	}),
	{
		title: "Topic",
		description: docify(`
			A conversation or knowledge topic.

			Topics are used by speech commands such as:
			- ask cook about rats
			- tell guard about lantern
			- say the mothmark password
		`),
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			idPrefix: "topic",
		},
	},
);

export const QuestObjectiveSchema = editorObject(
	z.object({
		id: editorId("quest-objective", {
			title: "Objective ID",
			description: "The unique id for this quest objective.",
			required: true,
			layout: {
				width: "half",
				order: 1,
			},
		}),

		name: editorInput({
			title: "Name",
			description: "The display name of this objective.",
			required: true,
			layout: {
				width: "half",
				order: 2,
			},
		}).min(1),

		description: editorTextarea({
			title: "Description",
			description: "Editor-facing notes or player-facing objective description.",
			layout: {
				width: "full",
				order: 3,
			},
		}).default(""),

		completeWhen: editorConditionList(ConditionUsageSchema, {
			title: "Complete When",
			description: "Conditions that mark this objective complete.",
			layout: {
				width: "full",
				order: 4,
			},
		}),

		visibleWhen: editorConditionList(ConditionUsageSchema, {
			title: "Visible When",
			description: "Conditions that make this objective visible.",
			layout: {
				width: "full",
				order: 5,
			},
		}),
	}),
	{
		title: "Quest Objective",
		description: "A single objective within a quest.",
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			idPrefix: "objective",
		},
	},
);

export const QuestSchema = editorObject(
	z.object({
		id: editorId("quest", {
			title: "Quest ID",
			description: "The unique id used to identify this quest.",
			required: true,
			layout: {
				width: "half",
				order: 1,
			},
		}),

		name: editorInput({
			title: "Name",
			description: "The display name of this quest.",
			required: true,
			layout: {
				width: "half",
				order: 2,
			},
		}).min(1),

		description: editorTextarea({
			title: "Description",
			description: "The quest description or editor-facing notes.",
			layout: {
				width: "full",
				order: 3,
			},
		}).default(""),

		tags: editorTagList("quests", {
			title: "Tags",
			description: "Tags used to group this quest.",
			layout: {
				width: "full",
				order: 4,
			},
		}),

		startWhen: editorConditionList(ConditionUsageSchema, {
			title: "Start When",
			description: "Conditions that make this quest active.",
			layout: {
				width: "full",
				order: 5,
			},
		}),

		completeWhen: editorConditionList(ConditionUsageSchema, {
			title: "Complete When",
			description: "Conditions that mark this quest completed.",
			layout: {
				width: "full",
				order: 6,
			},
		}),

		failWhen: editorConditionList(ConditionUsageSchema, {
			title: "Fail When",
			description: "Conditions that mark this quest failed.",
			layout: {
				width: "full",
				order: 7,
			},
		}),

		objectives: editorArray(QuestObjectiveSchema, {
			title: "Objectives",
			description: "Objectives contained in this quest.",
			emptyState: {
				emptyTitle: "No objectives",
				emptyDescription: "Add objectives to break the quest into trackable steps.",
				emptyActionLabel: "Add objective",
			},
			duplicate: {
				duplicateBehavior: "with-new-id",
				idField: "id",
				idPrefix: "objective",
			},
			layout: {
				width: "full",
				order: 8,
			},
		}),
	}),
	{
		title: "Quest",
		description: docify(`
			A quest or tracked story task.

			Quest conditions can check not-started, active, completed, failed,
			objective-complete, and objective-incomplete states.
		`),
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			idPrefix: "quest",
		},
	},
);

export const InitialObjectStateSchema = editorObject(
	z.object({
		objectId: editorReference("object", {
			title: "Object",
			description:
				"The object id whose state should be initialized, such as item:lantern or feature:kitchen.table.",
			layout: {
				width: "full",
				order: 1,
			},
		}),

		state: ObjectStateDefaultsSchema.describe("The initial state values for this object."),
	}),
	{
		title: "Initial Object State",
		description: "Initial state for an arbitrary object id.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const InitialFlagSchema = editorObject(
	z.object({
		flag: editorFlagKey({
			title: "Flag",
			description: "The flag key to initialize.",
			layout: {
				width: "full",
				order: 1,
			},
		}),

		value: editorBoolean({
			title: "Value",
			description: "The starting boolean value for the flag.",
			layout: {
				width: "half",
				order: 2,
			},
		}),
	}),
	{
		title: "Initial Flag",
		description: "A starting flag value.",
	},
);

export const InitialCounterSchema = editorObject(
	z.object({
		counter: editorInput({
			title: "Counter",
			description: "The counter key to initialize.",
			required: true,
			layout: {
				width: "full",
				order: 1,
			},
		}).min(1),

		value: editorNumber({
			title: "Value",
			description: "The starting numeric value for the counter.",
			layout: {
				width: "half",
				order: 2,
			},
		}),
	}),
	{
		title: "Initial Counter",
		description: "A starting counter value.",
	},
);

export const WorldInitialStateSchema = editorObject(
	z.object({
		flags: editorArray(InitialFlagSchema, {
			title: "Flags",
			description: "Boolean flags that should exist when the game starts.",
			emptyState: {
				emptyTitle: "No starting flags",
				emptyDescription: "Add initial flags when the world should begin with known boolean state.",
				emptyActionLabel: "Add flag",
			},
			layout: {
				width: "full",
				order: 1,
			},
		}),

		counters: editorArray(InitialCounterSchema, {
			title: "Counters",
			description: "Numeric counters that should exist when the game starts.",
			emptyState: {
				emptyTitle: "No starting counters",
				emptyDescription: "Add initial counters when the world should begin with known numeric state.",
				emptyActionLabel: "Add counter",
			},
			layout: {
				width: "full",
				order: 2,
			},
		}),

		objectStates: editorArray(InitialObjectStateSchema, {
			title: "Object States",
			description: "Initial object states that should exist when the game starts.",
			emptyState: {
				emptyTitle: "No object states",
				emptyDescription:
					"Add initial object state when objects need open, locked, lit, broken, clean, or custom state.",
				emptyActionLabel: "Add object state",
			},
			layout: {
				width: "full",
				order: 3,
			},
		}),

		knownTopics: editorMultiSelect({
			title: "Known Topics",
			description: "Topic ids the player knows when the game starts.",
			entityType: "topic",
			layout: {
				width: "full",
				order: 4,
			},
		}),

		inventory: editorMultiSelect({
			title: "Inventory",
			description: "Item ids the player starts with. Prefer item.initialLocation when possible.",
			entityType: "item",
			layout: {
				width: "full",
				order: 5,
			},
		}),
	}),
	{
		title: "Initial State",
		description: docify(`
			World-level initial game state.

			This supplements static entity data and seeds runtime game state values like
			flags, counters, object states, known topics, and starting inventory.
		`),
	},
);

export const DefaultWorldInitialState = {
	flags: [],
	counters: [],
	objectStates: [],
	knownTopics: [],
	inventory: [],
} satisfies z.infer<typeof WorldInitialStateSchema>;

export const WorldMetadataSchema = editorObject(
	z.object({
		title: editorInput({
			title: "Title",
			description: "The title of the world.",
			placeholder: "Untitled World",
			layout: {
				width: "half",
				order: 1,
			},
		}).default(""),

		author: editorInput({
			title: "Author",
			description: "The author name shown in editor metadata.",
			layout: {
				width: "half",
				order: 2,
			},
		}).default(""),

		description: editorTextarea({
			title: "Description",
			description: "Short editor-facing or player-facing world description.",
			layout: {
				width: "full",
				order: 3,
			},
		}).default(""),

		version: editorInput({
			title: "Version",
			description: "The world data version.",
			placeholder: "0.1.0",
			layout: {
				width: "half",
				order: 4,
			},
		}).default("0.1.0"),
	}),
	{
		title: "World Metadata",
		description: "Optional world metadata.",
	},
);

export const DefaultWorldMetadata = {
	title: "",
	author: "",
	description: "",
	version: "0.1.0",
} satisfies z.infer<typeof WorldMetadataSchema>;

export const WorldSchema = editorObject(
	z
		.object({
			metadata: WorldMetadataSchema.default(DefaultWorldMetadata).describe(
				"Optional metadata about this world.",
			),

			startRoomId: editorReference("room", {
				title: "Start Room",
				description: "The id of the room where the player starts.",
				layout: {
					width: "full",
					order: 2,
				},
			}),

			rooms: editorArray(RoomSchema, {
				title: "Rooms",
				description: "All rooms that exist in the world.",
				emptyState: {
					emptyTitle: "No rooms",
					emptyDescription: "Add at least one room so the player has somewhere to start.",
					emptyActionLabel: "Add room",
				},
				duplicate: {
					duplicateBehavior: "with-new-id",
					idField: "id",
					idPrefix: "room",
				},
				layout: {
					width: "full",
					order: 3,
				},
			}),

			connections: editorArray(ConnectionSchema, {
				title: "Connections",
				description: "All connections between rooms in the world.",
				emptyState: {
					emptyTitle: "No connections",
					emptyDescription: "Add connections to let the player travel between rooms.",
					emptyActionLabel: "Add connection",
				},
				duplicate: {
					duplicateBehavior: "with-new-id",
					idField: "id",
					idPrefix: "connection",
				},
				layout: {
					width: "full",
					order: 4,
				},
			}),

			conditions: editorArray(WorldConditionSchema, {
				title: "Conditions",
				description: "Named condition definitions that can be attached throughout the world.",
				emptyState: {
					emptyTitle: "No conditions",
					emptyDescription:
						"Add named conditions that visibility, commands, events, and groups can use.",
					emptyActionLabel: "Add condition",
				},
				duplicate: {
					duplicateBehavior: "with-new-id",
					idField: "id",
					idPrefix: "condition",
				},
				layout: {
					width: "full",
					order: 5,
				},
			}),

			effects: editorArray(WorldEffectSchema, {
				title: "Effects",
				description: "Named effect definitions that can be attached throughout the world.",
				emptyState: {
					emptyTitle: "No effects",
					emptyDescription: "Add named effects that commands, events, groups, and branches can use.",
					emptyActionLabel: "Add effect",
				},
				duplicate: {
					duplicateBehavior: "with-new-id",
					idField: "id",
					idPrefix: "effect",
				},
				layout: {
					width: "full",
					order: 6,
				},
			}),

			items: editorArray(ItemSchema, {
				title: "Items",
				description: "All item definitions in the world.",
				emptyState: {
					emptyTitle: "No items",
					emptyDescription: "Add portable or world-placed objects the player can interact with.",
					emptyActionLabel: "Add item",
				},
				duplicate: {
					duplicateBehavior: "with-new-id",
					idField: "id",
					idPrefix: "item",
				},
				layout: {
					width: "full",
					order: 7,
				},
			}),

			npcs: editorArray(NpcSchema, {
				title: "NPCs",
				description: "All NPC definitions in the world.",
				emptyState: {
					emptyTitle: "No NPCs",
					emptyDescription: "Add characters the player can meet, talk to, or interact with.",
					emptyActionLabel: "Add NPC",
				},
				duplicate: {
					duplicateBehavior: "with-new-id",
					idField: "id",
					idPrefix: "npc",
				},
				layout: {
					width: "full",
					order: 7,
				},
			}),

			topics: editorArray(TopicSchema, {
				title: "Topics",
				description: "All known conversation or knowledge topics in the world.",
				emptyState: {
					emptyTitle: "No topics",
					emptyDescription: "Add topics for speech commands and NPC conversations.",
					emptyActionLabel: "Add topic",
				},
				duplicate: {
					duplicateBehavior: "with-new-id",
					idField: "id",
					idPrefix: "topic",
				},
				layout: {
					width: "full",
					order: 8,
				},
			}),

			quests: editorArray(QuestSchema, {
				title: "Quests",
				description: "All quest definitions in the world.",
				emptyState: {
					emptyTitle: "No quests",
					emptyDescription: "Add tracked story tasks and objectives.",
					emptyActionLabel: "Add quest",
				},
				duplicate: {
					duplicateBehavior: "with-new-id",
					idField: "id",
					idPrefix: "quest",
				},
				layout: {
					width: "full",
					order: 9,
				},
			}),

			authoredCommands: editorArray(AuthorCommandSchema, {
				title: "Authored Commands",
				description: "Editor-authored command rules saved as world data.",
				emptyState: {
					emptyTitle: "No authored commands",
					emptyDescription: "Add authored interactions that respond to player input.",
					emptyActionLabel: "Add command",
				},
				duplicate: {
					duplicateBehavior: "with-new-id",
					idField: "id",
					idPrefix: "command",
				},
				layout: {
					width: "full",
					order: 10,
				},
			}),

			authoredEvents: editorArray(AuthoredEventSchema, {
				title: "Authored Events",
				description: "Reusable authored events that commands and other events can schedule.",
				emptyState: {
					emptyTitle: "No authored events",
					emptyDescription: "Add reusable delayed or scheduled world events.",
					emptyActionLabel: "Add event",
				},
				duplicate: {
					duplicateBehavior: "with-new-id",
					idField: "id",
					idPrefix: "event",
				},
				layout: {
					width: "full",
					order: 11,
				},
			}),

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
			const conditionIds = new Set<string>();

			const fullFeatureIds = new Set<string>();
			const containerIds = new Set<string>();
			const surfaceIds = new Set<string>();

			for (const [roomIndex, room] of world.rooms.entries()) {
				const roomId = idValue(room.id);
				if (roomIds.has(roomId)) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate room id: ${roomId}`,
						path: ["rooms", roomIndex, "id"],
					});
				}

				roomIds.add(roomId);

				const roomFeatureIds = new Set<string>();

				for (const [featureIndex, feature] of room.features.entries()) {
					const featureId = idValue(feature.id);
					const fullFeatureId = `${roomId}.${featureId}`;

					if (roomFeatureIds.has(featureId)) {
						ctx.addIssue({
							code: "custom",
							message: `Duplicate feature id ${featureId} in room ${roomId}`,
							path: ["rooms", roomIndex, "features", featureIndex, "id"],
						});
					}

					roomFeatureIds.add(featureId);

					if (fullFeatureIds.has(fullFeatureId)) {
						ctx.addIssue({
							code: "custom",
							message: `Duplicate full feature id: ${fullFeatureId}`,
							path: ["rooms", roomIndex, "features", featureIndex, "id"],
						});
					}

					fullFeatureIds.add(fullFeatureId);

					if (feature.kind === "container") {
						containerIds.add(featureId);
						containerIds.add(fullFeatureId);
					}

					if (feature.kind === "surface") {
						surfaceIds.add(featureId);
						surfaceIds.add(fullFeatureId);
					}
				}
			}

			for (const [connectionIndex, connection] of world.connections.entries()) {
				const connectionId = idValue(connection.id);
				if (connectionIds.has(connectionId)) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate connection id: ${connectionId}`,
						path: ["connections", connectionIndex, "id"],
					});
				}

				connectionIds.add(connectionId);
			}

			for (const [conditionIndex, condition] of world.conditions.entries()) {
				const conditionId = "id" in condition && isID(condition.id) ? idValue(condition.id) : "";
				if (!conditionId) {
					ctx.addIssue({
						code: "custom",
						message: "World conditions need a condition id.",
						path: ["conditions", conditionIndex, "id"],
					});
					continue;
				}

				if (conditionIds.has(conditionId)) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate condition id: ${conditionId}`,
						path: ["conditions", conditionIndex, "id"],
					});
				}

				conditionIds.add(conditionId);
			}

			for (const [itemIndex, item] of world.items.entries()) {
				const itemId = idValue(item.id);
				if (itemIds.has(itemId)) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate item id: ${itemId}`,
						path: ["items", itemIndex, "id"],
					});
				}

				itemIds.add(itemId);
			}

			for (const [topicIndex, topic] of world.topics.entries()) {
				const topicId = idValue(topic.id);
				if (topicIds.has(topicId)) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate topic id: ${topicId}`,
						path: ["topics", topicIndex, "id"],
					});
				}

				topicIds.add(topicId);
			}

			for (const [npcIndex, npc] of world.npcs.entries()) {
				const npcId = idValue(npc.id);
				if (npcIds.has(npcId)) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate NPC id: ${npcId}`,
						path: ["npcs", npcIndex, "id"],
					});
				}

				npcIds.add(npcId);
			}

			for (const [questIndex, quest] of world.quests.entries()) {
				const questId = idValue(quest.id);
				if (questIds.has(questId)) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate quest id: ${questId}`,
						path: ["quests", questIndex, "id"],
					});
				}

				questIds.add(questId);

				const objectiveIds = new Set<string>();

				for (const [objectiveIndex, objective] of quest.objectives.entries()) {
					const objectiveId = idValue(objective.id);
					if (objectiveIds.has(objectiveId)) {
						ctx.addIssue({
							code: "custom",
							message: `Duplicate objective id ${objectiveId} in quest ${questId}`,
							path: ["quests", questIndex, "objectives", objectiveIndex, "id"],
						});
					}

					objectiveIds.add(objectiveId);
				}
			}

			for (const [commandIndex, command] of world.authoredCommands.entries()) {
				const commandId = idValue(command.id);
				if (commandIds.has(commandId)) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate authored command id: ${commandId}`,
						path: ["authoredCommands", commandIndex, "id"],
					});
				}

				commandIds.add(commandId);
			}

			for (const [eventIndex, event] of world.authoredEvents.entries()) {
				const eventId = idValue(event.id);
				if (eventIds.has(eventId)) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate authored event id: ${eventId}`,
						path: ["authoredEvents", eventIndex, "id"],
					});
				}

				eventIds.add(eventId);
			}

			const startRoomId = idValue(world.startRoomId);
			if (!roomIds.has(startRoomId)) {
				ctx.addIssue({
					code: "custom",
					message: `Starting room ${startRoomId} is not a real room.`,
					path: ["startRoomId"],
				});
			}

			for (const [connectionIndex, connection] of world.connections.entries()) {
				const fromRoomId = idValue(connection.fromRoomId);
				const toRoomId = idValue(connection.toRoomId);

				if (!roomIds.has(fromRoomId)) {
					ctx.addIssue({
						code: "custom",
						message: `Connection points from missing room: ${fromRoomId}`,
						path: ["connections", connectionIndex, "fromRoomId"],
					});
				}

				if (!roomIds.has(toRoomId)) {
					ctx.addIssue({
						code: "custom",
						message: `Connection points to missing room: ${toRoomId}`,
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
								message: `Feature ${idValue(room.id)}.${idValue(feature.id)} references missing initial item: ${itemId}`,
								path: ["rooms", roomIndex, "features", featureIndex, "initialItems", itemIndex],
							});
						}
					}
				}
			}

			for (const [itemIndex, item] of world.items.entries()) {
				if (
					item.initialLocation.type === "room" &&
					!roomIds.has(idValue(item.initialLocation.roomId))
				) {
					ctx.addIssue({
						code: "custom",
						message: `Item ${idValue(item.id)} starts in missing room: ${idValue(item.initialLocation.roomId)}`,
						path: ["items", itemIndex, "initialLocation", "roomId"],
					});
				}

				if (
					item.initialLocation.type === "container" &&
					!containerIds.has(idValue(item.initialLocation.containerId))
				) {
					ctx.addIssue({
						code: "custom",
						message: `Item ${idValue(item.id)} starts in missing container: ${idValue(item.initialLocation.containerId)}`,
						path: ["items", itemIndex, "initialLocation", "containerId"],
					});
				}

				if (
					item.initialLocation.type === "surface" &&
					!surfaceIds.has(idValue(item.initialLocation.surfaceId))
				) {
					ctx.addIssue({
						code: "custom",
						message: `Item ${idValue(item.id)} starts on missing surface: ${idValue(item.initialLocation.surfaceId)}`,
						path: ["items", itemIndex, "initialLocation", "surfaceId"],
					});
				}

				if (item.initialLocation.type === "npc" && !npcIds.has(idValue(item.initialLocation.npcId))) {
					ctx.addIssue({
						code: "custom",
						message: `Item ${idValue(item.id)} starts with missing NPC: ${idValue(item.initialLocation.npcId)}`,
						path: ["items", itemIndex, "initialLocation", "npcId"],
					});
				}
			}

			for (const [npcIndex, npc] of world.npcs.entries()) {
				if (npc.initialRoomId && !roomIds.has(idValue(npc.initialRoomId))) {
					ctx.addIssue({
						code: "custom",
						message: `NPC ${idValue(npc.id)} starts in missing room: ${idValue(npc.initialRoomId)}`,
						path: ["npcs", npcIndex, "initialRoomId"],
					});
				}

				for (const [inventoryIndex, itemId] of npc.initialInventory.entries()) {
					if (!itemIds.has(itemId)) {
						ctx.addIssue({
							code: "custom",
							message: `NPC ${idValue(npc.id)} starts with missing item: ${itemId}`,
							path: ["npcs", npcIndex, "initialInventory", inventoryIndex],
						});
					}
				}

				for (const [topicIndex, topicId] of npc.knownTopics.entries()) {
					if (!topicIds.has(topicId)) {
						ctx.addIssue({
							code: "custom",
							message: `NPC ${idValue(npc.id)} references missing topic: ${topicId}`,
							path: ["npcs", npcIndex, "knownTopics", topicIndex],
						});
					}
				}

				for (const [scheduleIndex, scheduleEntry] of npc.schedule.entries()) {
					const roomId = idValue(scheduleEntry.roomId);
					if (!roomIds.has(roomId)) {
						ctx.addIssue({
							code: "custom",
							message: `NPC ${idValue(npc.id)} schedule points to missing room: ${roomId}`,
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
		}),
	{
		title: "World",
		description: "A complete playable text adventure world.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export type Id = z.infer<typeof IdSchema>;
export type EntityVisibility = z.infer<typeof EntityVisibilitySchema>;
export type InteractionRule = z.infer<typeof InteractionRuleSchema>;
export type ItemLocation = z.infer<typeof ItemLocationSchema>;
export type Item = z.infer<typeof ItemSchema>;
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
export type {Connection, Direction, Point, Room} from "./roomSchema";
