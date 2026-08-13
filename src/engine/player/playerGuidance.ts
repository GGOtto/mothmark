import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {DIRECTION_NAMES} from "@/schemas/world/directionSchema";
import {commandIsInScope} from "../commands/parse";
import {getAvailableExits} from "./move";
import {evaluateCondition} from "../conditions/evaluateCondition";

const HELP_GROUP_SIZE = 6;

export function availableExitsMessage(world: World, game: GameState): string {
	const exits = getAvailableExits(world, game).map((exit) => DIRECTION_NAMES[exit.direction]);
	return exits.length === 0
		? "There are no visible exits."
		: `Available exits: ${exits.join(", ")}.`;
}

function helpLine(pattern: string, description: string): string {
	return description ? `${pattern} — ${description}` : pattern;
}

/**
 * Uses only explicit help copy and ordinary command scope. It deliberately
 * does not probe targets or behavior conditions, which could disclose hidden
 * entities or state through the presence of a help entry.
 */
export function commandHelpMessage(world: World, game: GameState): string {
	const entries = world.commands
		.filter(
			(command) =>
				command.enabled &&
				(!command.availableWhen || evaluateCondition(world, game, command.availableWhen)) &&
				command.showInHelp &&
				command.helpPattern.trim() &&
				commandIsInScope(command, world, game),
		)
		.map((command) => helpLine(command.helpPattern.trim(), command.helpDescription.trim()));

	if (entries.length === 0) {
		return "No commands are currently listed. Try commands again when your surroundings change.";
	}

	const groups: string[] = [];
	for (let index = 0; index < entries.length; index += HELP_GROUP_SIZE) {
		const title = index === 0 ? "Useful commands:" : "More commands:";
		groups.push(`${title}\n${entries.slice(index, index + HELP_GROUP_SIZE).join("\n")}`);
	}
	return groups.join("\n\n");
}
