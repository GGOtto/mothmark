import {produce} from "immer";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {RoomSchema} from "@/schemas/world/roomSchema";
import {
	ContainerBehaviorSchema,
	ItemSchema,
	OpenableBehaviorSchema,
	TakeableBehaviorSchema,
} from "@/schemas/world/itemSchema";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";
import {EffectSchema, type Effect} from "@/schemas/world/effectSchema";
import {ConditionSchema, type Condition} from "@/schemas/world/conditionSchema";
import {EventSchema} from "@/schemas/world/eventSchema";
import {createInitialGameState} from "../states/createInitialState";
import {resolveEffects} from "./resolveEffects";
import {createPlayerTestEffectGroup} from "../utils/testUtils";
import {evaluateCondition} from "../conditions/evaluateCondition";
import {createRoomMessage} from "../messages/createRoomMessage";
import {GameStateSchema} from "@/schemas/states/gameStateSchemas";

function effect(overrides: Record<string, unknown>): Effect {
	return EffectSchema.parse({...createDefaultFieldObject(EffectSchema), ...overrides});
}

function condition(overrides: Record<string, unknown>): Condition {
	return ConditionSchema.parse({...createDefaultFieldObject(ConditionSchema), ...overrides});
}

function testWorld(): World {
	const room = produce(createDefaultFieldObject(RoomSchema), (draft) => {
		draft.id = toID("room", "yard");
		draft.name = "Yard";
		draft.description = "An open yard.";
		draft.tags = ["outdoors"];
	});
	const cellar = produce(createDefaultFieldObject(RoomSchema), (draft) => {
		draft.id = toID("room", "cellar");
		draft.name = "Cellar";
		draft.description = "A cellar.";
	});
	const takeable = createDefaultFieldObject(TakeableBehaviorSchema);
	const coin = produce(createDefaultFieldObject(ItemSchema), (draft) => {
		draft.id = toID("item", "coin");
		draft.name = "Coin";
		draft.aliases = ["money"];
		draft.tags = ["treasure"];
		draft.behaviors = [{...takeable, size: "tiny"}];
		draft.initialState.location = {type: "room", roomId: room.id};
		draft.presentation.listedInRoom = true;
	});
	const torch = produce(createDefaultFieldObject(ItemSchema), (draft) => {
		draft.id = toID("item", "torch");
		draft.name = "Torch";
		draft.tags = ["light"];
		draft.behaviors = [{...takeable, size: "small"}];
		draft.initialState.location = {type: "room", roomId: room.id};
		draft.initialState.flags.lit = true;
	});
	const bag = produce(createDefaultFieldObject(ItemSchema), (draft) => {
		draft.id = toID("item", "bag");
		draft.name = "Bag";
		draft.behaviors = [
			{...takeable, size: "small"},
			createDefaultFieldObject(ContainerBehaviorSchema),
			createDefaultFieldObject(OpenableBehaviorSchema),
		];
		draft.initialState.location = {type: "inventory"};
		draft.initialState.open = true;
	});
	const hole = produce(createDefaultFieldObject(ItemSchema), (draft) => {
		draft.id = toID("item", "hole-template");
		draft.name = "Hole";
		draft.tags = ["hole"];
		draft.behaviors = [
			createDefaultFieldObject(ContainerBehaviorSchema),
			createDefaultFieldObject(OpenableBehaviorSchema),
		];
		draft.initialState.location = {type: "hidden", roomId: room.id};
		draft.initialState.open = true;
		draft.presentation.listedInRoom = true;
		draft.presentation.listingText = "A hole interrupts the ground.";
	});
	return produce(createDefaultFieldObject(WorldSchema), (draft) => {
		draft.startRoomId = room.id;
		draft.deathMessage = "Dead.";
		draft.rooms = [room, cellar];
		draft.items = [coin, torch, bag, hole];
		draft.initialState.counters = [
			{counter: "left", value: 8},
			{counter: "right", value: 2},
		];
		draft.initialState.texts = [
			{text: "first", value: "A"},
			{text: "second", value: "B"},
		];
	});
}

