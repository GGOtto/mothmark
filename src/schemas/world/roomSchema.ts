import {z} from "zod";
import {ConditionSchema} from "./conditionSchema";
import {docify} from "@/schemas/utils/docify";
import {editor} from "../utils/editorSchemaHelpers";

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

export const PointSchema = z.object({
	x: z.number(),
	y: z.number(),
});

export const RoomMetadataSchema = z.object({
	position: PointSchema.describe("The room's position in the editor canvas."),
});

export const ConnectionMetadataSchema = z
	.object({
		fromLayerStubPoint: PointSchema.optional(),
		toLayerStubPoint: PointSchema.optional(),
	})
	.default({});

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
			An enclosed feature, such as a chest, cabinet, drawer, box, or bag.

			surface:
			An open supporting feature, such as a table, shelf, desk, altar, or counter.

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
				description: "An enclosed feature, such as a chest, cabinet, drawer, box, or bag.",
			},
			{
				label: "Surface",
				value: "surface",
				description: "An open supporting feature, such as a table, shelf, desk, altar, or counter.",
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
	{
		id: editor.id("feature", {
			title: "Feature ID",
			description: "The unique id used to identify this room feature.",
			required: true,
			layout: {
				width: "half",
				order: 1,
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

		description: editor.richText({
			placeholder: "Describe what the player sees...",
			layout: {
				group: "details",
				width: "full",
				order: 3,
			},
			title: "Description",
			description: "A default description with optional conditional variants.",
			appearance: {
				chrome: "field",
			},
		}),

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

		activeWhen: editor.conditionControl(ConditionSchema, {
			title: "Active When",
			description:
				"The feature is not listed or interacted with unless all of these conditions are true.",
			layout: {
				width: "full",
				order: 8,
			},
		}),

		visibleWhen: editor.conditionControl(ConditionSchema, {
			title: "Visible When",
			description: "The feature is visible only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 9,
			},
		}),

		usableWhen: editor.conditionControl(ConditionSchema, {
			title: "Usable When",
			description: "The feature can be used only when all of these conditions pass.",
			layout: {
				width: "full",
				order: 10,
			},
		}),

		flags: editor
			.objectFlags({
				title: "Flags",
				description: "Boolean state attached to this feature and its initial values.",
				layout: {
					width: "full",
					order: 11,
				},
				features: {
					flags: {
						examined: {
							permanent: true,
							defaultReadonly: true,
							description: "Set when the player examines this feature.",
						},
					},
				},
			})
			.default({examined: false}),
	},
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
				},
			},
			description: {
				layout: {
					width: "full",
					order: 4,
				},
			},
		},
	},
);

