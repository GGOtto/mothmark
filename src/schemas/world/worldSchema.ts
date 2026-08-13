import {z} from "zod";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {docify} from "@/schemas/utils/docify";
import {SavedConditionSchema} from "./conditionSchema";
import {EffectGroupSchema} from "./effectSchema";
import {EventSchema} from "./eventSchema";
import {CommandSchema} from "./commandSchemas";
import {ConnectionSchema, RoomSchema} from "./roomSchema";
import {ITEM_SIZE_UNITS, ItemSchema} from "./itemSchema";
import {idValue} from "../../utils/idUtils";

export const InitialFlagSchema = editor.object({
	flag: editor.flagKey({title: "Flag"}),
	value: editor.boolean({title: "Value"}),
});

export const InitialCounterSchema = editor.object({
	counter: editor.counterKey({title: "Counter"}),
	value: editor.number({title: "Value"}),
});

export const InitialTextSchema = editor.object({
	text: editor.textKey({title: "Text variable"}),
	value: editor.textarea({title: "Value"}),
});

export const WorldInitialStateSchema = editor.object(
	{
		flags: editor.array(InitialFlagSchema, {title: "Initial Flags"}),
		counters: editor.array(InitialCounterSchema, {title: "Initial Counters"}),
		texts: editor.array(InitialTextSchema, {title: "Initial text"}).default([]),
	},
	{
		title: "Initial State",
		description: "Flag, counter, and text values used when a room exploration session starts.",
	},
);

