import {resolveTurn} from "@/engine/player/resolveTurn";
import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {defineStorageMigration, unchanged, type GameStateMigrationContext} from "./types";

function retainedRecord(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`The retained ${label} must be an object.`);
	}
	return value as Record<string, unknown>;
}

function facingFor(context: GameStateMigrationContext) {
	if (!context.previousState || !context.world) return "n" as const;
	const previous = GameStateSchema.parse(context.previousState);
	return context.command
		? resolveTurn(context.world, previous, context.command).player.facing
		: previous.player.facing;
}

function preserveLegacyDirectionMatching(value: unknown): unknown {
	if (!value || typeof value !== "object" || Array.isArray(value)) return value;
	const world = value as Record<string, unknown>;
	if (!Array.isArray(world.commands)) return value;
	return {
		...world,
		commands: world.commands.map((commandValue) => {
			if (!commandValue || typeof commandValue !== "object" || Array.isArray(commandValue))
				return commandValue;
			const command = commandValue as Record<string, unknown>;
			if (!Array.isArray(command.patterns)) return commandValue;
			return {
				...command,
				patterns: command.patterns.map((patternValue) => {
					if (!patternValue || typeof patternValue !== "object" || Array.isArray(patternValue))
						return patternValue;
					const pattern = patternValue as Record<string, unknown>;
					if (!Array.isArray(pattern.blocks)) return patternValue;
					return {
						...pattern,
						blocks: pattern.blocks.map((blockValue) => {
							if (!blockValue || typeof blockValue !== "object" || Array.isArray(blockValue))
								return blockValue;
							const block = blockValue as Record<string, unknown>;
							return block.type === "direction" ? {...block, allowRelative: false} : blockValue;
						}),
					};
				}),
			};
		}),
	};
}

/**
 * Facing changes after successful compass travel, so retained turn snapshots
 * must be upgraded in sequence rather than merely receiving the north default.
 * The release runner supplies each prior migrated snapshot and command without
 * exposing database access to this pure transform.
 */
export const v4ToV5 = defineStorageMigration({
	id: "v4-to-v5-add-player-facing",
	fromVersion: 4,
	toVersion: 5,
	world: preserveLegacyDirectionMatching,
	gameState(value, context) {
		const state = retainedRecord(value, "game state");
		const player = retainedRecord(state.player, "player state");
		return {...state, player: {...player, facing: facingFor(context)}};
	},
	messages: unchanged,
});
