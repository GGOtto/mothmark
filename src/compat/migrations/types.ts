import type {World} from "@/schemas/world/worldSchema";

export const unchanged = Symbol("unchanged persisted document");

export type MigrationTransform<TContext> =
	typeof unchanged | ((value: unknown, context: TContext) => unknown);

export type WorldMigrationContext = {
	id: string;
	name?: string;
	storage: "editor" | "publication" | "template" | "unknown";
};

export type GameStateMigrationContext = {
	playthroughId: string;
	sequence: number | null;
	storage: "current" | "turn" | "unknown";
	world?: World;
};

export type MessageMigrationContext = {
	playthroughId: string;
	sequence: number | null;
	storage: "output" | "transcript" | "unknown";
};

export type StorageMigration = {
	id: string;
	fromVersion: number;
	toVersion: number;
	world: MigrationTransform<WorldMigrationContext>;
	gameState: MigrationTransform<GameStateMigrationContext>;
	messages: MigrationTransform<MessageMigrationContext>;
};

export function defineStorageMigration(migration: StorageMigration): StorageMigration {
	if (migration.toVersion !== migration.fromVersion + 1)
		throw new Error(`Storage migration ${migration.id} must advance exactly one version.`);
	return migration;
}

export function runTransform<TContext>(
	transform: MigrationTransform<TContext>,
	value: unknown,
	context: TContext,
): unknown {
	return transform === unchanged ? value : transform(value, context);
}

export type VersionedMigrationResult = {
	applied: boolean;
	schemaVersion: number;
	value: unknown;
};

/** Couples a transform to its version advance so persistence can atomically mark it applied. */
export function applyVersionedTransform<TContext>(
	migration: Pick<StorageMigration, "fromVersion" | "toVersion">,
	documentVersion: number,
	transform: MigrationTransform<TContext>,
	value: unknown,
	context: TContext,
): VersionedMigrationResult {
	if (documentVersion !== migration.fromVersion)
		return {applied: false, schemaVersion: documentVersion, value};
	return {
		applied: true,
		schemaVersion: migration.toVersion,
		value: runTransform(transform, value, context),
	};
}
