import "server-only";

import type {Knex} from "knex";

import {resolvePermissions, type Permission} from "@/auth/permissions";
import {createOpaqueToken, hashSessionToken, PLAY_SESSION_DURATION_MS} from "@/auth/sessionTokens";
import {resolveTurn} from "@/engine/player/resolveTurn";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {GameStateSchema, type GameMessage, type GameState} from "@/schemas/states/gameStateSchemas";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";
import {compareIds} from "@/utils/idUtils";

import {getDb} from "./knex";

const database = getDb();

export const HOSTED_ENGINE_VERSION = "mothmark-engine-0.1.0";
export const PUBLICATION_TITLE_MAX_LENGTH = 80;
export const PUBLICATION_SUMMARY_MAX_LENGTH = 280;
export const PUBLICATION_SLUG_MAX_LENGTH = 64;
export const HOSTED_COMMAND_MAX_LENGTH = 500;
export const HOSTED_WORLD_MAX_BYTES = 1024 * 1024;
export const HOSTED_TRANSCRIPT_MAX_BYTES = 1024 * 1024;

export const RESERVED_PUBLICATION_SLUGS = new Set([
	"about",
	"account",
	"admin",
	"api",
	"editor",
	"forgot-password",
	"health",
	"login",
	"logout",
	"play",
	"privacy",
	"register",
	"reset-password",
	"sign-in",
	"terms",
	"verify-email",
	"worlds",
]);

export type PublicationVisibility = "listed" | "unlisted";

export class PublicationError extends Error {
	constructor(
		readonly code:
			| "COMMAND_INVALID"
			| "COMMAND_TOO_LARGE"
			| "FORBIDDEN"
			| "NOT_FOUND"
			| "PUBLICATION_EXISTS"
			| "REVISION_CONFLICT"
			| "SLUG_CONFLICT"
			| "SLUG_INVALID"
			| "TRANSCRIPT_TOO_LARGE"
			| "WORLD_NOT_PLAYABLE"
			| "WORLD_TOO_LARGE",
		message: string,
	) {
		super(message);
		this.name = "PublicationError";
	}
}

export function normalizePublicationSlug(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, PUBLICATION_SLUG_MAX_LENGTH)
		.replace(/-+$/g, "");
}

export function validatePublicationSlug(value: string): string {
	const slug = normalizePublicationSlug(value);
	if (
		!slug ||
		slug.length > PUBLICATION_SLUG_MAX_LENGTH ||
		!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug) ||
		RESERVED_PUBLICATION_SLUGS.has(slug)
	) {
		throw new PublicationError(
			"SLUG_INVALID",
			"Choose a public slug using letters, numbers, and hyphens that is not reserved.",
		);
	}
	return slug;
}

type PermissionUserRow = {
	id: string;
	account_type: "anonymous" | "registered";
	site_role: "admin" | "user";
	status: "active" | "deleted" | "suspended";
};

async function hasPermission(
	connection: Knex | Knex.Transaction,
	userId: string,
	permission: Permission,
): Promise<boolean> {
	const [user, overrides] = await Promise.all([
		connection<PermissionUserRow>("users").where({id: userId}).first(),
		connection("user_permission_overrides")
			.select("permission", "allowed", "expires_at")
			.where({user_id: userId}),
	]);
	if (!user) return false;
	return Boolean(
		resolvePermissions(
			{accountType: user.account_type, siteRole: user.site_role, status: user.status},
			overrides,
		).find((entry) => entry.permission === permission)?.allowed,
	);
}

type PublicationRow = {
	id: string;
	world_id: string;
	slug: string;
	status: "published" | "unpublished" | "suspended";
	visibility: PublicationVisibility;
	current_release_id: string;
	published_at: Date | string;
	updated_at: Date | string;
	release_id: string;
	release_number: number;
	title: string;
	summary: string;
	release_published_at: Date | string;
	world_version_id: string;
	world: World;
	schema_version: number;
	engine_version: string;
};

export type PublicPublication = {
	id: string;
	slug: string;
	title: string;
	summary: string;
	visibility: PublicationVisibility;
	release: {id: string; number: number; publishedAt: string};
};

export type PlayablePublication = PublicPublication & {
	world: World;
	worldVersionId: string;
	engineVersion: string;
};

