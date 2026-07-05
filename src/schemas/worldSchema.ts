import {z} from "zod";

export const DirectionSchema = z.enum(["n", "ne", "e", "se", "s", "sw", "w", "nw"]);

export const PathwaySchema = z
	.enum(["no-way", "two-way", "forwards", "backwards"])
	.default("two-way");

export const PointSchema = z.object({
	x: z.number(),
	y: z.number(),
});

export const RoomSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	position: PointSchema,
});

export const ConnectionSchema = z.object({
	id: z.string().min(1),
	fromRoomId: z.string().min(1),
	toRoomId: z.string().min(1),
	direction: DirectionSchema,
	returnDirection: DirectionSchema,
	controlPoints: z.array(PointSchema).optional(),
	pathway: PathwaySchema,
});

export const WorldSchema = z
	.object({
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
