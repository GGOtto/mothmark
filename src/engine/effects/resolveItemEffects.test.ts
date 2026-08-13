import {produce} from "immer";
import {EffectGroupSchema, type Effect} from "@/schemas/world/effectSchema";
import {ItemSchema} from "@/schemas/world/itemSchema";
import {RoomSchema} from "@/schemas/world/roomSchema";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {compareIds, toID} from "@/utils/idUtils";
import {createInitialGameState} from "../states/createInitialState";
import {resolveEffects} from "./resolveEffects";

const roomId = toID("room", "room");
const otherRoomId = toID("room", "other");
const itemId = toID("item", "token");
const boxId = toID("item", "box");
const tableId = toID("item", "table");

const world = produce(createDefaultFieldObject(WorldSchema), (draft) => {
	draft.startRoomId = roomId;
	draft.rooms = [roomId, otherRoomId].map((id) => ({
		...createDefaultFieldObject(RoomSchema),
		id,
		name: id.id,
	}));
	draft.items = [
		produce(createDefaultFieldObject(ItemSchema), (item) => {
			item.id = itemId;
			item.name = "token";
			item.aliases = ["disc"];
			item.tags = ["metal"];
			item.presentation.listingText = "A token lies here.";
			item.examine.text = "An old token.";
			item.initialState.location = {type: "room", roomId};
			item.behaviors = [{type: "takeable", size: "tiny", blockedMessage: "blocked"}];
		}),
		...([boxId, tableId] as const).map((id) =>
			produce(createDefaultFieldObject(ItemSchema), (item) => {
				item.id = id;
				item.name = id.id;
				item.initialState.location = {type: "room", roomId};
			}),
		),
	];
});

function resolve(effects: Effect[]) {
	const group = produce(createDefaultFieldObject(EffectGroupSchema), (draft) => {
		draft.id = toID("effect", "direct-items");
		draft.name = "Direct items";
		draft.effects = effects;
	});
	return resolveEffects(world, createInitialGameState(world, roomId), group);
}

describe("direct item effects", () => {
	it("changes every runtime presentation collection", () => {
		const game = resolve([
			{type: "item", operation: "set-name", itemId, value: "medallion"},
			{
				type: "item",
				operation: "set-examine-text",
				itemId,
				value: "A bright medallion.",
			},
			{
				type: "item",
				operation: "set-listing-text",
				itemId,
				value: "A medallion gleams here.",
			},
			{type: "item", operation: "add-alias", itemId, value: "medal"},
			{type: "item", operation: "remove-alias", itemId, value: "disc"},
			{type: "item", operation: "add-tag", itemId, value: "valuable"},
			{type: "item", operation: "remove-tag", itemId, value: "metal"},
		]);
		const item = game.itemStates.find((candidate) => compareIds(candidate.id, itemId));
		expect(item).toMatchObject({
			name: "medallion",
			description: "A bright medallion.",
			listingText: "A medallion gleams here.",
			aliases: ["medal"],
			tags: ["valuable"],
		});
	});

	it("changes location and restores the authored starting location", () => {
		const game = resolve([
			{type: "item", operation: "move-to-inventory", itemId},
			{type: "item", operation: "move-to-current-room", itemId},
			{type: "item", operation: "move-to-room", itemId, roomId: otherRoomId},
			{type: "item", operation: "place-inside", itemId, containerId: boxId},
			{type: "item", operation: "place-on", itemId, surfaceId: tableId},
			{type: "item", operation: "destroy", itemId},
			{type: "item", operation: "restore-start-location", itemId},
		]);
		expect(game.itemStates.find((candidate) => compareIds(candidate.id, itemId))?.location).toEqual({
			type: "room",
			roomId,
		});
	});

	it("changes all boolean item state", () => {
		const game = resolve([
			{type: "item", operation: "hide", itemId},
			{type: "item", operation: "reveal", itemId},
			{type: "item", operation: "set-listed", itemId},
			{type: "item", operation: "set-examined", itemId},
			{type: "item", operation: "set-open", itemId},
			{type: "item", operation: "set-locked", itemId},
			{type: "item", operation: "set-unlocked", itemId},
			{type: "item", operation: "set-closed", itemId},
		]);
		const item = game.itemStates.find((candidate) => compareIds(candidate.id, itemId));
		expect(item).toMatchObject({
			listedInRoom: true,
			open: false,
			locked: false,
			flags: {hidden: false, examined: true},
		});
		const reset = resolveEffects(
			world,
			game,
			produce(createDefaultFieldObject(EffectGroupSchema), (draft) => {
				draft.effects = [
					{type: "item", operation: "set-unlisted", itemId},
					{type: "item", operation: "set-unexamined", itemId},
				];
			}),
		);
		expect(reset.itemStates.find((candidate) => compareIds(candidate.id, itemId))).toMatchObject({
			listedInRoom: false,
			flags: {examined: false},
		});
	});

	it("empties and transfers direct contents", () => {
		const initial = produce(createInitialGameState(world, roomId), (draft) => {
			const token = draft.itemStates.find((candidate) => compareIds(candidate.id, itemId));
			if (token) token.location = {type: "item", itemId: boxId, placement: "inside"};
		});
		const moveGroup = produce(createDefaultFieldObject(EffectGroupSchema), (draft) => {
			draft.effects = [
				{
					type: "item",
					operation: "move-contents",
					itemId: boxId,
					destinationItemId: tableId,
					placement: "inside",
				},
			];
		});
		const moved = resolveEffects(world, initial, moveGroup);
		expect(moved.itemStates.find((candidate) => compareIds(candidate.id, itemId))?.location).toEqual({
			type: "item",
			itemId: tableId,
			placement: "inside",
		});
		const emptyGroup = produce(createDefaultFieldObject(EffectGroupSchema), (draft) => {
			draft.effects = [
				{type: "item", operation: "empty-into-inventory", itemId: tableId, placement: "inside"},
			];
		});
		const emptied = resolveEffects(world, moved, emptyGroup);
		expect(
			emptied.itemStates.find((candidate) => compareIds(candidate.id, itemId))?.location,
		).toEqual({type: "inventory"});
	});
});