const publicationSelect = (connection: Knex | Knex.Transaction = database) =>
	connection<PublicationRow>("world_publications as p")
		.join("world_releases as r", "r.id", "p.current_release_id")
		.join("world_versions as v", "v.id", "r.world_version_id")
		.join("worlds as w", "w.id", "p.world_id")
		.join("users as owner", "owner.id", "w.owner_user_id")
		.select(
			"p.id",
			"p.world_id",
			"p.slug",
			"p.status",
			"p.visibility",
			"p.current_release_id",
			"p.published_at",
			"p.updated_at",
			"r.id as release_id",
			"r.release_number",
			"r.title",
			"r.summary",
			"r.published_at as release_published_at",
			"v.id as world_version_id",
			"v.world",
			"v.schema_version",
			"v.engine_version",
		)
		.where({"p.status": "published", "owner.status": "active", "owner.account_type": "registered"})
		.whereNull("w.deleted_at");

const mapPublicPublication = (row: PublicationRow): PublicPublication => ({
	id: row.id,
	slug: row.slug,
	title: row.title,
	summary: row.summary,
	visibility: row.visibility,
	release: {
		id: row.release_id,
		number: row.release_number,
		publishedAt: new Date(row.release_published_at).toISOString(),
	},
});

const mapPlayablePublication = (row: PublicationRow): PlayablePublication => ({
	...mapPublicPublication(row),
	world: WorldSchema.parse(row.world),
	worldVersionId: row.world_version_id,
	engineVersion: row.engine_version,
});

export async function listPublications(search = ""): Promise<PublicPublication[]> {
	const query = publicationSelect()
		.where({"p.visibility": "listed"})
		.orderBy("r.published_at", "desc")
		.limit(100);
	const normalizedSearch = search.trim();
	if (normalizedSearch) {
		query.andWhere((builder) => {
			builder
				.whereILike("r.title", `%${normalizedSearch}%`)
				.orWhereILike("r.summary", `%${normalizedSearch}%`);
		});
	}
	return (await query).map(mapPublicPublication);
}

export async function getPublicPublication(slug: string): Promise<PlayablePublication | undefined> {
	const normalized = normalizePublicationSlug(slug);
	if (!normalized) return undefined;
	const row = await publicationSelect().where({"p.slug": normalized}).first();
	return row ? mapPlayablePublication(row) : undefined;
}

export type OwnerPublication = PublicPublication & {
	worldId: string;
	worldRevision: number;
};

export async function getOwnedPublication(
	ownerUserId: string,
	worldId: string,
): Promise<OwnerPublication | undefined> {
	const row = await publicationSelect()
		.where({"p.world_id": worldId, "w.owner_user_id": ownerUserId})
		.select("v.revision as world_revision")
		.first();
	return row
		? {...mapPublicPublication(row), worldId: row.world_id, worldRevision: Number(row.world_revision)}
		: undefined;
}

export async function publishOwnedWorld(input: {
	ownerUserId: string;
	worldId: string;
	expectedRevision: number;
	title: string;
	summary: string;
	slug: string;
	visibility: PublicationVisibility;
}): Promise<OwnerPublication> {
	const slug = validatePublicationSlug(input.slug);
	return database.transaction(async (transaction) => {
		const owner = await transaction<PermissionUserRow>("users")
			.where({id: input.ownerUserId})
			.forUpdate()
			.first();
		if (
			!owner ||
			owner.status !== "active" ||
			owner.account_type !== "registered" ||
			!(await hasPermission(transaction, input.ownerUserId, "world.publish_owned"))
		) {
			throw new PublicationError(
				"FORBIDDEN",
				"Only an eligible registered owner can publish this world.",
			);
		}

		const worldRow = await transaction("worlds")
			.where({id: input.worldId, owner_user_id: input.ownerUserId, kind: "editor"})
			.whereNull("deleted_at")
			.forUpdate()
			.first();
		if (!worldRow) throw new PublicationError("NOT_FOUND", "The requested world does not exist.");
		if (worldRow.revision !== input.expectedRevision) {
			throw new PublicationError(
				"REVISION_CONFLICT",
				"Save and reload the current world before publishing.",
			);
		}
		if (await transaction("world_publications").where({world_id: input.worldId}).first()) {
			throw new PublicationError("PUBLICATION_EXISTS", "This world already has a publication.");
		}
		if (await transaction("world_publications").where({slug}).first()) {
			throw new PublicationError("SLUG_CONFLICT", "That public slug is already in use.");
		}

		const world = WorldSchema.parse(worldRow.world);
		if (
			world.rooms.length === 0 ||
			!world.rooms.some((room) => compareIds(room.id, world.startRoomId))
		) {
			throw new PublicationError("WORLD_NOT_PLAYABLE", "Add a valid starting room before publishing.");
		}
		if (Buffer.byteLength(JSON.stringify(world), "utf8") > HOSTED_WORLD_MAX_BYTES) {
			throw new PublicationError("WORLD_TOO_LARGE", "This world is too large for hosted play.");
		}

		let version = await transaction("world_versions")
			.where({world_id: input.worldId, revision: worldRow.revision})
			.first();
		if (!version) {
			[version] = await transaction("world_versions")
				.insert({
					world_id: input.worldId,
					revision: worldRow.revision,
					world,
					schema_version: worldRow.schema_version,
					engine_version: HOSTED_ENGINE_VERSION,
					created_by_user_id: input.ownerUserId,
				})
				.returning("*");
		}

		const [publication] = await transaction("world_publications")
			.insert({
				world_id: input.worldId,
				slug,
				status: "published",
				visibility: input.visibility,
				created_by_user_id: input.ownerUserId,
			})
			.returning("*");
		const [release] = await transaction("world_releases")
			.insert({
				publication_id: publication.id,
				world_version_id: version.id,
				release_number: 1,
				title: input.title,
				summary: input.summary,
				published_by_user_id: input.ownerUserId,
			})
			.returning("*");
		await transaction("world_publications")
			.where({id: publication.id})
			.update({current_release_id: release.id, updated_at: transaction.fn.now()});
		await transaction("admin_audit_log").insert({
			actor_user_id: input.ownerUserId,
			action: "publication.created",
			target_type: "publication",
			target_id: publication.id,
			details: {releaseId: release.id, releaseNumber: 1, worldId: input.worldId},
		});

		return {
			id: publication.id,
			slug,
			title: release.title,
			summary: release.summary,
			visibility: publication.visibility,
			release: {
				id: release.id,
				number: 1,
				publishedAt: new Date(release.published_at).toISOString(),
			},
			worldId: input.worldId,
			worldRevision: worldRow.revision,
		};
	});
}

