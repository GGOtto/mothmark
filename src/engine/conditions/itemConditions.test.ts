import {produce} from "immer";
import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {ItemStateSchema, RoomStateSchema} from "@/schemas/states/entityStateSchemas";
import {SingleConditionSchema, type SingleCondition} from "@/schemas/world/conditionSchema";
import {ItemSchema} from "@/schemas/world/itemSchema";
import {ConnectionSchema, RoomSchema} from "@/schemas/world/roomSchema";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {evaluateSingleCondition} from "./evaluateSingleCondition";

const roomId = toID("room", "workshop");
const galleryId = toID("room", "gallery");
const ids = {
	box: toID("item", "box"),
	coin: toID("item", "coin"),
	key: toID("item", "key"),
	table: toID("item", "table"),
	door: toID("item", "door"),
};

function authoredItem(id: keyof typeof ids) {
	return produce(createDefaultFieldObject(ItemSchema), (draft) => {
		draft.id = ids[id];
		draft.name = id;
		draft.initialState.location = {type: "room", roomId};
		if (id === "coin" || id === "key") {
			draft.behaviors = [{type: "takeable", size: "tiny", blockedMessage: "blocked"}];
		}
		if (id === "key") draft.tags = ["brass-key"];
		if (id === "box") {
			draft.behaviors = [
				{type: "container", capacity: {capacity: 1, maximumItemSize: "tiny"}},
				{type: "openable", openMessage: "open", closeMessage: "close", blockedMessage: "blocked"},
				{
					type: "lockable",
					unlockWith: [{type: "tag", tag: "brass-key"}],
					consumesKey: false,
					unlockMessage: "unlock",
					wrongKeyMessage: "wrong",
				},
			];
		}
		if (id === "table") {
			draft.behaviors = [{type: "surface", capacity: {capacity: 1, maximumItemSize: "tiny"}}];
		}
		if (id === "door") {
			draft.behaviors = [
				{type: "openable", openMessage: "open", closeMessage: "close", blockedMessage: "blocked"},
				{type: "door", connectionId: toID("connection", "passage"), controls: "both-directions"},
			];
		}
	});
}

const world = produce(createDefaultFieldObject(WorldSchema), (draft) => {
	draft.startRoomId = roomId;
	draft.rooms = [roomId, galleryId].map((id) => ({
		...createDefaultFieldObject(RoomSchema),
		id,
		name: id.id,
	}));
	draft.connections = [
		{
			...createDefaultFieldObject(ConnectionSchema),
			id: toID("connection", "passage"),
			fromRoomId: roomId,
			toRoomId: galleryId,
			direction: "e",
			returnDirection: "w",
			pathway: "two-way",
		},
	];
	draft.items = [
		authoredItem("box"),
		authoredItem("coin"),
		authoredItem("key"),
		authoredItem("table"),
		authoredItem("door"),
	];
});

const game = produce(createDefaultFieldObject(GameStateSchema), (draft) => {
	draft.player.currentRoom = roomId;
	draft.roomStates = [roomId, galleryId].map((id) => ({
		...createDefaultFieldObject(RoomStateSchema),
		id,
		flags: {visited: id.id === "workshop", active: true},
	}));
	draft.itemStates = Object.entries(ids).map(([name, id]) => ({
		...createDefaultFieldObject(ItemStateSchema),
		id,
		name,
		tags: name === "key" ? ["brass-key"] : [],
		behaviorTags:
			world.items.find((item) => item.id.id === id.id)?.behaviors.map((behavior) => behavior.type) ??
			[],
		listedInRoom: true,
		location:
			name === "coin"
				? {type: "item" as const, itemId: ids.box, placement: "inside" as const}
				: name === "key"
					? {type: "inventory" as const}
					: {type: "room" as const, roomId},
		open: name === "box",
		locked: false,
		flags: {examined: name === "box"},
	}));
});

function itemCondition(itemId: (typeof ids)[keyof typeof ids], test: unknown): SingleCondition {
	return SingleConditionSchema.parse({type: "item", itemId, test});
}

describe("item conditions", () => {
	it.each([
		["visible", true],
		["reachable", true],
		["known", true],
		["carried", false],
		["examined", true],
		["open", true],
		["locked", false],
	] as const)("checks the %s state", (state, value) => {
		expect(
			evaluateSingleCondition(world, game, itemCondition(ids.box, {type: "state", state, value})),
		).toBe(true);
	});

	it("checks root and direct nested locations", () => {
		expect(
			evaluateSingleCondition(
				world,
				game,
				itemCondition(ids.coin, {type: "location", location: "current-room"}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				itemCondition(ids.coin, {
					type: "location",
					location: "inside-item",
					parentItemId: ids.box,
				}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				itemCondition(ids.key, {type: "location", location: "inventory"}),
			),
		).toBe(true);
	});

	it("checks important tags and mutable author tags", () => {
		expect(
			evaluateSingleCondition(
				world,
				game,
				itemCondition(ids.box, {type: "important-tag", tag: "container", value: true}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				itemCondition(ids.key, {type: "tag", tag: "brass-key", value: true}),
			),
		).toBe(true);
	});

	it("checks contents, capacity, and unlock requirements", () => {
		expect(
			evaluateSingleCondition(
				world,
				game,
				itemCondition(ids.box, {
					type: "contents",
					test: "contains-item",
					itemId: ids.coin,
					placement: "inside",
				}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				itemCondition(ids.box, {type: "capacity", test: "full", placement: "inside", value: true}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				itemCondition(ids.key, {
					type: "can-unlock",
					lockItemId: ids.box,
					keyItemId: ids.key,
				}),
			),
		).toBe(true);
	});

	it("checks door ownership and passability", () => {
		expect(
			evaluateSingleCondition(
				world,
				game,
				itemCondition(ids.door, {
					type: "door",
					test: "controls-connection",
					connectionId: toID("connection", "passage"),
					value: true,
				}),
			),
		).toBe(true);
		expect(
			evaluateSingleCondition(
				world,
				game,
				itemCondition(ids.door, {type: "door", test: "connection-passable", value: false}),
			),
		).toBe(true);
	});

	it("uses ordinary typed item references", () => {
		expect(
			evaluateSingleCondition(
				world,
				game,
				itemCondition(ids.key, {type: "tag", tag: "brass-key", value: true}),
			),
		).toBe(true);
	});
});
