/** @jest-environment node */

import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {WorldSchema} from "@/schemas/world/worldSchema";

import {observableState} from "../replayCompatibility";
import {applyVersionedTransform} from "./types";
import {v12ToV13} from "./v12ToV13";

describe("the v12 to v13 migration through the player path", () => {
	it("preserves player-visible command behavior", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const migrated = WorldSchema.parse(
			applyVersionedTransform(v12ToV13, 12, v12ToV13.world, world, {
				id: "world-1",
				storage: "publication",
			}).value,
		);

		const migratedResult = resolveTurn(migrated, game, "look");
		const retainedResult = resolveTurn(world, game, "look");

		expect(observableState(migratedResult)).toEqual(observableState(retainedResult));
		expect(migratedResult.messages.map(({type, text}) => ({type, text}))).toEqual(
			retainedResult.messages.map(({type, text}) => ({type, text})),
		);
	});
});
