import {
	WORLD_EDITOR_SLUG_MAX_LENGTH,
	createUniqueWorldSlug,
	isWorldEditorSlug,
	worldSlugBase,
} from "./worldSlug";

describe("private editor world slugs", () => {
	it.each([
		["North Archive", "north-archive"],
		["  Café / Workshop  ", "cafe-workshop"],
		["---", "untitled-world"],
	])("normalizes %j into %j", (name, expected) => {
		expect(worldSlugBase(name)).toBe(expected);
	});

	it("adds the first available readable numeric suffix within an owner scope", () => {
		expect(createUniqueWorldSlug("North archive", ["north-archive", "north-archive-2"])).toBe(
			"north-archive-3",
		);
	});

	it("never creates a slug that the private route would interpret as an internal UUID", () => {
		expect(worldSlugBase("8ebc3f3f-b9ca-4f75-898f-e196bae50be4")).toBe(
			"world-8ebc3f3f-b9ca-4f75-898f-e196bae50be4",
		);
	});

	it("keeps generated slugs bounded and route-safe", () => {
		const slug = createUniqueWorldSlug("A".repeat(100), ["a".repeat(WORLD_EDITOR_SLUG_MAX_LENGTH)]);
		expect(slug.length).toBeLessThanOrEqual(WORLD_EDITOR_SLUG_MAX_LENGTH);
		expect(isWorldEditorSlug(slug)).toBe(true);
		expect(isWorldEditorSlug("not/a/slug")).toBe(false);
	});
});
