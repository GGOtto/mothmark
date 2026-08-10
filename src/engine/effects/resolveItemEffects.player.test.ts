import {produce} from "immer";
import {rawInitialCommands} from "@/data/commands/initialCommands";
import {ItemSchema} from "@/schemas/world/itemSchema";
import {RoomSchema} from "@/schemas/world/roomSchema";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {compareIds, toID} from "@/utils/idUtils";
import {resolveTurn} from "../player/resolveTurn";
import {createInitialGameState} from "../states/createInitialState";
import {createPlayerTestEvent} from "../utils/testUtils";

const roomId = toID("room", "gallery");
const tokenId = toID("item", "token");
const boxId = toID("item", "box");

describe("direct item effects through resolveTurn", () => {
	it("changes player-visible presentation and resulting runtime state", () => {
		const event = createPlayerTestEvent(
			"transform-token",
			[
				{type: "item", operation: "change-name", itemId: tokenId, value: "silver token"},
				{
					type: "item",
					operation: "change-examine-text",
					itemId: tokenId,
					value: "The silver token shines.",
				},
				{type: "item", operation: "add-tag", itemId: tokenId, value: "valuable"},
				{type: "item", operation: "mark-examined", itemId: tokenId},
			],
			(draft) => {
				draft.disposable = true;
			},
		);
		const world = produce(createDefaultFieldObject(WorldSchema), (draft) => {
			draft.startRoomId = roomId;
			draft.rooms = [
				{
					...createDefaultFieldObject(RoomSchema),
					id: roomId,
					name: "Gallery",
					description: "A bare gallery.",
				},
			];
			draft.items = [
				produce(createDefaultFieldObject(ItemSchema), (item) => {
					item.id = tokenId;
					item.name = "token";
					item.examine.text = "A dull token.";
					item.presentation.listedInRoom = true;
					item.initialState.location = {type: "room", roomId};
				}),
			];
			draft.commands = rawInitialCommands;
			draft.events = [event];
		});
		let game = createInitialGameState(world, roomId);
		game = resolveTurn(world, game, "look");
		game = resolveTurn(world, game, "look");
		expect(game.messages.at(-1)?.text).toContain("The silver token shines.");
		expect(game.itemStates.find((item) => compareIds(item.id, tokenId))).toMatchObject({
			name: "silver token",
			tags: ["valuable"],
			flags: {examined: true},
		});
	});

	it("places and empties contents while changing container state", () => {
		const event = createPlayerTestEvent(
			"move-token",
			[
				{type: "item", operation: "place-inside", itemId: tokenId, containerId: boxId},
				{type: "item", operation: "lock", itemId: boxId},
				{type: "item", operation: "unlock", itemId: boxId},
				{type: "item", operation: "empty-into-inventory", itemId: boxId, placement: "inside"},
			],
			(draft) => {
				draft.disposable = true;
			},
		);
		const world = produce(createDefaultFieldObject(WorldSchema), (draft) => {
			draft.startRoomId = roomId;
			draft.rooms = [{...createDefaultFieldObject(RoomSchema), id: roomId, name: "Gallery"}];
			draft.items = [tokenId, boxId].map((id) =>
				produce(createDefaultFieldObject(ItemSchema), (item) => {
					item.id = id;
					item.name = id.id;
					item.examine.text = id.id;
					item.initialState.location = {type: "room", roomId};
				}),
			);
			draft.commands = rawInitialCommands;
			draft.events = [event];
		});
		const game = resolveTurn(world, createInitialGameState(world, roomId), "look");
		expect(game.itemStates.find((item) => compareIds(item.id, tokenId))?.location).toEqual({
			type: "inventory",
		});
		expect(game.itemStates.find((item) => compareIds(item.id, boxId))).toMatchObject({
			open: false,
			locked: false,
		});
	});
});
