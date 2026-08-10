import {resolveTurn} from "@/engine/player/resolveTurn";
import {createInitialGameState} from "@/engine/states/createInitialState";
import type {GameMessage, GameState} from "@/schemas/states/gameStateSchemas";
import type {World} from "@/schemas/world/worldSchema";

const observableMessages = (messages: readonly GameMessage[]) =>
	messages.map(({text, type}) => ({text, type}));

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, child]) => [key, canonicalize(child)]),
	);
}

export function observableState(state: GameState): unknown {
	return canonicalize({
		...state,
		messages: observableMessages(state.messages),
		variables: {...state.variables, command: []},
	});
}

export function observablyEqual(left: unknown, right: unknown): boolean {
	return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

export type StoredReplayTurn = {
	command: string;
	outputMessages: GameMessage[];
	resultingState: GameState;
	sequence: number;
};

export function replayCompatibilityIssues(
	world: World,
	turns: readonly StoredReplayTurn[],
	currentState: GameState,
): string[] {
	const issues: string[] = [];
	let state = createInitialGameState(world, world.startRoomId);
	for (const turn of turns) {
		const previousMessageCount = state.messages.length;
		state = resolveTurn(world, state, turn.command);
		const output = state.messages.slice(previousMessageCount);
		if (!observablyEqual(observableMessages(turn.outputMessages), observableMessages(output)))
			issues.push(`turn ${turn.sequence} produced different player-visible messages`);
		if (!observablyEqual(observableState(turn.resultingState), observableState(state)))
			issues.push(`turn ${turn.sequence} produced a different game state`);
	}
	if (!observablyEqual(observableState(currentState), observableState(state)))
		issues.push("current state does not match replayed command history");
	return issues;
}
