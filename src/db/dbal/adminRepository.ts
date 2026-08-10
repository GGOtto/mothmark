import "server-only";

import type {Knex} from "knex";

import {
	PERMISSIONS,
	resolvePermissions,
	type EffectivePermission,
	type Permission,
} from "@/auth/permissions";
import {parseStoredWorld} from "@/compat/storageCodec";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";

import {evaluateCleanupEligibility, type CleanupSnapshot} from "./anonymousCleanupRepository";
import {getDb} from "./knex";
import {effectivePermissionsForUser, userHasPermission} from "./permissionRepository";
import {createOwnedEditorSlug} from "./worldsRepository";

const database = getDb();

type AccountType = "anonymous" | "registered";
type SiteRole = "admin" | "user";
type UserStatus = "active" | "deleted" | "suspended";

export type AdminPermissionSummary = EffectivePermission;

export function permissionSummaryFor(
	accountType: AccountType,
	siteRole: SiteRole,
): AdminPermissionSummary[] {
	return resolvePermissions({accountType, siteRole, status: "active"});
}

type AdminUserRow = {
	account_type: AccountType;
	active_world_count: string | number;
	cleanup_after: Date | string | null;
	cleanup_reason: string | null;
	cleanup_scheduled_at: Date | string | null;
	created_at: Date | string;
	display_name: string | null;
	id: string;
	last_seen_at: Date | string;
	max_worlds: number | null;
	site_role: SiteRole;
	status: UserStatus;
	suspended_at: Date | string | null;
	suspension_reason: string | null;
	trashed_world_count: string | number;
	username: string | null;
};

export type AdminUserSummary = {
	accountType: AccountType;
	cleanupAfter: string | null;
	cleanupReason: string | null;
	cleanupScheduledAt: string | null;
	createdAt: string;
	displayName: string | null;
	id: string;
	lastSeenAt: string;
	maxWorlds: number;
	siteRole: SiteRole;
	status: UserStatus;
	suspendedAt: string | null;
	suspensionReason: string | null;
	worldCount: number;
	trashedWorldCount: number;
	username: string | null;
};

const iso = (value: Date | string | null): string | null =>
	value === null ? null : new Date(value).toISOString();

const mapUser = (row: AdminUserRow): AdminUserSummary => ({
	accountType: row.account_type,
	cleanupAfter: iso(row.cleanup_after),
	cleanupReason: row.cleanup_reason,
	cleanupScheduledAt: iso(row.cleanup_scheduled_at),
	createdAt: new Date(row.created_at).toISOString(),
	displayName: row.display_name,
	id: row.id,
	lastSeenAt: new Date(row.last_seen_at).toISOString(),
	maxWorlds: row.max_worlds ?? 5,
	siteRole: row.site_role,
	status: row.status,
	suspendedAt: iso(row.suspended_at),
	suspensionReason: row.suspension_reason,
	worldCount: Number(row.active_world_count),
	trashedWorldCount: Number(row.trashed_world_count),
	username: row.username,
});

const userSummaryQuery = () =>
	database("users as u")
		.leftJoin("user_limits as l", "l.user_id", "u.id")
		.leftJoin("worlds as w", function () {
			this.on("w.owner_user_id", "=", "u.id").andOnVal("w.kind", "=", "editor");
		})
		.select(
			"u.id",
			"u.account_type",
			"u.site_role",
			"u.status",
			"u.display_name",
			"u.username",
			"u.created_at",
			"u.last_seen_at",
			"u.cleanup_scheduled_at",
			"u.cleanup_after",
			"u.cleanup_reason",
			"u.suspended_at",
			"u.suspension_reason",
			"l.max_worlds",
		)
		.count({
			active_world_count: database.raw("case when w.deleted_at is null then w.id end"),
		})
		.count({
			trashed_world_count: database.raw("case when w.deleted_at is not null then 1 end"),
		})
		.whereNot({"u.status": "deleted"})
		.groupBy("u.id", "l.max_worlds");

export async function listAdminUsers(): Promise<AdminUserSummary[]> {
	const rows = (await userSummaryQuery().orderBy("u.last_seen_at", "desc")) as AdminUserRow[];
	return rows.map(mapUser);
}

