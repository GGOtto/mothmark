/** @jest-environment node */

import {permissionSummaryFor} from "./adminRepository";

describe("administrator read-only permission summaries", () => {
	it("does not grant anonymous users registered or administrator capabilities", () => {
		const summary = permissionSummaryFor("anonymous", "user");
		expect(summary.find((entry) => entry.permission === "editor.access")).toMatchObject({
			allowed: true,
		});
		expect(summary.find((entry) => entry.permission === "world.publish_owned")).toMatchObject({
			allowed: false,
		});
		expect(summary.find((entry) => entry.permission === "admin.users.view")).toMatchObject({
			allowed: false,
		});
	});

	it("shows registered and site-role defaults without inventing overrides", () => {
		const summary = permissionSummaryFor("registered", "admin");
		expect(summary.find((entry) => entry.permission === "world.publish_owned")).toEqual({
			allowed: true,
			permission: "world.publish_owned",
			source: "account default",
		});
		expect(summary.find((entry) => entry.permission === "admin.worlds.view")).toEqual({
			allowed: true,
			permission: "admin.worlds.view",
			source: "site role",
		});
	});
});
