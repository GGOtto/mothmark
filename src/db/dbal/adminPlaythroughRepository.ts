import "server-only";

import {createHash} from "node:crypto";

import type {Knex} from "knex";

import {resolveTurn} from "@/engine/player/resolveTurn";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {
	GameMessageSchema,
	GameStateSchema,
	type GameMessage,
	type GameState,
} from "@/schemas/states/gameStateSchemas";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";
import {idValue} from "@/utils/idUtils";

import {HOSTED_ENGINE_VERSION} from "./publicationRepository";
import {getDb} from "./knex";

const database = getDb();

export const DIAGNOSTIC_COMMAND_LIMIT = 200;
export const DIAGNOSTIC_PAYLOAD_LIMIT_BYTES = 1024 * 1024;
export const DIAGNOSTIC_TIME_LIMIT_MS = 5_000;

type PlaythroughStatus = "active" | "completed" | "abandoned" | "errored";

export type AdminPlaythroughSummary = {
	id: string;
	publicationId: string;
	publicationTitle: string;
	publicationSlug: string;
	releaseId: string;
	releaseNumber: number;
	playerReference: string;
	status: PlaythroughStatus;
	commandCount: number;
	startedAt: string;
	lastActivityAt: string;
	endedAt: string | null;
	anonymizedAt: string | null;
	purgeAfter: string | null;
};

export type AdminPlaythroughTurn = {
	sequence: number;
	command: string;
	outputMessages: GameMessage[];
	resultingState: GameState;
	engineVersion: string;
	acceptedAt: string;
};

export type AdminPlaythroughDetail = AdminPlaythroughSummary & {
	commands: string;
	transcript: GameMessage[];
	initialState: GameState;
	currentState: GameState;
	engineVersion: string;
	worldId: string;
	worldVersionId: string;
	turns: AdminPlaythroughTurn[];
	stateSummary: {
		currentRoom: string;
		turns: number;
		inventory: string[];
		importantFlags: string[];
		playerStatus: "alive" | "dead" | "frozen";
	};
};

export class PlaythroughDiagnosticError extends Error {
	constructor(
		readonly code: "INVALID_DATA" | "LIMIT_EXCEEDED" | "NOT_FOUND",
		message: string,
	) {
		super(message);
		this.name = "PlaythroughDiagnosticError";
	}
}

const iso = (value: Date | string | null | undefined) =>
	value ? new Date(value).toISOString() : null;

const playerReference = (playerUserId: string | null): string =>
	playerUserId
		? `Player ${createHash("sha256").update(playerUserId).digest("hex").slice(0, 8)}`
		: "Anonymized player";

const mapSummary = (row: Record<string, unknown>): AdminPlaythroughSummary => ({
	id: String(row.id),
	publicationId: String(row.publication_id),
	publicationTitle: String(row.publication_title),
	publicationSlug: String(row.publication_slug),
	releaseId: String(row.release_id),
	releaseNumber: Number(row.release_number),
	playerReference: playerReference(row.player_user_id ? String(row.player_user_id) : null),
	status: row.status as PlaythroughStatus,
	commandCount: Number(row.command_count),
	startedAt: iso(row.started_at as Date | string)!,
	lastActivityAt: iso((row.last_command_at ?? row.updated_at) as Date | string)!,
	endedAt: iso(row.ended_at as Date | string | null),
	anonymizedAt: iso(row.anonymized_at as Date | string | null),
	purgeAfter: iso(row.purge_after as Date | string | null),
});

const playthroughSelect = (connection: Knex | Knex.Transaction = database) =>
	connection("playthroughs as pt")
		.join("world_publications as p", "p.id", "pt.publication_id")
		.join("world_releases as r", "r.id", "pt.release_id")
		.select("pt.*", "p.slug as publication_slug", "r.title as publication_title", "r.release_number");