describe("audited condition and effect primitives", () => {
	it("keeps previously stored worlds and game states readable", () => {
		const worldJson = JSON.parse(JSON.stringify(testWorld())) as Record<string, unknown>;
		for (const room of worldJson.rooms as Array<Record<string, unknown>>) {
			delete room.descriptionFragments;
		}
		for (const item of worldJson.items as Array<Record<string, unknown>>) {
			const examine = item.examine as Record<string, unknown>;
			const presentation = item.presentation as Record<string, unknown>;
			delete examine.conditionalText;
			delete presentation.conditionalText;
		}
		const parsedWorld = WorldSchema.parse(worldJson);
		expect(parsedWorld.rooms.every((room) => room.descriptionFragments.length === 0)).toBe(true);

		const gameJson = JSON.parse(
			JSON.stringify(createInitialGameState(parsedWorld, parsedWorld.startRoomId)),
		) as Record<string, unknown>;
		const player = gameJson.player as Record<string, unknown>;
		for (const key of [
			"previousRoom",
			"lastRoomTransitionTurn",
			"lastCommandSucceeded",
			"lastCommandTurn",
			"randomState",
			"carryingCapacity",
			"equippedItemIds",
			"hasWon",
			"isEnded",
			"endingMessage",
		]) {
			delete player[key];
		}
		expect(GameStateSchema.safeParse(gameJson).success).toBe(true);
	});

	it("computes counters and composes saved text", () => {
		const world = testWorld();
		const game = resolveEffects(
			world,
			createInitialGameState(world, world.startRoomId),
			createPlayerTestEffectGroup("compute", [
				effect({type: "world", operation: "subtract-counter", counter: "left", sourceCounter: "right"}),
				effect({type: "world", operation: "multiply-counter", counter: "left", sourceCounter: "right"}),
				effect({type: "world", operation: "divide-counter", counter: "left", sourceCounter: "right"}),
				effect({type: "world", operation: "clamp-counter", counter: "left", min: 0, max: 5}),
				effect({type: "world", operation: "copy-counter", counter: "copied", sourceCounter: "right"}),
				effect({type: "world", operation: "append-saved-text", text: "first", sourceText: "second"}),
				effect({type: "world", operation: "prepend-text", text: "first", value: "<"}),
				effect({type: "world", operation: "append-text", text: "first", value: ">"}),
			]),
		);
		expect(game.variables.counters).toEqual(expect.arrayContaining([{left: 5}, {copied: 2}]));
		expect(game.variables.texts).toEqual(expect.arrayContaining([{first: "<AB>"}]));
		expect(
			evaluateCondition(
				world,
				game,
				condition({
					type: "world",
					operation: "counter-compare-counter",
					leftCounter: "left",
					operator: "gt",
					rightCounter: "right",
				}),
			),
		).toBe(true);
	});

	it("queries and changes dynamic item collections", () => {
		const world = testWorld();
		let game = createInitialGameState(world, world.startRoomId);
		expect(
			evaluateCondition(
				world,
				game,
				condition({
					type: "items",
					operation: "matching-count",
					scope: "current-room",
					tag: "treasure",
					includeNested: true,
					placement: "both",
					operator: "eq",
					value: 1,
				}),
			),
		).toBe(true);
		expect(
			evaluateCondition(
				world,
				game,
				condition({
					type: "items",
					operation: "matching-total-size",
					scope: "current-room",
					includeNested: true,
					placement: "both",
					operator: "eq",
					value: 3,
				}),
			),
		).toBe(true);
		game = resolveEffects(
			world,
			game,
			createPlayerTestEffectGroup("collections", [
				effect({
					type: "items",
					operation: "set-flag-on-matching",
					scope: "current-room",
					tag: "light",
					includeNested: true,
					placement: "both",
					flag: "lit",
					value: false,
				}),
				effect({
					type: "items",
					operation: "set-listing-text-on-matching",
					scope: "current-room",
					tag: "treasure",
					includeNested: true,
					placement: "both",
					value: "A marked coin lies here.",
				}),
				effect({
					type: "items",
					operation: "move-matching-to-inventory",
					scope: "current-room",
					tag: "treasure",
					includeNested: true,
					placement: "both",
				}),
				effect({
					type: "items",
					operation: "instantiate",
					templateItemId: toID("item", "hole-template"),
					destination: "current-room",
				}),
			]),
		);
		expect(
			evaluateCondition(
				world,
				game,
				condition({
					type: "items",
					operation: "all-matching-have-flag",
					scope: "world",
					tag: "light",
					includeNested: true,
					placement: "both",
					flag: "lit",
					value: false,
					requireMatch: true,
				}),
			),
		).toBe(true);
		expect(game.itemStates.find((item) => item.id.id === "coin")?.location.type).toBe("inventory");
		expect(
			game.itemStates.filter((item) => item.templateItemId?.id === "hole-template"),
		).toHaveLength(1);
	});

	it("resets, transforms, and extends item presentation", () => {
		const world = testWorld();
		let game = resolveEffects(
			world,
			createInitialGameState(world, world.startRoomId),
			createPlayerTestEffectGroup("change", [
				effect({type: "item", operation: "set-name", itemId: toID("item", "coin"), value: "Bent coin"}),
				effect({
					type: "item",
					operation: "append-examine-text",
					itemId: toID("item", "coin"),
					value: " Scratched.",
				}),
				effect({
					type: "item",
					operation: "apply-item-template",
					itemId: toID("item", "coin"),
					templateItemId: toID("item", "torch"),
				}),
			]),
		);
		expect(game.itemStates.find((item) => item.id.id === "coin")?.name).toBe("Torch");
		game = resolveEffects(
			world,
			game,
			createPlayerTestEffectGroup("reset", [
				effect({type: "item", operation: "reset-state", itemId: toID("item", "coin")}),
			]),
		);
		expect(game.itemStates.find((item) => item.id.id === "coin")?.name).toBe("Coin");
	});

	it("offers validated direct placement without bypassing container rules", () => {
		const world = testWorld();
		const game = resolveEffects(
			world,
			createInitialGameState(world, world.startRoomId),
			createPlayerTestEffectGroup("validated-place", [
				effect({
					type: "item",
					operation: "place-inside-validated",
					itemId: toID("item", "coin"),
					destinationItemId: toID("item", "bag"),
				}),
			]),
		);
		expect(game.itemStates.find((item) => item.id.id === "coin")?.location).toEqual({
			type: "item",
			itemId: toID("item", "bag"),
			placement: "inside",
		});
	});

	it("controls events, guarded effects, and deterministic random branches", () => {
		const guardGroup = createPlayerTestEffectGroup("guard-pass", [
			effect({type: "world", operation: "set-flag", flag: "guarded", value: true}),
		]);
		const randomA = createPlayerTestEffectGroup("random-a", [
			effect({type: "world", operation: "set-text", text: "roll", value: "a"}),
		]);
		const randomB = createPlayerTestEffectGroup("random-b", [
			effect({type: "world", operation: "set-text", text: "roll", value: "b"}),
		]);
		const world = produce(testWorld(), (draft) => {
			const event = createDefaultFieldObject(EventSchema);
			event.id = toID("event", "alarm");
			event.name = "Alarm";
			event.wait = 4;
			draft.events = [event];
			draft.effects = [guardGroup, randomA, randomB];
		});
		let game = createInitialGameState(world, world.startRoomId);
		game = resolveEffects(
			world,
			game,
			createPlayerTestEffectGroup("event-control", [
				effect({type: "event", operation: "cancel", eventId: toID("event", "alarm")}),
				effect({type: "event", operation: "reschedule", eventId: toID("event", "alarm"), wait: 7}),
				effect({type: "event", operation: "disable", eventId: toID("event", "alarm")}),
			]),
		);
		expect(
			evaluateCondition(
				world,
				game,
				condition({type: "event", operation: "is-disabled", eventId: toID("event", "alarm")}),
			),
		).toBe(true);
		const guarded = effect({
			type: "control",
			operation: "when",
			condition: {
				type: "group",
				operation: "all",
				conditions: [
					condition({type: "event", operation: "is-disabled", eventId: toID("event", "alarm")}),
				],
			},
			thenEffectId: guardGroup.id,
		});
		const random = effect({
			type: "control",
			operation: "random-branch",
			choices: [
				{weight: 1, effectId: randomA.id},
				{weight: 1, effectId: randomB.id},
			],
		});
		game = resolveEffects(world, game, createPlayerTestEffectGroup("flow", [guarded, random]));
		expect(
			evaluateCondition(
				world,
				game,
				condition({type: "world", operation: "flag-is", flag: "guarded", value: true}),
			),
		).toBe(true);
		expect(["a", "b"]).toContain(game.variables.texts.find((entry) => "roll" in entry)?.roll);
		expect(game.player.randomState).not.toBe(0x6d2b79f5);
	});

	it("supports equipment, capacity, room-local state, win, and terminal ending", () => {
		const world = testWorld();
		let game = createInitialGameState(world, world.startRoomId);
		game = resolveEffects(
			world,
			game,
			createPlayerTestEffectGroup("player-state", [
				effect({type: "player", operation: "set-carrying-capacity", capacity: 2}),
				effect({type: "player", operation: "equip", itemId: toID("item", "bag")}),
				effect({type: "room", operation: "set-current-flag", flag: "disturbed", value: true}),
				effect({type: "room", operation: "add-alias", roomId: toID("room", "yard"), value: "garden"}),
				effect({type: "player", operation: "win", message: "Victory, but the yard remains open."}),
			]),
		);
		expect(
			evaluateCondition(
				world,
				game,
				condition({type: "player", operation: "is-equipped", itemId: toID("item", "bag")}),
			),
		).toBe(true);
		expect(
			evaluateCondition(
				world,
				game,
				condition({type: "room", operation: "current-flag-is", flag: "disturbed", value: true}),
			),
		).toBe(true);
		expect(evaluateCondition(world, game, condition({type: "player", operation: "has-won"}))).toBe(
			true,
		);
		expect(game.player.isEnded).not.toBe(true);
		game = resolveEffects(
			world,
			game,
			createPlayerTestEffectGroup("ending", [
				effect({type: "player", operation: "end-game", message: "The story is over."}),
			]),
		);
		expect(
			evaluateCondition(world, game, condition({type: "player", operation: "game-has-ended"})),
		).toBe(true);
		expect(game.messages.at(-1)?.text).toBe("The story is over.");
	});

	it("creates dynamic inventory and contents messages", () => {
		const world = testWorld();
		const game = resolveEffects(
			world,
			createInitialGameState(world, world.startRoomId),
			createPlayerTestEffectGroup("messages", [
				effect({type: "message", operation: "list-inventory", emptyMessage: "Empty."}),
				effect({
					type: "message",
					operation: "list-contents",
					itemId: toID("item", "bag"),
					placement: "both",
					emptyMessage: "The bag is empty.",
				}),
				effect({
					type: "message",
					operation: "show-counter",
					variable: "left",
					prefix: "Left: ",
					suffix: ".",
				}),
				effect({
					type: "message",
					operation: "show-saved-text",
					variable: "first",
					prefix: "Text: ",
					suffix: ".",
				}),
			]),
		);
		expect(game.messages.slice(-4).map((message) => message.text)).toEqual([
			expect.stringContaining("Bag"),
			"The bag is empty.",
			"Left: 8.",
			"Text: A.",
		]);
	});

	it("renders conditional room and item text from live conditions", () => {
		const when = {
			type: "group" as const,
			operation: "all" as const,
			conditions: [condition({type: "world", operation: "flag-is", flag: "disturbed", value: true})],
		};
		const world = produce(testWorld(), (draft) => {
			draft.initialState.flags = [{flag: "disturbed", value: true}];
			draft.rooms[0].descriptionFragments = [{when, text: "The soil has been disturbed."}];
			draft.items[0].presentation.conditionalText = [{when, text: "It bears fresh mud."}];
		});
		const game = createInitialGameState(world, world.startRoomId);
		const message = createRoomMessage(world, world.rooms[0], game);
		expect(message.text).toContain("The soil has been disturbed.");
		expect(message.text).toContain("It bears fresh mud.");
	});
});
