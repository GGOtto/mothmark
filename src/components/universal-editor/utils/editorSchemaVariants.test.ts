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
			"feature",
			"room",
			"player",
			"effect-ref",
		]);
		expect(
			schemaFieldOptions(EffectSchema, "operation", {type: "message"}).map((option) => option.value),
		).toContain("current-room-description");
		expect(
			schemaFieldOptions(EffectSchema, "operation", {type: "player"}).map((option) => option.value),
		).toContain("move-in-direction");
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
			"current-room",
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
			"current-room",
			"condition-ref",
		]);
	});
});
