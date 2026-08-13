/** @jest-environment node */

import {produce} from "immer";

import {helpCommand} from "@/data/commands/initialCommands";
import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestEffectGroup, createPlayerTestScenario} from "@/engine/utils/testUtils";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {applyVersionedTransform} from "./types";
import {LEGACY_EMPTY_FLAG_KEY, v6ToV7} from "./v6ToV7";

describe("the v6 to v7 migration through the player path", () => {
	it("keeps an unnamed legacy flag effect functional under its reserved name", () => {
		const scenario = createPlayerTestScenario("navigation");
		const retained = produce(scenario.world, (draft) => {
			const command = structuredClone(helpCommand);
			command.behavior.always = createPlayerTestEffectGroup("legacy-empty-flag", [
				{type: "world", operation: "set-flag", flag: LEGACY_EMPTY_FLAG_KEY, value: true},
			]);
			draft.commands = [command];
		});
		const legacy = structuredClone(retained) as unknown as Record<string, unknown>;
		const commands = legacy.commands as Array<Record<string, unknown>>;
		const behavior = commands[0].behavior as Record<string, unknown>;
		const always = behavior.always as Record<string, unknown>;
		const effects = always.effects as Array<Record<string, unknown>>;
		effects[0].flag = "";

		const migrated = WorldSchema.parse(
			applyVersionedTransform(v6ToV7, 6, v6ToV7.world, legacy, {
				id: "world-1",
				storage: "publication",
			}).value,
		);
		const result = resolveTurn(migrated, scenario.game, "help");

		expect(result.variables.flags).toContainEqual({[LEGACY_EMPTY_FLAG_KEY]: true});
	});
});
