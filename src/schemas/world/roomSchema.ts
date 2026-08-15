import {z} from "zod";
import {docify} from "@/schemas/utils/docify";
import {editor} from "../utils/editorSchemaHelpers";
import {ROOM_FLAG_DEFINITIONS} from "./entityFlagDefinitions";
import {DirectionSchema} from "./directionSchema";
import {ConditionalTextSchema} from "./conditionSchema";

export {DirectionSchema} from "./directionSchema";

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
		descriptionFragments: editor
			.array(ConditionalTextSchema, {
				title: "Conditional description fragments",
				description: "Extra room text shown whenever its condition passes.",
				layout: {group: "details", width: "full", order: 3.5},
			})
			.default([]),

		shortDescription: editor
			.textarea({
				title: "Short description",
				description: "Optional shorter description used after the room has already been visited.",
				placeholder: "You are back in the kitchen.",
				layout: {
					group: "details",
					width: "full",
					order: 4,
				},
				appearance: {
					chrome: "field",
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

		flags: editor
			.objectFlags({
				title: "Flags",
				description: "Boolean state attached to this room and its initial values.",
				layout: {
					group: "state",
					width: "full",
					order: 8,
				},
				features: {flags: ROOM_FLAG_DEFINITIONS},
			})
			.default({visited: false, active: true}),

		metadata: RoomMetadataSchema,
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
					id: "state",
					title: "State",
					description: "Initial room state. Items placed in this room are edited from Items.",
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
				description: "The display name of the connection.",
				placeholder: "Connection Name",
				required: true,
				layout: {
					group: "details",
					width: "half",
					order: 2,
				},
			})
			.optional(),

		fromRoomId: editor.reference("room", {
			title: "Start Room",
			description: "The id of the room where this connection starts.",
			layout: {
				group: "route",
				width: "half",
				order: 2,
			},
		}),

		toRoomId: editor.reference("room", {
			title: "End Room",
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
				title: "Start Direction",
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
		},
	},
);

export type Direction = z.infer<typeof DirectionSchema>;
export type Point = z.infer<typeof PointSchema>;
export type Pathway = z.infer<typeof PathwaySchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
