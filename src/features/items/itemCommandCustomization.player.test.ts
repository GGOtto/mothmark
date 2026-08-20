import {produce} from "immer";
import {rawInitialCommands} from "@/data/commands/initialCommands";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {resolveTurn} from "@/engine/player/resolveTurn";
import {addItemBehaviorDraft} from "@/features/items/itemBehaviors";
import {ItemSchema} from "@/schemas/world/itemSchema";
import {RoomSchema} from "@/schemas/world/roomSchema";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {
	createItemCommandCustomization,
	findItemMatchingTargetBlocks,
} from "./itemCommandCustomization";

const roomId = toID("room", "pantry");

function edibleItem(name: "apple" | "pear") {
	return produce(createDefaultFieldObject(ItemSchema), (draft) => {
		draft.id = toID("item", name);
		draft.name = name;
		draft.presentation.listedInRoom = true;
		draft.initialState.location = {type: "room", roomId};
		addItemBehaviorDraft(draft, "edible");
		const behavior = draft.behaviors.find((candidate) => candidate.type === "edible")!;
		behavior.actions[0]!.message = `You eat the ${name}.`;
	});
}

describe("item command customization through resolveTurn", () => {
	it("uses an item-specific command while other items keep the shared behavior", () => {
		const baseWorld = produce(createDefaultFieldObject(WorldSchema), (draft) => {
			draft.startRoomId = roomId;
			draft.rooms = [
				produce(createDefaultFieldObject(RoomSchema), (room) => {
					room.id = roomId;
					room.name = "Pantry";
				}),
			];
			draft.items = [edibleItem("apple"), edibleItem("pear")];
			draft.commands = rawInitialCommands;
		});
		const apple = baseWorld.items[0]!;
		const eat = baseWorld.commands.find((command) => command.name === "Eat")!;
		const target = findItemMatchingTargetBlocks(eat, apple)[0]!;
		const customized = produce(
			createItemCommandCustomization(baseWorld, apple, eat, target.id),
			(draft) => {
				draft.behavior.always!.effects = [
					{
						type: "message",
						operation: "show",
						message: "This apple uses its customized command.",
					},
				];
			},
		);
		const world = produce(baseWorld, (draft) => {
			draft.commands.push(customized);
		});

		const appleGame = resolveTurn(world, createInitialGameState(world, roomId), "eat apple");
		const pearGame = resolveTurn(world, createInitialGameState(world, roomId), "eat pear");

		expect(appleGame.messages.at(-1)?.text).toBe("This apple uses its customized command.");
		expect(pearGame.messages.at(-1)?.text).toBe("You eat the pear.");
	});
});