export const RoomSchema = editor.object(
	{
		id: editor.id("room", {
			title: "Room ID",
			description: "The unique id used to identify this room.",
			required: true,
			layout: {
				group: "details",
				width: "half",
				order: -1,
			},
		}),

		name: editor
			.input({
				title: "Name",
				description: "The display name of the room.",
				placeholder: "Kitchen",
				required: true,
				layout: {
					group: "details",
					width: "half",
					order: 2,
				},
			})
			.min(1),

		description: editor.richText({
			placeholder: "Describe what the player sees...",
			layout: {
				group: "details",
				width: "full",
				order: 3,
			},
			title: "Description",
			description: "A default description with optional conditional variants.",
			appearance: {
				chrome: "field",
			},
		}),

		shortDescription: editor
			.textarea({
				title: "Short Description",
				description: "Optional shorter description used after the room has already been visited.",
				placeholder: "You are back in the kitchen.",
				layout: {
					group: "details",
					width: "full",
					order: 4,
				},
				appearance: {
					chrome: "collapse",
					defaultCollapsed: true,
				},
			})
			.default(""),

		aliases: editor.aliasList({
			title: "Aliases",
			description: "Alternative names for this room.",
			layout: {
				group: "identify",
				width: "full",
				order: 5,
			},
		}),

		tags: editor.tagList("rooms", {
			title: "Tags",
			description: "Tags used to group this room, such as indoors, outdoors, safe, dark, or kitchen.",
			layout: {
				group: "identify",
				width: "full",
				order: 6,
			},
		}),

		features: editor.linkList(
			{
				title: "Features",
				description: "Interactive room features that exist inside this room.",
				layout: {
					group: "features",
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

		flags: editor
			.objectFlags({
				title: "Flags",
				description: "Boolean state attached to this room and its initial values.",
				layout: {
					group: "features",
					width: "full",
					order: 8,
				},
				features: {
					flags: {
						visited: {
							permanent: true,
							defaultReadonly: true,
							description: "Set when the player visits this room.",
						},
					},
				},
			})
			.default({visited: false}),

		metadata: RoomMetadataSchema,

		activeWhen: editor.conditionControl(ConditionSchema, {
			title: "Active When",
			description:
				"The room is available only when all of these conditions pass. Passages to this room will be blocked.",
			layout: {
				group: "availability",
				width: "full",
				order: 11,
			},
		}),
	},
	{
		title: "Room",
		description: "A location in the world that the player can visit.",
		features: {
			layout: "section",
			groups: [
				{
					id: "details",
					title: "Presentation",
					description: "Control what the player will see when interacting with this room.",
					order: 10,
					groups: [
						{
							id: "identify",
							title: "Identification",
							description: "Tags used to identify this room if a user types something close to the name.",
							defaultCollapsed: true,
						},
					],
				},
				{
					id: "features",
					title: "Features",
					description: "Interactive features located in this room.",
					order: 30,
					defaultCollapsed: true,
				},
				{
					id: "availability",
					title: "Availability",
					description: "Block passages into this room until these conditions are met.",
					order: 40,
					defaultCollapsed: true,
				},
			],
		},
		duplicate: {
			duplicateBehavior: "with-new-id",
			idField: "id",
			idPrefix: "room",
		},
	},
);

export const ConnectionSchema = editor.object(
	{
		id: editor.id("connection", {
			title: "Connection ID",
			description: "The unique id used to identify this connection.",
			required: true,
			layout: {
				group: "details",
				width: "half",
				order: 1,
			},
		}),

		name: editor
			.input({
				title: "Name",
				description: "The display name of the room.",
				placeholder: "Connection Name",
				required: true,
				layout: {
					group: "details",
					width: "half",
					order: 2,
				},
			})
			.min(1)
			.optional(),

		fromRoomId: editor.reference("room", {
			title: "From Room",
			description: "The id of the room where this connection starts.",
			layout: {
				group: "route",
				width: "half",
				order: 2,
			},
		}),

		toRoomId: editor.reference("room", {
			title: "To Room",
			description: "The id of the room where this connection leads.",
			layout: {
				group: "route",
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

		pathway: PathwaySchema.describe(
			"Controls whether this connection can be traveled both ways, only forwards, only backwards, or not at all.",
		),

		metadata: ConnectionMetadataSchema,

		aliases: editor.aliasList({
			title: "Aliases",
			description: "Alternative words or phrases that can trigger travel through this connection.",
			layout: {
				group: "details",
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
					group: "messages",
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
					group: "messages",
					width: "full",
					order: 9,
				},
			})
			.default(""),

		visibleWhen: editor.conditionControl(ConditionSchema, {
			title: "Visible When",
			description: "The connection is visible only when all of these conditions pass.",
			layout: {
				group: "availability",
				width: "full",
				order: 10,
			},
		}),

		travelAllowedWhen: editor.conditionControl(ConditionSchema, {
			title: "Travel Allowed When",
			description: "The connection can be traveled only when all of these conditions pass.",
			layout: {
				group: "availability",
				width: "full",
				order: 11,
			},
		}),

		lockedWhen: editor.conditionControl(ConditionSchema, {
			title: "Locked When",
			description: "The connection is considered locked when any of these conditions pass.",
			layout: {
				group: "availability",
				width: "full",
				order: 12,
			},
		}),
	},
	{
		title: "Connection",
		description: docify(`
			A directional link between two rooms.

			Connections are used by movement and may also be referenced by conditions
			and effects.
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
					group: "route",
					width: "half",
					order: 4,
				},
			},
			returnDirection: {
				title: "Return Direction",
				description:
					"The direction the player uses to travel back from the destination room to the starting room.",
				layout: {
					group: "route",
					width: "half",
					order: 5,
				},
			},
			pathway: {
				title: "Pathway",
				description:
					"Controls whether this connection can be traveled both ways, only forwards, only backwards, or not at all.",
				layout: {
					group: "route",
					width: "full",
					order: 6,
				},
			},
		},
		features: {
			layout: "section",
			groups: [
				{
					id: "route",
					title: "Route",
					description: "The connected rooms, travel directions, and permitted pathway.",
					order: 10,
				},
				{
					id: "details",
					title: "Details",
					description: "The connection's identifier, name, and travel aliases.",
					order: 20,
				},
				{
					id: "messages",
					title: "Messages",
					description: "Player-facing descriptions and blocked-travel feedback.",
					order: 30,
				},
				{
					id: "availability",
					title: "Availability",
					description: "Conditions controlling visibility, travel, and locking.",
					order: 40,
					defaultCollapsed: true,
				},
			],
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