export async function listAdminPlaythroughs(input: {
	publicationId?: string;
	worldId?: string;
	releaseId?: string;
	status?: PlaythroughStatus;
	from?: Date;
	to?: Date;
	minimumCommands?: number;
	errorsOnly?: boolean;
}): Promise<AdminPlaythroughSummary[]> {
	const query = playthroughSelect().orderBy("pt.updated_at", "desc").limit(200);
	if (input.publicationId) query.where("pt.publication_id", input.publicationId);
	if (input.worldId) query.where("pt.world_id", input.worldId);
	if (input.releaseId) query.where("pt.release_id", input.releaseId);
	if (input.status) query.where("pt.status", input.status);
	if (input.errorsOnly) query.where("pt.status", "errored");
	if (input.from) query.andWhere("pt.started_at", ">=", input.from);
	if (input.to) query.andWhere("pt.started_at", "<=", input.to);
	if (input.minimumCommands !== undefined)
		query.andWhere("pt.command_count", ">=", input.minimumCommands);
	return (await query).map(mapSummary);
}

function parseTranscript(value: unknown): GameMessage[] {
	let parsed = value;
	if (typeof value === "string") {
		try {
			parsed = JSON.parse(value) as unknown;
		} catch {
			throw new PlaythroughDiagnosticError("INVALID_DATA", "The recorded transcript is invalid.");
		}
	}
	const result = GameMessageSchema.array().safeParse(parsed);
	if (!result.success)
		throw new PlaythroughDiagnosticError("INVALID_DATA", "The recorded transcript is invalid.");
	return result.data;
}

function summarizeState(state: GameState): AdminPlaythroughDetail["stateSummary"] {
	const room = state.roomStates.find((candidate) => candidate.id.id === state.player.currentRoom.id);
	const flags = [
		...state.variables.flags.flatMap((group) =>
			Object.entries(group).flatMap(([name, value]) => (value ? [name] : [])),
		),
		...state.roomStates.flatMap((candidate) =>
			Object.entries(candidate.flags).flatMap(([name, value]) =>
				value && name !== "visited" ? [`${candidate.name}: ${name}`] : [],
			),
		),
	].slice(0, 20);
	return {
		currentRoom: room?.name ?? idValue(state.player.currentRoom),
		turns: state.player.turns,
		inventory: state.itemStates
			.filter((item) => item.location.type === "inventory")
			.map((item) => item.name),
		importantFlags: flags,
		playerStatus: state.player.isDead ? "dead" : state.player.freezeState.frozen ? "frozen" : "alive",
	};
}

async function audit(
	connection: Knex | Knex.Transaction,
	actorUserId: string,
	action: string,
	playthroughId: string,
	details: Record<string, unknown> = {},
) {
	await connection("admin_audit_log").insert({
		actor_user_id: actorUserId,
		action,
		target_type: "playthrough",
		target_id: playthroughId,
		details,
	});
}

export async function getAdminPlaythrough(
	actorUserId: string,
	playthroughId: string,
): Promise<AdminPlaythroughDetail | undefined> {
	return database.transaction(async (transaction) => {
		const row = await playthroughSelect(transaction)
			.join("world_versions as v", "v.id", "pt.world_version_id")
			.select("v.world", "v.engine_version")
			.where("pt.id", playthroughId)
			.first();
		if (!row) return undefined;
		const world = WorldSchema.parse(row.world);
		const initialState = createInitialGameState(world, world.startRoomId);
		const currentState = GameStateSchema.parse(row.current_state);
		const turnRows = await transaction("playthrough_turns")
			.where({playthrough_id: playthroughId})
			.orderBy("sequence", "asc");
		const turns = turnRows.map((turn) => ({
			sequence: Number(turn.sequence),
			command: String(turn.command),
			outputMessages: GameMessageSchema.array().parse(turn.output_messages),
			resultingState: GameStateSchema.parse(turn.resulting_state),
			engineVersion: String(turn.engine_version),
			acceptedAt: new Date(turn.accepted_at).toISOString(),
		}));
		await audit(transaction, actorUserId, "playthrough.detail_viewed", playthroughId, {
			publicationId: row.publication_id,
			releaseId: row.release_id,
		});
		return {
			...mapSummary(row),
			commands: String(row.commands),
			transcript: parseTranscript(row.transcript),
			initialState,
			currentState,
			engineVersion: String(row.engine_version),
			worldId: String(row.world_id),
			worldVersionId: String(row.world_version_id),
			turns,
			stateSummary: summarizeState(currentState),
		};
	});
}

type DiagnosticTarget =
	| {type: "original"}
	| {type: "current_release"}
	| {type: "release"; releaseId: string}
	| {type: "editor"};

