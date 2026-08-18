/** @jest-environment node */

import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {WorldSchema} from "@/schemas/world/worldSchema";

import {observableState} from "../replayCompatibility";
import {applyVersionedTransform} from "./types";
import {v13ToV14} from "./v13ToV14";

describe("the v13 to v14 migration through the player path", () => {
	it("preserves player-visible command behavior", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const migrated = WorldSchema.parse(
			applyVersionedTransform(v13ToV14, 13, v13ToV14.world, world, {
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
