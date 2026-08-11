import {
	PublicProfileInputSchema,
	normalizePublicProfileInput,
	publicProfileDisplayName,
} from "./publicProfile";

describe("public account profiles", () => {
	it("uses the username until a display name is explicitly supplied", () => {
		expect(publicProfileDisplayName({displayName: null, username: "archivekeeper"})).toBe(
			"archivekeeper",
		);
		expect(publicProfileDisplayName({displayName: "  ", username: "archivekeeper"})).toBe(
			"archivekeeper",
		);
		expect(publicProfileDisplayName({displayName: "Archive Keeper", username: "archivekeeper"})).toBe(
			"Archive Keeper",
		);
	});

	it("normalizes blank optional fields to null", () => {
		expect(
			normalizePublicProfileInput(
				PublicProfileInputSchema.parse({bio: " ", displayName: " ", website: " "}),
			),
		).toEqual({bio: null, displayName: null, website: null});
	});

	it("accepts public web addresses and rejects other protocols", () => {
		expect(
			PublicProfileInputSchema.safeParse({
				bio: "A short profile.",
				displayName: "Archive Keeper",
				website: "https://example.com/about",
			}).success,
		).toBe(true);
		expect(
			normalizePublicProfileInput(
				PublicProfileInputSchema.parse({bio: "", displayName: "", website: "github.com/user"}),
			).website,
		).toBe("https://github.com/user");
		expect(
			PublicProfileInputSchema.safeParse({bio: "", displayName: "", website: "javascript:alert(1)"})
				.success,
		).toBe(false);
	});
});
