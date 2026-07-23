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

	it("rejects untyped ID references", () => {
		expect(schema.safeParse({type: "condition-ref", conditionId: "gate-open"}).success).toBe(false);
		expect(schema.safeParse({type: "current-room", operation: "is", roomId: "foyer"}).success).toBe(
			false,
		);
	});

	it("accepts room and feature flag conditions", () => {
		expect(
			schema.safeParse({
				type: "flag",
				"flag-type": "room",
				operation: "true",
				roomId: toID("room", "foyer"),
				flag: "visited",
			}).success,
		).toBe(true);
		expect(
			schema.safeParse({
				type: "flag",
				"flag-type": "feature",
				operation: "false",
				roomId: toID("room", "foyer"),
				featureId: toID("feature", "door"),
				flag: "examined",
			}).success,
		).toBe(true);
	});

	it("defaults legacy flag conditions to normal flags", () => {
		expect(schema.parse({type: "flag", operation: "true", flag: "gate.open"})).toEqual({
			type: "flag",
			"flag-type": "normal",
			operation: "true",
			flag: "gate.open",
		});
	});

	it("rejects stale object, room-state, and feature-state conditions", () => {
		expect(
			schema.safeParse({type: "object-state", operation: "open", objectId: "door"}).success,
		).toBe(false);
		expect(
			schema.safeParse({type: "room-state", state: "visited", roomId: toID("room", "foyer")}).success,
		).toBe(false);
		expect(
			schema.safeParse({
				type: "feature-state",
				state: "examined",
				roomId: toID("room", "foyer"),
				featureId: toID("feature", "door"),
			}).success,
		).toBe(false);
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
			conditions: [{type: "flag", "flag-type": "normal", operation: "true", flag: "gate.open"}],
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
			condition: {type: "flag", "flag-type": "normal", operation: "true", flag: "gate.open"},
		});
	});
});
