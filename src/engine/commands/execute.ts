import {produce} from "immer";
import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds} from "@/utils/idUtils";
import {addMessage} from "../messages/createRoomMessage";
import {getHigherPriorityCommand} from "./getHigherPriorityCommand";
import {findMatchingCommands, type RunnableCommandMatch} from "./parse";
import {resolveCommandConditionBranch} from "./resolveCommandLogic";

function higherPriorityMatch(
	left: RunnableCommandMatch,
	right: RunnableCommandMatch,
): RunnableCommandMatch {
	return getHigherPriorityCommand(left.command, right.command) === left.command ? left : right;
}

export function runCommand(text: string, world: World, game: GameState): GameState {
	const matches = findMatchingCommands(text, world, game);
	if (matches.length === 0) {
		return addMessage(game, "I don't know what that means.", "error");
	}

	const chosenMatch = matches.reduce(higherPriorityMatch);
	const behavior =
		chosenMatch.match === "match"
			? chosenMatch.command.behavior
			: chosenMatch.command.fallbacks.find((fallback) =>
					compareIds(fallback.blockId, chosenMatch.partialBlockId),
				)?.behavior;

	if (!behavior) {
		return addMessage(game, "I don't know what that means.", "error");
	}

	const gameWithCommandVariables = produce(game, (draft) => {
		draft.variables.command = [
			...chosenMatch.variables,
			...(chosenMatch.match === "partial match" ? chosenMatch.failedVariables : []),
		];
	});

	return resolveCommandConditionBranch(world, gameWithCommandVariables, behavior);
}
