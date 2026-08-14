import {lookCommand, openCommand} from "@/data/commands/initialCommands";
import {
	ContainerBehaviorSchema,
	OpenableBehaviorSchema,
	SurfaceBehaviorSchema,
} from "@/schemas/world/itemSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {produce} from "immer";
import {resolveTurn} from "../player/resolveTurn";
import {createInitialGameState} from "../states/createInitialState";
import {createPlayerTestItem, createPlayerTestScenario} from "../utils/testUtils";

describe("room messages through the player path", () => {
	it("introduces the starting room with its full description and visible features", () => {
		const {game} = createPlayerTestScenario("navigation");

		expect(game.messages).toEqual([
			expect.objectContaining({
				type: "room",
				text: expect.stringContaining(
					"Test Foyer\nA plain foyer provides a dependable starting point.",
				),
			}),
		]);
		expect(game.messages[0].text).toContain("A small brass bell hangs beside the doorway.");
	});

	it("does not leak a feature from one room into another room's description", () => {
		const {world, game} = createPlayerTestScenario("navigation");

		const galleryGame = resolveTurn(world, game, "east");

		expect(galleryGame.messages.at(-1)?.text).not.toContain("brass bell");
	});

	it("lists surface contents and reveals nested container contents after opening the parent", () => {
		const scenario = createPlayerTestScenario("navigation");
		const chest = produce(
			createPlayerTestItem("chest", "Chest", "A chest rests here.", "foyer"),
			(draft) => {
				const container = createDefaultFieldObject(ContainerBehaviorSchema);
				container.contentsListingText = "Inside the chest:";
				draft.behaviors = [container, createDefaultFieldObject(OpenableBehaviorSchema)];
			},
		);
		const key = produce(
			createPlayerTestItem("key", "Key", "A small key lies inside.", "foyer"),
			(draft) => {
				draft.initialState.location = {
					type: "item",
					itemId: toID("item", "chest"),
					placement: "inside",
				};
			},
		);
		const table = produce(
			createPlayerTestItem("table", "Table", "A table stands nearby.", "foyer"),
			(draft) => {
				const surface = createDefaultFieldObject(SurfaceBehaviorSchema);
				surface.contentsListingText = "On the table:";
				draft.behaviors = [surface];
			},
		);
		const map = produce(
			createPlayerTestItem("map", "Map", "A map is spread across it.", "foyer"),
			(draft) => {
				draft.initialState.location = {
					type: "item",
					itemId: toID("item", "table"),
					placement: "on",
				};
			},
		);
		const world = produce(scenario.world, (draft) => {
			draft.items = [key, map, chest, table];
			draft.commands.push(lookCommand, openCommand);
		});
		const game = createInitialGameState(world, world.startRoomId);

		const beforeOpening = resolveTurn(world, game, "look");
		expect(beforeOpening.messages.at(-1)?.text).toContain(
			" A table stands nearby.\n  On the table:\n  A map is spread across it.",
		);
		expect(beforeOpening.messages.at(-1)?.text).not.toContain("A small key lies inside.");

		const opened = resolveTurn(world, beforeOpening, "open chest");
		const afterOpening = resolveTurn(world, opened, "look");

		expect(afterOpening.messages.at(-1)).toMatchObject({
			type: "room",
			text: expect.stringContaining(
				" A chest rests here.\n  Inside the chest:\n  A small key lies inside.",
			),
		});
	});
});
