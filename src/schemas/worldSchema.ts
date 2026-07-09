import {z} from "zod";
import {ConditionSchema} from "./conditionSchema";
import {AuthorCommandSchema} from "./authoredCommandSchema";
import {AuthoredEventSchema} from "./effectSchema";
import {docify} from "../utils/docify";
import {
	editorAliasList,
	editorArray,
	editorBoolean,
	editorConditionList,
	editorConditionalText,
	editorDiscriminatedUnion,
	editorEntityId,
	editorEntityIdList,
	editorFlagKey,
	editorId,
	editorInput,
	editorMessage,
	editorNonNegativeInteger,
	editorNumber,
	editorObject,
	editorOptionalFlagKey,
	editorOptionalRoomId,
	editorPositiveInteger,
	editorRichText,
	editorSelect,
	editorStringList,
	editorTagList,
	editorTextarea,
} from "@/schemas/editorSchemaHelpers";

export const IdSchema = editorId({
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

export const StateValueSchema = editorDiscriminatedUnion(
	z.union([z.string(), z.number(), z.boolean(), z.null()]),
	{
		title: "State Value",
		description: "A simple serializable state value.",
	},
);

export const ConditionalTextSchema = editorObject(
	z.object({
		text: editorRichText({
			title: "Text",
			description: "The text that will be used when all required conditions are met.",
			placeholder: "Describe the conditional text...",
			required: true,
			layout: {
				width: "full",
				order: 1,
			},
		}).min(1),

		when: editorConditionList(ConditionSchema, {
			title: "When",
			description: "Conditions that must all be true before this text can be used.",
			layout: {
				width: "full",
				order: 2,
			},
		}),
	}),
	{
		title: "Conditional Text",
		description: "Text that is only used when a set of conditions are met.",
		summary: {
			enabled: true,
			mode: "deterministic",
		},
	},
);

export const DirectionSchema = editorSelect(
	z.enum(["n", "ne", "e", "se", "s", "sw", "w", "nw", "up", "down", "in", "out"]),
	{
		title: "Direction",
		description: docify(`
			A direction used for room exits and return exits.

			Compass directions are useful for map-style worlds.
			Vertical and contextual directions support movement like up, down, in, and out.
		`),
		options: [
			{label: "North", value: "n"},
			{label: "Northeast", value: "ne"},
			{label: "East", value: "e"},
			{label: "Southeast", value: "se"},
			{label: "South", value: "s"},
			{label: "Southwest", value: "sw"},
			{label: "West", value: "w"},
			{label: "Northwest", value: "nw"},
			{label: "Up", value: "up"},
			{label: "Down", value: "down"},
			{label: "In", value: "in"},
			{label: "Out", value: "out"},
		],
	},
);

export const PathwaySchema = editorSelect(
	z.enum(["no-way", "two-way", "forwards", "backwards"]).default("two-way"),
	{
		title: "Pathway",
		description: "Controls whether travel is allowed through a connection, and in which direction.",
		options: [
			{
				label: "No Way",
				value: "no-way",
				description: "The connection exists, but travel is not allowed.",
				tone: "danger",
			},
			{
				label: "Two Way",
				value: "two-way",
				description: "Travel is allowed in both directions.",
				tone: "success",
			},
			{
				label: "Forwards",
				value: "forwards",
				description: "Travel is allowed from the source room to the destination room.",
			},
			{
				label: "Backwards",
				value: "backwards",
				description: "Travel is allowed from the destination room back to the source room.",
			},
		],
	},
);

export const PointSchema = editorObject(
	z.object({
		x: editorNumber({
			title: "X",
			description: "The horizontal position of the point.",
			layout: {
				width: "half",
				order: 1,
			},
		}),

		y: editorNumber({
			title: "Y",
			description: "The vertical position of the point.",
			layout: {
				width: "half",
				order: 2,
			},
		}),
	}),
	{
		title: "Point",
		description: "A two-dimensional position used by the editor layout.",
		appearance: {
			chrome: "compact",
		},
	},
);

export const DescriptionSchema = editorConditionalText(
	z.object({
		default: editorRichText({
			title: "Default Description",
			description: "The description that will be displayed if no other conditions are met.",
			placeholder: "Describe what the player sees...",
			layout: {
				width: "full",
				order: 1,
			},
		}).default(""),

		variants: editorArray(ConditionalTextSchema, {
			title: "Description Variants",
			description: "Description variants that can replace the description if conditions are met.",
			emptyState: {
				emptyTitle: "No variants",
				emptyDescription: "Add conditional descriptions for alternate world states.",
				emptyActionLabel: "Add variant",
			},
			duplicate: {
				duplicateBehavior: "exact",
			},
			layout: {
				width: "full",
				order: 2,
			},
		}),
	}),
	{
		title: "Description",
		description: "A default description with optional conditional variants.",
	},
);

export const EntityVisibilitySchema = editorObject(
	z.object({
		visibleWhen: editorConditionList(ConditionSchema, {
			title: "Visible When",
			description: "The entity is only visible when all of these conditions pass.",
			layout: {
				width: "full",
				order: 1,
			},
		}),

		hiddenWhen: editorConditionList(ConditionSchema, {
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
		allowedWhen: editorConditionList(ConditionSchema, {
			title: "Allowed When",
			description: "The interaction is allowed only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 1,
			},
		}),

		blockedWhen: editorConditionList(ConditionSchema, {
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

export const ObjectStateDefaultsSchema = editorObject(
	z.object({
		open: editorBoolean({
			title: "Open",
			description: "Initial open state for an object, door, feature, or container.",
			layout: {
				width: "half",
				order: 1,
			},
		}).optional(),

		locked: editorBoolean({
			title: "Locked",
			description: "Initial locked state for an object, door, feature, or container.",
			layout: {
				width: "half",
				order: 2,
			},
		}).optional(),

		lit: editorBoolean({
			title: "Lit",
			description: "Initial lit state for an object, item, or feature.",
			layout: {
				width: "half",
				order: 3,
			},
		}).optional(),

		broken: editorBoolean({
			title: "Broken",
			description: "Initial broken state for an object, item, or feature.",
			layout: {
				width: "half",
				order: 4,
			},
		}).optional(),

		clean: editorBoolean({
			title: "Clean",
			description: "Initial clean state for an object, item, surface, or feature.",
			layout: {
				width: "half",
				order: 5,
			},
		}).optional(),

		custom: editorObject(z.record(z.string(), StateValueSchema).default({}), {
			title: "Custom State",
			description: "Custom object state values, such as freshness, fuel, sealed, sticky, or charged.",
			advanced: true,
			layout: {
				width: "full",
				order: 6,
			},
		}),
	}),
	{
		title: "Object State Defaults",
		description: docify(`
			Initial built-in and custom object state.

			These values seed gameState.objectStates and can be checked by object-state
			conditions or changed by object-state effects.
		`),
	},
);

export const DefaultObjectStateDefaults = {
	custom: {},
} satisfies z.infer<typeof ObjectStateDefaultsSchema>;

export const ItemLocationSchema = editorDiscriminatedUnion(
	z.discriminatedUnion("type", [
		z.object({
			type: z.literal("inventory").describe("The item starts in the player's inventory."),
		}),

		z.object({
			type: z.literal("room").describe("The item starts loose in a room."),
			roomId: editorEntityId("room", {
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
			containerId: editorEntityId("container", {
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
			surfaceId: editorEntityId("surface", {
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
			npcId: editorEntityId("npc", {
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
		id: editorId({
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

		visibleWhen: editorConditionList(ConditionSchema, {
			title: "Visible When",
			description: "The item is visible only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 8,
			},
		}),

		takeableWhen: editorConditionList(ConditionSchema, {
			title: "Takeable When",
			description: "The item can be taken only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 9,
			},
		}),

		usableWhen: editorConditionList(ConditionSchema, {
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

export const RoomFeatureKindSchema = editorSelect(
	z
		.enum(["feature", "container", "surface", "door", "exit", "decoration", "hazard"])
		.default("feature"),
	{
		title: "Feature Kind",
		description: docify(`
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
		options: [
			{
				label: "Feature",
				value: "feature",
				description: "A normal interactable object that cannot be picked up.",
			},
			{
				label: "Container",
				value: "container",
				description: "Can contain items, such as a chest, cabinet, drawer, box, or bag.",
			},
			{
				label: "Surface",
				value: "surface",
				description: "Can have items placed on it, such as a table, shelf, desk, altar, or counter.",
			},
			{
				label: "Door",
				value: "door",
				description: "A feature that may control movement or locked/unlocked state.",
			},
			{
				label: "Exit",
				value: "exit",
				description: "A visible destination or passage.",
			},
			{
				label: "Decoration",
				value: "decoration",
				description: "Mostly descriptive, but still targetable if desired.",
				tone: "quiet",
			},
			{
				label: "Hazard",
				value: "hazard",
				description: "A dangerous or stateful room feature.",
				tone: "warning",
			},
		],
	},
);

export const RoomFeatureSchema = editorObject(
	z.object({
		id: editorId({
			title: "Feature ID",
			description: "The unique id used to identify this room feature.",
			required: true,
			layout: {
				width: "half",
				order: 1,
			},
		}),

		name: editorInput({
			title: "Name",
			description: "The display name of the room feature.",
			placeholder: "Kitchen Table",
			required: true,
			layout: {
				width: "half",
				order: 2,
			},
		}).min(1),

		aliases: editorAliasList({
			title: "Aliases",
			description: "Alternative names the player can use to refer to this feature.",
			layout: {
				width: "full",
				order: 3,
			},
		}),

		tags: editorTagList("features", {
			title: "Tags",
			description: "Tags used to group this feature.",
			layout: {
				width: "full",
				order: 4,
			},
		}),

		kind: RoomFeatureKindSchema.describe("The feature's interaction category."),

		description: DescriptionSchema.describe(
			"The description shown when the player examines or interacts with this feature.",
		),

		listedInRoom: editorBoolean({
			title: "Listed in Room",
			description:
				"Controls whether the feature is listed separately in the room output. Features can still be mentioned in the room description when this is false.",
			layout: {
				width: "half",
				order: 7,
			},
		}).default(false),

		activeWhen: editorConditionList(ConditionSchema, {
			title: "Active When",
			description:
				"The feature is not listed or interacted with unless all of these conditions are true.",
			layout: {
				width: "full",
				order: 8,
			},
		}),

		visibleWhen: editorConditionList(ConditionSchema, {
			title: "Visible When",
			description: "The feature is visible only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 9,
			},
		}),

		usableWhen: editorConditionList(ConditionSchema, {
			title: "Usable When",
			description: "The feature can be used only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 10,
			},
		}),

		examineSetsFlag: editorOptionalFlagKey({
			title: "Examine Sets Flag",
			description:
				"Optional flag set when this feature is examined. Useful for feature-examined conditions.",
			layout: {
				width: "full",
				order: 11,
			},
		}),

		capacity: editorPositiveInteger({
			title: "Capacity",
			description: "Optional maximum number of items this container or surface can hold.",
			layout: {
				width: "half",
				order: 12,
			},
		}).optional(),

		initialItems: editorEntityIdList("item", {
			title: "Initial Items",
			description:
				"Item ids initially inside this container or on this surface. Prefer item.initialLocation as the source of truth when possible.",
			layout: {
				width: "full",
				order: 13,
			},
		}),

		state: ObjectStateDefaultsSchema.default(DefaultObjectStateDefaults).describe(
			"Initial object state for this feature.",
		),
	}),
	{
		title: "Room Feature",
		description: docify(`
			A room feature is an interactable thing inside a room that the player usually
			cannot pick up.

			Features cover scenery, containers, surfaces, doors, exits, hazards, and
			other room-local objects.
		`),
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			idPrefix: "feature",
		},
	},
);

export const RoomSchema = editorObject(
	z.object({
		id: editorId({
			title: "Room ID",
			description: "The unique id used to identify this room.",
			required: true,
			layout: {
				width: "half",
				order: 1,
			},
		}),

		name: editorInput({
			title: "Name",
			description: "The display name of the room.",
			placeholder: "Kitchen",
			required: true,
			layout: {
				width: "half",
				order: 2,
			},
		}).min(1),

		aliases: editorAliasList({
			title: "Aliases",
			description: "Alternative names for this room.",
			layout: {
				width: "full",
				order: 3,
			},
		}),

		tags: editorTagList("rooms", {
			title: "Tags",
			description: "Tags used to group this room, such as indoors, outdoors, safe, dark, or kitchen.",
			layout: {
				width: "full",
				order: 4,
			},
		}),

		position: PointSchema.describe("The room's position in the editor canvas."),

		description: DescriptionSchema.describe(
			"The description shown when the player enters or looks around this room.",
		),

		shortDescription: editorTextarea({
			title: "Short Description",
			description: "Optional shorter description used after the room has already been visited.",
			placeholder: "You are back in the kitchen.",
			layout: {
				width: "full",
				order: 7,
			},
		}).default(""),

		features: editorArray(RoomFeatureSchema, {
			title: "Features",
			description: "Interactive room features that exist inside this room.",
			emptyState: {
				emptyTitle: "No features",
				emptyDescription:
					"Add scenery, containers, surfaces, doors, hazards, or other room-local objects.",
				emptyActionLabel: "Add feature",
			},
			duplicate: {
				duplicateBehavior: "with-new-id",
				idField: "id",
				idPrefix: "feature",
			},
			layout: {
				width: "full",
				order: 8,
			},
		}),

		visitedFlag: editorOptionalFlagKey({
			title: "Visited Flag",
			description: "Optional flag set when the player visits this room.",
			layout: {
				width: "half",
				order: 9,
			},
		}),

		viewedFlag: editorOptionalFlagKey({
			title: "Viewed Flag",
			description: "Optional flag set when this room's description is shown.",
			layout: {
				width: "half",
				order: 10,
			},
		}),

		activeWhen: editorConditionList(ConditionSchema, {
			title: "Active When",
			description: "The room is available only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 11,
			},
		}),

		visibleWhen: editorConditionList(ConditionSchema, {
			title: "Visible When",
			description: "The room can be discovered or referenced only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 12,
			},
		}),
	}),
	{
		title: "Room",
		description: "A location in the world that the player can visit.",
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			idPrefix: "room",
		},
	},
);

export const ConnectionSchema = editorObject(
	z.object({
		id: editorId({
			title: "Connection ID",
			description: "The unique id used to identify this connection.",
			required: true,
			layout: {
				width: "half",
				order: 1,
			},
		}),

		fromRoomId: editorEntityId("room", {
			title: "From Room",
			description: "The id of the room where this connection starts.",
			layout: {
				width: "half",
				order: 2,
			},
		}),

		toRoomId: editorEntityId("room", {
			title: "To Room",
			description: "The id of the room where this connection leads.",
			layout: {
				width: "half",
				order: 3,
			},
		}),

		direction: DirectionSchema.describe(
			"The direction the player uses to travel from the starting room to the destination room.",
		),

		returnDirection: DirectionSchema.describe(
			"The direction the player uses to travel back from the destination room to the starting room.",
		),

		aliases: editorAliasList({
			title: "Aliases",
			description: "Alternative words or phrases that can trigger travel through this connection.",
			layout: {
				width: "full",
				order: 6,
			},
		}),

		pathway: PathwaySchema.describe(
			"Controls whether this connection can be traveled both ways, only forwards, only backwards, or not at all.",
		),

		description: editorTextarea({
			title: "Description",
			description: "Optional description of the exit or passage.",
			placeholder: "A narrow stairway leads down into the cellar.",
			layout: {
				width: "full",
				order: 8,
			},
		}).default(""),

		blockedMessage: editorMessage({
			title: "Blocked Message",
			description: "Optional message shown when this connection exists but cannot be traveled.",
			placeholder: "The way is blocked.",
			layout: {
				width: "full",
				order: 9,
			},
		}).default(""),

		visibleWhen: editorConditionList(ConditionSchema, {
			title: "Visible When",
			description: "The connection is visible only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 10,
			},
		}),

		travelAllowedWhen: editorConditionList(ConditionSchema, {
			title: "Travel Allowed When",
			description: "The connection can be traveled only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 11,
			},
		}),

		lockedWhen: editorConditionList(ConditionSchema, {
			title: "Locked When",
			description: "The connection is considered locked when any of these conditions pass.",
			layout: {
				width: "full",
				order: 12,
			},
		}),

		state: ObjectStateDefaultsSchema.default(DefaultObjectStateDefaults).describe(
			"Initial state for this connection or exit, such as locked or open.",
		),
	}),
	{
		title: "Connection",
		description: docify(`
			A directional link between two rooms.

			Connections are used by movement commands and may also be referenced by
			authored commands, conditions, and effects.
		`),
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			idPrefix: "connection",
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
		id: editorId({
			title: "Schedule Entry ID",
			description: "Unique id for this schedule entry.",
			required: true,
			layout: {
				width: "half",
				order: 1,
			},
		}),

		roomId: editorEntityId("room", {
			title: "Room",
			description: "The room where the NPC should be for this schedule entry.",
			layout: {
				width: "half",
				order: 2,
			},
		}),

		when: editorConditionList(ConditionSchema, {
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
		id: editorId({
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

		initialRoomId: editorOptionalRoomId({
			title: "Initial Room",
			description: "The room where this NPC starts. Omit if the NPC starts unavailable or hidden.",
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

		initialInventory: editorEntityIdList("item", {
			title: "Initial Inventory",
			description: "Item ids this NPC starts with.",
			layout: {
				width: "full",
				order: 10,
			},
		}),

		visibleWhen: editorConditionList(ConditionSchema, {
			title: "Visible When",
			description: "The NPC is visible only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 11,
			},
		}),

		talkableWhen: editorConditionList(ConditionSchema, {
			title: "Talkable When",
			description: "The NPC can be spoken to only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 12,
			},
		}),

		knownTopics: editorEntityIdList("topic", {
			title: "Known Topics",
			description: "Topic ids this NPC can discuss.",
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
		id: editorId({
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

		knownWhen: editorConditionList(ConditionSchema, {
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
		id: editorId({
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

		completeWhen: editorConditionList(ConditionSchema, {
			title: "Complete When",
			description: "Conditions that mark this objective complete.",
			layout: {
				width: "full",
				order: 4,
			},
		}),

		visibleWhen: editorConditionList(ConditionSchema, {
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
		id: editorId({
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

		startWhen: editorConditionList(ConditionSchema, {
			title: "Start When",
			description: "Conditions that make this quest active.",
			layout: {
				width: "full",
				order: 5,
			},
		}),

		completeWhen: editorConditionList(ConditionSchema, {
			title: "Complete When",
			description: "Conditions that mark this quest completed.",
			layout: {
				width: "full",
				order: 6,
			},
		}),

		failWhen: editorConditionList(ConditionSchema, {
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
		objectId: editorEntityId("object", {
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

		knownTopics: editorEntityIdList("topic", {
			title: "Known Topics",
			description: "Topic ids the player knows when the game starts.",
			layout: {
				width: "full",
				order: 4,
			},
		}),

		inventory: editorEntityIdList("item", {
			title: "Inventory",
			description: "Item ids the player starts with. Prefer item.initialLocation when possible.",
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

			startRoomId: editorEntityId("room", {
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
					order: 5,
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
					order: 6,
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
					order: 7,
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
					order: 8,
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
					order: 9,
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
					order: 10,
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

				if (
					item.initialLocation.type === "surface" &&
					!surfaceIds.has(item.initialLocation.surfaceId)
				) {
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
