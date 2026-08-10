import {produce} from "immer";
import {
	closeCommand,
	dropCommand,
	examineCommand,
	lockCommand,
	openCommand,
	putInsideCommand,
	putOnCommand,
	rawInitialCommands,
	takeCommand,
	unlockCommand,
	useCommand,
	useTargetCommand,
} from "./initialCommands";
import {EffectGroupSchema} from "@/schemas/world/effectSchema";
import {ItemSchema} from "@/schemas/world/itemSchema";
import {RoomSchema} from "@/schemas/world/roomSchema";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {compareIds, toID} from "@/utils/idUtils";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {resolveTurn} from "@/engine/player/resolveTurn";

const roomId = toID("room", "study");
const otherRoomId = toID("room", "hall");
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

const wrongKey = produce(createDefaultFieldObject(ItemSchema), (draft) => {
	draft.id = toID("item", "iron-key");
	draft.name = "iron key";
	draft.initialState.location = {type: "inventory"};
	draft.behaviors = [{type: "takeable", size: "tiny", blockedMessage: "blocked"}];
});

const folio = produce(createDefaultFieldObject(ItemSchema), (draft) => {
	draft.id = toID("item", "folio");
	draft.name = "folio";
	draft.presentation.listedInRoom = true;
	draft.initialState.location = {type: "room", roomId: otherRoomId};
	draft.behaviors = [{type: "takeable", size: "small", blockedMessage: "The folio is stuck."}];
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
		{
			...createDefaultFieldObject(RoomSchema),
			id: otherRoomId,
			name: "Hall",
			description: "A long hall.",
		},
	];
	draft.items = [lens, key, wrongKey, folio, box, table];
	draft.commands = rawInitialCommands;
});

function itemState(game: ReturnType<typeof createInitialGameState>, id: string) {
	return game.itemStates.find((item) => compareIds(item.id, toID("item", id)));
}

function lastText(game: ReturnType<typeof createInitialGameState>) {
	return game.messages.at(-1)?.text;
}

