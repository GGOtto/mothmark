import {z} from "zod";

export const ConditionSchema = z
	.object({
		flag: z.string().min(1).describe("The id of the world flag that this condition checks."),
		value: z
			.boolean()
			.default(true)
			.describe("The boolean value the flag must match for this condition to pass."),
	})
	.describe("A condition that checks whether a world flag matches a required boolean value.");

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
	.enum(["n", "ne", "e", "se", "s", "sw", "w", "nw"])
	.describe("A compass direction used for room exits and return exits.");

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

export const RoomFeatureSchema = z
	.object({
		id: z.string().min(1).describe("The unique id used to identify this room feature."),
		name: z.string().min(1).describe("The display name of the room feature."),
		aliases: z
			.array(z.string().min(1))
			.default([])
			.describe("Alternative names the player can use to refer to this feature."),
		description: DescriptionSchema.describe(
			"The description shown when the player examines or interacts with this feature.",
		),
		listedInRoom: z
			.boolean()
			.default(false)
			.describe(
				"Controls whether the feature is listed in the room. Features can still be interacted with even if this is false. Defaults to false, since you would normally want to mention these in the room description.",
			),
		activeWhen: z
			.array(ConditionSchema)
			.default([])
			.describe(
				"The feature is not listed or interacted with unless all of these conditions are true.",
			),
	})
	.describe(
		"Room features are like items in the room that you can interact with. Unlike items, however, you can't pick them up.",
	);

export const RoomSchema = z
	.object({
		id: z.string().min(1).describe("The unique id used to identify this room."),
		name: z.string().min(1).describe("The display name of the room."),
		position: PointSchema.describe("The room's position in the editor canvas."),
		description: DescriptionSchema.describe(
			"The description shown when the player enters or looks around this room.",
		),
		features: z
			.array(RoomFeatureSchema)
			.optional()
			.describe("Interactive room features that exist inside this room."),
	})
	.describe("A location in the world that the player can visit.");

export const ConnectionSchema = z
	.object({
		id: z.string().min(1).describe("The unique id used to identify this connection."),
		fromRoomId: z.string().min(1).describe("The id of the room where this connection starts."),
		toRoomId: z.string().min(1).describe("The id of the room where this connection leads."),
		direction: DirectionSchema.describe(
			"The direction the player uses to travel from the starting room to the destination room.",
		),
		returnDirection: DirectionSchema.describe(
			"The direction the player uses to travel back from the destination room to the starting room.",
		),
		pathway: PathwaySchema.describe(
			"Controls whether this connection can be traveled both ways, only forwards, only backwards, or not at all.",
		),
	})
	.describe("A directional link between two rooms.");

export const WorldSchema = z
	.object({
		startRoomId: z.string().min(1).describe("The id of the room where the player starts."),
		rooms: z.array(RoomSchema).describe("All rooms that exist in the world."),
		connections: z.array(ConnectionSchema).describe("All connections between rooms in the world."),
	})
	.describe("A complete playable text adventure world.")
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

		// Starting room needs to exist.
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
