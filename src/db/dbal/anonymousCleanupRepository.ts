import type {Knex} from "knex";

import {getDb} from "./knex";

const database = getDb();

export type AnonymousCleanupClass = "authored_editor" | "empty" | "untouched_editor";

export const ANONYMOUS_RETENTION_MS: Record<AnonymousCleanupClass, number> = {
	empty: 24 * 60 * 60 * 1_000,
	untouched_editor: 7 * 24 * 60 * 60 * 1_000,
	authored_editor: 180 * 24 * 60 * 60 * 1_000,
};
export const ANONYMOUS_CLEANUP_GRACE_MS = 7 * 24 * 60 * 60 * 1_000;
export const DEFAULT_CLEANUP_BATCH_SIZE = 100;

type CleanupUserRow = {
	id: string;
	account_type: "anonymous" | "registered";
	site_role: "admin" | "user";
	status: "active" | "deleted" | "suspended";
	last_seen_at: Date | string;
	cleanup_scheduled_at: Date | string | null;
	cleanup_after: Date | string | null;
	cleanup_reason: string | null;
};

export type CleanupSnapshot = {
	accountType: CleanupUserRow["account_type"];
	activeSessionExpiresAt: Array<Date | string>;
	cleanupReason: string | null;
	lastSeenAt: Date | string;
	latestWorldActivityAt: Date | string | null;
	siteRole: CleanupUserRow["site_role"];
	status: CleanupUserRow["status"];
	worldRevisions: number[];
};

export type CleanupEligibility =
	| {
			eligible: true;
			retentionClass: AnonymousCleanupClass;
			inactiveSince: Date;
			cutoff: Date;
	  }
	| {eligible: false; reason: string; retentionClass: AnonymousCleanupClass};

export type CleanupBatchResult = {
	cancelled: number;
	deferred: number;
	failed: number;
	processed: number;
	purged: number;
	scheduled: number;
	wouldPurge: number;
	wouldSchedule: number;
};

export function deriveCleanupClass(worldRevisions: number[]): AnonymousCleanupClass {
	if (worldRevisions.length === 0) return "empty";
	return worldRevisions.every((revision) => revision === 1) ? "untouched_editor" : "authored_editor";
}

const newestDate = (values: Array<Date | string | null>): Date =>
	new Date(
		Math.max(...values.flatMap((value) => (value === null ? [] : [new Date(value).getTime()]))),
	);

export function evaluateCleanupEligibility(
	snapshot: CleanupSnapshot,
	now: Date,
	options?: {ignoreNonexpiredSessions?: boolean},
): CleanupEligibility {
	const retentionClass = deriveCleanupClass(snapshot.worldRevisions);
	if (snapshot.accountType !== "anonymous" || snapshot.siteRole !== "user") {
		return {eligible: false, reason: "protected_account", retentionClass};
	}
	if (snapshot.status !== "active") {
		return {eligible: false, reason: "inactive_status", retentionClass};
	}
	if (
		!options?.ignoreNonexpiredSessions &&
		snapshot.activeSessionExpiresAt.some((expiresAt) => new Date(expiresAt) > now)
	) {
		return {eligible: false, reason: "nonexpired_session", retentionClass};
	}
	const inactiveSince = newestDate([snapshot.lastSeenAt, snapshot.latestWorldActivityAt]);
	const cutoff = new Date(now.getTime() - ANONYMOUS_RETENTION_MS[retentionClass]);
	if (inactiveSince > cutoff) {
		return {eligible: false, reason: "recent_activity", retentionClass};
	}
	return {eligible: true, retentionClass, inactiveSince, cutoff};
}

async function readCleanupSnapshot(
	transaction: Knex.Transaction,
	user: CleanupUserRow,
	now: Date,
): Promise<CleanupSnapshot> {
	const [sessions, worlds, latestActivity] = await Promise.all([
		transaction("sessions")
			.select<{expires_at: Date | string}[]>("expires_at")
			.where({user_id: user.id})
			.whereNull("revoked_at")
			.andWhere("expires_at", ">", now),
		transaction("worlds")
			.select<{revision: number; updated_at: Date | string}[]>("revision", "updated_at")
			.where({owner_user_id: user.id, kind: "editor"}),
		transaction("user_world_activity")
			.where({user_id: user.id})
			.max<{latest: Date | string | null}>("last_opened_at as latest")
			.first(),
	]);
	const latestWorldUpdate = worlds.length
		? newestDate(worlds.map((world) => world.updated_at))
		: null;
	const latestWorldActivityAt =
		latestActivity?.latest || latestWorldUpdate
			? newestDate([latestActivity?.latest ?? null, latestWorldUpdate])
			: null;
	return {
		accountType: user.account_type,
		activeSessionExpiresAt: sessions.map((session) => session.expires_at),
		cleanupReason: user.cleanup_reason,
		lastSeenAt: user.last_seen_at,
		latestWorldActivityAt,
		siteRole: user.site_role,
		status: user.status,
		worldRevisions: worlds.map((world) => world.revision),
	};
}

