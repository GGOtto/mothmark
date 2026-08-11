import "server-only";

import {createHash} from "node:crypto";

import type {Knex} from "knex";

import {resolvePermissions, type Permission} from "@/auth/permissions";
import {createOpaqueToken, hashSessionToken, PLAY_SESSION_DURATION_MS} from "@/auth/sessionTokens";
import {PERSISTED_SCHEMA_VERSION} from "@/compat/migrations";
import {parseStoredGameState, parseStoredWorld} from "@/compat/storageCodec";
import {resolveTurn} from "@/engine/player/resolveTurn";
import {createInitialGameState} from "@/engine/states/createInitialState";
import type {GameMessage, GameState} from "@/schemas/states/gameStateSchemas";
import type {World} from "@/schemas/world/worldSchema";
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

export function serializeHostedOutputMessages(outputMessages: readonly GameMessage[]): string {
	return JSON.stringify(outputMessages);
}

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
export type PublicationStatus = "published" | "unpublished" | "suspended";

export function resolveCatalogPlayAction(
	status?: "active" | "completed" | "abandoned" | "errored",
): "play" | "continue" | "play_again" {
	return status === "active" ? "continue" : status ? "play_again" : "play";
}

export function publicationAllowsPlay(
	status: PublicationStatus,
	operation: "start" | "resume" | "command" | "restart",
	hasActivePlaythrough: boolean,
): boolean {
	if (status === "suspended") return false;
	if (status === "published") return true;
	return hasActivePlaythrough && (operation === "resume" || operation === "command");
}

function requirePublicationPlayAccess(
	status: PublicationStatus,
	operation: "start" | "resume" | "command" | "restart",
	hasActivePlaythrough: boolean,
): void {
	if (publicationAllowsPlay(status, operation, hasActivePlaythrough)) return;
	if (status === "suspended")
		throw new PublicationError(
			"SUSPENDED",
			"This world is unavailable because its publication is suspended.",
		);
	throw new PublicationError(
		"UNPUBLISHED",
		operation === "restart"
			? "This world is no longer published, so it cannot be restarted."
			: "This world is no longer published.",
	);
}

export class PublicationError extends Error {
	constructor(
		readonly code:
			| "COMMAND_INVALID"
			| "COMMAND_TOO_LARGE"
			| "FORBIDDEN"
			| "NOT_FOUND"
			| "PLAYTHROUGH_ERRORED"
			| "PUBLICATION_EXISTS"
			| "RATE_LIMITED"
			| "REVISION_CONFLICT"
			| "SLUG_CONFLICT"
			| "SLUG_INVALID"
			| "SUSPENDED"
			| "TRANSCRIPT_TOO_LARGE"
			| "UNPUBLISHED"
			| "WORLD_NOT_PLAYABLE"
			| "WORLD_TOO_LARGE",
		message: string,
	) {
		super(message);
		this.name = "PublicationError";
	}
}

async function enforceHostedRateLimit(
	action: string,
	dimensions: Array<{kind: string; value: string; limit: number}>,
	windowMs: number,
): Promise<void> {
	await database.transaction(async (transaction) => {
		const now = new Date();
		const cutoff = new Date(now.getTime() - windowMs);
		const hashed = dimensions.map((dimension) => ({
			...dimension,
			hash: createHash("sha256").update(`${dimension.kind}:${dimension.value}`).digest("hex"),
		}));
		for (const dimension of [...hashed].sort((left, right) => left.hash.localeCompare(right.hash)))
			await transaction.raw("select pg_advisory_xact_lock(hashtext(?))", [
				`mothmark-hosted-rate:${action}:${dimension.hash}`,
			]);
		for (const dimension of hashed) {
			const count = await transaction("request_rate_limit_events")
				.where({action, dimension_hash: dimension.hash})
				.where("attempted_at", ">=", cutoff)
				.count<{count: string}[]>("id as count")
				.first();
			if (Number(count?.count ?? 0) >= dimension.limit)
				throw new PublicationError("RATE_LIMITED", "Too many requests. Wait a moment and try again.");
		}
		await transaction("request_rate_limit_events").insert(
			hashed.map((dimension) => ({action, dimension_hash: dimension.hash, attempted_at: now})),
		);
	});
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
	username: string | null;
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
	author_username: string;
	id: string;
	world_id: string;
	slug: string;
	status: PublicationStatus;
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
	world: unknown;
	schema_version: number;
	engine_version: string;
	current_world_revision: number;
	owner_status: "active" | "deleted" | "suspended";
	owner_account_type: "anonymous" | "registered";
};

