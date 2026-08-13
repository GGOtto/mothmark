import {produce} from "immer";
import {EffectGroupSchema, type PlayerItemActionEffect} from "@/schemas/world/effectSchema";
import {ItemSchema, type Item} from "@/schemas/world/itemSchema";
import {RoomSchema} from "@/schemas/world/roomSchema";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {compareIds, toID} from "@/utils/idUtils";
import {createInitialGameState} from "../states/createInitialState";
import {resolveEffects} from "./resolveEffects";

const roomId = toID("room", "workshop");
const id = (value: string) => toID("item", value);

function group(
	effects: PlayerItemActionEffect[] | import("@/schemas/world/effectSchema").Effect[],
) {
	return produce(createDefaultFieldObject(EffectGroupSchema), (draft) => {
		draft.id = toID("effect", "test-action");
		draft.name = "Test action";
		draft.effects = effects;
	});
}

function messageHook(text: string) {
	return group([{type: "message", operation: "show", message: text}]);
}

function item(value: string, recipe: (draft: import("immer").Draft<Item>) => void) {
	return produce(createDefaultFieldObject(ItemSchema), (draft) => {
		draft.id = id(value);
		draft.name = value;
		draft.examine.text = `You inspect the ${value}.`;
		draft.initialState.location = {type: "room", roomId};
		recipe(draft);
	});
}

function createWorld(): World {
	const coin = item("coin", (draft) => {
		draft.behaviors = [
			{
				type: "takeable",
				size: "tiny",
				blockedMessage: "The coin is stuck.",
				afterTake: messageHook("Taken hook."),
				afterDrop: messageHook("Dropped hook."),
			},
		];
	});
	const key = item("key", (draft) => {
		draft.tags = ["brass-key"];
		draft.initialState.location = {type: "inventory"};
		draft.behaviors = [{type: "takeable", size: "tiny", blockedMessage: "blocked"}];
	});
	const box = item("box", (draft) => {
		draft.initialState.locked = true;
		draft.behaviors = [
			{type: "container", capacity: {capacity: 1, maximumItemSize: "tiny"}},
			{
				type: "openable",
				openMessage: "The box opens.",
				closeMessage: "The box closes.",
				blockedMessage: "The box is locked.",
				afterOpen: messageHook("Open hook."),
				afterClose: messageHook("Close hook."),
			},
			{
				type: "lockable",
				unlockWith: [{type: "tag", tag: "brass-key"}],
				consumesKey: true,
				unlockMessage: "The key turns.",
				wrongKeyMessage: "Wrong key.",
				afterUnlock: messageHook("Unlock hook."),
				afterLock: messageHook("Lock hook."),
			},
		];
	});
	const table = item("table", (draft) => {
		draft.behaviors = [{type: "surface", capacity: {capacity: 1, maximumItemSize: "tiny"}}];
	});
	const wand = item("wand", (draft) => {
		draft.behaviors = [
			{
				type: "usable",
				recipes: [
					{
						id: toID("condition-branch", "spark"),
						target: {type: "none"},
						outcome: messageHook("Sparks leap from the wand."),
					},
				],
				fallbackMessage: "The wand does nothing.",
			},
		];
	});
	return produce(createDefaultFieldObject(WorldSchema), (draft) => {
		draft.startRoomId = roomId;
		draft.rooms = [{...createDefaultFieldObject(RoomSchema), id: roomId, name: "Workshop"}];
		draft.items = [coin, key, box, table, wand];
	});
}

