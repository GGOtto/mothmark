import {produce} from "immer";
import {resolveTurn} from "../player/resolveTurn";
import {createPlayerTestScenario} from "../utils/testUtils";
import {
	CommandSchema,
	DirectionBlockSchema,
	PatternSchema,
	PhraseBlockSchema,
	TargetBlockSchema,
} from "@/schemas/world/commandSchemas";
import {CommandConditionBranchSchema} from "@/schemas/world/commandLogicSchemas";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";

function messageBehavior(id: string, message: string) {
	return {
		...createDefaultFieldObject(CommandConditionBranchSchema),
		id: toID("condition-branch", `${id}-behavior`),
		always: {
			name: `${id} result`,
			id: toID("effect", `${id}-result`),
			type: "group" as const,
			effects: [{type: "message", operation: "show", message}],
			allowMultipleUsesInWorld: true as const,
		},
	};
}

describe("command fallbacks through the player path", () => {
	it("runs the fallback pinned to the partially matched block", () => {
		const scenario = createPlayerTestScenario("navigation");
		const verb = {
			...createDefaultFieldObject(PhraseBlockSchema),
			id: toID("command-block", "take-verb"),
			matches: ["take"],
		};
		const target = {
			...createDefaultFieldObject(TargetBlockSchema),
			id: toID("command-block", "take-target"),
			role: "target",
			entityTypes: ["feature" as const],
			source: "visible" as const,
		};
		const command = CommandSchema.parse({
			...createDefaultFieldObject(CommandSchema),
			id: toID("command", "take"),
			name: "Take",
			patterns: [{...createDefaultFieldObject(PatternSchema), blocks: [verb, target]}],
			fallbacks: [
				{blockId: verb.id, behavior: messageBehavior("take-verb-fallback", "Take what?")},
				{
					blockId: target.id,
					behavior: messageBehavior("take-target-fallback", "You can't see that."),
				},
			],
			behavior: messageBehavior("take-success", "You take it."),
		});
		const world = produce(scenario.world, (draft) => {
			draft.commands = [command];
		});

		const nextGame = resolveTurn(world, scenario.game, "take skull");

		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "system",
			text: "You can't see that.",
		});
		expect(nextGame.variables.command).toEqual([]);
	});

	it("does not let a partial-only direction pattern claim unrelated input", () => {
		const scenario = createPlayerTestScenario("navigation");
		const direction = {
			...createDefaultFieldObject(DirectionBlockSchema),
			id: toID("command-block", "move-direction"),
			role: "direction",
		};
		const command = CommandSchema.parse({
			...createDefaultFieldObject(CommandSchema),
			id: toID("command", "move-direction"),
			name: "Move",
			patterns: [{...createDefaultFieldObject(PatternSchema), blocks: [direction]}],
			fallbacks: [
				{
					blockId: direction.id,
					behavior: messageBehavior("move-fallback", "You can't go that way."),
				},
			],
			behavior: messageBehavior("move-success", "You move."),
		});
		const world = produce(scenario.world, (draft) => {
			draft.commands = [command];
		});

		const nextGame = resolveTurn(world, scenario.game, "hello");

		expect(nextGame.messages.at(-1)).toMatchObject({
			type: "error",
			text: "I don't know what that means.",
		});
	});
});
