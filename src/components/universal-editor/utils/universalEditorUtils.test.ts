import {ConditionSchema} from "@/schemas/world/conditionSchema";
import {EffectSchema} from "@/schemas/world/effectSchema";
import {toID} from "@/utils/idUtils";
import {
	applyTextTransform,
	createStableId,
	generateConditionSummary,
	generateEditorSummary,
	generateEffectSummary,
} from "./universalEditorUtils";

describe("applyTextTransform", () => {
	it.each([
		[undefined, "  Mixed Case  ", "  Mixed Case  "],
		["none", "  Mixed Case  ", "  Mixed Case  "],
		["lowercase", "Mixed Case", "mixed case"],
		["uppercase", "Mixed Case", "MIXED CASE"],
	] as const)("applies the %s transform", (transform, input, expected) => {
		expect(applyTextTransform(input, transform)).toBe(expected);
	});

	it("creates a compact URL-style slug", () => {
		expect(applyTextTransform("  Brass & Bone: Upstairs!  ", "slug")).toBe("brass-bone-upstairs");
	});

	it("preserves supported path and underscore characters in internal IDs", () => {
		expect(applyTextTransform("  Rooms/Main_floor #2  ", "id")).toBe("rooms/main_floor-2");
	});
});

describe("generateEditorSummary", () => {
	it("uses an explicit summary before any generated value", () => {
		expect(
			generateEditorSummary(
				{name: "Ignored"},
				{enabled: true, summary: "Authored summary", summaryTemplate: "{name}"},
				"Fallback",
			),
		).toBe("Authored summary");
	});

	it("fills nested templates, lengths, arrays, and typed IDs", () => {
		expect(
			generateEditorSummary(
				{
					owner: {name: "Archivist"},
					tags: ["brass", "locked"],
					target: toID("room", "upper-stack"),
				},
				{summaryTemplate: "{owner.name}: {tags.length} tags → {target}"},
			),
		).toBe("Archivist: 2 tags → upper-stack");
	});

	it("uses intentional empty summaries for empty collections", () => {
		expect(generateEditorSummary([], {emptySummary: "Nothing linked"})).toBe("Nothing linked");
		expect(generateEditorSummary({}, undefined, "No configuration")).toBe("No configuration");
	});

	it("counts populated arrays when deterministic summaries are enabled", () => {
		expect(generateEditorSummary(["one", "two"], {mode: "deterministic"})).toBe("2 items");
	});

	it("uses readable object labels for deterministic summaries", () => {
		expect(generateEditorSummary({name: "North stair"}, {enabled: true})).toBe("North stair");
		expect(generateEditorSummary({id: toID("room", "atrium")}, {enabled: true})).toBe("atrium");
	});

	it("falls back when a template resolves to no meaningful text", () => {
		expect(generateEditorSummary({name: "Archive"}, {summaryTemplate: "{missing}"}, "Fallback")).toBe(
			"Fallback",
		);
	});
});

describe("createStableId", () => {
	it("derives copy IDs from author-facing names", () => {
		expect(createStableId({name: "North Stair"})).toBe("north-stair-copy");
	});

	it("derives copy IDs from typed entity IDs", () => {
		expect(createStableId({id: toID("room", "atrium")})).toBe("atrium-copy");
	});

	it("uses the requested prefix when no identifying field exists", () => {
		expect(createStableId({}, "branch")).toBe("branch-copy");
		expect(createStableId(null, "effect")).toBe("effect-copy");
	});
});

describe("schema-driven condition and effect summaries", () => {
	it("summarizes empty and nested condition groups in player-readable order", () => {
		expect(
			generateConditionSummary({type: "group", operation: "all", conditions: []}, ConditionSchema),
		).toBe("no conditions");
		expect(
			generateConditionSummary(
				{
					type: "group",
					operation: "none",
					conditions: [
						{type: "room", operation: "current-has-tag", tag: "flooded"},
						{type: "room", operation: "current-has-tag", tag: "dark"},
					],
				},
				ConditionSchema,
			),
		).toContain("none of (");
	});

	it("uses schema labels for a known effect and a safe fallback for unknown variants", () => {
		expect(
			generateEffectSummary(
				{type: "message", operation: "show", message: "The lock clicks."},
				EffectSchema,
			),
		).toContain("The lock clicks.");
		expect(generateEffectSummary({type: "reticulating-splines"}, EffectSchema)).toBe(
			"Unknown effect",
		);
		expect(generateEffectSummary(null, EffectSchema)).toBe("Unknown effect");
	});
});
