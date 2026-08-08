import {produce} from "immer";
import {rawInitialCommands, examineCommand, takeCommand, useCommand} from "./initialCommands";
import {EffectGroupSchema} from "@/schemas/world/effectSchema";
import {ItemSchema} from "@/schemas/world/itemSchema";
import {RoomSchema} from "@/schemas/world/roomSchema";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {compareIds, toID} from "@/utils/idUtils";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {resolveTurn} from "@/engine/player/resolveTurn";

const roomId = toID("room", "study");
const lensId = toID("item", "lens");

const useOutcome = produce(createDefaultFieldObject(EffectGroupSchema), (draft) => {
	draft.id = toID("effect", "focus-light");
	draft.name = "Focus light";
	draft.effects = [
		{type: "message", operation: "show", message: "A bright point dances on the wall."},
	];
});

const takeHook = produce(createDefaultFieldObject(EffectGroupSchema), (draft) => {
	draft.id = toID("effect", "mark-handled");
	draft.name = "Mark handled";
	draft.effects = [
		{
			type: "item",
			operation: "add-tag",
			itemId: lensId,
			value: "handled",
		},
	];
});

const lens = produce(createDefaultFieldObject(ItemSchema), (draft) => {
	draft.id = lensId;
	draft.name = "lens";
	draft.aliases = ["glass"];
	draft.examine.text = "The lens is scratched around its brass rim.";
	draft.presentation.listedInRoom = true;
	draft.initialState.location = {type: "room", roomId};
	draft.behaviors = [
		{
			type: "takeable",
			size: "tiny",
			blockedMessage: "The lens will not budge.",
			afterTake: takeHook,
		},
		{
			type: "usable",
			recipes: [
				{id: toID("condition-branch", "focus"), target: {type: "none"}, outcome: useOutcome},
				{
					id: toID("condition-branch", "focus-on-table"),
					target: {type: "item", itemId: toID("item", "table")},
					outcome: produce(useOutcome, (outcome) => {
						outcome.id = toID("effect", "focus-on-table");
						outcome.effects = [
							{
								type: "message",
								operation: "show",
								message: "A circle of light lands on the table.",
							},
						];
					}),
				},
			],
			fallbackMessage: "Nothing happens.",
		},
	];
});

const key = produce(createDefaultFieldObject(ItemSchema), (draft) => {
	draft.id = toID("item", "key");
	draft.name = "key";
	draft.tags = ["study-key"];
	draft.examine.text = "A small key.";
	draft.initialState.location = {type: "inventory"};
	draft.behaviors = [{type: "takeable", size: "tiny", blockedMessage: "blocked"}];
});

const box = produce(createDefaultFieldObject(ItemSchema), (draft) => {
	draft.id = toID("item", "box");
	draft.name = "box";
	draft.examine.text = "A stout box.";
	draft.initialState.location = {type: "room", roomId};
	draft.initialState.locked = true;
	draft.behaviors = [
		{type: "container", capacity: {capacity: 2, maximumItemSize: "small"}},
		{
			type: "openable",
			openMessage: "Box opened.",
			closeMessage: "Box closed.",
			blockedMessage: "Box locked.",
		},
		{
			type: "lockable",
			unlockWith: [{type: "tag", tag: "study-key"}],
			consumesKey: false,
			unlockMessage: "Box unlocked.",
			wrongKeyMessage: "Wrong key.",
		},
	];
});

const table = produce(createDefaultFieldObject(ItemSchema), (draft) => {
	draft.id = toID("item", "table");
	draft.name = "table";
	draft.examine.text = "A broad table.";
	draft.initialState.location = {type: "room", roomId};
	draft.behaviors = [{type: "surface", capacity: {capacity: 2, maximumItemSize: "small"}}];
});

const world = produce(createDefaultFieldObject(WorldSchema), (draft) => {
	draft.startRoomId = roomId;
	draft.rooms = [
		{
			...createDefaultFieldObject(RoomSchema),
			id: roomId,
			name: "Study",
			description: "A quiet study.",
		},
	];
	draft.items = [lens, key, box, table];
	draft.commands = rawInitialCommands;
});

describe("saved base item commands through resolveTurn", () => {
	it("loads take, examine, and use as ordinary command documents", () => {
		for (const command of [takeCommand, examineCommand, useCommand]) {
			const effects = command.behavior.always?.effects ?? command.behavior.if?.effect.effects;
			expect(effects).toEqual([
				expect.objectContaining({
					type: "item-action",
					commandVariables: [expect.objectContaining({field: "itemId"})],
				}),
			]);
		}
		expect(takeCommand.behavior.if?.condition).toMatchObject({
			type: "group",
			conditions: [
				expect.objectContaining({
					type: "item",
					commandVariables: [expect.objectContaining({field: "itemId"})],
				}),
			],
		});
	});

	it("examines a command target through an item-action effect", () => {
		const game = createInitialGameState(world, roomId);
		const next = resolveTurn(world, game, "examine lens");
		expect(next.messages.at(-1)?.text).toBe("The lens is scratched around its brass rim.");
		expect(next.itemStates.find((item) => compareIds(item.id, lensId))?.flags.examined).toBe(true);
	});

	it("takes a reachable takeable target through an item-action effect", () => {
		const game = createInitialGameState(world, roomId);
		const next = resolveTurn(world, game, "take lens");
		expect(next.messages.at(-1)?.text).toBe("You take the lens.");
		expect(next.itemStates.find((item) => compareIds(item.id, lensId))?.location).toEqual({
			type: "inventory",
		});
		expect(next.itemStates.find((item) => compareIds(item.id, lensId))?.tags).toContain("handled");
	});

	it("uses the first matching authored recipe through an item-action effect", () => {
		const game = createInitialGameState(world, roomId);
		const next = resolveTurn(world, game, "use lens");
		expect(next.messages.at(-1)?.text).toBe("A bright point dances on the wall.");
		const targeted = resolveTurn(world, game, "use lens on table");
		expect(targeted.messages.at(-1)?.text).toBe("A circle of light lands on the table.");
	});

	it("unlocks, opens, puts inside, closes, and locks using saved commands", () => {
		let game = createInitialGameState(world, roomId);
		game = resolveTurn(world, game, "unlock box");
		expect(game.messages.at(-1)?.text).toBe("Box unlocked.");
		game = resolveTurn(world, game, "open box");
		expect(game.messages.at(-1)?.text).toBe("Box opened.");
		game = resolveTurn(world, game, "take lens");
		game = resolveTurn(world, game, "put lens in box");
		expect(game.itemStates.find((item) => compareIds(item.id, lensId))?.location).toEqual({
			type: "item",
			itemId: toID("item", "box"),
			placement: "inside",
		});
		game = resolveTurn(world, game, "close box");
		expect(game.messages.at(-1)?.text).toBe("Box closed.");
		game = resolveTurn(world, game, "lock box");
		expect(game.itemStates.find((item) => compareIds(item.id, toID("item", "box")))?.locked).toBe(
			true,
		);
	});

	it("drops and puts items on surfaces using saved commands", () => {
		let game = createInitialGameState(world, roomId);
		game = resolveTurn(world, game, "take lens");
		game = resolveTurn(world, game, "drop lens");
		expect(game.itemStates.find((item) => compareIds(item.id, lensId))?.location).toEqual({
			type: "room",
			roomId,
		});
		game = resolveTurn(world, game, "take lens");
		game = resolveTurn(world, game, "put lens on table");
		expect(game.itemStates.find((item) => compareIds(item.id, lensId))?.location).toEqual({
			type: "item",
			itemId: toID("item", "table"),
			placement: "on",
		});
	});
});
