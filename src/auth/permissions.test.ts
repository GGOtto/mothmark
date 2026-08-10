import {PERMISSIONS, resolvePermissions} from "./permissions";

describe("effective permissions", () => {
	it("defines one result for every code-defined permission", () => {
		expect(
			resolvePermissions({accountType: "anonymous", siteRole: "user", status: "active"}),
		).toHaveLength(PERMISSIONS.length);
	});

	it("keeps registered, anonymous, and site-role defaults distinct", () => {
		const anonymous = resolvePermissions({
			accountType: "anonymous",
			siteRole: "user",
			status: "active",
		});
		const registered = resolvePermissions({
			accountType: "registered",
			siteRole: "user",
			status: "active",
		});
		const admin = resolvePermissions({
			accountType: "registered",
			siteRole: "admin",
			status: "active",
		});
		expect(anonymous.find(({permission}) => permission === "world.publish_owned")?.allowed).toBe(
			false,
		);
		expect(registered.find(({permission}) => permission === "world.publish_owned")?.allowed).toBe(
			true,
		);
		expect(admin.find(({permission}) => permission === "admin.users.manage")?.allowed).toBe(true);
	});

	it("applies active allow and deny overrides before defaults", () => {
		const permissions = resolvePermissions(
			{accountType: "anonymous", siteRole: "admin", status: "active"},
			[
				{allowed: true, expiresAt: null, permission: "world.publish_owned"},
				{allowed: false, expiresAt: null, permission: "admin.users.manage"},
			],
		);
		expect(permissions.find(({permission}) => permission === "world.publish_owned")).toMatchObject({
			allowed: true,
			override: "allow",
		});
		expect(permissions.find(({permission}) => permission === "admin.users.manage")).toMatchObject({
			allowed: false,
			override: "deny",
		});
	});

	it("ignores expired overrides and denies every capability for suspended principals", () => {
		const now = new Date("2026-08-09T12:00:00Z");
		const expired = resolvePermissions(
			{accountType: "registered", siteRole: "admin", status: "active"},
			[{allowed: false, expiresAt: "2026-08-09T11:59:59Z", permission: "admin.users.manage"}],
			now,
		);
		expect(expired.find(({permission}) => permission === "admin.users.manage")?.allowed).toBe(true);
		const suspended = resolvePermissions({
			accountType: "registered",
			siteRole: "admin",
			status: "suspended",
		});
		expect(suspended.every(({allowed}) => !allowed)).toBe(true);
		expect(suspended.every(({source}) => source === "account status")).toBe(true);
	});

	it("treats a verification-pending anonymous upgrade as anonymous until verification completes", () => {
		const pending = resolvePermissions({
			accountType: "anonymous",
			siteRole: "user",
			status: "active",
		});
		expect(pending.find(({permission}) => permission === "editor.access")?.allowed).toBe(true);
		expect(pending.find(({permission}) => permission === "world.publish_owned")?.allowed).toBe(false);
	});

	it.each(["suspended", "deleted"] as const)("denies all permissions for %s accounts", (status) => {
		expect(
			resolvePermissions({accountType: "registered", siteRole: "admin", status}).every(
				({allowed}) => !allowed,
			),
		).toBe(true);
	});
});
