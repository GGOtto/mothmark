import type {CommandVariable, GameState} from "@/schemas/states/gameStateSchemas";
import type {Command} from "@/schemas/world/commandSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {idValue, type ID} from "@/utils/idUtils";
import {getPartitions} from "../utils/getPartitions";
import {matchBlock, type MatchBlockContext} from "./blocks";
import {resolveTargetMatchContext} from "./targetContext";

export function normalize(text: string): string {
	return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export type CommandMatch =
	| {
			command: Command;
			match: "match";
			variables: CommandVariable[];
	  }
	| {
			command: Command;
			match: "partial match";
			partialBlockId: ID<"command-block">;
			variables: CommandVariable[];
	  }
	| {
			command: Command;
			match: "fail";
			variables: [];
	  };

export type RunnableCommandMatch = Exclude<CommandMatch, {match: "fail"}>;

export function matchCommandToPartition(
	partition: string[],
	command: Command,
	commandContext: MatchBlockContext,
): CommandMatch {
	let partialCommandMatch: Extract<CommandMatch, {match: "partial match"}> | undefined;

	for (const pattern of command.patterns) {
		if (partition.length !== pattern.blocks.length) continue;

		const variables: CommandVariable[] = [];
		const partialBlockIds: ID<"command-block">[] = [];
		let patternFailed = false;
		let matchedBlockCount = 0;

		for (let index = 0; index < partition.length; index += 1) {
			const block = pattern.blocks[index];
			const blockMatch = matchBlock(partition[index], block, commandContext);

			if (blockMatch.match === "fail") {
				patternFailed = true;
				break;
			}

			if (blockMatch.match === "partial match") {
				partialBlockIds.push(block.id);
				continue;
			}

			variables.push(blockMatch.command);
			matchedBlockCount += 1;
		}

		if (patternFailed) continue;

		if (partialBlockIds.length === 0) {
			return {command, match: "match", variables};
		}

		if (matchedBlockCount === 0) continue;

		partialCommandMatch ??= {
			command,
			match: "partial match",
			partialBlockId: partialBlockIds[0],
			variables,
		};
	}

	return partialCommandMatch ?? {command, match: "fail", variables: []};
}

export function findMatchingCommands(
	text: string,
	world: World,
	game: GameState,
): RunnableCommandMatch[] {
	const partitions = getPartitions(text);
	const fullMatches = new Map<string, Extract<CommandMatch, {match: "match"}>>();
	const partialMatches = new Map<string, Extract<CommandMatch, {match: "partial match"}>>();
	const context = resolveTargetMatchContext(world, game);

	for (const partition of partitions) {
		for (const command of world.commands) {
			const result = matchCommandToPartition(partition, command, context);
			const commandId = idValue(command.id);

			if (result.match === "match") {
				fullMatches.set(commandId, result);
				partialMatches.delete(commandId);
			} else if (result.match === "partial match" && !fullMatches.has(commandId)) {
				partialMatches.set(commandId, partialMatches.get(commandId) ?? result);
			}
		}
	}

	return fullMatches.size > 0 ? [...fullMatches.values()] : [...partialMatches.values()];
}