export type DiagnosticStep = {
	sequence: number;
	command: string;
	recordedOutput: GameMessage[];
	replayedOutput: GameMessage[];
	outputDiffers: boolean;
	stateDiffers: boolean;
	stateSummary: string | null;
};

export type DiagnosticResult = {
	available: boolean;
	label: string;
	engineVersion: string;
	commandCount: number;
	firstDifference: number | null;
	steps: DiagnosticStep[];
	message?: string;
};

const observableMessages = (messages: GameMessage[]) =>
	messages.map(({text, type}) => ({text, type}));

const observableState = (state: GameState) => ({
	...state,
	messages: observableMessages(state.messages),
	variables: {...state.variables, command: []},
});

const canonicalize = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (!value || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, child]) => [key, canonicalize(child)]),
	);
};

const observablyEqual = (left: unknown, right: unknown): boolean =>
	JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));

const stateDifference = (recorded: GameState, replayed: GameState): string | null => {
	if (recorded.player.currentRoom.id !== replayed.player.currentRoom.id)
		return `Current room changed from ${recorded.player.currentRoom.id} to ${replayed.player.currentRoom.id}.`;
	if (recorded.player.turns !== replayed.player.turns)
		return `Turn count changed from ${recorded.player.turns} to ${replayed.player.turns}.`;
	const recordedInventory = recorded.itemStates
		.filter((item) => item.location.type === "inventory")
		.map((item) => item.name)
		.sort();
	const replayedInventory = replayed.itemStates
		.filter((item) => item.location.type === "inventory")
		.map((item) => item.name)
		.sort();
	if (JSON.stringify(recordedInventory) !== JSON.stringify(replayedInventory))
		return `Inventory changed from ${recordedInventory.join(", ") || "empty"} to ${replayedInventory.join(", ") || "empty"}.`;
	return "The resulting game state differs.";
};

export function replayRecordedTurns(
	world: World,
	turns: Array<{
		sequence: number;
		command: string;
		outputMessages: unknown;
		resultingState: unknown;
	}>,
	now: () => number = Date.now,
): {steps: DiagnosticStep[]; firstDifference: number | null} {
	if (turns.length > DIAGNOSTIC_COMMAND_LIMIT)
		throw new PlaythroughDiagnosticError(
			"LIMIT_EXCEEDED",
			"The diagnostic run exceeds its command limit.",
		);
	let state = createInitialGameState(world, world.startRoomId);
	const steps: DiagnosticStep[] = [];
	const started = now();
	for (const turn of turns) {
		if (now() - started > DIAGNOSTIC_TIME_LIMIT_MS)
			throw new PlaythroughDiagnosticError(
				"LIMIT_EXCEEDED",
				"The diagnostic run exceeded its time limit.",
			);
		const previousMessageCount = state.messages.length;
		state = resolveTurn(world, state, turn.command);
		const replayedOutput = state.messages.slice(previousMessageCount);
		const recordedOutputResult = GameMessageSchema.array().safeParse(turn.outputMessages);
		const recordedStateResult = GameStateSchema.safeParse(turn.resultingState);
		if (!recordedOutputResult.success || !recordedStateResult.success)
			throw new PlaythroughDiagnosticError(
				"INVALID_DATA",
				`Recorded data is invalid at command ${turn.sequence}.`,
			);
		const recordedOutput = recordedOutputResult.data;
		const recordedState = recordedStateResult.data;
		const outputDiffers = !observablyEqual(
			observableMessages(recordedOutput),
			observableMessages(replayedOutput),
		);
		const stateDiffers = !observablyEqual(observableState(recordedState), observableState(state));
		steps.push({
			sequence: turn.sequence,
			command: turn.command,
			recordedOutput,
			replayedOutput,
			outputDiffers,
			stateDiffers,
			stateSummary: stateDiffers ? stateDifference(recordedState, state) : null,
		});
	}
	return {
		steps,
		firstDifference: steps.find((step) => step.outputDiffers || step.stateDiffers)?.sequence ?? null,
	};
}

