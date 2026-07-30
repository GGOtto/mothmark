import {produce} from "immer";
import type {ZodType} from "zod";
import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {Condition} from "@/schemas/world/conditionSchema";
import {ConditionSchema} from "@/schemas/world/conditionSchema";
import type {ConditionWithEffect} from "@/schemas/world/conditionBranchSchemas";
import {
	type CommandCondition,
	type CommandConditionBranch,
	type CommandConditionWithEffect,
	type CommandEffect,
	type CommandEffectGroup,
	type CommandLogicTemplate,
	type CommandVariableBinding,
} from "@/schemas/world/commandLogicSchemas";
import type {Effect, EffectGroup} from "@/schemas/world/effectSchema";
import {EffectGroupSchema, EffectSchema} from "@/schemas/world/effectSchema";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds} from "@/utils/idUtils";
import {evaluateCondition} from "../conditions/evaluateCondition";
import {resolveEffects} from "../effects/resolveEffects";
import {addDelayedConditionEvent} from "../events/addDelayedConditionEvent";
import {findVariable} from "../utils/lookupUtils";

const passingCondition: Condition = {type: "group", operation: "all", conditions: []};
const failingCondition: Condition = {type: "group", operation: "any", conditions: []};

function resolvedVariableValue(game: GameState, binding: CommandVariableBinding): unknown {
	return game.variables.command.find((variable) => compareIds(variable.blockId, binding.blockId))
		?.value;
}

function applyCommandVariables(
	game: GameState,
	template: Record<string, unknown>,
): Record<string, unknown> {
	const bindings = Array.isArray(template.commandVariables)
		? (template.commandVariables as CommandVariableBinding[])
		: [];
	const resolved = {...template};
	delete resolved.commandVariables;

	for (const binding of bindings) {
		const value = resolvedVariableValue(game, binding);
		if (value !== undefined) resolved[binding.field] = value;
	}

	return resolved;
}

/**
 * Applies command-block bindings and asks the supplied canonical schema to
 * validate the materialized value. This is the shared extension point for new
 * condition and effect variants.
 */
export function resolveCommandTemplate<T>(
	game: GameState,
	template: CommandLogicTemplate,
	schema: ZodType<T>,
): T | undefined {
	const result = schema.safeParse(applyCommandVariables(game, template));
	return result.success ? result.data : undefined;
}

function compareNumbers(left: number, operator: string, right: number): boolean {
	switch (operator) {
		case "eq":
			return left === right;
		case "neq":
			return left !== right;
		case "gt":
			return left > right;
		case "gte":
			return left >= right;
		case "lt":
			return left < right;
		case "lte":
			return left <= right;
		default:
			return false;
	}
}

function resolveNumberOperand(game: GameState, operand: unknown): number | undefined {
	if (typeof operand === "number" && Number.isFinite(operand)) return operand;
	if (!operand || typeof operand !== "object" || Array.isArray(operand)) return undefined;

	const record = operand as Record<string, unknown>;
	if (record.source !== "counter" || typeof record.counter !== "string") return undefined;
	const counter = findVariable(game.variables.counters, record.counter);
	return counter.exists ? counter.value : undefined;
}

function resolveComparisonCondition(
	game: GameState,
	condition: CommandCondition,
): Condition | undefined {
	const resolved = applyCommandVariables(game, condition as Record<string, unknown>);
	const left = resolveNumberOperand(game, resolved.left);
	const right = resolveNumberOperand(game, resolved.right);
	if (left === undefined || right === undefined) return undefined;

	return compareNumbers(left, String(resolved.operator), right)
		? passingCondition
		: failingCondition;
}

function tryResolveCommandCondition(
	game: GameState,
	condition: CommandCondition,
): Condition | undefined {
	if (condition.type === "comparison") {
		return resolveComparisonCondition(game, condition);
	}

	if (condition.type === "group") {
		const group = condition as Extract<CommandCondition, {conditions: CommandCondition[]}>;
		const conditions = group.conditions.map((child) => tryResolveCommandCondition(game, child));
		if (conditions.some((child) => child === undefined)) return undefined;

		return {
			type: "group",
			operation: group.operation,
			conditions: conditions as Condition[],
		};
	}

	return resolveCommandTemplate(game, condition as CommandLogicTemplate, ConditionSchema);
}

export function resolveCommandCondition(game: GameState, condition: CommandCondition): Condition {
	return tryResolveCommandCondition(game, condition) ?? failingCondition;
}

export function resolveCommandEffect(game: GameState, effect: CommandEffect): Effect | undefined {
	return resolveCommandTemplate(game, effect, EffectSchema);
}

export function resolveCommandEffectGroup(game: GameState, group: CommandEffectGroup): EffectGroup {
	const resolved = {
		...group,
		effects: group.effects.flatMap((effect) => {
			const nextEffect = resolveCommandEffect(game, effect);
			return nextEffect ? [nextEffect] : [];
		}),
	};
	const result = EffectGroupSchema.safeParse(resolved);
	if (result.success) return result.data;

	return EffectGroupSchema.parse({...resolved, effects: []});
}

function clearCommandVariables(game: GameState): GameState {
	return produce(game, (draft) => {
		draft.variables.command = [];
	});
}

function resolveCommandConditionEffect(
	world: World,
	game: GameState,
	conditionWithEffect: CommandConditionWithEffect,
): GameState {
	const resolved: ConditionWithEffect = {
		condition: {
			type: "group",
			operation: "all",
			conditions: [resolveCommandCondition(game, conditionWithEffect.condition)],
		},
		effect: resolveCommandEffectGroup(game, conditionWithEffect.effect),
		delayTurns: conditionWithEffect.delayTurns,
		cancelIfConditionFails: conditionWithEffect.cancelIfConditionFails,
	};

	return resolved.delayTurns > 0
		? addDelayedConditionEvent(game, resolved)
		: resolveEffects(world, game, resolved.effect);
}

export type CommandConditionBranchResult = {
	game: GameState;
	actionTaken: boolean;
};

export function resolveCommandConditionBranchWithResult(
	world: World,
	game: GameState,
	branch: CommandConditionBranch,
): CommandConditionBranchResult {
	let nextGame = game;
	let actionTaken = false;
	let conditionalActionTaken = false;

	if (branch.always) {
		nextGame = resolveEffects(world, nextGame, resolveCommandEffectGroup(nextGame, branch.always));
		actionTaken = true;
	}

	if (
		branch.if &&
		evaluateCondition(world, nextGame, resolveCommandCondition(nextGame, branch.if.condition))
	) {
		nextGame = resolveCommandConditionEffect(world, nextGame, branch.if);
		actionTaken = true;
		conditionalActionTaken = true;
	} else if (branch.elifs) {
		for (const condition of branch.elifs) {
			if (
				!evaluateCondition(world, nextGame, resolveCommandCondition(nextGame, condition.condition))
			) {
				continue;
			}
			nextGame = resolveCommandConditionEffect(world, nextGame, condition);
			actionTaken = true;
			conditionalActionTaken = true;
			break;
		}
	}

	if (!conditionalActionTaken && branch.else) {
		nextGame = resolveEffects(world, nextGame, resolveCommandEffectGroup(nextGame, branch.else));
		actionTaken = true;
	}

	return {game: clearCommandVariables(nextGame), actionTaken};
}

export function resolveCommandConditionBranch(
	world: World,
	game: GameState,
	branch: CommandConditionBranch,
): GameState {
	return resolveCommandConditionBranchWithResult(world, game, branch).game;
}
