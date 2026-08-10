import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {ItemStateSchema, RoomStateSchema} from "./entityStateSchemas";
import {
	CommandVariableRepositorySchema,
	CommandVariableSchema,
	GameStateSchema,
} from "./gameStateSchemas";

describe("command variables", () => {
	it("starts each game with an empty command-variable scope", () => {
		const game = createDefaultFieldObject(GameStateSchema);

		expect(game.variables.command).toEqual([]);
	});

	it.each([
		{type: "phrase", value: "put"},
		{type: "relation", value: "in"},
		{type: "target", value: toID("item", "offering-bowl")},
		{type: "number", value: 3},
		{type: "boolean", value: true},
		{type: "direction", value: "n"},
		{type: "choice", value: "clockwise"},
		{type: "text", value: "the silver idol"},
	] as const)("stores a resolved $type block value", ({type, value}) => {
		const variable = {
			blockId: toID("command-block", `${type}-block`),
			type,
			value,
		};

		expect(CommandVariableSchema.parse(variable)).toEqual(variable);
	});

	it("rejects two resolved values attached to the same command block", () => {
		const blockId = toID("command-block", "answer-block");

		const result = CommandVariableRepositorySchema.safeParse([
			{blockId, type: "boolean", value: true},
			{blockId, type: "boolean", value: false},
		]);

		expect(result.success).toBe(false);
	});

	it("stores the entered text for a block that triggered fallback behavior", () => {
		const failed = {
			blockId: toID("command-block", "missing-target"),
			type: "failed" as const,
			rawText: "silver skull",
		};

		expect(CommandVariableSchema.parse(failed)).toEqual(failed);
	});
});

describe("entity state snapshots", () => {
	it("requires all player-facing room fields", () => {
		expect(
			RoomStateSchema.safeParse({
				type: "room",
				id: toID("room", "foyer"),
				flags: {},
				itemStates: [],
			}).success,
		).toBe(false);
	});

	it("requires all player-facing feature fields", () => {
		expect(
			ItemStateSchema.safeParse({
				type: "item",
				id: toID("item", "bell"),
				flags: {},
			}).success,
		).toBe(false);
	});
});
