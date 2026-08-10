import {produce} from "immer";
import type {Draft} from "immer";
import {
	ConditionBranchSchema,
	type ConditionBranch,
	type ConditionWithEffect,
} from "@/schemas/world/conditionBranchSchemas";
import type {ConditionGroup} from "@/schemas/world/conditionSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue, toID} from "@/utils/idUtils";
import {createPlayerTestEffectGroup, createPlayerTestScenario} from "../utils/testUtils";
import {resolveConditionBranch, resolveConditionBranchWithResult} from "./resolveConditionBranch";

const passingCondition: ConditionGroup = {type: "group", operation: "all", conditions: []};
const failingCondition: ConditionGroup = {type: "group", operation: "any", conditions: []};

function effect(message: string) {
	return createPlayerTestEffectGroup(`${message}-effects`, [
		{type: "message", operation: "show", message},
	]);
}

function conditionWithEffect(
	message: string,
	passes: boolean,
	overrides: Partial<Pick<ConditionWithEffect, "delayTurns" | "cancelIfConditionFails">> = {},
): ConditionWithEffect {
	return {
		condition: passes ? passingCondition : failingCondition,
		effect: effect(message),
		delayTurns: 0,
		cancelIfConditionFails: true,
		...overrides,
	};
}

function createBranch(recipe?: (draft: Draft<ConditionBranch>) => void): ConditionBranch {
	return produce(createDefaultFieldObject(ConditionBranchSchema), (draft) => {
		draft.id = toID("condition-branch", "tested-branch");
		delete draft.always;
		delete draft.if;
		delete draft.elifs;
		delete draft.else;
		recipe?.(draft);
	});
}

describe("resolveConditionBranchWithResult", () => {
	const scenario = createPlayerTestScenario("navigation");

	it("returns the original game and reports no action for an empty branch", () => {
		const result = resolveConditionBranchWithResult(scenario.world, scenario.game, createBranch());

		expect(result).toEqual({game: scenario.game, actionTaken: false});
		expect(result.game).toBe(scenario.game);
	});

	it("runs an always effect and reports an action", () => {
		const branch = createBranch((draft) => {
			draft.always = effect("always");
		});

		const result = resolveConditionBranchWithResult(scenario.world, scenario.game, branch);

		expect(result.actionTaken).toBe(true);
		expect(result.game.messages.at(-1)?.text).toBe("always");
	});

	it("runs a passing if and skips elif and else", () => {
		const branch = createBranch((draft) => {
			draft.if = conditionWithEffect("if", true);
			draft.elifs = [conditionWithEffect("elif", true)];
			draft.else = effect("else");
		});

		const result = resolveConditionBranchWithResult(scenario.world, scenario.game, branch);

		expect(result.game.messages.at(-1)?.text).toBe("if");
	});

	it("runs only the first passing elif when if fails", () => {
		const branch = createBranch((draft) => {
			draft.if = conditionWithEffect("if", false);
			draft.elifs = [
				conditionWithEffect("first failing elif", false),
				conditionWithEffect("first passing elif", true),
				conditionWithEffect("later passing elif", true),
			];
			draft.else = effect("else");
		});

		const result = resolveConditionBranchWithResult(scenario.world, scenario.game, branch);

		expect(result.game.messages.at(-1)?.text).toBe("first passing elif");
	});

	it("runs else when no condition passes", () => {
		const branch = createBranch((draft) => {
			draft.if = conditionWithEffect("if", false);
			draft.elifs = [conditionWithEffect("elif", false)];
			draft.else = effect("else");
		});

		const result = resolveConditionBranchWithResult(scenario.world, scenario.game, branch);

		expect(result.actionTaken).toBe(true);
		expect(result.game.messages.at(-1)?.text).toBe("else");
	});

	it("runs always before the selected conditional effect", () => {
		const branch = createBranch((draft) => {
			draft.always = effect("always");
			draft.if = conditionWithEffect("if", true);
		});

		const result = resolveConditionBranchWithResult(scenario.world, scenario.game, branch);

		expect(result.game.messages.slice(-2).map((message) => message.text)).toEqual(["always", "if"]);
	});

	it("schedules a passing if whose delay is greater than zero", () => {
		const branch = createBranch((draft) => {
			draft.if = conditionWithEffect("later", true, {delayTurns: 2});
		});

		const result = resolveConditionBranchWithResult(scenario.world, scenario.game, branch);

		expect(result.actionTaken).toBe(true);
		expect(result.game.messages).toEqual(scenario.game.messages);
		expect(result.game.events).toHaveLength(scenario.game.events.length + 1);
		expect(result.game.events.at(-1)).toMatchObject({
			name: "Delayed Condition",
			disposable: true,
			wait: 2,
			lastSuccess: scenario.game.player.turns,
			branch: {if: {delayTurns: 0, cancelIfConditionFails: true}},
		});
		expect(idValue(result.game.events.at(-1)!.branch.id)).not.toBe(idValue(branch.id));
	});

	it("schedules a passing elif whose delay is greater than zero", () => {
		const branch = createBranch((draft) => {
			draft.if = conditionWithEffect("if", false);
			draft.elifs = [conditionWithEffect("later elif", true, {delayTurns: 3})];
		});

		const result = resolveConditionBranchWithResult(scenario.world, scenario.game, branch);

		expect(result.game.events.at(-1)).toMatchObject({wait: 3});
		expect(result.game.messages).toEqual(scenario.game.messages);
	});

	it("applies a passing condition immediately when its delay is zero", () => {
		const branch = createBranch((draft) => {
			draft.if = conditionWithEffect("now", true, {delayTurns: 0});
		});

		const result = resolveConditionBranchWithResult(scenario.world, scenario.game, branch);

		expect(result.game.messages.at(-1)?.text).toBe("now");
		expect(result.game.events).toEqual(scenario.game.events);
	});

	it("resolveConditionBranch returns only the resolved game", () => {
		const branch = createBranch((draft) => {
			draft.always = effect("resolved");
		});

		expect(resolveConditionBranch(scenario.world, scenario.game, branch).messages.at(-1)?.text).toBe(
			"resolved",
		);
	});

	it("lets always effects influence the following if condition", () => {
		const branch = createBranch((draft) => {
			draft.always = createPlayerTestEffectGroup("set-ready", [
				{
					type: "flag",
					"flag-type": "normal",
					operation: "create",
					flag: "ready",
					value: true,
				},
			]);
			draft.if = {
				condition: {
					type: "group",
					operation: "all",
					conditions: [
						{
							type: "flag",
							"flag-type": "normal",
							operation: "is",
							flag: "ready",
							value: true,
						},
					],
				},
				effect: effect("ready observed"),
				delayTurns: 0,
				cancelIfConditionFails: true,
			};
			draft.else = effect("ready missed");
		});

		const result = resolveConditionBranchWithResult(scenario.world, scenario.game, branch);

		expect(result.game.messages.at(-1)?.text).toBe("ready observed");
	});
});