export type HostedPlaythrough = {
	id: string;
	revision: number;
	commandCount: number;
	commands: string;
	state: GameState;
};

export function resolveHostedCommand(
	world: World,
	previousState: GameState,
	previousCommands: string,
	command: string,
): {commands: string; nextState: GameState; outputMessages: GameMessage[]; transcript: string} {
	const nextState = resolveTurn(world, previousState, command);
	return {
		commands: previousCommands ? `${previousCommands}\n${command}` : command,
		nextState,
		outputMessages: nextState.messages.slice(previousState.messages.length),
		transcript: JSON.stringify(nextState.messages),
	};
}

export type HostedPlayBootstrap = {
	publication: PublicPublication;
	playthrough: HostedPlaythrough;
	session?: {token: string; expiresAt: Date};
};

const mapPlaythrough = (row: Record<string, unknown>): HostedPlaythrough => ({
	id: String(row.id),
	revision: Number(row.revision),
	commandCount: Number(row.command_count),
	commands: String(row.commands ?? ""),
	state: GameStateSchema.parse(row.current_state),
});

export async function bootstrapHostedPlay(
	slug: string,
	currentPlayerUserId?: string,
): Promise<HostedPlayBootstrap> {
	return database.transaction(async (transaction) => {
		const publicationRow = await publicationSelect(transaction)
			.where({"p.slug": normalizePublicationSlug(slug)})
			.first();
		if (!publicationRow)
			throw new PublicationError("NOT_FOUND", "The published world does not exist.");
		const publication = mapPlayablePublication(publicationRow);

		let playerUserId = currentPlayerUserId;
		let session: HostedPlayBootstrap["session"];
		if (playerUserId) {
			if (!(await hasPermission(transaction, playerUserId, "hosted_play.access"))) {
				throw new PublicationError("FORBIDDEN", "Hosted play is not available for this account.");
			}
		} else {
			const [user] = await transaction("users")
				.insert({account_type: "anonymous", site_role: "user", status: "active"})
				.returning("id");
			playerUserId = user.id;
			const token = createOpaqueToken();
			const expiresAt = new Date(Date.now() + PLAY_SESSION_DURATION_MS);
			await transaction("sessions").insert({
				user_id: playerUserId,
				audience: "play",
				token_hash: hashSessionToken(token),
				expires_at: expiresAt,
			});
			session = {token, expiresAt};
		}

		await transaction.raw("select pg_advisory_xact_lock(hashtext(?))", [
			`hosted-play:${playerUserId}:${publication.id}`,
		]);
		let playthrough = await transaction("playthroughs")
			.where({player_user_id: playerUserId, publication_id: publication.id, status: "active"})
			.first();
		if (!playthrough) {
			const state = createInitialGameState(publication.world, publication.world.startRoomId);
			[playthrough] = await transaction("playthroughs")
				.insert({
					player_user_id: playerUserId,
					publication_id: publication.id,
					release_id: publication.release.id,
					world_id: publicationRow.world_id,
					world_version_id: publication.worldVersionId,
					transcript: JSON.stringify(state.messages),
					current_state: state,
				})
				.returning("*");
		}
		return {publication, playthrough: mapPlaythrough(playthrough), ...(session && {session})};
	});
}