export type PublicPublication = {
	authorUsername: string;
	id: string;
	slug: string;
	title: string;
	summary: string;
	visibility: PublicationVisibility;
	release: {id: string; number: number; publishedAt: string};
	playAction?: "play" | "continue" | "play_again";
};

export type PlayablePublication = PublicPublication & {
	world: World;
	worldVersionId: string;
	engineVersion: string;
};

const publicationBaseSelect = (connection: Knex | Knex.Transaction = database) =>
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
			"w.owner_user_id",
			"w.revision as current_world_revision",
			"owner.status as owner_status",
			"owner.account_type as owner_account_type",
			"owner.username as author_username",
		)
		.whereNull("w.deleted_at");

const publicationSelect = (connection: Knex | Knex.Transaction = database) =>
	publicationBaseSelect(connection)
		.where({"p.status": "published", "owner.status": "active", "owner.account_type": "registered"})
		.whereNotNull("p.current_release_id");

const mapPublicPublication = (row: PublicationRow): PublicPublication => ({
	authorUsername: row.author_username,
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
	world: parseStoredWorld(row.world, Number(row.schema_version), {
		id: row.world_version_id,
		storage: "publication",
	}),
	worldVersionId: row.world_version_id,
	engineVersion: row.engine_version,
});

function requireAvailablePublicationOwner(row: PublicationRow): void {
	if (row.owner_status !== "active" || row.owner_account_type !== "registered")
		throw new PublicationError("SUSPENDED", "This published world is currently unavailable.");
}

export async function listPublications(
	search = "",
	playerUserId?: string,
): Promise<PublicPublication[]> {
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
	const publications = (await query).map(mapPublicPublication);
	if (!playerUserId || publications.length === 0) return publications;
	const history = await database("playthroughs")
		.distinctOn("publication_id")
		.select("publication_id", "status")
		.where({player_user_id: playerUserId})
		.whereIn(
			"publication_id",
			publications.map((publication) => publication.id),
		)
		.orderBy("publication_id")
		.orderBy("updated_at", "desc");
	const statuses = new Map(history.map((row) => [row.publication_id, row.status]));
	return publications.map((publication) => ({
		...publication,
		playAction: resolveCatalogPlayAction(statuses.get(publication.id)),
	}));
}

export async function listPublicationsByOwnerUserId(
	ownerUserId: string,
): Promise<PublicPublication[]> {
	const rows = await publicationSelect()
		.where({"p.visibility": "listed", "w.owner_user_id": ownerUserId})
		.orderBy("r.published_at", "desc")
		.limit(100);
	return rows.map(mapPublicPublication);
}

export async function getPublicPublication(slug: string): Promise<PlayablePublication | undefined> {
	const normalized = normalizePublicationSlug(slug);
	if (!normalized) return undefined;
	const row = await publicationSelect().where({"p.slug": normalized}).first();
	return row ? mapPlayablePublication(row) : undefined;
}

export type OwnerPublication = PublicPublication & {
	status: PublicationStatus;
	worldId: string;
	worldRevision: number;
	currentWorldRevision: number;
	unpublishedChanges: boolean;
};

