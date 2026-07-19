import {z} from "zod";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {docify} from "@/schemas/utils/docify";
import {WorldConditionSchema} from "./conditionSchema";
import {WorldEffectSchema} from "./effectSchema";
import {ConnectionSchema, RoomSchema} from "./roomSchema";
import {idValue, isID} from "../../utils/idUtils";

export const InitialFlagSchema = editor.object({
	flag: editor.flagKey({title: "Flag"}),
	value: editor.boolean({title: "Value"}),
});

export const InitialCounterSchema = editor.object({
	counter: editor.counterKey({title: "Counter"}),
	value: editor.number({title: "Value"}),
});

export const WorldInitialStateSchema = editor.object(
	{
		flags: editor.array(InitialFlagSchema, {title: "Initial Flags"}),
		counters: editor.array(InitialCounterSchema, {title: "Initial Counters"}),
	},
	{
		title: "Initial State",
		description: "Flag and counter values used when a room exploration session starts.",
	},
);

export const DefaultWorldInitialState = {
	flags: [],
	counters: [],
} satisfies z.infer<typeof WorldInitialStateSchema>;

export const DefaultViewport = {x: 0, y: 0, zoom: 1};

export const ViewportSchema = editor.setDefault(
	editor.object({
		x: editor.setDefault(editor.number({}, z.number()), DefaultViewport.x),
		y: editor.setDefault(editor.number({}, z.number()), DefaultViewport.y),
		zoom: editor.setDefault(editor.number({}, z.number()), DefaultViewport.zoom),
	}),
	DefaultViewport,
);

export const LayerSchema = editor.object(
	{
		name: z.string(),
		layer: z.number(),
		rooms: z.array(editor.id("room", {})).default([]),
		viewport: ViewportSchema.default(DefaultViewport),
	},
	{
		title: "Layer",
		description: "A map layer containing a set of rooms and its saved viewport.",
	},
);

export const WorldMetadataSchema = editor.object(
	{
		title: editor.input({title: "Title", placeholder: "Untitled World"}).default(""),
		author: editor.input({title: "Author"}).default(""),
		description: editor.textarea({title: "Description"}).default(""),
		version: editor.input({title: "Version", placeholder: "0.1.0"}).default("0.1.0"),
		layers: z.array(LayerSchema).default([]),
	},
	{title: "World Metadata", description: "Editor metadata for this room map."},
);

export const DefaultWorldMetadata = {
	title: "",
	author: "",
	description: "",
	version: "0.1.0",
	layers: [],
} satisfies z.infer<typeof WorldMetadataSchema>;

export const WorldSchema = editor
	.object(
		{
			metadata: WorldMetadataSchema.default(DefaultWorldMetadata),
			startRoomId: editor.reference("room", {
				title: "Start Room",
				description: "The room where exploration starts.",
			}),
			rooms: editor.array(RoomSchema, {
				title: "Rooms",
				description: "All rooms and their local features.",
				emptyState: {
					emptyTitle: "No rooms",
					emptyDescription: "Add at least one room.",
					emptyActionLabel: "Add room",
				},
				duplicate: {duplicateBehavior: "with-new-id", idField: "id", idPrefix: "room"},
			}),
			connections: editor.array(ConnectionSchema, {
				title: "Connections",
				description: "Travel links between rooms.",
				emptyState: {
					emptyTitle: "No connections",
					emptyDescription: "Add connections to link rooms.",
					emptyActionLabel: "Add connection",
				},
				duplicate: {duplicateBehavior: "with-new-id", idField: "id", idPrefix: "connection"},
			}),
			conditions: editor.array(WorldConditionSchema, {
				title: "Conditions",
				description: "Reusable conditions for rooms and features.",
				duplicate: {duplicateBehavior: "with-new-id", idField: "id", idPrefix: "condition"},
			}),
			effects: editor.array(WorldEffectSchema, {
				title: "Effects",
				description: "Reusable effects retained for room and feature interactions.",
				duplicate: {duplicateBehavior: "with-new-id", idField: "id", idPrefix: "effect"},
			}),
			initialState: WorldInitialStateSchema.default(DefaultWorldInitialState),
		},
		{
			title: "World",
			description: "A room map made of rooms, connections, and room-local features.",
		},
	)
	.describe(
		docify(`
			The authored world currently contains rooms, connections, and room features.
			Conditions, effects, flags, and counters remain as supporting logic.

			TODO: Restore additional entity collections only when their runtime models are rebuilt.
		`),
	)
	.superRefine((world, ctx) => {
		const roomIds = new Set<string>();
		const connectionIds = new Set<string>();
		const conditionIds = new Set<string>();

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

			const featureIds = new Set<string>();
			for (const [featureIndex, feature] of room.features.entries()) {
				const featureId = idValue(feature.id);
				if (featureIds.has(featureId)) {
					ctx.addIssue({
						code: "custom",
						message: `Duplicate feature id ${featureId} in room ${roomId}`,
						path: ["rooms", roomIndex, "features", featureIndex, "id"],
					});
				}
				featureIds.add(featureId);
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

			for (const [field, roomId] of [
				["fromRoomId", idValue(connection.fromRoomId)],
				["toRoomId", idValue(connection.toRoomId)],
			] as const) {
				if (!roomIds.has(roomId)) {
					ctx.addIssue({
						code: "custom",
						message: `Connection references missing room: ${roomId}`,
						path: ["connections", connectionIndex, field],
					});
				}
			}
		}

		for (const [conditionIndex, condition] of world.conditions.entries()) {
			const conditionId = "id" in condition && isID(condition.id) ? idValue(condition.id) : "";
			if (!conditionId || conditionIds.has(conditionId)) {
				ctx.addIssue({
					code: "custom",
					message: conditionId
						? `Duplicate condition id: ${conditionId}`
						: "World conditions need a condition id.",
					path: ["conditions", conditionIndex, "id"],
				});
			}
			conditionIds.add(conditionId);
		}

		if (!roomIds.has(idValue(world.startRoomId))) {
			ctx.addIssue({
				code: "custom",
				message: `Starting room ${idValue(world.startRoomId)} is not a real room.`,
				path: ["startRoomId"],
			});
		}
	});

export type InitialFlag = z.infer<typeof InitialFlagSchema>;
export type InitialCounter = z.infer<typeof InitialCounterSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type WorldInitialState = z.infer<typeof WorldInitialStateSchema>;
export type WorldMetadata = z.infer<typeof WorldMetadataSchema>;
export type World = z.infer<typeof WorldSchema>;
export type Viewport = z.infer<typeof ViewportSchema>;
export type {Connection, Direction, Point, Room, RoomFeature} from "./roomSchema";
