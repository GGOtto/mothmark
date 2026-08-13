import {world} from "@/data/worlds/initialWorld";
import type {Effect} from "@/schemas/world/effectSchema";
import {
	ContainerBehaviorSchema,
	OpenableBehaviorSchema,
	SurfaceBehaviorSchema,
} from "@/schemas/world/itemSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {produce} from "immer";
import {resolveRoomEffect} from "../effects/resolveEffects";
import {createInitialGameState} from "../states/createInitialState";
import {createPlayerTestItem, createPlayerTestScenario} from "../utils/testUtils";
import {createRoomMessage} from "./createRoomMessage";

describe("createRoomMessage", () => {
	it("indents every listed item line beneath the room description", () => {
		const scenario = createPlayerTestScenario("navigation");
		const room = scenario.world.rooms[0];

		const message = createRoomMessage(scenario.world, room, scenario.game);

		expect(message.text).toContain(
			"You are back in the test foyer.\n A small brass bell hangs beside the doorway.",
		);
	});

	it("nests listed contents beneath room items with one additional space per level", () => {
		const scenario = createPlayerTestScenario("navigation");
		const chest = produce(
			createPlayerTestItem("chest", "Chest", "An open chest rests here.", "foyer"),
			(draft) => {
				draft.initialState.open = true;
				draft.behaviors = [
					createDefaultFieldObject(ContainerBehaviorSchema),
					createDefaultFieldObject(OpenableBehaviorSchema),
				];
			},
		);
		const satchel = produce(
			createPlayerTestItem("satchel", "Satchel", "A satchel sits inside it.", "foyer"),
			(draft) => {
				draft.initialState.location = {
					type: "item",
					itemId: toID("item", "chest"),
					placement: "inside",
				};
				draft.initialState.open = true;
				draft.behaviors = [
					createDefaultFieldObject(ContainerBehaviorSchema),
					createDefaultFieldObject(OpenableBehaviorSchema),
				];
			},
		);
		const coin = produce(
			createPlayerTestItem("coin", "Coin", "A coin glints at the bottom.", "foyer"),
			(draft) => {
				draft.presentation.listingText = "A coin glints.\nIts face is worn.";
				draft.initialState.location = {
					type: "item",
					itemId: toID("item", "satchel"),
					placement: "inside",
				};
			},
		);
		const nestedWorld = produce(scenario.world, (draft) => {
			draft.items = [coin, chest, satchel];
		});
		const game = createInitialGameState(nestedWorld, nestedWorld.startRoomId);

		const message = createRoomMessage(nestedWorld, nestedWorld.rooms[0], game);

		expect(message.text).toContain(
			"You are back in the test foyer.\n" +
				" An open chest rests here.\n" +
				"  A satchel sits inside it.\n" +
				"   A coin glints.\n" +
				"   Its face is worn.",
		);
	});

	it("lists surface contents without requiring the surface to be open", () => {
		const scenario = createPlayerTestScenario("navigation");
		const table = produce(
			createPlayerTestItem("table", "Table", "A stone table stands here.", "foyer"),
			(draft) => {
				draft.behaviors = [createDefaultFieldObject(SurfaceBehaviorSchema)];
			},
		);
		const map = produce(
			createPlayerTestItem("map", "Map", "A map is spread across it.", "foyer"),
			(draft) => {
				draft.initialState.location = {
					type: "item",
					itemId: toID("item", "table"),
					placement: "on",
				};
			},
		);
		const surfaceWorld = produce(scenario.world, (draft) => {
			draft.items = [table, map];
		});
		const game = createInitialGameState(surfaceWorld, surfaceWorld.startRoomId);

		const message = createRoomMessage(surfaceWorld, surfaceWorld.rooms[0], game);

		expect(message.text).toContain(" A stone table stands here.\n  A map is spread across it.");
	});

	it("omits listed descendants of closed or unlisted parents", () => {
		const scenario = createPlayerTestScenario("navigation");
		const closedChest = produce(
			createPlayerTestItem("closed-chest", "Closed chest", "A closed chest rests here.", "foyer"),
			(draft) => {
				draft.behaviors = [
					createDefaultFieldObject(ContainerBehaviorSchema),
					createDefaultFieldObject(OpenableBehaviorSchema),
				];
			},
		);
		const hiddenCoin = produce(
			createPlayerTestItem("hidden-coin", "Hidden coin", "This coin should not appear.", "foyer"),
			(draft) => {
				draft.initialState.location = {
					type: "item",
					itemId: toID("item", "closed-chest"),
					placement: "inside",
				};
			},
		);
		const unlistedTable = produce(
			createPlayerTestItem(
				"unlisted-table",
				"Unlisted table",
				"This table should not appear.",
				"foyer",
			),
			(draft) => {
				draft.presentation.listedInRoom = false;
				draft.behaviors = [createDefaultFieldObject(SurfaceBehaviorSchema)];
			},
		);
		const hiddenMap = produce(
			createPlayerTestItem("hidden-map", "Hidden map", "This map should not appear.", "foyer"),
			(draft) => {
				draft.initialState.location = {
					type: "item",
					itemId: toID("item", "unlisted-table"),
					placement: "on",
				};
			},
		);
		const gatedWorld = produce(scenario.world, (draft) => {
			draft.items = [closedChest, hiddenCoin, unlistedTable, hiddenMap];
		});
		const game = createInitialGameState(gatedWorld, gatedWorld.startRoomId);

		const message = createRoomMessage(gatedWorld, gatedWorld.rooms[0], game);

		expect(message.text).toContain(" A closed chest rests here.");
		expect(message.text).not.toContain("This coin should not appear.");
		expect(message.text).not.toContain("This table should not appear.");
		expect(message.text).not.toContain("This map should not appear.");
	});

	it("uses the runtime short description for a visited room", () => {
		const initialGame = createInitialGameState(world, world.startRoomId);
		const namedGame = resolveRoomEffect(initialGame, {
			type: "room",
			operation: "set-name",
			roomId: world.startRoomId,
			value: "Changed Entrance",
		} as Effect);
		const fullyDescribedGame = resolveRoomEffect(namedGame, {
			type: "room",
			operation: "set-description",
			roomId: world.startRoomId,
			value: "This full description should not be shown.",
		} as Effect);
		const describedGame = resolveRoomEffect(fullyDescribedGame, {
			type: "room",
			operation: "set-short-description",
			roomId: world.startRoomId,
			value: "The entrance remains cold and dark.",
		} as Effect);
		const room = world.rooms.find((candidate) => candidate.id.id === world.startRoomId.id)!;

		const message = createRoomMessage(world, room, describedGame);

		expect(message.text).toContain("Changed Entrance\n");
		expect(message.text).toContain("The entrance remains cold and dark.\n");
		expect(message.text).not.toContain("This full description should not be shown.");
	});

	it("uses the runtime full description for an unvisited room", () => {
		const initialGame = createInitialGameState(world, world.startRoomId);
		const room = world.rooms.find((candidate) => candidate.id.id === "stockroom")!;
		const game = resolveRoomEffect(initialGame, {
			type: "room",
			operation: "set-description",
			roomId: room.id,
			value: "The guardroom has changed.",
		} as Effect);
		const gameWithShortDescription = resolveRoomEffect(game, {
			type: "room",
			operation: "set-short-description",
			roomId: room.id,
			value: "This short description should not be shown.",
		} as Effect);

		const message = createRoomMessage(world, room, gameWithShortDescription);

		expect(message.text).toContain("The guardroom has changed.\n");
		expect(message.text).not.toContain("This short description should not be shown.");
	});
});
