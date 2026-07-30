import {GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {idValue} from "@/utils/idUtils";
import {produce} from "immer";
import {createPlayerTestScenario} from "../utils/testUtils";

describe("createInitialGameState", () => {
	it("loads complete room and feature snapshots from the world", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const room = world.rooms.find((candidate) => idValue(candidate.id) === "foyer")!;
		const feature = room.features.find((candidate) => idValue(candidate.id) === "brass-bell")!;
		const roomState = game.roomStates.find((candidate) => idValue(candidate.id) === "foyer")!;
		const featureState = roomState.featureStates.find(
			(candidate) => idValue(candidate.id) === "brass-bell",
		)!;

		expect(GameStateSchema.safeParse(game).success).toBe(true);
		expect(roomState).toMatchObject({
			name: room.name,
			description: room.description,
			shortDescription: room.shortDescription,
			aliases: room.aliases,
			tags: room.tags,
			lockedExits: [],
		});
		expect(featureState).toMatchObject({
			name: feature.name,
			description: feature.description,
			aliases: feature.aliases,
			tags: feature.tags,
			kind: feature.kind,
			listedInRoom: feature.listedInRoom,
		});
	});

	it("copies mutable collections instead of sharing them with authored world data", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const changedGame = produce(game, (draft) => {
			const room = draft.roomStates.find((candidate) => idValue(candidate.id) === "foyer")!;
			room.aliases.push("runtime foyer");
			room.tags.push("runtime room");
			room.featureStates[0].aliases.push("runtime bell");
			room.featureStates[0].tags.push("runtime feature");
		});

		expect(changedGame.roomStates[0].aliases).toContain("runtime foyer");
		expect(world.rooms[0].aliases).not.toContain("runtime foyer");
		expect(world.rooms[0].tags).not.toContain("runtime room");
		expect(world.rooms[0].features[0].aliases).not.toContain("runtime bell");
		expect(world.rooms[0].features[0].tags).not.toContain("runtime feature");
	});
});
