import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {getEditorMetadata} from "@/utils/editorMetadata";
import {toID} from "@/utils/idUtils";
import {ConditionSchema, WorldConditionSchema} from "./conditionSchema";

const schema = editor.condition(ConditionSchema);
const controlSchema = editor.conditionControl(ConditionSchema);

describe("editor.condition", () => {
	it("uses the condition builder control", () => {
		expect(getEditorMetadata(schema)?.control).toBe("condition-builder");
	});

	it.each([
		{
			name: "a single condition",
			value: {type: "flag", operation: "true", flag: "gate.open"},
		},
		{
			name: "a condition reference",
			value: {type: "condition-ref", conditionId: toID("condition", "gate-open")},
		},
		{
			name: "a nested condition group",
			value: {
				type: "group",
				operation: "all",
				conditions: [
					{type: "flag", operation: "true", flag: "gate.open"},
					{
						type: "group",
						operation: "none",
						conditions: [
							{
								type: "condition-ref",
								conditionId: toID("condition", "gate-closed"),
							},
						],
					},
				],
			},
		},
	])("accepts $name", ({value}) => {
		expect(schema.safeParse(value).success).toBe(true);
	});
});

describe("editor.conditionControl", () => {
	it("defaults to an empty all group", () => {
		expect(controlSchema.parse(undefined)).toEqual({
			type: "group",
			operation: "all",
			conditions: [],
		});
	});

	it("migrates a legacy condition list to an all group", () => {
		expect(controlSchema.parse([{type: "flag", operation: "true", flag: "gate.open"}])).toEqual({
			type: "group",
			operation: "all",
			conditions: [{type: "flag", operation: "true", flag: "gate.open"}],
		});
	});

	it("accepts every condition kind as a group child", () => {
		const result = controlSchema.safeParse({
			type: "group",
			operation: "any",
			conditions: [
				{type: "flag", operation: "true", flag: "gate.open"},
				{type: "condition-ref", conditionId: toID("condition", "gate-open")},
				{type: "group", operation: "none", conditions: []},
			],
		});

		expect(result.success).toBe(true);
	});
});

describe("WorldConditionSchema", () => {
	it("migrates a legacy flat stored condition", () => {
		expect(
			WorldConditionSchema.parse({
				id: toID("condition", "gate-open"),
				name: "Gate open",
				allowMultipleUsesInWorld: true,
				type: "flag",
				operation: "true",
				flag: "gate.open",
			}),
		).toEqual({
			identity: toID("condition", "gate-open"),
			condition: {type: "flag", operation: "true", flag: "gate.open"},
		});
	});
});
