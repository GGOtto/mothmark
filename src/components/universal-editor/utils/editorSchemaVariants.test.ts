import {ConditionSchema} from "@/schemas/world/conditionSchema";
import {EffectSchema} from "@/schemas/world/effectSchema";
import {CommandConditionSchema, CommandEffectSchema} from "@/schemas/world/commandLogicSchemas";
import {
	createSchemaVariantDefault,
	findEditorSchemaVariant,
	schemaFieldOptions,
	schemaLogicOptions,
	schemaTypeOptions,
} from "./editorSchemaVariants";

describe("editor schema variants", () => {
	it("returns isolated working values from the schema-derived logic catalog", () => {
		const first = schemaLogicOptions(EffectSchema);
		const second = schemaLogicOptions(EffectSchema);
		expect(first).not.toBe(second);
		expect(first.map((option) => option.key)).toEqual(second.map((option) => option.key));
		expect(first[0]?.defaultValue).not.toBe(second[0]?.defaultValue);
	});

	it("derives every effect choice and operation from EffectSchema", () => {
		expect(schemaTypeOptions(EffectSchema).map((option) => option.value)).toEqual([
			"message",
			"world",
			"item",
			"items",
			"player",
			"room",
			"navigation",
			"event",
			"control",
			"effect-ref",
		]);
		expect(
			schemaFieldOptions(EffectSchema, "operation", {type: "message"}).map((option) => option.value),
		).toEqual(
			expect.arrayContaining(["describe-current-room", "list-available-exits", "show-command-help"]),
		);
		expect(
			schemaFieldOptions(EffectSchema, "operation", {type: "navigation"}).map(
				(option) => option.value,
			),
		).toContain("move-in-direction");
		expect(
			schemaFieldOptions(EffectSchema, "operation", {type: "player"}).map((option) => option.value),
		).toEqual(
			expect.arrayContaining([
				"take",
				"drop",
				"examine",
				"open",
				"close",
				"lock",
				"put-inside",
				"put-on",
				"unlock",
				"use",
			]),
		);
	});

	it("uses the selected effect branch for fields and defaults", () => {
		const selection = {type: "navigation", operation: "move-in-direction"};
		const variant = findEditorSchemaVariant(EffectSchema, selection);

		expect(Object.keys(variant?.shape ?? {})).toEqual(["type", "operation", "direction"]);
		expect(createSchemaVariantDefault(EffectSchema, selection)).toEqual({
			type: "navigation",
			operation: "move-in-direction",
			direction: "n",
		});
	});

	it("derives condition types, operations, and defaults from ConditionSchema", () => {
		expect(schemaTypeOptions(ConditionSchema).map((option) => option.value)).toEqual([
			"world",
			"item",
			"items",
			"room",
			"player",
			"navigation",
			"event",
			"group",
			"condition-ref",
		]);
		expect(
			schemaFieldOptions(ConditionSchema, "operation", {type: "navigation"}).map(
				(option) => option.value,
			),
		).toEqual(["exit-is-open"]);
		expect(
			createSchemaVariantDefault(ConditionSchema, {type: "world", operation: "counter-between"}),
		).toMatchObject({type: "world", operation: "counter-between", min: 0, max: 0, inclusive: true});
	});

	it("derives command editor choices from the canonical schemas declared by command schemas", () => {
		expect(schemaTypeOptions(CommandEffectSchema).map((option) => option.value)).toEqual(
			schemaTypeOptions(EffectSchema).map((option) => option.value),
		);
		expect(schemaTypeOptions(CommandConditionSchema).map((option) => option.value)).toEqual([
			"comparison",
			"group",
			"world",
			"item",
			"items",
			"room",
			"player",
			"navigation",
			"event",
			"condition-ref",
		]);
	});
});
