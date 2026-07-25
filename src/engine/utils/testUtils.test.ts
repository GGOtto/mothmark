import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {idValue} from "@/utils/idUtils";
import {createPlayerTestScenario, type PlayerTestScenarioName} from "./testUtils";

const scenarioNames = [
	"navigation",
	"conditional-travel",
	"turn-event",
] satisfies PlayerTestScenarioName[];

describe("engine player test utilities", () => {
	it.each(scenarioNames)("creates a valid, playable %s scenario", (scenarioName) => {
		const {world, game} = createPlayerTestScenario(scenarioName);
		const worldResult = WorldSchema.safeParse(world);
		const gameResult = GameStateSchema.safeParse(game);

		if (!worldResult.success) throw worldResult.error;
		if (!gameResult.success) throw gameResult.error;
		expect(game.player.currentRoom).toEqual(world.startRoomId);
		expect(
			game.roomStates.find((roomState) => idValue(roomState.id) === idValue(world.startRoomId))?.flags
				.visited,
		).toBe(true);
		expect(game.messages.at(-1)).toMatchObject({type: "room"});
	});

	it("returns fresh worlds and game states for each test", () => {
		const first = createPlayerTestScenario("navigation");
		const second = createPlayerTestScenario("navigation");

		expect(first.world).not.toBe(second.world);
		expect(first.game).not.toBe(second.game);
		expect(first.world).toEqual(second.world);
		expect(first.game.player).toEqual(second.game.player);
		expect(first.game.roomStates).toEqual(second.game.roomStates);
	});
});
