import type {GameState} from "@/schemas/states/gameStateSchemas";
import type {World} from "@/schemas/world/worldSchema";
import {getPartitions} from "../utils/getPartitions";
import type {Command} from "@/schemas/world/commandSchemas";
import {matchBlock, type MatchBlockContext} from "./blocks";
import {resolveTargetMatchContext} from "./targetContext";

export function normalize(text: string): string {
	return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchCommandToPartition(
	partition: string[],
	command: Command,
	commandContext: MatchBlockContext,
): boolean {
	for (const pattern of command.patterns) {
		if (partition.length !== pattern.blocks.length) {
			continue;
		}
		for (let i = 0; i < partition.length; i++) {
			const match = matchBlock(partition[i], pattern.blocks[i], commandContext);
			if (match.match !== "match") {
				break;
			}
			if (i === partition.length - 1) {
				return true;
			}
		}
	}
	return false;
}

export function findMatchingCommands(text: string, world: World, game: GameState): Command[] {
	const partitions = getPartitions(text);
	const matches: Command[] = [];
	const context = resolveTargetMatchContext(world, game);

	for (const partition of partitions) {
		for (const command of world.commands) {
			if (matchCommandToPartition(partition, command, context)) {
				matches.push(command);
			}
		}
	}

	return matches;
}