describe("item-action effects", () => {
	it("takes, drops, and examines while running their hooks", () => {
		const world = createWorld();
		let game = createInitialGameState(world, roomId);
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "take", itemId: id("coin")}]),
		);
		expect(game.itemStates.find((state) => compareIds(state.id, id("coin")))?.location).toEqual({
			type: "inventory",
		});
		expect(game.messages.at(-1)?.text).toBe("Taken hook.");
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "drop", itemId: id("coin")}]),
		);
		expect(game.messages.at(-1)?.text).toBe("Dropped hook.");
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "examine", itemId: id("coin")}]),
		);
		expect(game.itemStates.find((state) => compareIds(state.id, id("coin")))?.flags.examined).toBe(
			true,
		);
		expect(game.messages.at(-1)?.text).toBe("You inspect the coin.");
	});

	it("explains invalid repeated take and drop actions", () => {
		const world = createWorld();
		const initial = createInitialGameState(world, roomId);
		const notCarried = resolveEffects(
			world,
			initial,
			group([{type: "player", operation: "drop", itemId: id("coin")}]),
		);
		expect(notCarried.messages.at(-1)?.text).toBe("You're not carrying the coin.");

		const carried = resolveEffects(
			world,
			initial,
			group([{type: "player", operation: "take", itemId: id("key")}]),
		);
		expect(carried.messages.at(-1)?.text).toBe("You're already carrying the key.");
	});

	it("blocks opening while locked, then unlocks with and consumes a carried matching key", () => {
		const world = createWorld();
		let game = createInitialGameState(world, roomId);
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "open", itemId: id("box")}]),
		);
		expect(game.messages.at(-1)?.text).toBe("The box is locked.");
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "unlock", itemId: id("box")}]),
		);
		expect(game.itemStates.find((state) => compareIds(state.id, id("box")))?.locked).toBe(false);
		expect(game.itemStates.find((state) => compareIds(state.id, id("key")))?.location).toEqual({
			type: "destroyed",
		});
		expect(game.messages.at(-1)?.text).toBe("Unlock hook.");
	});

	it("opens, closes, and locks while running hooks", () => {
		const world = createWorld();
		let game = produce(createInitialGameState(world, roomId), (draft) => {
			const box = draft.itemStates.find((state) => compareIds(state.id, id("box")));
			if (box) box.locked = false;
		});
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "open", itemId: id("box")}]),
		);
		expect(game.messages.at(-1)?.text).toBe("Open hook.");
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "close", itemId: id("box")}]),
		);
		expect(game.messages.at(-1)?.text).toBe("Close hook.");
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "lock", itemId: id("box")}]),
		);
		expect(game.itemStates.find((state) => compareIds(state.id, id("box")))?.locked).toBe(true);
		expect(game.messages.at(-1)?.text).toBe("Lock hook.");
	});

	it("explains repeated open, close, lock, and unlock actions", () => {
		const world = createWorld();
		let game = produce(createInitialGameState(world, roomId), (draft) => {
			const box = draft.itemStates.find((state) => compareIds(state.id, id("box")));
			if (box) {
				box.locked = false;
				box.open = true;
			}
		});

		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "open", itemId: id("box")}]),
		);
		expect(game.messages.at(-1)?.text).toBe("The box is already open.");
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "close", itemId: id("box")}]),
		);
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "close", itemId: id("box")}]),
		);
		expect(game.messages.at(-1)?.text).toBe("The box is already closed.");
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "lock", itemId: id("box")}]),
		);
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "lock", itemId: id("box")}]),
		);
		expect(game.messages.at(-1)?.text).toBe("The box is already locked.");
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "unlock", itemId: id("box")}]),
		);
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "unlock", itemId: id("box")}]),
		);
		expect(game.messages.at(-1)?.text).toBe("The box is already unlocked.");
	});

	it("enforces open state, capacity, and carrying for player placement", () => {
		const world = createWorld();
		let game = produce(createInitialGameState(world, roomId), (draft) => {
			const coin = draft.itemStates.find((state) => compareIds(state.id, id("coin")));
			const box = draft.itemStates.find((state) => compareIds(state.id, id("box")));
			if (coin) coin.location = {type: "inventory"};
			if (box) box.locked = false;
		});
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "put-inside", itemId: id("coin"), containerId: id("box")}]),
		);
		expect(game.messages.at(-1)?.text).toBe("It won't fit there.");
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "open", itemId: id("box")}]),
		);
		game = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "put-inside", itemId: id("coin"), containerId: id("box")}]),
		);
		expect(game.itemStates.find((state) => compareIds(state.id, id("coin")))?.location).toEqual({
			type: "item",
			itemId: id("box"),
			placement: "inside",
		});
	});

	it("explains placement attempts when the item is not carried", () => {
		const world = createWorld();
		const game = resolveEffects(
			world,
			createInitialGameState(world, roomId),
			group([{type: "player", operation: "put-on", itemId: id("coin"), surfaceId: id("table")}]),
		);
		expect(game.messages.at(-1)?.text).toBe("You're not carrying the coin.");
	});

	it("runs a matching use recipe and otherwise uses its fallback", () => {
		const world = createWorld();
		const game = createInitialGameState(world, roomId);
		const used = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "use", itemId: id("wand")}]),
		);
		expect(used.messages.at(-1)?.text).toBe("Sparks leap from the wand.");
		const fallback = resolveEffects(
			world,
			game,
			group([{type: "player", operation: "use", itemId: id("wand"), targetItemId: id("table")}]),
		);
		expect(fallback.messages.at(-1)?.text).toBe("The wand does nothing.");
	});
});