export type AdminSessionSummary = {
	audience: "admin" | "editor" | "play";
	createdAt: string;
	expiresAt: string;
	id: string;
	lastSeenAt: string;
	revokedAt: string | null;
};

export type AdminUserDetail = AdminUserSummary & {
	credentialChangedAt: string | null;
	email: string | null;
	emailVerifiedAt: string | null;
	mfaEnrolled: boolean;
	permissions: AdminPermissionSummary[];
	registeredAt: string | null;
	sessions: AdminSessionSummary[];
	verificationPending: boolean;
	worlds: AdminWorldSummary[];
};

export async function getAdminUser(userId: string): Promise<AdminUserDetail | undefined> {
	const row = (await userSummaryQuery().where("u.id", userId).first()) as AdminUserRow | undefined;
	if (!row) return undefined;
	const [worlds, sessions, email, credential, authenticator, overrides, userRecord, registration] =
		await Promise.all([
			listAdminWorlds(userId),
			database("sessions")
				.select("id", "audience", "created_at", "last_seen_at", "expires_at", "revoked_at")
				.where({user_id: userId})
				.orderBy("created_at", "desc"),
			database("user_emails").select("email", "verified_at").where({user_id: userId}).first(),
			database("password_credentials").select("updated_at").where({user_id: userId}).first(),
			database("totp_authenticators").select("confirmed_at").where({user_id: userId}).first(),
			database("user_permission_overrides")
				.select("permission", "allowed", "expires_at")
				.where({user_id: userId}),
			database("users").select("registered_at").where({id: userId}).first(),
			database("account_registrations")
				.select("id")
				.where({user_id: userId})
				.whereNull("completed_at")
				.whereNull("superseded_at")
				.andWhere("expires_at", ">", database.fn.now())
				.first(),
		]);
	const summary = mapUser(row);
	return {
		...summary,
		credentialChangedAt: iso(credential?.updated_at ?? null),
		email: email?.email ?? null,
		emailVerifiedAt: iso(email?.verified_at ?? null),
		mfaEnrolled: Boolean(authenticator),
		permissions: resolvePermissions(
			{accountType: summary.accountType, siteRole: summary.siteRole, status: summary.status},
			overrides.map((override) => ({
				allowed: override.allowed,
				expiresAt: override.expires_at,
				permission: override.permission as Permission,
			})),
		),
		registeredAt: iso(userRecord?.registered_at ?? null),
		sessions: sessions.map((session) => ({
			audience: session.audience,
			createdAt: new Date(session.created_at).toISOString(),
			expiresAt: new Date(session.expires_at).toISOString(),
			id: session.id,
			lastSeenAt: new Date(session.last_seen_at).toISOString(),
			revokedAt: iso(session.revoked_at),
		})),
		worlds,
		verificationPending: Boolean(registration),
	};
}

type AdminWorldRow = {
	created_at: Date | string;
	deleted_at: Date | string | null;
	editor_slug: string | null;
	id: string;
	name: string;
	owner_account_type: AccountType;
	owner_display_name: string | null;
	owner_username: string | null;
	owner_user_id: string;
	revision: number;
	schema_version: number;
	trash_purge_after: Date | string | null;
	updated_at: Date | string;
	world_size_bytes: string | number;
};

export type AdminWorldSummary = {
	createdAt: string;
	deletedAt: string | null;
	editorSlug: string | null;
	id: string;
	lifecycle: "active" | "trashed";
	name: string;
	owner: {accountType: AccountType; displayName: string | null; id: string; username: string | null};
	revision: number;
	schemaVersion: number;
	trashPurgeAfter: string | null;
	updatedAt: string;
	worldSizeBytes: number;
};

const mapWorld = (row: AdminWorldRow): AdminWorldSummary => ({
	createdAt: new Date(row.created_at).toISOString(),
	deletedAt: iso(row.deleted_at),
	editorSlug: row.editor_slug,
	id: row.id,
	lifecycle: row.deleted_at === null ? "active" : "trashed",
	name: row.name,
	owner: {
		accountType: row.owner_account_type,
		displayName: row.owner_display_name,
		id: row.owner_user_id,
		username: row.owner_username,
	},
	revision: row.revision,
	schemaVersion: row.schema_version,
	trashPurgeAfter: iso(row.trash_purge_after),
	updatedAt: new Date(row.updated_at).toISOString(),
	worldSizeBytes: Number(row.world_size_bytes),
});

