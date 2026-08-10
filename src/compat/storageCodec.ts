import {
	GameMessageSchema,
	GameStateSchema,
	type GameMessage,
	type GameState,
} from "@/schemas/states/gameStateSchemas";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";

import {migrationFrom, PERSISTED_SCHEMA_VERSION} from "./migrations";
import {
	runTransform,
	type GameStateMigrationContext,
	type MigrationTransform,
	type MessageMigrationContext,
	type WorldMigrationContext,
} from "./migrations/types";

export class UnsupportedStorageVersionError extends Error {
	constructor(readonly version: number) {
		super(
			version > PERSISTED_SCHEMA_VERSION
				? `Stored content version ${version} requires a newer Mothmark deployment.`
				: `Stored content version ${version} has no complete migration path.`,
		);
		this.name = "UnsupportedStorageVersionError";
	}
}

function migrateValue<TContext>(
	value: unknown,
	version: number,
	context: TContext,
	select: (version: number) => MigrationTransform<TContext> | undefined,
): unknown {
	let migrated = value;
	let current = version;
	while (current < PERSISTED_SCHEMA_VERSION) {
		const transform = select(current);
		if (!transform) throw new UnsupportedStorageVersionError(current);
		migrated = runTransform(transform, migrated, context);
		current += 1;
	}
	if (current !== PERSISTED_SCHEMA_VERSION) throw new UnsupportedStorageVersionError(current);
	return migrated;
}

export function parseStoredWorld(
	value: unknown,
	version = PERSISTED_SCHEMA_VERSION,
	context: WorldMigrationContext = {id: "unknown", storage: "unknown"},
): World {
	return WorldSchema.parse(
		migrateValue(value, version, context, (fromVersion) => migrationFrom(fromVersion)?.world),
	);
}

export function parseStoredGameState(
	value: unknown,
	version = PERSISTED_SCHEMA_VERSION,
	context: GameStateMigrationContext = {
		playthroughId: "unknown",
		sequence: null,
		storage: "unknown",
	},
): GameState {
	return GameStateSchema.parse(
		migrateValue(value, version, context, (fromVersion) => migrationFrom(fromVersion)?.gameState),
	);
}

export function parseStoredMessages(
	value: unknown,
	version = PERSISTED_SCHEMA_VERSION,
	context: MessageMigrationContext = {
		playthroughId: "unknown",
		sequence: null,
		storage: "unknown",
	},
): GameMessage[] {
	return GameMessageSchema.array().parse(
		migrateValue(value, version, context, (fromVersion) => migrationFrom(fromVersion)?.messages),
	);
}

export function migrateWorldValue(
	value: unknown,
	version: number,
	context: WorldMigrationContext,
): World {
	return parseStoredWorld(value, version, context);
}

export function migrateGameStateValue(
	value: unknown,
	version: number,
	context: GameStateMigrationContext,
): GameState {
	return parseStoredGameState(value, version, context);
}

export function migrateMessageValue(
	value: unknown,
	version: number,
	context: MessageMigrationContext,
): GameMessage[] {
	return parseStoredMessages(value, version, context);
}
