/** @jest-environment node */

import {
	HOSTED_COMMAND_MAX_LENGTH,
	PublicationError,
	normalizePublicationSlug,
	validatePublicationSlug,
} from "./publicationRepository";

describe("publication slugs", () => {
	it.each([
		[" The Lantern Room ", "the-lantern-room"],
		["Café Observatory", "cafe-observatory"],
		["Quiet___Archive", "quiet-archive"],
	])("normalizes %s", (input, expected) => {
		expect(normalizePublicationSlug(input)).toBe(expected);
		expect(validatePublicationSlug(input)).toBe(expected);
	});

	it.each(["api", "admin", "play", "worlds", "---"])(
		"rejects reserved or invalid slug %s",
		(slug) => {
			expect(() => validatePublicationSlug(slug)).toThrow(PublicationError);
		},
	);

	it("keeps the first hosted command boundary deliberately small", () => {
		expect(HOSTED_COMMAND_MAX_LENGTH).toBe(500);
	});
});
