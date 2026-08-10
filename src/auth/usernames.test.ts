import {
	USERNAME_MAX_LENGTH,
	UsernameSchema,
	normalizeUsername,
	usernameValidationMessage,
} from "./usernames";

describe("account usernames", () => {
	it("preserves display casing while deriving one lowercase identity", () => {
		expect(normalizeUsername("  Archive_Keeper  ")).toBe("archive_keeper");
		expect(UsernameSchema.parse("Archive-Keeper")).toBe("Archive-Keeper");
		expect(normalizeUsername(UsernameSchema.parse("Green"))).toBe(
			normalizeUsername(UsernameSchema.parse("green")),
		);
	});

	it.each([
		"ab",
		"-archive",
		" archive",
		"archive ",
		"archive keeper",
		"archive$",
		"a".repeat(USERNAME_MAX_LENGTH + 1),
	])("rejects invalid username %s", (username) =>
		expect(UsernameSchema.safeParse(username).success).toBe(false),
	);

	it("explains invalid characters and valid syntax while the user types", () => {
		expect(usernameValidationMessage("ab")).toBe("Use at least 3 characters.");
		expect(usernameValidationMessage("archive keeper$")).toContain("no spaces");
		expect(usernameValidationMessage("-archive")).toBe("Start with a letter or number.");
		expect(usernameValidationMessage("archive_keeper")).toBeUndefined();
		expect(usernameValidationMessage("Archive_Keeper")).toBeUndefined();
		expect(usernameValidationMessage("Archive.Keeper")).toBeUndefined();
		expect(UsernameSchema.parse("Green.Room")).toBe("Green.Room");
	});
});
