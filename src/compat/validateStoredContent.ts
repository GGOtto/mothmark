import type {Knex} from "knex";

import {compareIds} from "@/utils/idUtils";

import {PERSISTED_SCHEMA_VERSION} from "./migrations";
import {replayCompatibilityIssues, observablyEqual} from "./replayCompatibility";
import {parseStoredGameState, parseStoredMessages, parseStoredWorld} from "./storageCodec";

export type StoredContentValidation = {
	counts: {
		playthroughs: number;
		turns: number;
		worldVersions: number;
		worlds: number;
	};
	issues: string[];
};

const issueText = (error: unknown): string =>
	error instanceof Error ? error.message : "Unknown validation failure.";

const parseTranscript = (value: unknown): unknown => {
	if (typeof value !== "string") return value;
	return JSON.parse(value) as unknown;
};

export async function validateStoredContent(
	database: Knex | Knex.Transaction,
): Promise<StoredContentValidation> {
	const issues: string[] = [];
	const [worldRows, versionRows, playthroughRows] = await Promise.all([
		database("worlds").select("id", "kind", "world", "schema_version"),
		database("world_versions").select("id", "world", "schema_version"),
		database("playthroughs").select(
			"id",
			"world_version_id",
			"current_state",
			"transcript",
			"commands",
			"command_count",
			"schema_version",
		),
	]);

	const worlds = new Map<string, ReturnType<typeof parseStoredWorld>>();
	for (const row of worldRows) {
		try {
			if (Number(row.schema_version) !== PERSISTED_SCHEMA_VERSION)
				issues.push(`worlds ${row.id}: schema version is ${row.schema_version}`);
			parseStoredWorld(row.world, Number(row.schema_version), {
				id: String(row.id),
				storage: row.kind === "template" ? "template" : "editor",
			});
		} catch (error) {
			issues.push(`worlds ${row.id}: ${issueText(error)}`);
		}
	}
	for (const row of versionRows) {
		try {
			if (Number(row.schema_version) !== PERSISTED_SCHEMA_VERSION)
				issues.push(`world_versions ${row.id}: schema version is ${row.schema_version}`);
			worlds.set(
				String(row.id),
				parseStoredWorld(row.world, Number(row.schema_version), {
					id: String(row.id),
					storage: "publication",
				}),
			);
		} catch (error) {
			issues.push(`world_versions ${row.id}: ${issueText(error)}`);
		}
	}

	const turnRows = await database("playthrough_turns")
		.select(
			"playthrough_id",
			"sequence",
			"command",
			"output_messages",
			"resulting_state",
			"schema_version",
		)
		.orderBy(["playthrough_id", "sequence"]);
	const turnsByPlaythrough = new Map<string, typeof turnRows>();
	for (const row of turnRows) {
		const key = String(row.playthrough_id);
		const group = turnsByPlaythrough.get(key) ?? [];
		group.push(row);
		turnsByPlaythrough.set(key, group);
	}

	for (const row of playthroughRows) {
		const playthroughId = String(row.id);
		try {
			if (Number(row.schema_version) !== PERSISTED_SCHEMA_VERSION)
				issues.push(`playthroughs ${playthroughId}: schema version is ${row.schema_version}`);
			const world = worlds.get(String(row.world_version_id));
			if (!world) throw new Error("Pinned world version is invalid or missing.");
			if (!world.rooms.some((room) => compareIds(room.id, world.startRoomId)))
				throw new Error("Pinned publication has no valid starting room.");
			const state = parseStoredGameState(row.current_state, Number(row.schema_version), {
				playthroughId,
				sequence: null,
				storage: "current",
				world,
			});
			const transcript = parseStoredMessages(
				parseTranscript(row.transcript),
				Number(row.schema_version),
				{playthroughId, sequence: null, storage: "transcript"},
			);
			if (!observablyEqual(transcript, state.messages))
				issues.push(`playthroughs ${playthroughId}: transcript differs from current state messages`);

			const rawTurns = turnsByPlaythrough.get(playthroughId) ?? [];
			if (Number(row.command_count) !== rawTurns.length)
				issues.push(
					`playthroughs ${playthroughId}: command_count ${row.command_count} does not match ${rawTurns.length} turns`,
				);
			const commandLines = String(row.commands ?? "")
				.split("\n")
				.filter((command) => command.length > 0);
			if (
				commandLines.length !== rawTurns.length ||
				rawTurns.some((turn, index) => String(turn.command) !== commandLines[index])
			)
				issues.push(`playthroughs ${playthroughId}: command log differs from retained turns`);

			const turns = rawTurns.map((turn) => {
				if (Number(turn.schema_version) !== PERSISTED_SCHEMA_VERSION)
					issues.push(
						`playthrough_turns ${playthroughId}/${turn.sequence}: schema version is ${turn.schema_version}`,
					);
				return {
					sequence: Number(turn.sequence),
					command: String(turn.command),
					outputMessages: parseStoredMessages(turn.output_messages, Number(turn.schema_version), {
						playthroughId,
						sequence: Number(turn.sequence),
						storage: "output",
					}),
					resultingState: parseStoredGameState(turn.resulting_state, Number(turn.schema_version), {
						playthroughId,
						sequence: Number(turn.sequence),
						storage: "turn",
						world,
					}),
				};
			});
			for (const replayIssue of replayCompatibilityIssues(world, turns, state))
				issues.push(`playthroughs ${playthroughId}: ${replayIssue}`);
		} catch (error) {
			issues.push(`playthroughs ${playthroughId}: ${issueText(error)}`);
		}
	}

	return {
		counts: {
			worlds: worldRows.length,
			worldVersions: versionRows.length,
			playthroughs: playthroughRows.length,
			turns: turnRows.length,
		},
		issues,
	};
}