export async function submitHostedCommand(input: {
	playerUserId: string;
	slug: string;
	command: string;
	expectedRevision: number;
}): Promise<HostedPlaythrough & {outputMessages: GameMessage[]}> {
	if (!input.command.trim() || /[\r\n]/.test(input.command)) {
		throw new PublicationError("COMMAND_INVALID", "Enter exactly one non-empty command line.");
	}
	if (input.command.length > HOSTED_COMMAND_MAX_LENGTH) {
		throw new PublicationError("COMMAND_TOO_LARGE", "That command is too long.");
	}
	return database.transaction(async (transaction) => {
		if (!(await hasPermission(transaction, input.playerUserId, "hosted_play.save_progress"))) {
			throw new PublicationError("FORBIDDEN", "Hosted progress cannot be saved for this account.");
		}
		const publicationRow = await publicationSelect(transaction)
			.where({"p.slug": normalizePublicationSlug(input.slug)})
			.first();
		if (!publicationRow)
			throw new PublicationError("NOT_FOUND", "The published world does not exist.");
		const playthrough = await transaction("playthroughs")
			.where({
				player_user_id: input.playerUserId,
				publication_id: publicationRow.id,
				status: "active",
			})
			.forUpdate()
			.first();
		if (!playthrough)
			throw new PublicationError("NOT_FOUND", "The active playthrough does not exist.");
		if (playthrough.revision !== input.expectedRevision) {
			throw new PublicationError(
				"REVISION_CONFLICT",
				"This playthrough changed in another tab. Reload it before continuing.",
			);
		}

		const world = WorldSchema.parse(publicationRow.world);
		const previousState = GameStateSchema.parse(playthrough.current_state);
		const {commands, nextState, outputMessages, transcript} = resolveHostedCommand(
			world,
			previousState,
			playthrough.commands,
			input.command,
		);
		if (
			Buffer.byteLength(commands, "utf8") > HOSTED_TRANSCRIPT_MAX_BYTES ||
			Buffer.byteLength(transcript, "utf8") > HOSTED_TRANSCRIPT_MAX_BYTES
		) {
			throw new PublicationError(
				"TRANSCRIPT_TOO_LARGE",
				"This playthrough has reached its storage limit.",
			);
		}
		const sequence = playthrough.command_count + 1;
		await transaction("playthrough_turns").insert({
			playthrough_id: playthrough.id,
			sequence,
			command: input.command,
			output_messages: outputMessages,
			resulting_state: nextState,
			engine_version: publicationRow.engine_version,
		});
		const [updated] = await transaction("playthroughs")
			.where({id: playthrough.id, revision: input.expectedRevision})
			.update({
				commands,
				transcript,
				current_state: nextState,
				command_count: sequence,
				revision: transaction.raw("?? + 1", ["revision"]),
				last_command_at: transaction.fn.now(),
				updated_at: transaction.fn.now(),
			})
			.returning("*");
		if (!updated)
			throw new PublicationError(
				"REVISION_CONFLICT",
				"This playthrough changed in another tab. Reload it before continuing.",
			);
		return {...mapPlaythrough(updated), outputMessages};
	});
}

export type AdminPublication = PublicPublication & {
	status: "published" | "unpublished" | "suspended";
	worldId: string;
	ownerUserId: string;
	ownerName: string | null;
};

export async function listAdminPublications(): Promise<AdminPublication[]> {
	const rows = await database("world_publications as p")
		.join("world_releases as r", "r.id", "p.current_release_id")
		.join("worlds as w", "w.id", "p.world_id")
		.join("users as owner", "owner.id", "w.owner_user_id")
		.select(
			"p.id",
			"p.slug",
			"p.status",
			"p.visibility",
			"p.world_id",
			"r.id as release_id",
			"r.release_number",
			"r.title",
			"r.summary",
			"r.published_at as release_published_at",
			"owner.id as owner_user_id",
			"owner.display_name as owner_name",
		)
		.orderBy("r.published_at", "desc");
	return rows.map((row) => ({
		...mapPublicPublication(row),
		status: row.status,
		worldId: row.world_id,
		ownerUserId: row.owner_user_id,
		ownerName: row.owner_name,
	}));
}