const worldSummaryQuery = () =>
	database("worlds as w")
		.join("users as u", "u.id", "w.owner_user_id")
		.select(
			"w.id",
			"w.name",
			"w.editor_slug",
			"w.revision",
			"w.schema_version",
			"w.created_at",
			"w.updated_at",
			"w.deleted_at",
			"w.trash_purge_after",
			"u.id as owner_user_id",
			"u.display_name as owner_display_name",
			"u.username as owner_username",
			"u.account_type as owner_account_type",
			database.raw("pg_column_size(w.world) as world_size_bytes"),
		)
		.where({"w.kind": "editor"});

export async function listAdminWorlds(ownerUserId?: string): Promise<AdminWorldSummary[]> {
	const query = worldSummaryQuery();
	if (ownerUserId) query.where("w.owner_user_id", ownerUserId);
	const rows = (await query.orderBy("w.updated_at", "desc")) as AdminWorldRow[];
	return rows.map(mapWorld);
}

export type AdminWorldDetail = AdminWorldSummary & {world: World};

export async function getAdminWorld(worldId: string): Promise<AdminWorldDetail | undefined> {
	const row = (await worldSummaryQuery().select("w.world").where("w.id", worldId).first()) as
		(AdminWorldRow & {world: unknown}) | undefined;
	return row
		? {
				...mapWorld(row),
				world: parseStoredWorld(row.world, row.schema_version, {
					id: row.id,
					storage: "editor",
				}),
			}
		: undefined;
}

export async function recordAdministratorRead(
	actorUserId: string,
	targetType: "user" | "world",
	targetId: string,
): Promise<void> {
	await database("operational_events").insert({
		details: {actorUserId, targetId, targetType},
		event_type: "administrator_sensitive_read",
	});
}

export class AdminControlError extends Error {
	constructor(
		message: string,
		readonly code: "CONFLICT" | "FORBIDDEN" | "NOT_FOUND" | "WORLD_LIMIT_REACHED",
	) {
		super(message);
		this.name = "AdminControlError";
	}
}

type AuditTarget = "session" | "user" | "world";

async function audit(
	transaction: Knex.Transaction,
	input: {
		action: string;
		actorUserId: string;
		details?: Record<string, unknown>;
		reason?: string | null;
		targetId: string;
		targetType: AuditTarget;
	},
): Promise<void> {
	await transaction("admin_audit_log").insert({
		action: input.action,
		actor_user_id: input.actorUserId,
		details: input.details ?? {},
		reason: input.reason ?? null,
		target_id: input.targetId,
		target_type: input.targetType,
	});
}

export async function setUserPermissionOverride(input: {
	actorUserId: string;
	allowed: boolean | null;
	expiresAt?: Date | null;
	permission: Permission;
	targetUserId: string;
}): Promise<AdminPermissionSummary[]> {
	return database.transaction(async (transaction) => {
		const target = await transaction("users").where({id: input.targetUserId}).forUpdate().first();
		if (!target || target.status === "deleted") {
			throw new AdminControlError("The user was not found.", "NOT_FOUND");
		}
		if (
			target.site_role === "admin" &&
			input.allowed === false &&
			(input.permission === "admin.users.view" ||
				input.permission === "admin.users.manage_permissions")
		) {
			throw new AdminControlError(
				"The sole administrator's user-view and permission-management capabilities cannot be denied.",
				"FORBIDDEN",
			);
		}
		const previous = await transaction("user_permission_overrides")
			.where({user_id: input.targetUserId, permission: input.permission})
			.first();
		if (input.allowed === null) {
			if (!previous) return (await effectivePermissionsForUser(input.targetUserId, transaction)) ?? [];
			await transaction("user_permission_overrides")
				.where({user_id: input.targetUserId, permission: input.permission})
				.delete();
		} else {
			await transaction("user_permission_overrides")
				.insert({
					allowed: input.allowed,
					expires_at: input.expiresAt ?? null,
					permission: input.permission,
					updated_by_user_id: input.actorUserId,
					user_id: input.targetUserId,
				})
				.onConflict(["user_id", "permission"])
				.merge({
					allowed: input.allowed,
					expires_at: input.expiresAt ?? null,
					updated_at: transaction.fn.now(),
					updated_by_user_id: input.actorUserId,
				});
		}
		await audit(transaction, {
			action: "user.permission_override_changed",
			actorUserId: input.actorUserId,
			details: {
				from: previous ? (previous.allowed ? "allow" : "deny") : "inherited",
				permission: input.permission,
				to: input.allowed === null ? "inherited" : input.allowed ? "allow" : "deny",
				...(input.expiresAt && {expiresAt: input.expiresAt.toISOString()}),
			},
			targetId: input.targetUserId,
			targetType: "user",
		});
		return (await effectivePermissionsForUser(input.targetUserId, transaction)) ?? [];
	});
}

