import type {Command, CommandBlock} from "@/schemas/world/commandSchemas";
import {idValue} from "@/utils/idUtils";

type PriorityRank = readonly number[];

const DIRECTION_COUNT = 12;

function compareRanks(left: PriorityRank, right: PriorityRank): number {
	const length = Math.max(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0);
		if (difference !== 0) return difference;
	}
	return 0;
}

function closedValueCount(
	block: Extract<CommandBlock, {type: "boolean" | "choice" | "direction"}>,
) {
	switch (block.type) {
		case "boolean":
			return 2;
		case "choice":
			return block.choices.length;
		case "direction":
			return block.allowed.length || DIRECTION_COUNT;
	}
}

function targetRank(block: Extract<CommandBlock, {type: "target"}>): PriorityRank {
	const hasEntityIds = block.entityIds.length > 0;
	const hasTags = block.tags.length > 0;
	const hasEntityTypes = block.entityTypes.length > 0;
	const hasRestrictedSource = block.source !== "any";
	const allTagsAreStricter = block.tags.length > 1 && block.tagMode === "all";
	const tagNarrowness =
		block.tags.length <= 1 ? 0 : block.tagMode === "all" ? block.tags.length : -block.tags.length;

	return [
		4,
		hasEntityIds ? 1 : 0,
		hasEntityIds ? -block.entityIds.length : 0,
		hasTags ? 1 : 0,
		allTagsAreStricter ? 1 : 0,
		hasTags ? tagNarrowness : 0,
		hasEntityTypes ? 1 : 0,
		hasEntityTypes ? -block.entityTypes.length : 0,
		hasRestrictedSource ? 1 : 0,
	];
}

function boundedRangeRank(minimum: number | undefined, maximum: number | undefined): PriorityRank {
	const boundCount = Number(minimum !== undefined) + Number(maximum !== undefined);
	const width = minimum !== undefined && maximum !== undefined ? maximum - minimum : 0;
	return [boundCount, boundCount === 2 ? -width : 0];
}

function blockRank(block: CommandBlock): PriorityRank {
	switch (block.type) {
		case "phrase":
		case "relation":
			// These blocks resolve one authored, closed semantic value. Aliases are
			// alternative syntax and intentionally do not weaken the command.
			return [5, -1];
		case "boolean":
		case "choice":
			return [5, -closedValueCount(block)];
		case "direction":
			return [5, -closedValueCount(block), block.allowRelative ? 0 : 1];
		case "target":
			return targetRank(block);
		case "number":
			return [3, ...boundedRangeRank(block.min, block.max), block.numberType === "integer" ? 1 : 0];
		case "text": {
			const modeRank = block.mode === "quoted" ? 2 : block.mode === "word" ? 1 : 0;
			return [modeRank, ...boundedRangeRank(block.minLength, block.maxLength)];
		}
		default: {
			const exhaustiveBlock: never = block;
			return exhaustiveBlock;
		}
	}
}

function commandBlockRanks(command: Command): PriorityRank[] {
	// Patterns are alternative syntax for the same command and are expected to
	// contain the same semantic blocks. Using one representative pattern keeps
	// syntax aliases from changing command priority.
	const blocks = command.patterns[0]?.blocks ?? [];
	return blocks.map(blockRank).sort((left, right) => compareRanks(right, left));
}

function compareCommandBlocks(left: Command, right: Command): number {
	const leftRanks = commandBlockRanks(left);
	const rightRanks = commandBlockRanks(right);
	const length = Math.max(leftRanks.length, rightRanks.length);

	for (let index = 0; index < length; index += 1) {
		if (!leftRanks[index]) return -1;
		if (!rightRanks[index]) return 1;

		const difference = compareRanks(leftRanks[index], rightRanks[index]);
		if (difference !== 0) return difference;
	}

	return 0;
}

function scopeRank(command: Command): PriorityRank {
	switch (command.scope.scope) {
		case "rooms":
			return [2, -command.scope.roomIds.length];
		case "layers":
			return [1, -command.scope.layers.length];
		case "global":
			return [0, 0];
	}
}

function compareStableIds(left: Command, right: Command): number {
	const leftId = idValue(left.id);
	const rightId = idValue(right.id);
	if (leftId === rightId) return 0;
	return leftId < rightId ? 1 : -1;
}

/**
 * Returns the more specific of two commands that have already matched and are
 * applicable in the current game context.
 *
 * Semantic block specificity wins first, followed by scope, authored priority,
 * and finally command ID as a deterministic fallback.
 */
export function getHigherPriorityCommand(left: Command, right: Command): Command {
	const comparison =
		compareCommandBlocks(left, right) ||
		compareRanks(scopeRank(left), scopeRank(right)) ||
		left.priority - right.priority ||
		compareStableIds(left, right);

	return comparison >= 0 ? left : right;
}
