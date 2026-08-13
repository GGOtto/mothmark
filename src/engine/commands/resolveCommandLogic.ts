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
import {evaluateCondition} from "../conditions/evaluateCondition";
import {resolveEffects} from "../effects/resolveEffects";
import {addDelayedConditionEvent} from "../events/addDelayedConditionEvent";
import {findVariable} from "../utils/lookupUtils";
import {
	interpolateCommandTemplate,
	resolveCommandVariableReference,
} from "@/features/command-variables/runtime";

const passingCondition: Condition = {type: "group", operation: "all", conditions: []};
const failingCondition: Condition = {type: "group", operation: "any", conditions: []};

function resolvedVariableValue(game: GameState, binding: CommandVariableBinding): unknown {
	return resolveCommandVariableReference(game, {
		blockId: binding.blockId,
		projection: binding.projection,
	});
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

	return interpolateCommandTemplate(game, resolved) as Record<string, unknown>;
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

function conditionBinding(
	condition: CommandCondition,
	field: string,
): CommandVariableBinding | undefined {
	if (!("commandVariables" in condition) || !Array.isArray(condition.commandVariables)) {
		return undefined;
	}
	return condition.commandVariables.find((binding) => binding.field === field);
}

function compareText(left: string, operation: string, right: unknown): boolean {
	const textOperation = operation.replace(/^text-/, "");
	switch (textOperation) {
		case "is-empty":
			return left.length === 0;
		case "is-not-empty":
			return left.length > 0;
		case "exists":
			return true;
		case "missing":
			return false;
	}

	if (typeof right !== "string") return false;

	switch (textOperation) {
		case "is":
			return left === right;
		case "is-not":
			return left !== right;
		case "starts-with":
			return left.startsWith(right);
		case "does-not-start-with":
			return !left.startsWith(right);
		case "ends-with":
			return left.endsWith(right);
		case "does-not-end-with":
			return !left.endsWith(right);
		case "contains":
			return left.includes(right);
		case "does-not-contain":
			return !left.includes(right);
		default:
			return false;
	}
}

function resolveBoundSubjectCondition(
	game: GameState,
	condition: Exclude<CommandCondition, {type: "group" | "comparison"}>,
): Condition | undefined {
	if (condition.type !== "world" || typeof condition.operation !== "string") return undefined;
	const subjectField = condition.operation.startsWith("counter-")
		? "counter"
		: condition.operation.startsWith("flag-")
			? "flag"
			: condition.operation.startsWith("text-")
				? "text"
				: undefined;
	if (!subjectField) return undefined;
	const binding = conditionBinding(condition, subjectField);
	if (!binding) return undefined;

	const subject = resolvedVariableValue(game, binding);
	const resolved = applyCommandVariables(game, condition as Record<string, unknown>);
	const operation = String(resolved.operation);
	let passes = false;

	if (subjectField === "counter") {
		if (operation === "counter-exists" || operation === "counter-missing") {
			passes = operation === "counter-exists" ? subject !== undefined : subject === undefined;
		} else if (typeof subject === "number" && Number.isFinite(subject)) {
			if (operation === "counter-compare") {
				passes =
					typeof resolved.value === "number" &&
					compareNumbers(subject, String(resolved.operator), resolved.value);
			} else if (operation === "counter-between") {
				passes =
					typeof resolved.min === "number" &&
					typeof resolved.max === "number" &&
					(resolved.inclusive
						? subject >= resolved.min && subject <= resolved.max
						: subject > resolved.min && subject < resolved.max);
			}
		}
	} else if (subjectField === "flag") {
		if (operation === "flag-exists" || operation === "flag-missing") {
			passes = operation === "flag-exists" ? subject !== undefined : subject === undefined;
		} else {
			passes =
				operation === "flag-is" &&
				typeof subject === "boolean" &&
				typeof resolved.value === "boolean" &&
				subject === resolved.value;
		}
	} else if (typeof subject === "string") {
		passes = compareText(subject, operation, resolved.value);
	} else {
		passes = operation === "text-missing";
	}

	return passes ? passingCondition : failingCondition;
}

function resolveNumberOperand(game: GameState, operand: unknown): number | undefined {
	if (typeof operand === "number" && Number.isFinite(operand)) return operand;
	if (!operand || typeof operand !== "object" || Array.isArray(operand)) return undefined;

	const record = operand as Record<string, unknown>;
	if (record.source === "literal") {
		return typeof record.value === "number" && Number.isFinite(record.value)
			? record.value
			: undefined;
	}
	if (record.source === "counter" && typeof record.counter === "string") {
		const counter = findVariable(game.variables.counters, record.counter);
		return counter.exists ? counter.value : undefined;
	}
	return undefined;
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

	const boundSubject = resolveBoundSubjectCondition(game, condition);
	if (boundSubject) return boundSubject;

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