export async function setUserWorldLimit(input: {
	actorUserId: string;
	maxWorlds: number;
	targetUserId: string;
}): Promise<void> {
	await database.transaction(async (transaction) => {
		const user = await transaction("users").where({id: input.targetUserId}).forUpdate().first();
		if (!user || user.status === "deleted")
			throw new AdminControlError("The user was not found.", "NOT_FOUND");
		const previous = await transaction("user_limits").where({user_id: input.targetUserId}).first();
		if (previous?.max_worlds === input.maxWorlds) return;
		await transaction("user_limits")
			.insert({
				max_worlds: input.maxWorlds,
				updated_by_user_id: input.actorUserId,
				user_id: input.targetUserId,
			})
			.onConflict("user_id")
			.merge({
				max_worlds: input.maxWorlds,
				updated_at: transaction.fn.now(),
				updated_by_user_id: input.actorUserId,
			});
		await audit(transaction, {
			action: "user.world_limit_changed",
			actorUserId: input.actorUserId,
			details: {from: previous?.max_worlds ?? 5, to: input.maxWorlds},
			targetId: input.targetUserId,
			targetType: "user",
		});
	});
}

export async function setUserSuspension(input: {
	actorUserId: string;
	reason?: string;
	suspended: boolean;
	targetUserId: string;
}): Promise<void> {
	await database.transaction(async (transaction) => {
		const user = await transaction("users").where({id: input.targetUserId}).forUpdate().first();
		if (!user || user.status === "deleted")
			throw new AdminControlError("The user was not found.", "NOT_FOUND");
		if (user.site_role === "admin") {
			throw new AdminControlError("The sole administrator cannot be suspended.", "FORBIDDEN");
		}
		const nextStatus = input.suspended ? "suspended" : "active";
		if (user.status === nextStatus) return;
		const now = new Date();
		await transaction("users")
			.where({id: input.targetUserId})
			.update({
				status: nextStatus,
				suspended_at: input.suspended ? now : null,
				suspended_by_user_id: input.suspended ? input.actorUserId : null,
				suspension_reason: input.suspended ? input.reason : null,
				updated_at: now,
			});
		if (input.suspended) {
			await transaction("sessions")
				.where({user_id: input.targetUserId})
				.whereNull("revoked_at")
				.update({revoked_at: now});
		}
		await audit(transaction, {
			action: input.suspended ? "user.suspended" : "user.reactivated",
			actorUserId: input.actorUserId,
			details: {sessionsRevoked: input.suspended},
			reason: input.reason,
			targetId: input.targetUserId,
			targetType: "user",
		});
	});
}

export async function revokeUserSessions(input: {
	actorUserId: string;
	sessionId?: string;
	targetUserId: string;
}): Promise<number> {
	return database.transaction(async (transaction) => {
		const query = transaction("sessions")
			.where({user_id: input.targetUserId})
			.whereNull("revoked_at");
		if (input.sessionId) query.andWhere({id: input.sessionId});
		const ids = await query.clone().select<{id: string}[]>("id");
		if (input.sessionId && ids.length === 0)
			throw new AdminControlError("The session was not found.", "NOT_FOUND");
		if (ids.length === 0) return 0;
		await query.update({revoked_at: transaction.fn.now()});
		await audit(transaction, {
			action: input.sessionId ? "user.session_revoked" : "user.sessions_revoked",
			actorUserId: input.actorUserId,
			details: {count: ids.length, sessionIds: ids.map(({id}) => id)},
			targetId: input.targetUserId,
			targetType: "user",
		});
		return ids.length;
	});
}