export async function getOwnedPublication(
	ownerUserId: string,
	worldId: string,
): Promise<OwnerPublication | undefined> {
	const row = await publicationBaseSelect()
		.where({"p.world_id": worldId, "w.owner_user_id": ownerUserId})
		.select("v.revision as world_revision")
		.first();
	return row
		? {
				...mapPublicPublication(row),
				status: row.status,
				worldId: row.world_id,
				worldRevision: Number(row.world_revision),
				currentWorldRevision: Number(row.current_world_revision),
				unpublishedChanges: Number(row.current_world_revision) !== Number(row.world_revision),
			}
		: undefined;
}

async function requireEligibleOwner(
	transaction: Knex.Transaction,
	ownerUserId: string,
): Promise<string> {
	const owner = await transaction<PermissionUserRow>("users")
		.where({id: ownerUserId})
		.forUpdate()
		.first();
	if (
		!owner ||
		owner.status !== "active" ||
		owner.account_type !== "registered" ||
		!(await hasPermission(transaction, ownerUserId, "world.publish_owned"))
	) {
		throw new PublicationError(
			"FORBIDDEN",
			"Only an eligible registered owner can publish this world.",
		);
	}
	if (!owner.username)
		throw new PublicationError("FORBIDDEN", "The owner needs a username to publish.");
	return owner.username;
}

function validatePlayableWorld(world: World): void {
	if (
		world.rooms.length === 0 ||
		!world.rooms.some((room) => compareIds(room.id, world.startRoomId))
	) {
		throw new PublicationError("WORLD_NOT_PLAYABLE", "Add a valid starting room before publishing.");
	}
	if (Buffer.byteLength(JSON.stringify(world), "utf8") > HOSTED_WORLD_MAX_BYTES) {
		throw new PublicationError("WORLD_TOO_LARGE", "This world is too large for hosted play.");
	}
}

async function createWorldVersion(
	transaction: Knex.Transaction,
	worldRow: {
		id: string;
		revision: number;
		schema_version: number;
		world: unknown;
	},
	ownerUserId: string,
) {
	const world = parseStoredWorld(worldRow.world, worldRow.schema_version, {
		id: worldRow.id,
		storage: "editor",
	});
	validatePlayableWorld(world);
	let version = await transaction("world_versions")
		.where({world_id: worldRow.id, revision: worldRow.revision})
		.first();
	if (!version) {
		[version] = await transaction("world_versions")
			.insert({
				world_id: worldRow.id,
				revision: worldRow.revision,
				world,
				schema_version: PERSISTED_SCHEMA_VERSION,
				engine_version: HOSTED_ENGINE_VERSION,
				created_by_user_id: ownerUserId,
			})
			.returning("*");
	}
	return version;
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
		const authorUsername = await requireEligibleOwner(transaction, input.ownerUserId);

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

		const version = await createWorldVersion(transaction, worldRow, input.ownerUserId);

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
			authorUsername,
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
			currentWorldRevision: worldRow.revision,
			unpublishedChanges: false,
			status: "published",
		};
	});
}

