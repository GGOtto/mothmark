import {z} from "zod";

export const ConditionSchema = z.object({
	flag: z.string().min(1),
	value: z.boolean().default(true),
});

export const ConditionalTextSchema = z.object({
	text: z.string().min(1),
	when: z.array(ConditionSchema).default([]),
});

export const DirectionSchema = z.enum(["n", "ne", "e", "se", "s", "sw", "w", "nw"]);

export const PathwaySchema = z
	.enum(["no-way", "two-way", "forwards", "backwards"])
	.default("two-way");

export const PointSchema = z.object({
	x: z.number(),
	y: z.number(),
});

export const DescriptionSchema = z.object({
	default: z
		.string()
		.default("")
		.describe("The description that will be displayed if no other conditions are met."),
	variants: z
		.array(ConditionalTextSchema)
		.default([])
		.describe("Description variants that can replace the description if conditions are met."),
});

export const RoomFeatureSchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		aliases: z.array(z.string().min(1)).default([]),
		description: DescriptionSchema,
		listedInRoom: z
			.boolean()
			.default(false)
			.describe(
				"Controls whether the feature is listed in the room. Features can still be interacted with even if this is false. Defaults to false, since you would normally want to mention these in the room description.",
			),
		activeWhen: z
			.array(ConditionSchema)
			.default([])
			.describe("Item isn't listed or interacted with unless all of these conditions are true."),
	})
	.describe(
		"Room features are like items in the room that you can interact with. Unlike items, however, you can't pick them up.",
	);

export const RoomSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	position: PointSchema,
	description: DescriptionSchema,
	features: z.array(RoomFeatureSchema).optional(),
});

export const ConnectionSchema = z.object({
	id: z.string().min(1),
	fromRoomId: z.string().min(1),
	toRoomId: z.string().min(1),
	direction: DirectionSchema,
	returnDirection: DirectionSchema,
	pathway: PathwaySchema,
});

export const WorldSchema = z
	.object({
		startRoomId: z.string().min(1),
		rooms: z.array(RoomSchema),
		connections: z.array(ConnectionSchema),
	})
	.superRefine((world, ctx) => {
		// Collect every room id so we can check that connections point to real rooms.
		const roomIds = new Set<string>();

		// Collect every connection id so we can catch accidental duplicate connections.
		const connectionIds = new Set<string>();

		// Validate room-level rules.
		for (const [roomIndex, room] of world.rooms.entries()) {
			// Room ids need to be unique because connections refer to rooms by id.
			if (roomIds.has(room.id)) {
				ctx.addIssue({
					code: "custom",
					message: `Duplicate room id: ${room.id}`,
					path: ["rooms", roomIndex, "id"],
				});
			}

			roomIds.add(room.id);
		}

		// Starting romm needs to exist
		if (!roomIds.has(world.startRoomId)) {
			ctx.addIssue({
				code: "custom",
				message: `Starting room id ${world.startRoomId} is not a real room.`,
				path: ["world", "startRoomId"],
			});
		}

		// Validate connection-level rules.
		for (const [connectionIndex, connection] of world.connections.entries()) {
			// Connection ids should be unique so React/editor operations can target one connection safely.
			if (connectionIds.has(connection.id)) {
				ctx.addIssue({
					code: "custom",
					message: `Duplicate connection id: ${connection.id}`,
					path: ["connections", connectionIndex, "id"],
				});
			}

			connectionIds.add(connection.id);

			// A connection's starting room must exist in world.rooms.
			if (!roomIds.has(connection.fromRoomId)) {
				ctx.addIssue({
					code: "custom",
					message: `Connection points from missing room: ${connection.fromRoomId}`,
					path: ["connections", connectionIndex, "fromRoomId"],
				});
			}

			// A connection's destination room must exist in world.rooms.
			if (!roomIds.has(connection.toRoomId)) {
				ctx.addIssue({
					code: "custom",
					message: `Connection points to missing room: ${connection.toRoomId}`,
					path: ["connections", connectionIndex, "toRoomId"],
				});
			}
		}
	});

export type Direction = z.infer<typeof DirectionSchema>;
export type Point = z.infer<typeof PointSchema>;
export type Pathway = z.infer<typeof PathwaySchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type World = z.infer<typeof WorldSchema>;
export type Condition = z.infer<typeof ConditionSchema>;
export type ConditionalText = z.infer<typeof ConditionalTextSchema>;
export type RoomFeature = z.infer<typeof RoomFeatureSchema>;
export type Description = z.infer<typeof DescriptionSchema>;