describe("saved base item commands through resolveTurn", () => {
	it("loads every item action as an ordinary command document", () => {
		const commands = [
			takeCommand,
			dropCommand,
			examineCommand,
			openCommand,
			closeCommand,
			lockCommand,
			unlockCommand,
			useCommand,
			useTargetCommand,
			putInsideCommand,
			putOnCommand,
		];
		for (const command of commands) {
			const effects = command.behavior.always?.effects ?? command.behavior.if?.effect.effects;
			expect(effects).toEqual([
				expect.objectContaining({
					type: "item-action",
					commandVariables: expect.arrayContaining([expect.objectContaining({field: "itemId"})]),
				}),
			]);
		}
		expect(commands).toHaveLength(11);
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

	it("authors a runnable fallback for every value-bearing block", () => {
		for (const command of rawInitialCommands) {
			const valueBlockIds = new Set(
				command.patterns.flatMap((pattern) =>
					pattern.blocks
						.filter((block) => block.type !== "phrase" && block.type !== "relation")
						.map((block) => block.id.id),
				),
			);
			const fallbackBlockIds = new Set(command.fallbacks.map((fallback) => fallback.blockId.id));
			for (const valueBlockId of valueBlockIds) expect(fallbackBlockIds).toContain(valueBlockId);
			for (const fallback of command.fallbacks) {
				expect(fallback.behavior.always?.effects.length).toBeGreaterThan(0);
			}
		}
	});

	it.each(["examine lens", "inspect lens", "x lens", "look at lens", "examine glass"])(
		"supports examine syntax: %s",
		(input) => {
			const next = resolveTurn(world, createInitialGameState(world, roomId), input);
			expect(lastText(next)).toBe("The lens is scratched around its brass rim.");
			expect(itemState(next, "lens")?.flags.examined).toBe(true);
		},
	);

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

	it.each(["take lens", "get lens", "pick up lens", "take glass"])(
		"supports take syntax: %s",
		(input) => {
			const next = resolveTurn(world, createInitialGameState(world, roomId), input);
			expect(lastText(next)).toBe("You take the lens.");
			expect(itemState(next, "lens")?.location).toEqual({type: "inventory"});
		},
	);

	it("explains repeated take and drop attempts without changing location", () => {
		let game = resolveTurn(world, createInitialGameState(world, roomId), "take lens");
		game = resolveTurn(world, game, "take lens");
		expect(lastText(game)).toBe("You're already carrying the lens.");
		expect(itemState(game, "lens")?.location).toEqual({type: "inventory"});
		game = resolveTurn(world, game, "drop lens");
		expect(lastText(game)).toBe("You drop the lens.");
		game = resolveTurn(world, game, "drop lens");
		expect(lastText(game)).toBe("You're not carrying the lens.");
		expect(itemState(game, "lens")?.location).toEqual({type: "room", roomId});
	});

	it("does not resolve remembered items in another room for take, drop, or placement", () => {
		const remembered = produce(createInitialGameState(world, roomId), (draft) => {
			const hall = draft.roomStates.find((room) => compareIds(room.id, otherRoomId));
			if (hall) hall.flags.visited = true;
		});
		for (const [input, expected] of [
			["take folio", "You can't take that."],
			["drop folio", "You can't drop that."],
			["put folio in box", "You can't put that anywhere."],
			["put folio on table", "You can't put that anywhere."],
		] as const) {
			const next = resolveTurn(world, remembered, input);
			expect(lastText(next)).toBe(expected);
			expect(itemState(next, "folio")?.location).toEqual({type: "room", roomId: otherRoomId});
		}
	});

	it.each([
		["take moon", "You can't take that."],
		["drop moon", "You can't drop that."],
		["examine moon", "You can't examine that."],
		["open moon", "You can't open that."],
		["close moon", "You can't close that."],
		["lock moon", "You can't lock that."],
		["unlock moon", "You can't unlock that."],
		["use moon", "You can't use that."],
		["use moon on table", "You can't use that."],
		["use lens on moon", "You can't use it on that."],
		["put moon in box", "You can't put that anywhere."],
		["put lens in moon", "You can't put it in that."],
		["put moon on table", "You can't put that anywhere."],
		["put lens on moon", "You can't put it on that."],
	] as const)("runs the authored fallback for: %s", (input, expected) => {
		const next = resolveTurn(world, createInitialGameState(world, roomId), input);
		expect(lastText(next)).toBe(expected);
	});

	it("accepts ordinary articles without duplicating command patterns", () => {
		let game = createInitialGameState(world, roomId);
		expect(lastText(resolveTurn(world, game, "examine the lens"))).toBe(
			"The lens is scratched around its brass rim.",
		);
		game = resolveTurn(world, game, "take the lens");
		expect(lastText(game)).toBe("You take the lens.");
		expect(lastText(resolveTurn(world, game, "use my lens on the table"))).toBe(
			"A circle of light lands on the table.",
		);
		expect(lastText(resolveTurn(world, game, "put my lens on the table"))).toBe(
			"You put the lens on the table.",
		);
	});

	it("uses the first matching authored recipe through an item-action effect", () => {
		const game = createInitialGameState(world, roomId);
		const next = resolveTurn(world, game, "use lens");
		expect(next.messages.at(-1)?.text).toBe("A bright point dances on the wall.");
		const targeted = resolveTurn(world, game, "use lens on table");
		expect(targeted.messages.at(-1)?.text).toBe("A circle of light lands on the table.");
	});

	it("supports both targeted-use relations and falls back for unmatched recipes", () => {
		const game = createInitialGameState(world, roomId);
		expect(lastText(resolveTurn(world, game, "use lens on table"))).toBe(
			"A circle of light lands on the table.",
		);
		expect(lastText(resolveTurn(world, game, "use lens with table"))).toBe(
			"A circle of light lands on the table.",
		);
		expect(lastText(resolveTurn(world, game, "use lens on box"))).toBe("Nothing happens.");
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

	it("reports every lock and open state boundary and preserves the key", () => {
		let game = createInitialGameState(world, roomId);
		game = resolveTurn(world, game, "open the box");
		expect(lastText(game)).toBe("Box locked.");
		game = resolveTurn(world, game, "lock the box");
		expect(lastText(game)).toBe("The box is already locked.");
		game = resolveTurn(world, game, "unlock the box");
		expect(lastText(game)).toBe("Box unlocked.");
		expect(itemState(game, "key")?.location).toEqual({type: "inventory"});
		game = resolveTurn(world, game, "unlock box");
		expect(lastText(game)).toBe("The box is already unlocked.");
		game = resolveTurn(world, game, "close box");
		expect(lastText(game)).toBe("The box is already closed.");
		game = resolveTurn(world, game, "open the box");
		expect(lastText(game)).toBe("Box opened.");
		game = resolveTurn(world, game, "open box");
		expect(lastText(game)).toBe("The box is already open.");
		game = resolveTurn(world, game, "shut the box");
		expect(lastText(game)).toBe("Box closed.");
		game = resolveTurn(world, game, "lock the box");
		expect(lastText(game)).toBe("You lock it.");
		expect(itemState(game, "box")).toMatchObject({open: false, locked: true});
	});

	it("rejects unlocking without a carried matching key", () => {
		const noKey = produce(createInitialGameState(world, roomId), (draft) => {
			const matchingKey = draft.itemStates.find((item) => compareIds(item.id, toID("item", "key")));
			if (matchingKey) matchingKey.location = {type: "destroyed"};
		});
		const next = resolveTurn(world, noKey, "unlock box");
		expect(lastText(next)).toBe("Wrong key.");
		expect(itemState(next, "box")?.locked).toBe(true);
		expect(itemState(next, "iron-key")?.location).toEqual({type: "inventory"});
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

	it.each([
		["put lens in box", "inside", "box"],
		["place lens into box", "inside", "box"],
		["put lens on table", "on", "table"],
		["place lens onto table", "on", "table"],
	] as const)("supports placement syntax: %s", (input, placement, parent) => {
		let game = createInitialGameState(world, roomId);
		if (placement === "inside") {
			game = resolveTurn(world, game, "unlock box");
			game = resolveTurn(world, game, "open box");
		}
		game = resolveTurn(world, game, "take lens");
		game = resolveTurn(world, game, input);
		expect(itemState(game, "lens")?.location).toEqual({
			type: "item",
			itemId: toID("item", parent),
			placement,
		});
	});

	it("rejects placement when the item is not carried, the container is closed, or capacity is exceeded", () => {
		let game = createInitialGameState(world, roomId);
		game = resolveTurn(world, game, "put lens on table");
		expect(lastText(game)).toBe("You're not carrying the lens.");
		game = resolveTurn(world, game, "take lens");
		game = resolveTurn(world, game, "put lens in box");
		expect(lastText(game)).toBe("It won't fit there.");
		expect(itemState(game, "lens")?.location).toEqual({type: "inventory"});

		game = resolveTurn(world, game, "unlock box");
		game = resolveTurn(world, game, "open box");
		game = resolveTurn(world, game, "put lens in box");
		game = produce(game, (draft) => {
			const folioState = draft.itemStates.find((item) => compareIds(item.id, toID("item", "folio")));
			if (folioState) folioState.location = {type: "inventory"};
		});
		game = resolveTurn(world, game, "put folio in box");
		expect(lastText(game)).toBe("It won't fit there.");
		expect(itemState(game, "folio")?.location).toEqual({type: "inventory"});
	});

	it("treats ambiguous names as unresolved instead of selecting an arbitrary target", () => {
		const ambiguousWorld = produce(world, (draft) => {
			const duplicate = produce(lens, (item) => {
				item.id = toID("item", "spare-lens");
				item.aliases = [];
			});
			draft.items.push(duplicate);
		});
		const game = createInitialGameState(ambiguousWorld, roomId);
		const next = resolveTurn(ambiguousWorld, game, "take lens");
		expect(lastText(next)).toBe("You can't take that.");
		expect(itemState(next, "lens")?.location).toEqual({type: "room", roomId});
		expect(itemState(next, "spare-lens")?.location).toEqual({type: "room", roomId});
	});

	it("keeps hidden and closed-container contents outside command target resolution", () => {
		const inaccessible = produce(createInitialGameState(world, roomId), (draft) => {
			const lensState = draft.itemStates.find((item) => compareIds(item.id, lensId));
			if (lensState)
				lensState.location = {type: "item", itemId: toID("item", "box"), placement: "inside"};
		});
		for (const [input, expected] of [
			["examine lens", "You can't examine that."],
			["take lens", "You can't take that."],
			["use lens", "You can't use that."],
			["drop lens", "You can't drop that."],
		] as const) {
			expect(lastText(resolveTurn(world, inaccessible, input))).toBe(expected);
		}
	});
});
