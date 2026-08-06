import {produce} from "immer";
import {resolveTurn} from "@/engine/player/resolveTurn";
import {createPlayerTestScenario} from "@/engine/utils/testUtils";
import {DoorBehaviorSchema, ItemSchema, OpenableBehaviorSchema} from "@/schemas/world/itemSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue, toID} from "@/utils/idUtils";
import {createInitialGameState} from "@/engine/states/createInitialState";

function scenarioWithDoor(open: boolean) {
	const scenario = createPlayerTestScenario("navigation");
	const world = produce(scenario.world, (draft) => {
		const door = createDefaultFieldObject(ItemSchema);
		door.id = toID("item", "gallery-door");
		door.name = "Gallery door";
		door.initialState.location = {type: "room", roomId: toID("room", "foyer")};
		door.initialState.open = open;
		door.behaviors = [
			{...createDefaultFieldObject(OpenableBehaviorSchema), type: "openable"},
			{
				...createDefaultFieldObject(DoorBehaviorSchema),
				type: "door",
				connectionId: toID("connection", "foyer-gallery"),
				controls: "both-directions",
			},
		];
		draft.items.push(door);
	});
	return {world, game: createInitialGameState(world, world.startRoomId)};
}

describe("door items through the player path", () => {
	it("blocks its connection when closed", () => {
		const {world, game} = scenarioWithDoor(false);
		const result = resolveTurn(world, game, "east");

		expect(idValue(result.player.currentRoom)).toBe("foyer");
		expect(result.messages.at(-1)?.text).toBe("You can't go that way.");
	});

	it("allows travel through its connection when open", () => {
		const {world, game} = scenarioWithDoor(true);
		const result = resolveTurn(world, game, "east");

		expect(idValue(result.player.currentRoom)).toBe("gallery");
	});
});
