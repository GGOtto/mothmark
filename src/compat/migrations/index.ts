import {v1ToV2} from "./v1ToV2";
import {v2ToV3} from "./v2ToV3";
import {v3ToV4} from "./v3ToV4";
import {v4ToV5} from "./v4ToV5";
import {v5ToV6} from "./v5ToV6";
import {v6ToV7} from "./v6ToV7";
import {v7ToV8} from "./v7ToV8";
import {v8ToV9} from "./v8ToV9";
import {v9ToV10} from "./v9ToV10";
import {v10ToV11} from "./v10ToV11";
import {v11ToV12} from "./v11ToV12";
import {v12ToV13} from "./v12ToV13";
import type {StorageMigration} from "./types";

export const PERSISTED_SCHEMA_VERSION = 13;

export const storageMigrations: readonly StorageMigration[] = [
	v1ToV2,
	v2ToV3,
	v3ToV4,
	v4ToV5,
	v5ToV6,
	v6ToV7,
	v7ToV8,
	v8ToV9,
	v9ToV10,
	v10ToV11,
	v11ToV12,
	v12ToV13,
];

export function validateStorageMigrationRegistry(
	migrations: readonly StorageMigration[],
	currentVersion: number,
): void {
	const ids = new Set<string>();
	let expectedFromVersion = 1;
	for (const migration of migrations) {
		if (ids.has(migration.id)) throw new Error(`Duplicate storage migration ID: ${migration.id}.`);
		if (migration.fromVersion !== expectedFromVersion)
			throw new Error(
				`Storage migration ${migration.id} starts at ${migration.fromVersion}; expected ${expectedFromVersion}.`,
			);
		ids.add(migration.id);
		expectedFromVersion = migration.toVersion;
	}
	if (expectedFromVersion !== currentVersion)
		throw new Error(
			`Storage migrations end at version ${expectedFromVersion}; current version is ${currentVersion}.`,
		);
}

validateStorageMigrationRegistry(storageMigrations, PERSISTED_SCHEMA_VERSION);

export function migrationFrom(version: number): StorageMigration | undefined {
	return storageMigrations.find((migration) => migration.fromVersion === version);
}
