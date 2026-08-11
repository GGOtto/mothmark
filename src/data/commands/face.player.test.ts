import {produce} from "immer";
import {resolveTurn} from "@/engine/player/resolveTurn";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {EffectGroupSchema} from "@/schemas/world/effectSchema";
import {DIRECTION_NAMES} from "@/schemas/world/directionSchema";
import {
	CommandSchema,
	PatternSchema,
	PhraseBlockSchema,
	TargetBlockSchema,
} from "@/schemas/world/commandSchemas";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue, toID} from "@/utils/idUtils";
import {faceCommand} from "./initialCommands";

function scenarioWithFace() {
	const scenario = createPlayerTestScenario("navigation");
	const world = produce(scenario.world, (draft) => {
		draft.commands.push(faceCommand);
	});
	return {world, game: createInitialGameState(world, world.startRoomId)};
}

function turnWheelCommand() {
	return produce(createDefaultFieldObject(CommandSchema), (draft) => {
		draft.id = toID("command", "turn-wheel");
		draft.name = "Turn wheel";
		draft.patterns = [
			produce(createDefaultFieldObject(PatternSchema), (pattern) => {
				pattern.blocks = [
					{
						...createDefaultFieldObject(PhraseBlockSchema),
						id: toID("command-block", "turn-wheel-verb"),
						matches: ["turn"],
					},
					{
						...createDefaultFieldObject(TargetBlockSchema),
						id: toID("command-block", "turn-wheel-target"),
						role: "target",
					},
				];
			}),
		];
		draft.behavior.always = produce(createDefaultFieldObject(EffectGroupSchema), (effect) => {
			effect.id = toID("effect", "turn-wheel-effect");
			effect.name = "Turn wheel";
			effect.effects = [{type: "message", operation: "show", message: "You turn the wheel."}];
		});
	});
}

describe("the initial Face command through the player path", () => {
	it.each([
		["face east", "e"],
		["face ne", "ne"],
		["turn northeast", "ne"],
		["turn right", "e"],
		["face left", "w"],
		["turn backwards", "s"],
		["face forward", "n"],
		["turn to the right", "e"],
		["face to the left", "w"],
		["face towards the left", "w"],
	] as const)("faces without moving for %s", (input, expectedFacing) => {
		const {world, game} = scenarioWithFace();
		const next = resolveTurn(world, game, input);

		expect(idValue(next.player.currentRoom)).toBe("foyer");
		expect(next.player.facing).toBe(expectedFacing);
		expect(next.messages.at(-1)).toMatchObject({
			type: "system",
			text: `You turn to face the ${DIRECTION_NAMES[expectedFacing]}.`,
		});
	});

	it("resolves chained relative turns from the latest facing", () => {
		const {world, game} = scenarioWithFace();
		const northeast = resolveTurn(world, game, "face northeast");
		const northwest = resolveTurn(world, northeast, "turn left");
		const southeast = resolveTurn(world, northwest, "turn backwards");

		expect(northeast.player.facing).toBe("ne");
		expect(northwest.player.facing).toBe("nw");
		expect(southeast.player.facing).toBe("se");
	});

	it("leaves facing unchanged when the direction cannot resolve", () => {
		const {world, game} = scenarioWithFace();
		const next = resolveTurn(world, game, "turn sideways");

		expect(next.player.facing).toBe("n");
		expect(next.messages.at(-1)).toMatchObject({
			type: "system",
			text: "That's not a direction you can face.",
		});
	});

	it("does not collide with an authored turn command whose value is a target block", () => {
		const scenario = createPlayerTestScenario("navigation");
		const world = produce(scenario.world, (draft) => {
			const bell = draft.items.find((item) => idValue(item.id) === "brass-bell")!;
			bell.name = "Wheel";
			bell.aliases = ["wheel"];
			draft.commands.push(faceCommand, turnWheelCommand());
		});
		const game = createInitialGameState(world, world.startRoomId);

		const wheelTurned = resolveTurn(world, game, "turn wheel");
		const playerTurned = resolveTurn(world, wheelTurned, "turn right");

		expect(wheelTurned.messages.at(-1)).toMatchObject({text: "You turn the wheel."});
		expect(wheelTurned.player.facing).toBe("n");
		expect(playerTurned.player.facing).toBe("e");
	});
});
