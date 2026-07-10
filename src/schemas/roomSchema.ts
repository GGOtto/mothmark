import {z} from "zod";
import {ConditionSchema} from "./conditionSchema";
import {DescriptionSchema} from "./descriptionSchema";
import {DefaultObjectStateDefaults, ObjectStateDefaultsSchema} from "./objectStateSchema";
import {docify} from "../utils/docify";
import {editor} from "./editorSchemaHelpers";

export const DirectionSchema = editor.select(
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

export const PathwaySchema = editor.select(
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

export const PointSchema = editor.object(
	z.object({
		x: editor.number({
			title: "X",
			features: {
				kind: "coordinate",
			},
			layout: {
				width: "half",
				order: 1,
			},
		}),

		y: editor.number({
			title: "Y",
			features: {
				kind: "coordinate",
			},
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
		features: {
			layout: "inline",
		},
	},
);

export const RoomFeatureKindSchema = editor.select(
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

export const RoomFeatureSchema = editor.object(
	z.object({
		id: editor.id({
			title: "Feature ID",
			description: "The unique id used to identify this room feature.",
			required: true,
			layout: {
				width: "half",
				order: 1,
				pinned: true,
			},
		}),

		name: editor
			.input({
				title: "Name",
				description: "The display name of the room feature.",
				placeholder: "Kitchen Table",
				required: true,
				layout: {
					width: "half",
					order: 2,
					pinned: true,
				},
			})
			.min(1),

		aliases: editor.aliasList({
			title: "Aliases",
			description: "Alternative names the player can use to refer to this feature.",
			layout: {
				width: "full",
				order: 5,
			},
		}),

		tags: editor.tagList("features", {
			title: "Tags",
			description: "Tags used to group this feature.",
			layout: {
				width: "full",
				order: 6,
			},
		}),

		kind: RoomFeatureKindSchema.describe("The feature's interaction category."),

		description: DescriptionSchema.describe(
			"The description shown when the player examines or interacts with this feature.",
		),

		listedInRoom: editor
			.boolean({
				title: "Listed in Room",
				description:
					"Controls whether the feature is listed separately in the room output. Features can still be mentioned in the room description when this is false.",
				layout: {
					width: "half",
					order: 7,
				},
			})
			.default(false),

		activeWhen: editor.conditionList(ConditionSchema, {
			title: "Active When",
			description:
				"The feature is not listed or interacted with unless all of these conditions are true.",
			layout: {
				width: "full",
				order: 8,
			},
		}),

		visibleWhen: editor.conditionList(ConditionSchema, {
			title: "Visible When",
			description: "The feature is visible only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 9,
			},
		}),

		usableWhen: editor.conditionList(ConditionSchema, {
			title: "Usable When",
			description: "The feature can be used only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 10,
			},
		}),

		examineSetsFlag: editor.optionalFlagKey({
			title: "Examine Sets Flag",
			description:
				"Optional flag set when this feature is examined. Useful for feature-examined conditions.",
			layout: {
				width: "full",
				order: 11,
			},
		}),

		capacity: editor
			.positiveInteger({
				title: "Capacity",
				description: "Optional maximum number of items this container or surface can hold.",
				layout: {
					width: "half",
					order: 12,
				},
			})
			.optional(),

		initialItems: editor.entityIdList("item", {
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
		childControls: {
			kind: {
				title: "Kind",
				description: "The feature's interaction category.",
				layout: {
					width: "half",
					order: 3,
					pinned: true,
				},
			},
			description: {
				title: "Description",
				description: "The description shown when the player examines or interacts with this feature.",
				layout: {
					width: "full",
					order: 4,
					pinned: true,
				},
			},
			state: {
				title: "State",
				description: "Initial object state for this feature.",
				layout: {
					width: "full",
					order: 14,
				},
			},
		},
	},
);

export const RoomSchema = editor.object(
	z.object({
		id: editor.id({
			title: "Room ID",
			description: "The unique id used to identify this room.",
			required: true,
			layout: {
				width: "half",
				order: 1,
				pinned: true,
			},
		}),

		name: editor
			.input({
				title: "Name",
				description: "The display name of the room.",
				placeholder: "Kitchen",
				required: true,
				layout: {
					width: "half",
					order: 2,
					pinned: true,
				},
			})
			.min(1),

		description: DescriptionSchema.describe(
			"The description shown when the player enters or looks around this room.",
		),

		shortDescription: editor
			.textarea({
				title: "Short Description",
				description: "Optional shorter description used after the room has already been visited.",
				placeholder: "You are back in the kitchen.",
				layout: {
					width: "full",
					order: 4,
					pinned: true,
				},
			})
			.default(""),

		aliases: editor.aliasList({
			title: "Aliases",
			description: "Alternative names for this room.",
			layout: {
				width: "full",
				order: 5,
			},
		}),

		tags: editor.tagList("rooms", {
			title: "Tags",
			description: "Tags used to group this room, such as indoors, outdoors, safe, dark, or kitchen.",
			layout: {
				width: "full",
				order: 6,
			},
		}),

		features: editor.linkList(
			{
				title: "Features",
				description: "Interactive room features that exist inside this room.",
				layout: {
					width: "full",
					order: 7,
				},
				features: {
					mode: "edit",
					linkType: "editor",
					emptyText: "No features",
					clickHint: "Edit",
					editorTarget: {
						kind: "entity",
						entityType: "feature",
						path: ["{sourcePath}", "{id}"],
						create: {
							enabled: true,
							buttonLabel: "Add feature",
							defaultLabel: "New feature",
							idPrefix: "feature",
						},
					},
				},
			},
			z.array(RoomFeatureSchema).default([]),
		),

		position: PointSchema.describe("The room's position in the editor canvas."),

		visitedFlag: editor.optionalFlagKey({
			title: "Visited Flag",
			description: "Optional flag set when the player visits this room.",
			layout: {
				width: "half",
				order: 9,
			},
		}),

		viewedFlag: editor.optionalFlagKey({
			title: "Viewed Flag",
			description: "Optional flag set when this room's description is shown.",
			layout: {
				width: "half",
				order: 10,
			},
		}),

		activeWhen: editor.conditionList(ConditionSchema, {
			title: "Active When",
			description: "The room is available only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 11,
			},
		}),

		visibleWhen: editor.conditionList(ConditionSchema, {
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
		childControls: {
			description: {
				title: "Description",
				description: "The description shown when the player enters or looks around this room.",
				layout: {
					width: "full",
					order: 3,
					pinned: true,
				},
			},
			position: {
				title: "Position",
				description: "The room's position in the editor canvas.",
				layout: {
					width: "full",
					order: 8,
				},
				appearance: {
					chrome: "compact",
				},
			},
		},
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			idPrefix: "room",
		},
	},
);

export const ConnectionSchema = editor.object(
	z.object({
		id: editor.id({
			title: "Connection ID",
			description: "The unique id used to identify this connection.",
			required: true,
			layout: {
				width: "half",
				order: 1,
				pinned: true,
			},
		}),

		name: editor
			.input({
				title: "Name",
				description: "The display name of the room.",
				placeholder: "Connection Name",
				required: true,
				layout: {
					width: "half",
					order: 2,
					pinned: true,
				},
			})
			.min(1)
			.optional(),

		fromRoomId: editor.entityId("room", {
			title: "From Room",
			description: "The id of the room where this connection starts.",
			layout: {
				width: "half",
				order: 2,
				pinned: true,
			},
		}),

		toRoomId: editor.entityId("room", {
			title: "To Room",
			description: "The id of the room where this connection leads.",
			layout: {
				width: "half",
				order: 3,
				pinned: true,
			},
		}),

		direction: DirectionSchema.describe(
			"The direction the player uses to travel from the starting room to the destination room.",
		),

		returnDirection: DirectionSchema.describe(
			"The direction the player uses to travel back from the destination room to the starting room.",
		),

		pathway: PathwaySchema.describe(
			"Controls whether this connection can be traveled both ways, only forwards, only backwards, or not at all.",
		),

		aliases: editor.aliasList({
			title: "Aliases",
			description: "Alternative words or phrases that can trigger travel through this connection.",
			layout: {
				width: "full",
				order: 7,
			},
		}),

		description: editor
			.textarea({
				title: "Description",
				description: "Optional description of the exit or passage.",
				placeholder: "A narrow stairway leads down into the cellar.",
				layout: {
					width: "full",
					order: 8,
				},
			})
			.default(""),

		blockedMessage: editor
			.message({
				title: "Blocked Message",
				description: "Optional message shown when this connection exists but cannot be traveled.",
				placeholder: "The way is blocked.",
				layout: {
					width: "full",
					order: 9,
				},
			})
			.default(""),

		visibleWhen: editor.conditionList(ConditionSchema, {
			title: "Visible When",
			description: "The connection is visible only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 10,
			},
		}),

		travelAllowedWhen: editor.conditionList(ConditionSchema, {
			title: "Travel Allowed When",
			description: "The connection can be traveled only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 11,
			},
		}),

		lockedWhen: editor.conditionList(ConditionSchema, {
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
		childControls: {
			direction: {
				title: "Direction",
				description:
					"The direction the player uses to travel from the starting room to the destination room.",
				layout: {
					width: "half",
					order: 4,
					pinned: true,
				},
			},
			returnDirection: {
				title: "Return Direction",
				description:
					"The direction the player uses to travel back from the destination room to the starting room.",
				layout: {
					width: "half",
					order: 5,
					pinned: true,
				},
			},
			pathway: {
				title: "Pathway",
				description:
					"Controls whether this connection can be traveled both ways, only forwards, only backwards, or not at all.",
				layout: {
					width: "full",
					order: 6,
					pinned: true,
				},
			},
			state: {
				title: "State",
				description: "Initial state for this connection or exit, such as locked or open.",
				layout: {
					width: "full",
					order: 13,
				},
			},
		},
	},
);

export type Direction = z.infer<typeof DirectionSchema>;
export type Point = z.infer<typeof PointSchema>;
export type Pathway = z.infer<typeof PathwaySchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type RoomFeatureKind = z.infer<typeof RoomFeatureKindSchema>;
export type RoomFeature = z.infer<typeof RoomFeatureSchema>;
