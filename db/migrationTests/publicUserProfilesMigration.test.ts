import {
	CLEAR_LEGACY_EMAIL_DISPLAY_NAMES_SQL,
	PUBLIC_PROFILE_CONSTRAINTS_SQL,
} from "../migrations/20260811001300_public_user_profiles";

describe("public user profile migration", () => {
	it("clears only display names copied from the registered email address", () => {
		expect(CLEAR_LEGACY_EMAIL_DISPLAY_NAMES_SQL).toContain("user_email.user_id = user_account.id");
		expect(CLEAR_LEGACY_EMAIL_DISPLAY_NAMES_SQL).toContain(
			"lower(trim(user_account.display_name)) = lower(trim(user_email.email))",
		);
		expect(CLEAR_LEGACY_EMAIL_DISPLAY_NAMES_SQL).toContain(
			"user_account.account_type = 'registered'",
		);
	});

	it("keeps profile text within the application limits", () => {
		expect(PUBLIC_PROFILE_CONSTRAINTS_SQL).toContain("char_length(profile_bio) <= 500");
		expect(PUBLIC_PROFILE_CONSTRAINTS_SQL).toContain("char_length(profile_website) <= 2048");
	});
});
