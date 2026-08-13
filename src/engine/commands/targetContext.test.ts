import {TargetBlockSchema} from "@/schemas/world/commandSchemas";
import {ContainerBehaviorSchema, OpenableBehaviorSchema} from "@/schemas/world/itemSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {compareIds, idValue, toID} from "@/utils/idUtils";
import {produce} from "immer";
import {createInitialGameState} from "../states/createInitialState";
import {createPlayerTestItem, createPlayerTestScenario} from "../utils/testUtils";
import {matchBlock} from "./blocks";
import {resolveTargetMatchContext} from "./targetContext";

describe("resolveTargetMatchContext", () => {
	it("derives visibility, knowledge, and reachability from world topology and game state", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const targets = resolveTargetMatchContext(world, game).targets ?? [];
		const foyer = targets.find((candidate) => compareIds(candidate.reference, toID("room", "foyer")));
		const gallery = targets.find((candidate) =>
			compareIds(candidate.reference, toID("room", "gallery")),
		);
		const bell = targets.find((candidate) =>
			compareIds(candidate.reference, toID("item", "brass-bell")),
		);

		expect(foyer?.sources).toEqual(
			expect.arrayContaining(["current-room", "visible", "reachable", "known"]),
		);
		expect(gallery?.sources).toContain("reachable");
		expect(gallery?.sources).not.toContain("known");
		expect(bell?.sources).toEqual(
			expect.arrayContaining(["current-room", "visible", "reachable", "known"]),
		);
	});

	it("uses runtime names, aliases, tags, and flags instead of stale authored values", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const changedGame = produce(game, (draft) => {
			const bell = draft.itemStates.find((item) => idValue(item.id) === "brass-bell")!;
			bell.name = "Silver Chime";
			bell.aliases = ["chime"];
			bell.tags = ["musical"];
			bell.flags.hidden = false;
		});
		const block = {
			...createDefaultFieldObject(TargetBlockSchema),
			id: toID("command-block", "instrument"),
			role: "instrument",
			entityTypes: ["item" as const],
			tags: ["musical"],
			source: "visible" as const,
		};

		const result = matchBlock("chime", block, resolveTargetMatchContext(world, changedGame));

		expect(result).toEqual({
			match: "match",
			command: {
				blockId: block.id,
				type: "target",
				value: toID("item", "brass-bell"),
			},
		});
		expect(world.items.find((item) => idValue(item.id) === "brass-bell")?.aliases).toEqual(["bell"]);
	});

	it("removes visibility and reachability from hidden items", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const hiddenGame = produce(game, (draft) => {
			draft.itemStates[0].flags.hidden = true;
		});
		const bell = (resolveTargetMatchContext(world, hiddenGame).targets ?? []).find((candidate) =>
			compareIds(candidate.reference, toID("item", "brass-bell")),
		);

		expect(bell?.sources).not.toContain("current-room");
		expect(bell?.sources).not.toContain("visible");
		expect(bell?.sources).not.toContain("reachable");
	});

	it("removes connected rooms from reachability when their exit is locked", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const lockedGame = produce(game, (draft) => {
			const foyer = draft.roomStates.find((room) => idValue(room.id) === "foyer")!;
			foyer.lockedExits.push("e");
		});
		const gallery = (resolveTargetMatchContext(world, lockedGame).targets ?? []).find((candidate) =>
			compareIds(candidate.reference, toID("room", "gallery")),
		);

		expect(gallery?.sources).not.toContain("reachable");
	});

	it("does not mark listed contents as known through a closed or unlisted parent", () => {
		const scenario = createPlayerTestScenario("navigation");
		const box = produce(createPlayerTestItem("box", "Box", "A box rests here.", "foyer"), (draft) => {
			draft.behaviors = [
				createDefaultFieldObject(ContainerBehaviorSchema),
				createDefaultFieldObject(OpenableBehaviorSchema),
			];
		});
		const token = produce(
			createPlayerTestItem("token", "Token", "A token lies inside.", "foyer"),
			(draft) => {
				draft.initialState.location = {
					type: "item",
					itemId: toID("item", "box"),
					placement: "inside",
				};
			},
		);
		const world = produce(scenario.world, (draft) => {
			draft.items = [box, token];
		});
		const closedGame = createInitialGameState(world, world.startRoomId);
		const openGame = produce(closedGame, (draft) => {
			draft.itemStates[0].open = true;
		});
		const unlistedGame = produce(openGame, (draft) => {
			draft.itemStates[0].listedInRoom = false;
		});
		const tokenId = toID("item", "token");
		const sources = (game: typeof closedGame) =>
			(resolveTargetMatchContext(world, game).targets ?? []).find((candidate) =>
				compareIds(candidate.reference, tokenId),
			)?.sources;

		expect(sources(closedGame)).not.toContain("known");
		expect(sources(openGame)).toContain("known");
		expect(sources(unlistedGame)).not.toContain("known");
	});
});