async function loadDiagnosticWorld(
	transaction: Knex.Transaction,
	row: Record<string, unknown>,
	target: DiagnosticTarget,
): Promise<{world: World; engineVersion: string; label: string; targetId: string}> {
	if (target.type === "editor") {
		const world = await transaction("worlds").where({id: row.world_id}).first();
		if (!world) throw new PlaythroughDiagnosticError("NOT_FOUND", "The editor world does not exist.");
		return {
			world: WorldSchema.parse(world.world),
			engineVersion: HOSTED_ENGINE_VERSION,
			label: `Current engine against editor revision ${world.revision}`,
			targetId: String(world.id),
		};
	}
	const releaseId =
		target.type === "original"
			? String(row.release_id)
			: target.type === "current_release"
				? String(row.current_release_id)
				: target.releaseId;
	const release = await transaction("world_releases as r")
		.join("world_versions as v", "v.id", "r.world_version_id")
		.select("r.id", "r.release_number", "v.world", "v.engine_version")
		.where({"r.id": releaseId, "r.publication_id": row.publication_id})
		.first();
	if (!release)
		throw new PlaythroughDiagnosticError("NOT_FOUND", "The comparison release does not exist.");
	return {
		world: WorldSchema.parse(release.world),
		engineVersion: String(release.engine_version),
		label:
			target.type === "original"
				? `Original release ${release.release_number}`
				: `Current engine against release ${release.release_number}`,
		targetId: String(release.id),
	};
}

export async function runPlaythroughDiagnostic(input: {
	actorUserId: string;
	playthroughId: string;
	target: DiagnosticTarget;
}): Promise<DiagnosticResult> {
	return database.transaction(async (transaction) => {
		const row = await transaction("playthroughs as pt")
			.join("world_publications as p", "p.id", "pt.publication_id")
			.select("pt.*", "p.current_release_id")
			.where("pt.id", input.playthroughId)
			.first();
		if (!row) throw new PlaythroughDiagnosticError("NOT_FOUND", "The playthrough does not exist.");
		if (
			Number(row.command_count) > DIAGNOSTIC_COMMAND_LIMIT ||
			Buffer.byteLength(String(row.commands), "utf8") > DIAGNOSTIC_PAYLOAD_LIMIT_BYTES ||
			Buffer.byteLength(String(row.transcript), "utf8") > DIAGNOSTIC_PAYLOAD_LIMIT_BYTES
		)
			throw new PlaythroughDiagnosticError(
				"LIMIT_EXCEEDED",
				"This playthrough is too large for an interactive diagnostic run.",
			);
		const target = await loadDiagnosticWorld(transaction, row, input.target);
		const originalEngine = String(
			(
				await transaction("world_versions")
					.select("engine_version")
					.where({id: row.world_version_id})
					.first()
			)?.engine_version,
		);
		if (input.target.type === "original" && originalEngine !== HOSTED_ENGINE_VERSION) {
			await audit(
				transaction,
				input.actorUserId,
				"playthrough.diagnostic_unavailable",
				input.playthroughId,
				{
					engineVersion: originalEngine,
					targetType: input.target.type,
				},
			);
			return {
				available: false,
				label: "Original-engine replay unavailable",
				engineVersion: originalEngine,
				commandCount: Number(row.command_count),
				firstDifference: null,
				steps: [],
				message:
					"A compatible historical runner is not installed. Use a clearly labeled current-engine comparison instead.",
			};
		}
		const turnRows = await transaction("playthrough_turns")
			.where({playthrough_id: input.playthroughId})
			.orderBy("sequence", "asc");
		if (turnRows.length !== Number(row.command_count))
			throw new PlaythroughDiagnosticError("INVALID_DATA", "The turn history is incomplete.");
		const {steps, firstDifference} = replayRecordedTurns(
			target.world,
			turnRows.map((turn) => ({
				sequence: Number(turn.sequence),
				command: String(turn.command),
				outputMessages: turn.output_messages,
				resultingState: turn.resulting_state,
			})),
		);
		await audit(transaction, input.actorUserId, "playthrough.diagnostic_run", input.playthroughId, {
			commandCount: steps.length,
			firstDifference,
			targetId: target.targetId,
			targetType: input.target.type,
		});
		return {
			available: true,
			label: target.label,
			engineVersion: input.target.type === "original" ? originalEngine : HOSTED_ENGINE_VERSION,
			commandCount: steps.length,
			firstDifference,
			steps,
		};
	});
}
