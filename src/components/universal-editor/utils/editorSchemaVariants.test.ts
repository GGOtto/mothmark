import {ConditionSchema} from "@/schemas/world/conditionSchema";
import {EffectSchema} from "@/schemas/world/effectSchema";
import {CommandConditionSchema, CommandEffectSchema} from "@/schemas/world/commandLogicSchemas";
import {
	createSchemaVariantDefault,
	findEditorSchemaVariant,
	schemaFieldOptions,
	schemaTypeOptions,
} from "./editorSchemaVariants";

describe("editor schema variants", () => {
	it("derives every effect choice and operation from EffectSchema", () => {
		expect(schemaTypeOptions(EffectSchema).map((option) => option.value)).toEqual([
			"message",
			"flag",
			"counter",
			"text",
			"item",
			"item-action",
			"room",
			"player",
			"effect-ref",
		]);
		expect(
			schemaFieldOptions(EffectSchema, "operation", {type: "message"}).map((option) => option.value),
		).toEqual(
			expect.arrayContaining([
				"current-room-description",
				"list-available-exits",
				"show-command-help",
			]),
		);
		expect(
			schemaFieldOptions(EffectSchema, "operation", {type: "player"}).map((option) => option.value),
		).toContain("move-in-direction");
		expect(
			schemaFieldOptions(EffectSchema, "action", {type: "item-action"}).map((option) => option.value),
		).toEqual([
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
		]);
	});

	it("uses the selected effect branch for fields and defaults", () => {
		const selection = {type: "player", operation: "move-in-direction"};
		const variant = findEditorSchemaVariant(EffectSchema, selection);

		expect(Object.keys(variant?.shape ?? {})).toEqual(["type", "operation", "direction"]);
		expect(createSchemaVariantDefault(EffectSchema, selection)).toEqual({
			type: "player",
			operation: "move-in-direction",
			direction: "n",
		});
	});

	it("derives condition types, operations, and defaults from ConditionSchema", () => {
		expect(schemaTypeOptions(ConditionSchema).map((option) => option.value)).toEqual([
			"flag",
			"counter",
			"text",
			"current-room",
			"item",
			"group",
			"condition-ref",
		]);
		expect(
			schemaFieldOptions(ConditionSchema, "operation", {type: "current-room"}).map(
				(option) => option.value,
			),
		).toEqual(["is", "is-not", "has-tag", "missing-tag", "is-exit-open"]);
		expect(
			createSchemaVariantDefault(ConditionSchema, {type: "counter", operation: "between"}),
		).toMatchObject({type: "counter", operation: "between", min: 0, max: 0, inclusive: true});
	});

	it("derives command editor choices from the canonical schemas declared by command schemas", () => {
		expect(schemaTypeOptions(CommandEffectSchema).map((option) => option.value)).toEqual(
			schemaTypeOptions(EffectSchema).map((option) => option.value),
		);
		expect(schemaTypeOptions(CommandConditionSchema).map((option) => option.value)).toEqual([
			"comparison",
			"group",
			"flag",
			"counter",
			"text",
			"current-room",
			"item",
			"condition-ref",
		]);
	});
});
