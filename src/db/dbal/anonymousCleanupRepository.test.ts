/** @jest-environment node */

import {
	ANONYMOUS_CLEANUP_GRACE_MS,
	ANONYMOUS_RETENTION_MS,
	deriveCleanupClass,
	evaluateCleanupEligibility,
	type CleanupSnapshot,
} from "./anonymousCleanupRepository";

const now = new Date("2026-08-08T12:00:00.000Z");
const snapshot = (overrides: Partial<CleanupSnapshot> = {}): CleanupSnapshot => ({
	accountType: "anonymous",
	activeSessionExpiresAt: [],
	cleanupReason: null,
	lastSeenAt: new Date(now.getTime() - ANONYMOUS_RETENTION_MS.empty),
	latestWorldActivityAt: null,
	siteRole: "user",
	status: "active",
	worldRevisions: [],
	...overrides,
});

describe("anonymous cleanup retention", () => {
	it.each([
		[[], 0, "empty"],
		[[], 1, "play_only"],
		[[1], 0, "untouched_editor"],
		[[1, 1], 0, "untouched_editor"],
		[[1], 1, "authored_editor"],
		[[1, 2], 0, "authored_editor"],
	])(
		"derives a current retention class from authoritative activity",
		(revisions, plays, expected) => {
			expect(deriveCleanupClass(revisions, plays)).toBe(expected);
		},
	);

	it.each([
		["empty", []],
		["untouched_editor", [1]],
		["play_only", []],
		["authored_editor", [2]],
	] as const)(
		"is eligible at and after the %s cutoff, but not immediately before",
		(kind, revisions) => {
			const retention = ANONYMOUS_RETENTION_MS[kind];
			expect(
				evaluateCleanupEligibility(
					snapshot({
						lastSeenAt: new Date(now.getTime() - retention + 1),
						worldRevisions: [...revisions],
						playthroughCount: kind === "play_only" ? 1 : 0,
					}),
					now,
				),
			).toMatchObject({eligible: false, reason: "recent_activity"});
			expect(
				evaluateCleanupEligibility(
					snapshot({
						lastSeenAt: new Date(now.getTime() - retention),
						worldRevisions: [...revisions],
						playthroughCount: kind === "play_only" ? 1 : 0,
					}),
					now,
				),
			).toMatchObject({eligible: true, retentionClass: kind});
			expect(
				evaluateCleanupEligibility(
					snapshot({
						lastSeenAt: new Date(now.getTime() - retention - 1),
						worldRevisions: [...revisions],
						playthroughCount: kind === "play_only" ? 1 : 0,
					}),
					now,
				),
			).toMatchObject({eligible: true, retentionClass: kind});
		},
	);

	it.each([
		["registered", snapshot({accountType: "registered"}), "protected_account"],
		["administrator", snapshot({siteRole: "admin"}), "protected_account"],
		["suspended", snapshot({status: "suspended"}), "inactive_status"],
		[
			"nonexpired session",
			snapshot({activeSessionExpiresAt: [new Date(now.getTime() + 1)]}),
			"nonexpired_session",
		],
		[
			"recent world activity",
			snapshot({latestWorldActivityAt: new Date(now.getTime() - 60_000)}),
			"recent_activity",
		],
	])("excludes a %s account", (_, input, reason) => {
		expect(evaluateCleanupEligibility(input as CleanupSnapshot, now)).toMatchObject({
			eligible: false,
			reason,
		});
	});

	it("allows scheduling while a stale credential exists but still blocks purge", () => {
		const input = snapshot({activeSessionExpiresAt: [new Date(now.getTime() + 60_000)]});
		expect(evaluateCleanupEligibility(input, now)).toMatchObject({
			eligible: false,
			reason: "nonexpired_session",
		});
		expect(evaluateCleanupEligibility(input, now, {ignoreNonexpiredSessions: true})).toMatchObject({
			eligible: true,
		});
	});

	it("uses a separate seven-day recovery grace period", () => {
		expect(ANONYMOUS_CLEANUP_GRACE_MS).toBe(7 * 24 * 60 * 60 * 1_000);
	});
});