export async function publishOwnedWorldUpdate(input: {
	ownerUserId: string;
	worldId: string;
	expectedRevision: number;
	title: string;
	summary: string;
}): Promise<OwnerPublication> {
	return database.transaction(async (transaction) => {
		const authorUsername = await requireEligibleOwner(transaction, input.ownerUserId);
		const worldRow = await transaction("worlds")
			.where({id: input.worldId, owner_user_id: input.ownerUserId, kind: "editor"})
			.whereNull("deleted_at")
			.forUpdate()
			.first();
		if (!worldRow) throw new PublicationError("NOT_FOUND", "The requested world does not exist.");
		if (worldRow.revision !== input.expectedRevision)
			throw new PublicationError(
				"REVISION_CONFLICT",
				"Save and reload the current world before publishing.",
			);
		const publication = await transaction("world_publications")
			.where({world_id: input.worldId})
			.forUpdate()
			.first();
		if (!publication)
			throw new PublicationError("NOT_FOUND", "Publish the world before publishing an update.");
		if (publication.status === "suspended")
			throw new PublicationError("FORBIDDEN", "A suspended publication cannot be updated.");
		const version = await createWorldVersion(transaction, worldRow, input.ownerUserId);
		const existing = await transaction("world_releases")
			.where({publication_id: publication.id, world_version_id: version.id})
			.first();
		if (existing)
			throw new PublicationError(
				"PUBLICATION_EXISTS",
				"The current saved revision is already published.",
			);
		const latest = await transaction("world_releases")
			.where({publication_id: publication.id})
			.max<{release_number: number}>("release_number as release_number")
			.first();
		const releaseNumber = Number(latest?.release_number ?? 0) + 1;
		const [release] = await transaction("world_releases")
			.insert({
				publication_id: publication.id,
				world_version_id: version.id,
				release_number: releaseNumber,
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
			action: "publication.release_created",
			target_type: "publication",
			target_id: publication.id,
			details: {releaseId: release.id, releaseNumber, worldId: input.worldId},
		});
		return {
			authorUsername,
			id: publication.id,
			slug: publication.slug,
			title: release.title,
			summary: release.summary,
			visibility: publication.visibility,
			status: publication.status,
			release: {
				id: release.id,
				number: releaseNumber,
				publishedAt: new Date(release.published_at).toISOString(),
			},
			worldId: input.worldId,
			worldRevision: worldRow.revision,
			currentWorldRevision: worldRow.revision,
			unpublishedChanges: false,
		};
	});
}

export async function updateOwnedPublication(input: {
	ownerUserId: string;
	worldId: string;
	action: "set_visibility" | "unpublish" | "republish";
	visibility?: PublicationVisibility;
}): Promise<OwnerPublication> {
	await database.transaction(async (transaction) => {
		await requireEligibleOwner(transaction, input.ownerUserId);
		const publication = await transaction("world_publications as p")
			.join("worlds as w", "w.id", "p.world_id")
			.select("p.*")
			.where({"p.world_id": input.worldId, "w.owner_user_id": input.ownerUserId})
			.forUpdate()
			.first();
		if (!publication) throw new PublicationError("NOT_FOUND", "The publication does not exist.");
		if (publication.status === "suspended")
			throw new PublicationError(
				"FORBIDDEN",
				"A suspended publication can only be restored by an administrator.",
			);
		const changes: Record<string, unknown> = {updated_at: transaction.fn.now()};
		if (input.action === "set_visibility") changes.visibility = input.visibility;
		if (input.action === "unpublish") {
			changes.status = "unpublished";
			changes.unpublished_at = transaction.fn.now();
		}
		if (input.action === "republish") {
			changes.status = "published";
			changes.unpublished_at = null;
		}
		await transaction("world_publications").where({id: publication.id}).update(changes);
		await transaction("admin_audit_log").insert({
			actor_user_id: input.ownerUserId,
			action: `publication.${input.action}`,
			target_type: "publication",
			target_id: publication.id,
			details: input.action === "set_visibility" ? {visibility: input.visibility} : {},
		});
	});
	const result = await getOwnedPublication(input.ownerUserId, input.worldId);
	if (!result) throw new PublicationError("NOT_FOUND", "The publication does not exist.");
	return result;
}

export type HostedPlaythrough = {
	id: string;
	revision: number;
	commandCount: number;
	commands: string;
	state: GameState;
	status: "active" | "completed" | "abandoned" | "errored";
	release: {id: string; number: number};
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
	newerReleaseAvailable: boolean;
	session?: {token: string; expiresAt: Date};
};

const mapPlaythrough = (row: Record<string, unknown>): HostedPlaythrough => ({
	id: String(row.id),
	revision: Number(row.revision),
	commandCount: Number(row.command_count),
	commands: String(row.commands ?? ""),
	state: parseStoredGameState(row.current_state, Number(row.schema_version), {
		playthroughId: String(row.id),
		sequence: null,
		storage: "current",
	}),
	status: row.status as HostedPlaythrough["status"],
	release: {id: String(row.release_id), number: Number(row.release_number)},
});

