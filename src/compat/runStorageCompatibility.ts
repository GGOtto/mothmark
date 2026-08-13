import {readFileSync} from "node:fs";
import path from "node:path";

import type {Knex} from "knex";

import {migrationFrom, PERSISTED_SCHEMA_VERSION} from "./migrations";
import {applyVersionedTransform} from "./migrations/types";
import {parseStoredWorld} from "./storageCodec";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {
	compareStorageContracts,
	createStorageContract,
	storageContractDigest,
	type StorageContract,
} from "./storageContract";
import {validateStoredContent, type StoredContentValidation} from "./validateStoredContent";

type ContractStateRow = {
	contract: StorageContract | string;
	contract_digest: string;
	schema_version: number;
	singleton: number;
};

export function assertStoredContentValid(validation: StoredContentValidation): void {
	if (validation.issues.length > 0)
		throw new Error(
			`Stored-content validation failed:\n- ${validation.issues.slice(0, 100).join("\n- ")}`,
		);
}

const parsedContract = (value: StorageContract | string): StorageContract =>
	typeof value === "string" ? (JSON.parse(value) as StorageContract) : value;

function assertReviewedSnapshot(contract: StorageContract): void {
	const reviewed = readFileSync(path.join(process.cwd(), "storage-contract.snapshot.json"), "utf8");
	if (JSON.stringify(JSON.parse(reviewed)) !== JSON.stringify(contract))
		throw new Error(
			"The persisted storage contract changed. Run pnpm storage:contract, review the diff, and commit it.",
		);
}

async function storedVersion(transaction: Knex.Transaction): Promise<number> {
	const versions: number[] = [];
	for (const table of ["worlds", "world_versions", "playthroughs", "playthrough_turns"]) {
		const rows = await transaction(table).distinct("schema_version");
		versions.push(...rows.map((row) => Number(row.schema_version)));
	}
	const unique = [...new Set(versions)];
	if (unique.length === 0) return 1;
	if (unique.length !== 1)
		throw new Error(`Stored documents have mixed schema versions: ${unique.sort().join(", ")}.`);
	return unique[0];
}

async function applyMigration(
	transaction: Knex.Transaction,
	fromVersion: number,
	commit: string | null,
	contractDigest: string,
): Promise<void> {
	const migration = migrationFrom(fromVersion);
	if (!migration) throw new Error(`No storage migration exists from schema version ${fromVersion}.`);
	await transaction.raw("select set_config('mothmark.storage_migration', ?, true)", [migration.id]);

	const worldRows = await transaction("worlds")
		.select("id", "kind", "name", "world", "schema_version")
		.where({schema_version: fromVersion})
		.forUpdate();
	for (const row of worldRows) {
		const world = applyVersionedTransform(
			migration,
			Number(row.schema_version),
			migration.world,
			row.world,
			{
				id: String(row.id),
				name: String(row.name),
				storage: row.kind === "template" ? "template" : "editor",
			},
		);
		if (!world.applied) throw new Error(`World ${String(row.id)} changed version while locked.`);
		await transaction("worlds").where({id: row.id}).update({
			world: world.value,
			schema_version: world.schemaVersion,
		});
	}

	const versionRows = await transaction("world_versions")
		.select("id", "world", "schema_version")
		.where({schema_version: fromVersion})
		.forUpdate();
	for (const row of versionRows) {
		const world = applyVersionedTransform(
			migration,
			Number(row.schema_version),
			migration.world,
			row.world,
			{id: String(row.id), storage: "publication" as const},
		);
		if (!world.applied)
			throw new Error(`World version ${String(row.id)} changed version while locked.`);
		await transaction("world_versions").where({id: row.id}).update({
			world: world.value,
			schema_version: world.schemaVersion,
		});
	}

	const migratedWorldRows = await transaction("world_versions").select(
		"id",
		"world",
		"schema_version",
	);
	const migratedWorlds = new Map(
		migratedWorldRows.map((row) => [
			String(row.id),
			migration.toVersion === PERSISTED_SCHEMA_VERSION
				? parseStoredWorld(row.world, Number(row.schema_version), {
						id: String(row.id),
						storage: "publication",
					})
				: undefined,
		]),
	);

	const playthroughRows = await transaction("playthroughs")
		.select("id", "world_version_id", "current_state", "transcript", "schema_version")
		.where({schema_version: fromVersion})
		.forUpdate();

	const turnRows = await transaction("playthrough_turns")
		.select(
			"id",
			"playthrough_id",
			"sequence",
			"command",
			"resulting_state",
			"output_messages",
			"schema_version",
		)
		.where({schema_version: fromVersion})
		.orderBy(["playthrough_id", "sequence"])
		.forUpdate();
	const worldVersionByPlaythrough = new Map(
		(await transaction("playthroughs").select("id", "world_version_id")).map((row) => [
			String(row.id),
			String(row.world_version_id),
		]),
	);
	const previousStateByPlaythrough = new Map<string, unknown>();
	for (const row of playthroughRows) {
		const world = migratedWorlds.get(String(row.world_version_id));
		if (world)
			previousStateByPlaythrough.set(String(row.id), createInitialGameState(world, world.startRoomId));
	}
	for (const row of turnRows) {
		const playthroughId = String(row.playthrough_id);
		const sequence = Number(row.sequence);
		const worldId = worldVersionByPlaythrough.get(playthroughId);
		const state = applyVersionedTransform(
			migration,
			Number(row.schema_version),
			migration.gameState,
			row.resulting_state,
			{
				playthroughId,
				sequence,
				storage: "turn" as const,
				world: worldId ? migratedWorlds.get(worldId) : undefined,
				command: String(row.command),
				previousState: previousStateByPlaythrough.get(playthroughId),
			},
		);
		const messages = applyVersionedTransform(
			migration,
			Number(row.schema_version),
			migration.messages,
			row.output_messages,
			{
				playthroughId,
				sequence,
				storage: "output" as const,
				gameState: state.value,
				previousState: previousStateByPlaythrough.get(playthroughId),
			},
		);
		if (!state.applied || !messages.applied)
			throw new Error(
				`Playthrough turn ${playthroughId}:${String(sequence)} changed version while locked.`,
			);
		previousStateByPlaythrough.set(playthroughId, state.value);
		await transaction("playthrough_turns")
			.where({id: row.id})
			.update({
				resulting_state: state.value,
				output_messages: JSON.stringify(messages.value),
				schema_version: state.schemaVersion,
			});
	}

	for (const row of playthroughRows) {
		const playthroughId = String(row.id);
		const world = migratedWorlds.get(String(row.world_version_id));
		const state = applyVersionedTransform(
			migration,
			Number(row.schema_version),
			migration.gameState,
			row.current_state,
			{
				playthroughId,
				sequence: null,
				storage: "current" as const,
				world,
				previousState: previousStateByPlaythrough.get(playthroughId),
			},
		);
		const transcriptValue =
			typeof row.transcript === "string" ? JSON.parse(row.transcript) : row.transcript;
		const transcript = applyVersionedTransform(
			migration,
			Number(row.schema_version),
			migration.messages,
			transcriptValue,
			{
				playthroughId,
				sequence: null,
				storage: "transcript" as const,
				gameState: state.value,
				previousState: previousStateByPlaythrough.get(playthroughId),
			},
		);
		if (!state.applied || !transcript.applied)
			throw new Error(`Playthrough ${playthroughId} changed version while locked.`);
		await transaction("playthroughs")
			.where({id: row.id})
			.update({
				current_state: state.value,
				transcript: JSON.stringify(transcript.value),
				schema_version: state.schemaVersion,
			});
	}

	await transaction("storage_migration_log").insert({
		migration_id: migration.id,
		from_version: migration.fromVersion,
		to_version: migration.toVersion,
		contract_digest: contractDigest,
		deployed_commit: commit,
		record_counts: JSON.stringify({
			worlds: worldRows.length,
			worldVersions: versionRows.length,
			playthroughs: playthroughRows.length,
			turns: turnRows.length,
		}),
	});
}

