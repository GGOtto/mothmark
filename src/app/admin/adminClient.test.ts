import {adminNextPath} from "./adminClient";

describe("administrator deep links", () => {
	it("preserves an internal feedback destination through sign-in", () => {
		expect(adminNextPath("?next=%2Fadmin%2Ffeedback%2F3e816c4d-b957-45dc-8523-d53ec04c8d0f")).toBe(
			"/admin/feedback/3e816c4d-b957-45dc-8523-d53ec04c8d0f",
		);
	});

	it.each(["", "?next=https%3A%2F%2Fevil.example", "?next=%2F%2Fevil.example"])(
		"falls back for an unsafe destination: %s",
		(search) => expect(adminNextPath(search)).toBe("/admin/users"),
	);
});
