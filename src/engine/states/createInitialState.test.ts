import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {idValue} from "@/utils/idUtils";
import {produce} from "immer";
import {createPlayerTestScenario} from "../utils/testUtils";

describe("createInitialGameState", () => {
	it("loads complete room and item snapshots from the world", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const room = world.rooms.find((candidate) => idValue(candidate.id) === "foyer")!;
		const item = world.items.find((candidate) => idValue(candidate.id) === "brass-bell")!;
		const roomState = game.roomStates.find((candidate) => idValue(candidate.id) === "foyer")!;
		const itemState = game.itemStates.find((candidate) => idValue(candidate.id) === "brass-bell")!;

		expect(GameStateSchema.safeParse(game).success).toBe(true);
		expect(roomState).toMatchObject({
			name: room.name,
			description: room.description,
			shortDescription: room.shortDescription,
			aliases: room.aliases,
			tags: room.tags,
			lockedExits: [],
		});
		expect(itemState).toMatchObject({
			name: item.name,
			description: item.examine.text,
			aliases: item.aliases,
			tags: item.tags,
			behaviorTags: item.behaviors.map((behavior) => behavior.type),
			listedInRoom: item.presentation.listedInRoom,
		});
	});

	it("copies mutable collections instead of sharing them with authored world data", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const changedGame = produce(game, (draft) => {
			draft.roomStates[0].aliases.push("runtime foyer");
			draft.roomStates[0].tags.push("runtime room");
			draft.itemStates[0].aliases.push("runtime bell");
			draft.itemStates[0].tags.push("runtime item");
		});

		expect(changedGame.roomStates[0].aliases).toContain("runtime foyer");
		expect(world.rooms[0].aliases).not.toContain("runtime foyer");
		expect(world.rooms[0].tags).not.toContain("runtime room");
		expect(world.items[0].aliases).not.toContain("runtime bell");
		expect(world.items[0].tags).not.toContain("runtime item");
	});
});