export async function cancelScheduledCleanup(input: {
	actorUserId: string;
	targetUserId: string;
}): Promise<boolean> {
	return database.transaction(async (transaction) => {
		const user = await transaction("users").where({id: input.targetUserId}).forUpdate().first();
		if (!user || user.status === "deleted")
			throw new AdminControlError("The user was not found.", "NOT_FOUND");
		if (!user.cleanup_scheduled_at) return false;
		await transaction("users").where({id: input.targetUserId}).update({
			cleanup_after: null,
			cleanup_cancelled_at: transaction.fn.now(),
			cleanup_reason: null,
			cleanup_scheduled_at: null,
			updated_at: transaction.fn.now(),
		});
		await audit(transaction, {
			action: "user.cleanup_cancelled",
			actorUserId: input.actorUserId,
			details: {previousDeadline: iso(user.cleanup_after), previousReason: user.cleanup_reason},
			targetId: input.targetUserId,
			targetType: "user",
		});
		return true;
	});
}

export async function recheckCleanupEligibility(input: {
	actorUserId: string;
	targetUserId: string;
}): Promise<{eligible: boolean; reason: string}> {
	return database.transaction(async (transaction) => {
		const now = new Date();
		const user = await transaction("users").where({id: input.targetUserId}).forUpdate().first();
		if (!user || user.status === "deleted")
			throw new AdminControlError("The user was not found.", "NOT_FOUND");
		const [sessions, worlds, activity] = await Promise.all([
			transaction("sessions")
				.select("expires_at")
				.where({user_id: input.targetUserId})
				.whereNull("revoked_at")
				.andWhere("expires_at", ">", now),
			transaction("worlds")
				.select("revision", "updated_at")
				.where({owner_user_id: input.targetUserId, kind: "editor"}),
			transaction("user_world_activity")
				.where({user_id: input.targetUserId})
				.max("last_opened_at as latest")
				.first(),
		]);
		const activityDates = [
			...worlds.map((world) => new Date(world.updated_at).getTime()),
			...(activity?.latest ? [new Date(activity.latest).getTime()] : []),
		];
		const snapshot: CleanupSnapshot = {
			accountType: user.account_type,
			activeSessionExpiresAt: sessions.map((session) => session.expires_at),
			cleanupReason: user.cleanup_reason,
			lastSeenAt: user.last_seen_at,
			latestWorldActivityAt: activityDates.length ? new Date(Math.max(...activityDates)) : null,
			siteRole: user.site_role,
			status: user.status,
			worldRevisions: worlds.map((world) => world.revision),
		};
		const result = evaluateCleanupEligibility(snapshot, now);
		await audit(transaction, {
			action: "user.cleanup_eligibility_rechecked",
			actorUserId: input.actorUserId,
			details: result,
			targetId: input.targetUserId,
			targetType: "user",
		});
		return {
			eligible: result.eligible,
			reason: result.eligible ? result.retentionClass : result.reason,
		};
	});
}

export type AdminWorldAction =
	| {action: "archive"; reason?: string}
	| {action: "delete"; reason: string}
	| {action: "restore"; reason?: string}
	| {action: "transfer"; reason: string; targetUserId: string};

