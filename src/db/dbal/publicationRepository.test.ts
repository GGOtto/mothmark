/** @jest-environment node */

import {GameMessageSchema} from "@/schemas/states/gameStateSchemas";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";

import {
	HOSTED_COMMAND_MAX_LENGTH,
	PublicationError,
	planHostedRestart,
	normalizePublicationSlug,
	publicationAllowsPlay,
	resolveCatalogPlayAction,
	restartReasonFor,
	serializeHostedOutputMessages,
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

	it("serializes hosted output arrays as one jsonb parameter", () => {
		const outputMessages = [
			{
				...createDefaultFieldObject(GameMessageSchema),
				type: "command" as const,
				text: "move north",
			},
			{
				...createDefaultFieldObject(GameMessageSchema),
				type: "system" as const,
				text: "You enter the stockroom.",
			},
		];
		const serialized = serializeHostedOutputMessages(outputMessages);

		expect(typeof serialized).toBe("string");
		expect(JSON.parse(serialized)).toEqual(outputMessages);
	});
});

describe("publication lifecycle policy", () => {
	it("personalizes catalog actions from the latest playthrough state", () => {
		expect(resolveCatalogPlayAction()).toBe("play");
		expect(resolveCatalogPlayAction("active")).toBe("continue");
		expect(resolveCatalogPlayAction("completed")).toBe("play_again");
		expect(resolveCatalogPlayAction("abandoned")).toBe("play_again");
		expect(resolveCatalogPlayAction("errored")).toBe("play_again");
	});

	it("lets ordinary unpublishing preserve only an existing active run", () => {
		expect(publicationAllowsPlay("unpublished", "resume", true)).toBe(true);
		expect(publicationAllowsPlay("unpublished", "command", true)).toBe(true);
		expect(publicationAllowsPlay("unpublished", "start", false)).toBe(false);
		expect(publicationAllowsPlay("unpublished", "restart", true)).toBe(false);
	});

	it("makes administrative suspension an immediate play block", () => {
		expect(publicationAllowsPlay("suspended", "resume", true)).toBe(false);
		expect(publicationAllowsPlay("suspended", "command", true)).toBe(false);
		expect(publicationAllowsPlay("suspended", "restart", true)).toBe(false);
	});
});

describe("hosted restart lineage", () => {
	it("derives a reviewed reason from the recorded transition", () => {
		expect(restartReasonFor("active", "release-1", "release-1")).toBe("manual_restart");
		expect(restartReasonFor("active", "release-1", "release-2")).toBe("new_release");
		expect(restartReasonFor("completed", "release-1", "release-2")).toBe("replay_completed");
	});

	it("abandons active runs but preserves completed runs", () => {
		expect(planHostedRestart("active", "release-1", "release-1")).toEqual({
			abandonSource: true,
			reason: "manual_restart",
		});
		expect(planHostedRestart("completed", "release-1", "release-2")).toEqual({
			abandonSource: false,
			reason: "replay_completed",
		});
		expect(planHostedRestart("abandoned", "release-1", "release-2")).toBeUndefined();
		expect(planHostedRestart("errored", "release-1", "release-2")).toBeUndefined();
	});
});