async function loadPinnedRelease(
	transaction: Knex.Transaction,
	publicationRow: PublicationRow,
	releaseId: string,
): Promise<PlayablePublication> {
	const release = await transaction("world_releases as r")
		.join("world_versions as v", "v.id", "r.world_version_id")
		.select(
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
		.where({"r.id": releaseId, "r.publication_id": publicationRow.id})
		.first();
	if (!release) throw new PublicationError("NOT_FOUND", "The playthrough release does not exist.");
	return mapPlayablePublication({...publicationRow, ...release});
}

async function insertPlaythrough(
	transaction: Knex.Transaction,
	playerUserId: string,
	publicationRow: PublicationRow,
	publication: PlayablePublication,
) {
	const state = createInitialGameState(publication.world, publication.world.startRoomId);
	const [playthrough] = await transaction("playthroughs")
		.insert({
			player_user_id: playerUserId,
			publication_id: publication.id,
			release_id: publication.release.id,
			world_id: publicationRow.world_id,
			world_version_id: publication.worldVersionId,
			transcript: JSON.stringify(state.messages),
			current_state: state,
			schema_version: PERSISTED_SCHEMA_VERSION,
		})
		.returning("*");
	return playthrough;
}

export async function bootstrapHostedPlay(
	slug: string,
	currentPlayerUserId?: string,
	network = "unavailable",
): Promise<HostedPlayBootstrap> {
	await enforceHostedRateLimit(
		"hosted_bootstrap",
		[{kind: "network", value: network, limit: 30}],
		15 * 60 * 1_000,
	);
	return database.transaction(async (transaction) => {
		const publicationRow = await publicationBaseSelect(transaction)
			.where({"p.slug": normalizePublicationSlug(slug)})
			.first();
		if (!publicationRow)
			throw new PublicationError("NOT_FOUND", "The published world does not exist.");
		if (publicationRow.status === "suspended")
			requirePublicationPlayAccess(publicationRow.status, "start", false);
		requireAvailablePublicationOwner(publicationRow);
		if (publicationRow.status === "unpublished" && !currentPlayerUserId)
			requirePublicationPlayAccess(publicationRow.status, "start", false);
		const currentPublication = mapPlayablePublication(publicationRow);

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
		if (!playerUserId) throw new PublicationError("FORBIDDEN", "Hosted play is not available.");

		await transaction.raw("select pg_advisory_xact_lock(hashtext(?))", [
			`hosted-play:${playerUserId}:${currentPublication.id}`,
		]);
		let playthrough = await transaction("playthroughs")
			.where({player_user_id: playerUserId, publication_id: currentPublication.id, status: "active"})
			.first();
		requirePublicationPlayAccess(
			publicationRow.status,
			playthrough ? "resume" : "start",
			Boolean(playthrough),
		);
		let publication = currentPublication;
		if (!playthrough) {
			playthrough = await insertPlaythrough(transaction, playerUserId, publicationRow, publication);
		} else if (playthrough.release_id !== currentPublication.release.id) {
			publication = await loadPinnedRelease(transaction, publicationRow, playthrough.release_id);
		}
		playthrough.release_number = publication.release.number;
		return {
			publication,
			playthrough: mapPlaythrough(playthrough),
			newerReleaseAvailable: playthrough.release_id !== currentPublication.release.id,
			...(session && {session}),
		};
	});
}

export async function restartHostedPlay(input: {
	playerUserId: string;
	slug: string;
	network?: string;
}): Promise<HostedPlayBootstrap> {
	await enforceHostedRateLimit(
		"hosted_restart",
		[
			{kind: "player", value: input.playerUserId, limit: 20},
			{kind: "network", value: input.network ?? "unavailable", limit: 40},
		],
		15 * 60 * 1_000,
	);
	return database.transaction(async (transaction) => {
		if (!(await hasPermission(transaction, input.playerUserId, "hosted_play.save_progress")))
			throw new PublicationError("FORBIDDEN", "Hosted progress cannot be saved for this account.");
		const publicationRow = await publicationBaseSelect(transaction)
			.where({"p.slug": normalizePublicationSlug(input.slug)})
			.first();
		if (!publicationRow)
			throw new PublicationError("NOT_FOUND", "The published world does not exist.");
		requireAvailablePublicationOwner(publicationRow);
		requirePublicationPlayAccess(publicationRow.status, "restart", false);
		const publication = mapPlayablePublication(publicationRow);
		await transaction.raw("select pg_advisory_xact_lock(hashtext(?))", [
			`hosted-play:${input.playerUserId}:${publication.id}`,
		]);
		await transaction("playthroughs")
			.where({player_user_id: input.playerUserId, publication_id: publication.id, status: "active"})
			.update({status: "abandoned", ended_at: transaction.fn.now(), updated_at: transaction.fn.now()});
		const playthrough = await insertPlaythrough(
			transaction,
			input.playerUserId,
			publicationRow,
			publication,
		);
		playthrough.release_number = publication.release.number;
		return {publication, playthrough: mapPlaythrough(playthrough), newerReleaseAvailable: false};
	});
}

export async function deleteHostedPlaythrough(input: {
	playerUserId: string;
	slug: string;
	network?: string;
}): Promise<boolean> {
	await enforceHostedRateLimit(
		"hosted_delete",
		[
			{kind: "player", value: input.playerUserId, limit: 10},
			{kind: "network", value: input.network ?? "unavailable", limit: 20},
		],
		15 * 60 * 1_000,
	);
	return database.transaction(async (transaction) => {
		const publication = await transaction("world_publications")
			.select("id")
			.where({slug: normalizePublicationSlug(input.slug)})
			.first();
		if (!publication) return false;
		await transaction.raw("select pg_advisory_xact_lock(hashtext(?))", [
			`hosted-play:${input.playerUserId}:${publication.id}`,
		]);
		const deleted = await transaction("playthroughs")
			.where({player_user_id: input.playerUserId, publication_id: publication.id})
			.delete();
		if (deleted)
			await transaction("operational_events").insert({
				event_type: "hosted_playthrough_deleted_by_player",
				details: {count: deleted, publicationId: publication.id},
			});
		return deleted > 0;
	});
}

export async function submitHostedCommand(input: {
	playerUserId: string;
	slug: string;
	command: string;
	expectedRevision: number;
	network?: string;
}): Promise<HostedPlaythrough & {outputMessages: GameMessage[]}> {
	if (!input.command.trim() || /[\r\n]/.test(input.command)) {
		throw new PublicationError("COMMAND_INVALID", "Enter exactly one non-empty command line.");
	}
	if (input.command.length > HOSTED_COMMAND_MAX_LENGTH) {
		throw new PublicationError("COMMAND_TOO_LARGE", "That command is too long.");
	}
	await enforceHostedRateLimit(
		"hosted_command",
		[
			{kind: "player", value: input.playerUserId, limit: 120},
			{kind: "network", value: input.network ?? "unavailable", limit: 240},
		],
		60 * 1_000,
	);
	const result = await database.transaction(async (transaction) => {
		if (!(await hasPermission(transaction, input.playerUserId, "hosted_play.save_progress"))) {
			throw new PublicationError("FORBIDDEN", "Hosted progress cannot be saved for this account.");
		}
		const publicationRow = await publicationBaseSelect(transaction)
			.where({"p.slug": normalizePublicationSlug(input.slug)})
			.first();
		if (!publicationRow)
			throw new PublicationError("NOT_FOUND", "The published world does not exist.");
		requireAvailablePublicationOwner(publicationRow);
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
		requirePublicationPlayAccess(publicationRow.status, "command", true);
		if (playthrough.revision !== input.expectedRevision) {
			throw new PublicationError(
				"REVISION_CONFLICT",
				"This playthrough changed in another tab. Reload it before continuing.",
			);
		}

		const pinned = await loadPinnedRelease(transaction, publicationRow, playthrough.release_id);
		const world = pinned.world;
		const previousState = parseStoredGameState(
			playthrough.current_state,
			Number(playthrough.schema_version),
			{
				playthroughId: String(playthrough.id),
				sequence: null,
				storage: "current",
				world,
			},
		);
		let resolution: ReturnType<typeof resolveHostedCommand>;
		try {
			resolution = resolveHostedCommand(world, previousState, playthrough.commands, input.command);
		} catch (error) {
			console.error("Hosted command resolution failed", error);
			await transaction("playthroughs").where({id: playthrough.id}).update({
				status: "errored",
				ended_at: transaction.fn.now(),
				updated_at: transaction.fn.now(),
			});
			return {errored: true as const};
		}
		const {commands, nextState, outputMessages, transcript} = resolution;
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
			// Knex treats a top-level array as a PostgreSQL array parameter. Serialize it so
			// PostgreSQL receives one valid JSON document for the jsonb column.
			output_messages: serializeHostedOutputMessages(outputMessages),
			resulting_state: nextState,
			engine_version: pinned.engineVersion,
			schema_version: PERSISTED_SCHEMA_VERSION,
		});
		const completed = nextState.player.isDead === true;
		const [updated] = await transaction("playthroughs")
			.where({id: playthrough.id, revision: input.expectedRevision})
			.update({
				commands,
				transcript,
				current_state: nextState,
				schema_version: PERSISTED_SCHEMA_VERSION,
				command_count: sequence,
				revision: transaction.raw("?? + 1", ["revision"]),
				last_command_at: transaction.fn.now(),
				...(completed ? {status: "completed", ended_at: transaction.fn.now()} : {}),
				updated_at: transaction.fn.now(),
			})
			.returning("*");
		if (!updated)
			throw new PublicationError(
				"REVISION_CONFLICT",
				"This playthrough changed in another tab. Reload it before continuing.",
			);
		updated.release_number = pinned.release.number;
		return {errored: false as const, playthrough: {...mapPlaythrough(updated), outputMessages}};
	});
	if (result.errored)
		throw new PublicationError(
			"PLAYTHROUGH_ERRORED",
			"This playthrough stopped after an unexpected game error. You can start again.",
		);
	return result.playthrough;
}

