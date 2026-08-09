import "server-only";

import {WorldSchema, type World} from "@/schemas/world/worldSchema";

import {getDb} from "./knex";

const database = getDb();

type AccountType = "anonymous" | "registered";
type SiteRole = "admin" | "user";
type UserStatus = "active" | "deleted" | "suspended";

export type AdminPermissionSummary = {
	allowed: boolean;
	permission: string;
	source: "account default" | "not granted" | "site role";
};

const ORDINARY_PERMISSIONS = [
	"editor.access",
	"world.create",
	"world.update_owned",
	"world.delete_owned",
	"world.export_owned",
	"hosted_play.access",
	"hosted_play.save_progress",
] as const;
const ADMIN_PERMISSIONS = [
	"admin.users.view",
	"admin.users.manage",
	"admin.users.manage_permissions",
	"admin.worlds.view",
	"admin.worlds.manage",
	"admin.worlds.transfer",
	"admin.publications.manage",
	"admin.playthroughs.view",
	"admin.audit.view",
] as const;

export function permissionSummaryFor(
	accountType: AccountType,
	siteRole: SiteRole,
): AdminPermissionSummary[] {
	const permissions = [
		...ORDINARY_PERMISSIONS,
		"world.publish_owned",
		...ADMIN_PERMISSIONS,
	] as const;
	return permissions.map((permission) => {
		const fromSiteRole = siteRole === "admin" && ADMIN_PERMISSIONS.includes(permission as never);
		const fromAccount =
			ORDINARY_PERMISSIONS.includes(permission as never) ||
			(permission === "world.publish_owned" && accountType === "registered");
		return {
			allowed: fromSiteRole || fromAccount,
			permission,
			source: fromSiteRole ? "site role" : fromAccount ? "account default" : "not granted",
		};
	});
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
	trashed_world_count: string | number;
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
	worldCount: number;
	trashedWorldCount: number;
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
	worldCount: Number(row.active_world_count),
	trashedWorldCount: Number(row.trashed_world_count),
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
			"u.created_at",
			"u.last_seen_at",
			"u.cleanup_scheduled_at",
			"u.cleanup_after",
			"u.cleanup_reason",
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
	permissions: AdminPermissionSummary[];
	sessions: AdminSessionSummary[];
	worlds: AdminWorldSummary[];
};

export async function getAdminUser(userId: string): Promise<AdminUserDetail | undefined> {
	const row = (await userSummaryQuery().where("u.id", userId).first()) as AdminUserRow | undefined;
	if (!row) return undefined;
	const [worlds, sessions] = await Promise.all([
		listAdminWorlds(userId),
		database("sessions")
			.select("id", "audience", "created_at", "last_seen_at", "expires_at", "revoked_at")
			.where({user_id: userId})
			.orderBy("created_at", "desc"),
	]);
	const summary = mapUser(row);
	return {
		...summary,
		permissions: permissionSummaryFor(summary.accountType, summary.siteRole),
		sessions: sessions.map((session) => ({
			audience: session.audience,
			createdAt: new Date(session.created_at).toISOString(),
			expiresAt: new Date(session.expires_at).toISOString(),
			id: session.id,
			lastSeenAt: new Date(session.last_seen_at).toISOString(),
			revokedAt: iso(session.revoked_at),
		})),
		worlds,
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
	owner: {accountType: AccountType; displayName: string | null; id: string};
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
	return row ? {...mapWorld(row), world: WorldSchema.parse(row.world)} : undefined;
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
