import type {CommandVariable, GameState} from "@/schemas/states/gameStateSchemas";
import {DIRECTION_NAMES} from "@/schemas/world/directionSchema";
import {compareIds, type ID} from "@/utils/idUtils";
import type {CommandVariableReference} from "./model";
import {parseVariableText} from "./syntax";

function commandVariable(game: GameState, blockId: ID<"command-block">) {
	return game.variables.command.find((variable) => compareIds(variable.blockId, blockId));
}

function targetText(
	game: GameState,
	variable: Extract<CommandVariable, {type: "target"}>,
	projection: "name" | "description",
) {
	if (variable.value.type === "room") {
		return game.roomStates.find((room) => compareIds(room.id, variable.value))?.[projection];
	}

	return game.itemStates.find((item) => compareIds(item.id, variable.value))?.[projection];
}

export function resolveCommandVariableReference(
	game: GameState,
	reference: CommandVariableReference,
): unknown {
	const variable = commandVariable(game, reference.blockId);
	if (!variable) return undefined;
	if (reference.projection === "text") return variable.rawText;
	if (variable.type === "failed") return undefined;
	if (reference.projection === "name" && variable.type === "direction") {
		return DIRECTION_NAMES[variable.value];
	}
	if (reference.projection === "name" || reference.projection === "description") {
		return variable.type === "target" ? targetText(game, variable, reference.projection) : undefined;
	}
	return variable.type === "target" ? variable.value : variable.value;
}

export function interpolateCommandVariables(game: GameState, value: string) {
	return parseVariableText(value)
		.map((node) => {
			if (node.type === "text") return node.value;
			const resolved = resolveCommandVariableReference(game, node.reference);
			return resolved === undefined || (typeof resolved === "object" && resolved !== null)
				? ""
				: String(resolved);
		})
		.join("");
}

export function interpolateCommandTemplate(game: GameState, value: unknown): unknown {
	if (typeof value === "string") return interpolateCommandVariables(game, value);
	if (Array.isArray(value)) return value.map((child) => interpolateCommandTemplate(game, child));
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value).map(([key, child]) => [key, interpolateCommandTemplate(game, child)]),
	);
}
