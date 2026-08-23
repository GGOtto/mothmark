/** @jest-environment node */

import {produce} from "immer";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestEvent, createPlayerTestScenario} from "@/engine/utils/testUtils";
import {GameMessageSchema, GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {toID} from "@/utils/idUtils";

import {observableState} from "../replayCompatibility";
import {migrationFrom, PERSISTED_SCHEMA_VERSION} from ".";
import {applyVersionedTransform} from "./types";
import {v14ToV15} from "./v14ToV15";

function startupWorld() {
	const scenario = createPlayerTestScenario("navigation");
	const event = createPlayerTestEvent(
		"startup-shutter",
		[
			{
				type: "navigation",
				operation: "unlock-exit",
				roomId: toID("room", "foyer"),
				direction: "e",
			},
			{type: "message", operation: "show", message: "The shutter rises."},
		],
		(draft) => {
			draft.disposable = true;
		},
	);
	return produce(scenario.world, (draft) => {
		draft.rooms[0].initiallyBlockedExits = ["e"];
		draft.events = [event];
	});
}

describe("the v14 to v15 startup-event migration", () => {
	it("preserves old worlds and supplies the neutral blocked-exit default while parsing", () => {
		const value: unknown = structuredClone(createPlayerTestScenario("navigation").world);
		if (!value || typeof value !== "object" || !("rooms" in value) || !Array.isArray(value.rooms)) {
			throw new Error("Expected a legacy world object.");
		}
		for (const room of value.rooms) {
			if (room && typeof room === "object") delete room.initiallyBlockedExits;
		}

		const result = applyVersionedTransform(v14ToV15, 14, v14ToV15.world, value, {
			id: "world-1",
			storage: "publication",
		});

		expect(result).toEqual({applied: true, schemaVersion: 15, value});
		expect(
			WorldSchema.parse(result.value).rooms.every((room) => room.initiallyBlockedExits.length === 0),
		).toBe(true);
	});

	it("replays retained turns from the new startup state", () => {
		const world = startupWorld();
		const initial = createInitialGameState(world, world.startRoomId);
		const retained = resolveTurn(world, initial, "help");

		const result = applyVersionedTransform(
			v14ToV15,
			14,
			v14ToV15.gameState,
			{},
			{
				playthroughId: "playthrough-1",
				sequence: 1,
				storage: "turn",
				world,
				command: "help",
				previousState: initial,
			},
		);

		expect(observableState(GameStateSchema.parse(result.value))).toEqual(observableState(retained));
		expect(initial.messages.map(({type}) => type)).toEqual(["system", "room"]);
		expect(initial.roomStates[0].lockedExits).toEqual([]);
	});

	it("rebuilds current state and transcripts for playthroughs with no turns", () => {
		const world = startupWorld();
		const initial = createInitialGameState(world, world.startRoomId);
		const stateResult = applyVersionedTransform(
			v14ToV15,
			14,
			v14ToV15.gameState,
			{},
			{
				playthroughId: "playthrough-1",
				sequence: null,
				storage: "current",
				world,
				previousState: initial,
			},
		);
		const messageResult = applyVersionedTransform(v14ToV15, 14, v14ToV15.messages, [], {
			playthroughId: "playthrough-1",
			sequence: null,
			storage: "transcript",
			gameState: stateResult.value,
			previousState: initial,
		});

		expect(observableState(GameStateSchema.parse(stateResult.value))).toEqual(
			observableState(initial),
		);
		expect(
			GameMessageSchema.array()
				.parse(messageResult.value)
				.map(({type, text}) => ({type, text})),
		).toEqual(initial.messages.map(({type, text}) => ({type, text})));
	});

	it("is the final adjacent migration and cannot run twice", () => {
		const value = {retained: true};
		const result = applyVersionedTransform(
			v14ToV15,
			PERSISTED_SCHEMA_VERSION,
			v14ToV15.world,
			value,
			{id: "world-1", storage: "editor"},
		);

		expect(PERSISTED_SCHEMA_VERSION).toBe(15);
		expect(migrationFrom(14)).toBe(v14ToV15);
		expect(migrationFrom(PERSISTED_SCHEMA_VERSION)).toBeUndefined();
		expect(result).toEqual({
			applied: false,
			schemaVersion: PERSISTED_SCHEMA_VERSION,
			value,
		});
	});
});