export const DefaultWorldInitialState = {
	flags: [],
	counters: [],
	texts: [],
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
			deathMessage: editor.string(),
			rooms: editor.array(RoomSchema, {
				title: "Rooms",
				description: "All rooms in the world.",
				emptyState: {
					emptyTitle: "No rooms",
					emptyDescription: "Add at least one room.",
					emptyActionLabel: "Add room",
				},
				duplicate: {duplicateBehavior: "with-new-id", idField: "id", idPrefix: "room"},
			}),
			items: editor.array(ItemSchema, {
				title: "Items",
				description: "All portable and fixed objects, including former room features.",
				emptyState: {
					emptyTitle: "No items",
					emptyDescription: "Add scenery, containers, surfaces, doors, tools, and other objects.",
					emptyActionLabel: "Add item",
				},
				duplicate: {duplicateBehavior: "with-new-id", idField: "id", idPrefix: "item"},
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
			commands: editor.array(CommandSchema, {
				title: "Commands",
				description: "Author-defined player commands and their conditional behavior.",
				emptyState: {
					emptyTitle: "No authored commands",
					emptyDescription: "Add a command to match player input and run authored behavior.",
					emptyActionLabel: "Add command",
				},
				duplicate: {duplicateBehavior: "with-new-id", idField: "id", idPrefix: "command"},
			}),
			conditions: editor.array(SavedConditionSchema, {
				title: "Conditions",
				description: "Reusable conditions for rooms and items.",
				duplicate: {
					duplicateBehavior: "with-new-id",
					idField: "identity",
					idPrefix: "condition",
				},
			}),
			effects: editor.array(EffectGroupSchema, {
				title: "Effects",
				description: "Reusable effects retained for room and item interactions.",
				duplicate: {duplicateBehavior: "with-new-id", idField: "id", idPrefix: "effect"},
			}),
			events: editor
				.array(EventSchema, {
					title: "Events",
					description: "Conditional event branches evaluated while the game is running.",
					duplicate: {duplicateBehavior: "with-new-id", idField: "id", idPrefix: "event"},
				})
				.optional(),
			initialState: WorldInitialStateSchema.default(DefaultWorldInitialState),
		},
		{
			title: "World",
			description: "A room map with authored commands and supporting world logic.",
		},
	)
	.describe(
		docify(`
			The authored world contains rooms, connections, items, and commands.
			Conditions, effects, flags, and counters remain as supporting logic.

			TODO: Restore additional entity collections only when their runtime models are rebuilt.
		`),
	)
	.superRefine((world, ctx) => {
		const roomIds = new Set<string>();
		const itemIds = new Set<string>();
		const connectionIds = new Set<string>();
		const commandIds = new Set<string>();
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
		}

		for (const [itemIndex, item] of world.items.entries()) {
			const itemId = idValue(item.id);
			if (!itemId || itemIds.has(itemId)) {
				ctx.addIssue({
					code: "custom",
					message: itemId ? `Duplicate item id: ${itemId}` : "Items need an item id.",
					path: ["items", itemIndex, "id"],
				});
			}
			itemIds.add(itemId);
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

		for (const [commandIndex, command] of world.commands.entries()) {
			const commandId = idValue(command.id);
			if (!commandId || commandIds.has(commandId)) {
				ctx.addIssue({
					code: "custom",
					message: commandId
						? `Duplicate command id: ${commandId}`
						: "Authored commands need a command id.",
					path: ["commands", commandIndex, "id"],
				});
			}
			commandIds.add(commandId);
		}

		for (const [conditionIndex, condition] of world.conditions.entries()) {
			const conditionId = idValue(condition.identity);
			if (!conditionId || conditionIds.has(conditionId)) {
				ctx.addIssue({
					code: "custom",
					message: conditionId
						? `Duplicate condition id: ${conditionId}`
						: "World conditions need a condition id.",
					path: ["conditions", conditionIndex, "identity"],
				});
			}
			conditionIds.add(conditionId);
		}

		const itemsById = new Map(world.items.map((item) => [idValue(item.id), item]));
		const containedSize = new Map<string, number>();
		for (const [itemIndex, item] of world.items.entries()) {
			const location = item.initialState.location;
			if (location.type === "room" && !roomIds.has(idValue(location.roomId))) {
				ctx.addIssue({
					code: "custom",
					message: `Item ${idValue(item.id)} starts in a missing room.`,
					path: ["items", itemIndex, "initialState", "location", "roomId"],
				});
			}
			if (location.type === "hidden" && location.roomId && !roomIds.has(idValue(location.roomId))) {
				ctx.addIssue({
					code: "custom",
					message: `Item ${idValue(item.id)} is associated with a missing room.`,
					path: ["items", itemIndex, "initialState", "location", "roomId"],
				});
			}
			if (location.type === "item") {
				const parentId = idValue(location.itemId);
				const parent = itemsById.get(parentId);
				if (!parent) {
					ctx.addIssue({
						code: "custom",
						message: `Item ${idValue(item.id)} starts in or on a missing item.`,
						path: ["items", itemIndex, "initialState", "location", "itemId"],
					});
					continue;
				}
				if (parent === item) {
					ctx.addIssue({
						code: "custom",
						message: "An item cannot start inside or on itself.",
						path: ["items", itemIndex, "initialState", "location", "itemId"],
					});
					continue;
				}

				const takeable = item.behaviors.find((behavior) => behavior.type === "takeable");
				const requiredBehavior = location.placement === "inside" ? "container" : "surface";
				const receptacle =
					location.placement === "inside"
						? parent.behaviors.find((behavior) => behavior.type === "container")
						: parent.behaviors.find((behavior) => behavior.type === "surface");
				if (!takeable) {
					ctx.addIssue({
						code: "custom",
						message: "Only takeable items can start inside or on another item.",
						path: ["items", itemIndex, "initialState", "location"],
					});
				} else if (!receptacle) {
					ctx.addIssue({
						code: "custom",
						message: `The target item needs the ${requiredBehavior} behavior.`,
						path: ["items", itemIndex, "initialState", "location", "itemId"],
					});
				} else {
					const size = ITEM_SIZE_UNITS[takeable.size];
					const maximum = ITEM_SIZE_UNITS[receptacle.capacity.maximumItemSize];
					if (size > maximum) {
						ctx.addIssue({
							code: "custom",
							message: `${item.name} is too large for ${parent.name}.`,
							path: ["items", itemIndex, "initialState", "location"],
						});
					}
					const capacityKey = `${parentId}:${location.placement}`;
					containedSize.set(capacityKey, (containedSize.get(capacityKey) ?? 0) + size);
				}
			}

			for (const behavior of item.behaviors) {
				if (behavior.type === "door" && !connectionIds.has(idValue(behavior.connectionId))) {
					ctx.addIssue({
						code: "custom",
						message: `Door ${item.name} references a missing connection.`,
						path: ["items", itemIndex, "behaviors"],
					});
				}
				if (behavior.type === "lockable") {
					behavior.unlockWith.forEach((requirement, requirementIndex) => {
						if (requirement.type === "item" && !itemIds.has(idValue(requirement.itemId))) {
							ctx.addIssue({
								code: "custom",
								message: `Lock on ${item.name} references a missing item.`,
								path: ["items", itemIndex, "behaviors", "unlockWith", requirementIndex],
							});
						}
					});
				}
			}
		}

		for (const [itemIndex, item] of world.items.entries()) {
			const seen = new Set<string>([idValue(item.id)]);
			let location = item.initialState.location;
			while (location.type === "item") {
				const parentId = idValue(location.itemId);
				if (seen.has(parentId)) {
					ctx.addIssue({
						code: "custom",
						message: "Item placement cannot contain a cycle.",
						path: ["items", itemIndex, "initialState", "location"],
					});
					break;
				}
				seen.add(parentId);
				const parent = itemsById.get(parentId);
				if (!parent) break;
				location = parent.initialState.location;
			}
		}

		for (const [itemIndex, item] of world.items.entries()) {
			for (const behavior of item.behaviors) {
				if (behavior.type !== "container" && behavior.type !== "surface") continue;
				const placement = behavior.type === "container" ? "inside" : "on";
				const used = containedSize.get(`${idValue(item.id)}:${placement}`) ?? 0;
				if (used > behavior.capacity.capacity) {
					ctx.addIssue({
						code: "custom",
						message: `${item.name} starts over capacity (${used}/${behavior.capacity.capacity}).`,
						path: ["items", itemIndex, "behaviors"],
					});
				}
			}
		}

		if (world.rooms.length > 0 && !roomIds.has(idValue(world.startRoomId))) {
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
export type {Connection, Direction, Point, Room} from "./roomSchema";
export type {Item, ItemBehavior, ItemInitialState, ItemLocation, ItemSize} from "./itemSchema";
