import "server-only";

import {PERSISTED_SCHEMA_VERSION} from "@/compat/migrations";
import {parseStoredWorld} from "@/compat/storageCodec";
import type {World} from "@/schemas/world/worldSchema";
import {worldSlugBase} from "@/utils/worldSlug";

import {getDb} from "./knex";
import {DEFAULT_MAX_WORLDS, type WorldRow} from "./worldsRepository";
import {deriveCleanupClass, type AnonymousCleanupClass} from "./anonymousCleanupRepository";

const database = getDb();

type AccountRow = {
	id: string;
	account_type: "anonymous" | "registered";
	site_role: "admin" | "user";
	status: "active" | "deleted" | "suspended";
	username: string | null;
	created_at: Date | string;
	cleanup_scheduled_at: Date | string | null;
	cleanup_after: Date | string | null;
	cleanup_cancelled_at: Date | string | null;
};

export type AccountSummary = {
	accountType: AccountRow["account_type"];
	cleanupAfter: string | null;
	cleanupCancelledAt: string | null;
	cleanupWasRecentlyCancelled: boolean;
	cleanupScheduledAt: string | null;
	createdAt: string;
	email: string | null;
	retentionClass: AnonymousCleanupClass;
	sessions: Array<{createdAt: string; expiresAt: string; id: string; lastSeenAt: string}>;
	siteRole: AccountRow["site_role"];
	status: AccountRow["status"];
	usage: {activeWorlds: number; maxWorlds: number; trashedWorlds: number};
	userId: string;
	username: string | null;
};

export type AccountExport = {
	account: Pick<AccountSummary, "accountType" | "createdAt" | "email" | "userId" | "username">;
	exportedAt: string;
	format: "mothmark-account";
	worlds: Array<{
		createdAt: string;
		deletedAt: string | null;
		editorSlug: string;
		name: string;
		revision: number;
		schemaVersion: number;
		updatedAt: string;
		world: World;
		worldId: string;
	}>;
};

const toIso = (value: Date | string | null): string | null =>
	value === null ? null : new Date(value).toISOString();

export async function getOwnedAccountSummary(userId: string): Promise<AccountSummary | undefined> {
	const [user, worlds, limit, email, sessions] = await Promise.all([
		database<AccountRow>("users").where({id: userId}).first(),
		database("worlds")
			.select<Pick<WorldRow, "deleted_at" | "revision">[]>("deleted_at", "revision")
			.where({owner_user_id: userId, kind: "editor"}),
		database("user_limits")
			.select<{max_worlds: number}[]>("max_worlds")
			.where({user_id: userId})
			.first(),
		database("user_emails").select<{email: string}[]>("email").where({user_id: userId}).first(),
		database("sessions")
			.where({audience: "editor", user_id: userId})
			.whereNull("revoked_at")
			.where("expires_at", ">", database.fn.now())
			.orderBy("last_seen_at", "desc"),
	]);
	if (!user) return undefined;

	const cleanupCancelledAt = toIso(user.cleanup_cancelled_at);
	return {
		accountType: user.account_type,
		cleanupAfter: toIso(user.cleanup_after),
		cleanupCancelledAt,
		cleanupWasRecentlyCancelled: Boolean(
			cleanupCancelledAt && Date.now() - new Date(cleanupCancelledAt).getTime() < 24 * 60 * 60 * 1_000,
		),
		cleanupScheduledAt: toIso(user.cleanup_scheduled_at),
		createdAt: new Date(user.created_at).toISOString(),
		email: email?.email ?? null,
		retentionClass: deriveCleanupClass(worlds.map((world) => world.revision)),
		sessions: sessions.map((session) => ({
			createdAt: new Date(session.created_at).toISOString(),
			expiresAt: new Date(session.expires_at).toISOString(),
			id: session.id,
			lastSeenAt: new Date(session.last_seen_at).toISOString(),
		})),
		siteRole: user.site_role,
		status: user.status,
		usage: {
			activeWorlds: worlds.filter((world) => world.deleted_at === null).length,
			maxWorlds: limit?.max_worlds ?? DEFAULT_MAX_WORLDS,
			trashedWorlds: worlds.filter((world) => world.deleted_at !== null).length,
		},
		userId: user.id,
		username: user.username,
	};
}

export async function exportOwnedAccount(userId: string): Promise<AccountExport | undefined> {
	const [summary, worlds] = await Promise.all([
		getOwnedAccountSummary(userId),
		database<WorldRow>("worlds")
			.where({owner_user_id: userId, kind: "editor"})
			.orderBy("created_at", "asc"),
	]);
	if (!summary) return undefined;
	return {
		account: {
			accountType: summary.accountType,
			createdAt: summary.createdAt,
			email: summary.email,
			userId: summary.userId,
			username: summary.username,
		},
		exportedAt: new Date().toISOString(),
		format: "mothmark-account",
		worlds: worlds.map((row) => ({
			createdAt: new Date(row.created_at).toISOString(),
			deletedAt: toIso(row.deleted_at),
			editorSlug: row.editor_slug ?? worldSlugBase(row.name),
			name: row.name,
			revision: row.revision,
			schemaVersion: PERSISTED_SCHEMA_VERSION,
			updatedAt: new Date(row.updated_at).toISOString(),
			world: parseStoredWorld(row.world, row.schema_version, {
				id: row.id,
				storage: "editor",
			}),
			worldId: row.id,
		})),
	};
}

/** User-requested deletion is immediate: the user row and all cascading private data are removed. */
export async function permanentlyDeleteOwnedAccount(userId: string): Promise<boolean> {
	return database.transaction(async (transaction) => {
		const user = await transaction("users")
			.where({id: userId, account_type: "anonymous", site_role: "user"})
			.forUpdate()
			.first();
		if (!user) return false;
		await transaction("sessions").where({user_id: userId}).update({revoked_at: transaction.fn.now()});
		return (await transaction("users").where({id: userId}).delete()) > 0;
	});
}
