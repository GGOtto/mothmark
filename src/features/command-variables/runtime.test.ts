import {produce} from "immer";
import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {interpolateCommandVariables, resolveCommandVariableReference} from "./runtime";

const targetBlockId = toID("command-block", "target-variable");
const amountBlockId = toID("command-block", "amount-variable");
const failedBlockId = toID("command-block", "failed-variable");

function gameWithVariables() {
	return produce(createDefaultFieldObject(GameStateSchema), (draft) => {
		draft.roomStates = [
			{
				type: "room",
				id: toID("room", "foyer"),
				name: "Changed Foyer",
				description: "The current room description.",
				shortDescription: "Current short description.",
				aliases: [],
				tags: [],
				lockedExits: [],
				flags: {},
			},
		];
		draft.itemStates = [
			{
				...createDefaultFieldObject(GameStateSchema.shape.itemStates.element),
				id: toID("item", "bell"),
				name: "Changed Bell",
				description: "The current bell description.",
				location: {type: "room", roomId: toID("room", "foyer")},
			},
		];
		draft.variables.command = [
			{blockId: targetBlockId, type: "target", value: toID("item", "bell"), rawText: "old bell"},
			{blockId: amountBlockId, type: "number", value: 3, rawText: "three"},
			{blockId: failedBlockId, type: "failed", rawText: "silver skull"},
		];
	});
}

describe("command variable runtime", () => {
	it("uses current player-facing entity state for name and description projections", () => {
		const game = gameWithVariables();

		expect(resolveCommandVariableReference(game, {blockId: targetBlockId, projection: "name"})).toBe(
			"Changed Bell",
		);
		expect(
			resolveCommandVariableReference(game, {blockId: targetBlockId, projection: "description"}),
		).toBe("The current bell description.");
	});

	it("interpolates scalar values and exact entered text in one authored string", () => {
		const game = gameWithVariables();
		const value = `Count {variable ${amountBlockId.id}} (typed {variable ${amountBlockId.id} text}); missing {variable ${failedBlockId.id} text}.`;

		expect(interpolateCommandVariables(game, value)).toBe(
			"Count 3 (typed three); missing silver skull.",
		);
	});

	it("does not expose a typed value for a failed block", () => {
		expect(
			resolveCommandVariableReference(gameWithVariables(), {blockId: failedBlockId}),
		).toBeUndefined();
	});
});