export async function applyAdminWorldAction(
	actorUserId: string,
	worldId: string,
	input: AdminWorldAction,
): Promise<void> {
	await database.transaction(async (transaction) => {
		const world = await transaction("worlds")
			.where({id: worldId, kind: "editor"})
			.forUpdate()
			.first();
		if (!world) throw new AdminControlError("The world was not found.", "NOT_FOUND");
		if (input.action === "archive") {
			if (world.deleted_at) return;
			const now = new Date();
			await transaction("worlds").where({id: worldId}).update({
				deleted_at: now,
				trash_purge_after: null,
				updated_by_user_id: actorUserId,
			});
		} else if (input.action === "restore") {
			if (!world.deleted_at) return;
			await transaction("users").where({id: world.owner_user_id}).forUpdate().first();
			await requireTransferCapacity(transaction, world.owner_user_id);
			await transaction("worlds").where({id: worldId}).update({
				deleted_at: null,
				trash_purge_after: null,
				updated_by_user_id: actorUserId,
			});
		} else if (input.action === "delete") {
			await transaction("worlds").where({id: worldId}).delete();
		} else {
			const target = await transaction("users").where({id: input.targetUserId}).forUpdate().first();
			if (!target || target.status !== "active") {
				throw new AdminControlError("The target user is not active.", "NOT_FOUND");
			}
			if (world.owner_user_id === input.targetUserId) return;
			if (!world.deleted_at) await requireTransferCapacity(transaction, input.targetUserId);
			const editorSlug = await createOwnedEditorSlug(transaction, input.targetUserId, world.name);
			await transaction("user_world_activity").where({world_id: worldId}).delete();
			await transaction("worlds").where({id: worldId}).update({
				editor_slug: editorSlug,
				owner_user_id: input.targetUserId,
				updated_by_user_id: actorUserId,
			});
		}
		const actionNames = {
			archive: "world.archived",
			delete: "world.permanently_deleted",
			restore: "world.restored",
			transfer: "world.transferred",
		} as const;
		await audit(transaction, {
			action: actionNames[input.action],
			actorUserId,
			details: {
				fromOwnerUserId: world.owner_user_id,
				...(input.action === "transfer" && {toOwnerUserId: input.targetUserId}),
				revision: world.revision,
			},
			reason: input.reason,
			targetId: worldId,
			targetType: "world",
		});
	});
}

async function requireTransferCapacity(
	transaction: Knex.Transaction,
	userId: string,
): Promise<void> {
	const [limit, count] = await Promise.all([
		transaction("user_limits").where({user_id: userId}).first(),
		transaction("worlds")
			.where({owner_user_id: userId, kind: "editor"})
			.whereNull("deleted_at")
			.count<{count: string}>("id as count")
			.first(),
	]);
	if (Number(count?.count ?? 0) >= Number(limit?.max_worlds ?? 5)) {
		throw new AdminControlError(
			"The transfer would exceed the target user's active-world limit.",
			"WORLD_LIMIT_REACHED",
		);
	}
}

export async function updateWorldAdministratively(input: {
	actorUserId: string;
	expectedRevision: number;
	reason: string;
	world: unknown;
	worldId: string;
}): Promise<number> {
	const parsedWorld = WorldSchema.parse(input.world);
	return database.transaction(async (transaction) => {
		const current = await transaction("worlds")
			.where({id: input.worldId, kind: "editor", revision: input.expectedRevision})
			.whereNull("deleted_at")
			.forUpdate()
			.first();
		if (!current) throw new AdminControlError("The world changed or is unavailable.", "CONFLICT");
		const newRevision = current.revision + 1;
		await transaction("worlds").where({id: input.worldId}).update({
			revision: newRevision,
			updated_at: transaction.fn.now(),
			updated_by_user_id: input.actorUserId,
			world: parsedWorld,
		});
		await audit(transaction, {
			action: "world.administratively_edited",
			actorUserId: input.actorUserId,
			details: {newRevision, oldRevision: current.revision, ownerUserId: current.owner_user_id},
			reason: input.reason,
			targetId: input.worldId,
			targetType: "world",
		});
		return newRevision;
	});
}

export type AdminAuditEntry = {
	action: string;
	actorUserId: string | null;
	createdAt: string;
	details: Record<string, unknown>;
	id: string;
	reason: string | null;
	targetId: string;
	targetType: string;
};

export async function listAdminAudit(input: {
	action?: string;
	actorUserId?: string;
	from?: Date;
	targetId?: string;
	to?: Date;
}): Promise<AdminAuditEntry[]> {
	const query = database("admin_audit_log").select("*").orderBy("created_at", "desc").limit(200);
	if (input.action) query.where({action: input.action});
	if (input.actorUserId) query.where({actor_user_id: input.actorUserId});
	if (input.targetId) query.where({target_id: input.targetId});
	if (input.from) query.andWhere("created_at", ">=", input.from);
	if (input.to) query.andWhere("created_at", "<=", input.to);
	const rows = await query;
	return rows.map((row) => ({
		action: row.action,
		actorUserId: row.actor_user_id,
		createdAt: new Date(row.created_at).toISOString(),
		details: row.details,
		id: row.id,
		reason: row.reason,
		targetId: row.target_id,
		targetType: row.target_type,
	}));
}

export {PERMISSIONS};
export {userHasPermission as administratorHasPermission};