const emptyBatchResult = (): CleanupBatchResult => ({
	cancelled: 0,
	deferred: 0,
	failed: 0,
	processed: 0,
	purged: 0,
	scheduled: 0,
	wouldPurge: 0,
	wouldSchedule: 0,
});

async function recordBatchEvent(
	eventType: string,
	details: CleanupBatchResult & {dryRun: boolean},
): Promise<void> {
	await database("operational_events").insert({event_type: eventType, details});
}

export async function scheduleAnonymousCleanup(options?: {
	batchSize?: number;
	dryRun?: boolean;
	now?: Date;
}): Promise<CleanupBatchResult> {
	const now = options?.now ?? new Date();
	const batchSize = Math.max(1, Math.min(options?.batchSize ?? DEFAULT_CLEANUP_BATCH_SIZE, 1_000));
	const dryRun = options?.dryRun ?? false;
	const candidates = await database<CleanupUserRow>("users")
		.where({account_type: "anonymous", site_role: "user", status: "active"})
		.whereNull("cleanup_scheduled_at")
		.andWhere("last_seen_at", "<=", new Date(now.getTime() - ANONYMOUS_RETENTION_MS.empty))
		.orderBy("last_seen_at", "asc")
		.limit(batchSize)
		.select("*");
	const result = emptyBatchResult();

	for (const candidate of candidates) {
		result.processed += 1;
		try {
			await database.transaction(async (transaction) => {
				const user = await transaction<CleanupUserRow>("users")
					.where({id: candidate.id})
					.forUpdate()
					.first();
				if (!user || user.cleanup_scheduled_at) return;
				const eligibility = evaluateCleanupEligibility(
					await readCleanupSnapshot(transaction, user, now),
					now,
					{ignoreNonexpiredSessions: true},
				);
				if (!eligibility.eligible) return;
				if (dryRun) {
					result.wouldSchedule += 1;
					return;
				}
				await transaction("users")
					.where({id: user.id})
					.update({
						cleanup_scheduled_at: now,
						cleanup_after: new Date(now.getTime() + ANONYMOUS_CLEANUP_GRACE_MS),
						cleanup_cancelled_at: null,
						cleanup_reason: eligibility.retentionClass,
						updated_at: now,
					});
				result.scheduled += 1;
			});
		} catch {
			result.failed += 1;
		}
	}
	await recordBatchEvent("anonymous_cleanup_scheduling_batch", {...result, dryRun});
	return result;
}

export async function purgeScheduledAnonymousAccounts(options?: {
	batchSize?: number;
	dryRun?: boolean;
	now?: Date;
}): Promise<CleanupBatchResult> {
	const now = options?.now ?? new Date();
	const batchSize = Math.max(1, Math.min(options?.batchSize ?? DEFAULT_CLEANUP_BATCH_SIZE, 1_000));
	const dryRun = options?.dryRun ?? false;
	const candidates = await database<CleanupUserRow>("users")
		.whereNotNull("cleanup_scheduled_at")
		.andWhere("cleanup_after", "<=", now)
		.orderBy("cleanup_after", "asc")
		.limit(batchSize)
		.select("*");
	const result = emptyBatchResult();

	for (const candidate of candidates) {
		result.processed += 1;
		try {
			await database.transaction(async (transaction) => {
				const user = await transaction<CleanupUserRow>("users")
					.where({id: candidate.id})
					.forUpdate()
					.first();
				if (!user || !user.cleanup_scheduled_at || !user.cleanup_after) return;
				if (new Date(user.cleanup_after) > now) return;
				const snapshot = await readCleanupSnapshot(transaction, user, now);
				const eligibility = evaluateCleanupEligibility(snapshot, now);
				if (!eligibility.eligible) {
					if (eligibility.reason === "nonexpired_session") {
						if (!dryRun) {
							const lastSessionExpiry = Math.max(
								...snapshot.activeSessionExpiresAt.map((expiresAt) => new Date(expiresAt).getTime()),
							);
							await transaction("users")
								.where({id: user.id})
								.update({
									cleanup_after: new Date(lastSessionExpiry + ANONYMOUS_CLEANUP_GRACE_MS),
									updated_at: now,
								});
						}
						result.deferred += 1;
						return;
					}
					if (!dryRun) {
						await transaction("users").where({id: user.id}).update({
							cleanup_scheduled_at: null,
							cleanup_after: null,
							cleanup_reason: null,
							updated_at: now,
						});
					}
					result.cancelled += 1;
					return;
				}
				if (user.cleanup_reason !== eligibility.retentionClass) {
					if (!dryRun) {
						await transaction("users")
							.where({id: user.id})
							.update({
								cleanup_scheduled_at: now,
								cleanup_after: new Date(now.getTime() + ANONYMOUS_CLEANUP_GRACE_MS),
								cleanup_reason: eligibility.retentionClass,
								updated_at: now,
							});
					}
					result.cancelled += 1;
					return;
				}
				if (dryRun) {
					result.wouldPurge += 1;
					return;
				}
				await transaction("users").where({id: user.id}).delete();
				result.purged += 1;
			});
		} catch {
			result.failed += 1;
		}
	}
	await recordBatchEvent("anonymous_cleanup_purge_batch", {...result, dryRun});
	return result;
}