export async function runStorageCompatibility(
	database: Knex,
	options: {commit?: string} = {},
): Promise<StoredContentValidation> {
	const contract = createStorageContract();
	assertReviewedSnapshot(contract);
	const digest = storageContractDigest(contract);
	const commit = options.commit?.trim() || null;

	return database.transaction(async (transaction) => {
		await transaction.raw("select pg_advisory_xact_lock(hashtext(?))", [
			"mothmark-storage-compatibility",
		]);
		// Reads continue while the gate runs, but writes wait. Once the transaction commits,
		// queued old-deployment writes are rejected by the storage-version trigger.
		await transaction.raw(
			"lock table worlds, world_versions, playthroughs, playthrough_turns in share row exclusive mode",
		);
		const state = await transaction<ContractStateRow>("storage_contract_state")
			.where({singleton: 1})
			.forUpdate()
			.first();
		let version = state?.schema_version ?? (await storedVersion(transaction));

		if (state && version === PERSISTED_SCHEMA_VERSION) {
			const compatibilityIssues = compareStorageContracts(parsedContract(state.contract), contract);
			if (compatibilityIssues.length > 0)
				throw new Error(
					`The candidate schema is not backward compatible:\n- ${compatibilityIssues.join("\n- ")}\nAdd a numbered storage migration.`,
				);
		}
		if (version > PERSISTED_SCHEMA_VERSION)
			throw new Error(
				`The database is at storage version ${version}, but this deployment supports ${PERSISTED_SCHEMA_VERSION}.`,
			);
		while (version < PERSISTED_SCHEMA_VERSION) {
			await applyMigration(transaction, version, commit, digest);
			version += 1;
		}

		const validation = await validateStoredContent(transaction);
		assertStoredContentValid(validation);

		await transaction("storage_contract_state")
			.insert({
				singleton: 1,
				schema_version: PERSISTED_SCHEMA_VERSION,
				contract_digest: digest,
				contract: JSON.stringify(contract),
				validated_commit: commit,
				updated_at: transaction.fn.now(),
			})
			.onConflict("singleton")
			.merge({
				schema_version: PERSISTED_SCHEMA_VERSION,
				contract_digest: digest,
				contract: JSON.stringify(contract),
				validated_commit: commit,
				updated_at: transaction.fn.now(),
			});
		return validation;
	});
}
