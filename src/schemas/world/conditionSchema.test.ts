import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {getEditorMetadata} from "@/utils/editorMetadata";
import {toID} from "@/utils/idUtils";
import {ConditionSchema, SavedConditionSchema} from "./conditionSchema";

const schema = editor.condition(ConditionSchema);
const controlSchema = editor.conditionControl(ConditionSchema);

describe("editor.condition", () => {
	it("uses the condition builder control", () => {
		expect(getEditorMetadata(schema)?.control).toBe("condition-builder");
	});

	it("retains its source schema when condition features are customized", () => {
		const customized = editor.conditionControl(ConditionSchema, {
			features: {allowGroups: false},
		});

		expect(getEditorMetadata(customized)?.features?.conditionSchema).toBe(ConditionSchema);
	});

	it.each([
		{
			name: "a single condition",
			value: {type: "world", operation: "flag-is", flag: "gate.open", value: true},
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
					{type: "world", operation: "flag-is", flag: "gate.open", value: true},
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
		expect(schema.safeParse({type: "player", operation: "is-in-room", roomId: "foyer"}).success).toBe(
			false,
		);
	});

	it("accepts room and feature flag conditions", () => {
		expect(
			schema.safeParse({
				type: "room",
				operation: "flag-is",
				roomId: toID("room", "foyer"),
				flag: "visited",
				value: true,
			}).success,
		).toBe(true);
		expect(
			schema.safeParse({
				type: "item",
				operation: "flag-is",
				roomId: toID("room", "foyer"),
				itemId: toID("item", "door"),
				flag: "examined",
				value: false,
			}).success,
		).toBe(true);
	});

	it("accepts current-room exit availability conditions", () => {
		expect(
			ConditionSchema.safeParse({
				type: "navigation",
				operation: "exit-is-open",
				direction: "e",
			}).success,
		).toBe(true);
	});

	it("accepts saved text comparisons and rejects the old flag truth operations", () => {
		for (const operation of [
			"is",
			"is-not",
			"starts-with",
			"does-not-start-with",
			"ends-with",
			"does-not-end-with",
			"contains",
			"does-not-contain",
		] as const) {
			expect(
				ConditionSchema.safeParse({
					type: "world",
					operation: `text-${operation}`,
					text: "answer",
					value: "moth",
				}).success,
			).toBe(true);
		}
		for (const operation of ["is-empty", "is-not-empty", "exists", "missing"] as const) {
			expect(
				ConditionSchema.safeParse({type: "world", operation: `text-${operation}`, text: "answer"})
					.success,
			).toBe(true);
		}
		expect(
			ConditionSchema.safeParse({type: "world", operation: "text-contains", text: "answer"}).success,
		).toBe(false);
		expect(
			ConditionSchema.safeParse({type: "flag", operation: "true", flag: "gate.open"}).success,
		).toBe(false);
		expect(
			ConditionSchema.safeParse({type: "flag", operation: "false", flag: "gate.open"}).success,
		).toBe(false);
	});

	it.each([
		{operation: "is-reachable", value: true},
		{operation: "is-inside", parentItemId: toID("item", "box")},
		{operation: "has-behavior", behavior: "container", value: true},
		{operation: "has-tag", tag: "quest-item", value: false},
		{operation: "contents-empty", placement: "either", value: true},
		{
			operation: "can-fit-item",
			candidateItemId: toID("item", "coin"),
			placement: "inside",
		},
		{
			operation: "can-be-unlocked-by",
			keyItemId: toID("item", "key"),
		},
		{
			operation: "connection-is-passable",
			connectionId: toID("connection", "hall"),
			value: true,
		},
	])("accepts item operation %#", (itemOperation) => {
		expect(
			ConditionSchema.safeParse({type: "item", itemId: toID("item", "subject"), ...itemOperation})
				.success,
		).toBe(true);
	});

	it("accepts ordinary typed item flag references", () => {
		expect(
			ConditionSchema.parse({
				type: "item",
				operation: "flag-is",
				itemId: toID("item", "door"),
				flag: "glowing",
				value: true,
			}),
		).toMatchObject({itemId: toID("item", "door")});
	});

	it("defaults flag conditions without an entity type to normal flags", () => {
		expect(
			schema.parse({type: "world", operation: "flag-is", flag: "gate.open", value: true}),
		).toEqual({
			type: "world",
			operation: "flag-is",
			flag: "gate.open",
			value: true,
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
				itemId: toID("item", "door"),
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
		expect(
			controlSchema.parse([{type: "world", operation: "flag-is", flag: "gate.open", value: true}]),
		).toEqual({
			type: "group",
			operation: "all",
			conditions: [{type: "world", operation: "flag-is", flag: "gate.open", value: true}],
		});
	});

	it("accepts every condition kind as a group child", () => {
		const result = controlSchema.safeParse({
			type: "group",
			operation: "any",
			conditions: [
				{type: "world", operation: "flag-is", flag: "gate.open", value: true},
				{type: "condition-ref", conditionId: toID("condition", "gate-open")},
				{type: "group", operation: "none", conditions: []},
			],
		});

		expect(result.success).toBe(true);
	});
});

describe("SavedConditionSchema", () => {
	it("stores an identity around a canonical condition", () => {
		expect(
			SavedConditionSchema.parse({
				identity: toID("condition", "gate-open"),
				condition: {type: "world", operation: "flag-is", flag: "gate.open", value: true},
			}),
		).toEqual({
			identity: toID("condition", "gate-open"),
			name: "",
			condition: {
				type: "world",
				operation: "flag-is",
				flag: "gate.open",
				value: true,
			},
		});
	});
});
