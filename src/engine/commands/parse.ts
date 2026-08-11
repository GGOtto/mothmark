import type {CommandVariable, GameState} from "@/schemas/states/gameStateSchemas";
import type {Command} from "@/schemas/world/commandSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds, idValue, type ID} from "@/utils/idUtils";
import {getPartitionSegments, type PartitionSegment} from "../utils/getPartitions";
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
			failedVariables: Extract<CommandVariable, {type: "failed"}>[];
	  }
	| {
			command: Command;
			match: "fail";
			variables: [];
	  };

export type RunnableCommandMatch = Exclude<CommandMatch, {match: "fail"}>;

export function commandIsInScope(command: Command, world: World, game: GameState): boolean {
	switch (command.scope.scope) {
		case "global":
			return true;
		case "rooms":
			return command.scope.roomIds.some((roomId) => compareIds(roomId, game.player.currentRoom));
		case "layers": {
			const scopedLayers = command.scope.layers;
			return world.metadata.layers.some(
				(layer) =>
					scopedLayers.includes(layer.layer) &&
					layer.rooms.some((roomId) => compareIds(roomId, game.player.currentRoom)),
			);
		}
	}
}

export function matchCommandToPartition(
	partition: Array<PartitionSegment | string>,
	command: Command,
	commandContext: MatchBlockContext,
): CommandMatch {
	let partialCommandMatch: Extract<CommandMatch, {match: "partial match"}> | undefined;

	for (const pattern of command.patterns) {
		if (partition.length !== pattern.blocks.length) continue;

		const variables: CommandVariable[] = [];
		const partialBlockIds: ID<"command-block">[] = [];
		const failedVariables: Extract<CommandVariable, {type: "failed"}>[] = [];
		let patternFailed = false;
		let matchedBlockCount = 0;

		for (let index = 0; index < partition.length; index += 1) {
			const block = pattern.blocks[index];
			const segment = partition[index];
			const segmentText = typeof segment === "string" ? segment : segment.text;
			const rawText = typeof segment === "string" ? segment : segment.rawText;
			const blockMatch = matchBlock(segmentText, block, commandContext);

			if (blockMatch.match === "fail") {
				patternFailed = true;
				break;
			}

			if (blockMatch.match === "partial match") {
				partialBlockIds.push(block.id);
				failedVariables.push({blockId: block.id, type: "failed", rawText});
				continue;
			}

			variables.push({...blockMatch.command, rawText});
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
			failedVariables,
		};
	}

	return partialCommandMatch ?? {command, match: "fail", variables: []};
}

export function findMatchingCommands(
	text: string,
	world: World,
	game: GameState,
): RunnableCommandMatch[] {
	const partitions = getPartitionSegments(text);
	const fullMatches = new Map<string, Extract<CommandMatch, {match: "match"}>>();
	const partialMatches = new Map<string, Extract<CommandMatch, {match: "partial match"}>>();
	const context = resolveTargetMatchContext(world, game);

	for (const partition of partitions) {
		for (const command of world.commands) {
			if (!command.enabled) continue;
			if (!commandIsInScope(command, world, game)) continue;

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