export type AdminPublication = PublicPublication & {
	status: "published" | "unpublished" | "suspended";
	worldId: string;
	ownerUserId: string;
	ownerName: string | null;
	ownerUsername: string;
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
			"owner.username as author_username",
		)
		.orderBy("r.published_at", "desc");
	return rows.map((row) => ({
		...mapPublicPublication(row),
		status: row.status,
		worldId: row.world_id,
		ownerUserId: row.owner_user_id,
		ownerName: row.owner_name,
		ownerUsername: row.author_username,
	}));
}

export async function setPublicationSuspension(input: {
	actorUserId: string;
	publicationId: string;
	suspended: boolean;
	reason?: string;
}): Promise<AdminPublication> {
	await database.transaction(async (transaction) => {
		const publication = await transaction("world_publications")
			.where({id: input.publicationId})
			.forUpdate()
			.first();
		if (!publication) throw new PublicationError("NOT_FOUND", "The publication does not exist.");
		await transaction("world_publications")
			.where({id: input.publicationId})
			.update({
				status: input.suspended ? "suspended" : "unpublished",
				unpublished_at: input.suspended ? publication.unpublished_at : transaction.fn.now(),
				updated_at: transaction.fn.now(),
			});
		await transaction("admin_audit_log").insert({
			actor_user_id: input.actorUserId,
			action: input.suspended ? "publication.suspended" : "publication.suspension_lifted",
			target_type: "publication",
			target_id: input.publicationId,
			reason: input.reason,
			details: {},
		});
	});
	const result = (await listAdminPublications()).find((item) => item.id === input.publicationId);
	if (!result) throw new PublicationError("NOT_FOUND", "The publication does not exist.");
	return result;
}
