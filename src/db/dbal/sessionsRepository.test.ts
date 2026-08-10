/** @jest-environment node */

import {activeActorFromSession, type SessionActorRow} from "./sessionsRepository";

const now = new Date("2026-08-08T12:00:00Z");
const activeSession: SessionActorRow = {
	user_id: "3e816c4d-b957-45dc-8523-d53ec04c8d0f",
	account_type: "anonymous",
	site_role: "user",
	user_status: "active",
	user_deleted_at: null,
	audience: "editor",
	session_id: "04600bdb-b5ed-4318-8da6-4837e7a6af32",
	session_last_seen_at: "2026-08-08T11:59:00Z",
	expires_at: "2026-08-09T12:00:00Z",
	revoked_at: null,
	cleanup_scheduled_at: null,
};

describe("active session authorization", () => {
	it("accepts only an active, unexpired session for the expected audience", () => {
		expect(activeActorFromSession(activeSession, "editor", now)).toEqual({
			userId: activeSession.user_id,
			accountType: "anonymous",
			siteRole: "user",
			audience: "editor",
		});
	});

	it("accepts a registered administrator only in an admin-audience session", () => {
		const adminSession: SessionActorRow = {
			...activeSession,
			account_type: "registered",
			site_role: "admin",
			audience: "admin",
		};
		expect(activeActorFromSession(adminSession, "admin", now)).toMatchObject({
			accountType: "registered",
			audience: "admin",
			siteRole: "admin",
		});
		expect(activeActorFromSession(adminSession, "editor", now)).toBeUndefined();
	});

	it.each([
		["wrong audience", {...activeSession, audience: "play" as const}],
		["expired", {...activeSession, expires_at: now}],
		["revoked", {...activeSession, revoked_at: "2026-08-08T11:00:00Z"}],
		["suspended user", {...activeSession, user_status: "suspended" as const}],
		["deleted user", {...activeSession, user_deleted_at: "2026-08-08T11:00:00Z"}],
	])("rejects a %s", (_, session) => {
		expect(activeActorFromSession(session, "editor", now)).toBeUndefined();
	});
});
