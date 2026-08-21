import {produce} from "immer";
import {createInitialWorld} from "@/data/worlds/initialWorld";
import {addItemBehaviorDraft} from "@/features/items/itemBehaviors";
import {CommandSchema} from "@/schemas/world/commandSchemas";
import {compareIds, idValue} from "@/utils/idUtils";
import {
	createItemCommandCustomization,
	findItemMatchingTargetBlocks,
} from "./itemCommandCustomization";

function commandBlockIds(value: unknown): string[] {
	const ids: string[] = [];
	function visit(candidate: unknown) {
		if (!candidate || typeof candidate !== "object") return;
		if (
			"type" in candidate &&
			candidate.type === "command-block" &&
			"id" in candidate &&
			typeof candidate.id === "string"
		) {
			ids.push(candidate.id);
			return;
		}
		if (Array.isArray(candidate)) candidate.forEach(visit);
		else Object.values(candidate).forEach(visit);
	}
	visit(value);
	return ids;
}

describe("item command customization", () => {
	it("duplicates a command, scopes its chosen target to the item, and remaps internal IDs", () => {
		const world = produce(createInitialWorld(), (draft) => {
			addItemBehaviorDraft(draft.items[0]!, "edible");
		});
		const item = world.items[0]!;
		const source = world.commands.find((command) => command.name === "Eat")!;
		const sourceTarget = findItemMatchingTargetBlocks(source, item)[0]!;

		const customized = createItemCommandCustomization(world, item, source, sourceTarget.id);

		expect(CommandSchema.safeParse(customized).success).toBe(true);
		expect(customized.name).toBe("Eat (Customized for Shop Counter)");
		expect(customized.showInHelp).toBe(false);
		expect(customized.customization).toEqual({
			type: "item-command-customization",
			sourceCommandId: source.id,
			itemId: item.id,
			targetBlockId: expect.any(Object),
		});
		expect(compareIds(customized.id, source.id)).toBe(false);

		const customizedTarget = customized.patterns
			.flatMap((pattern) => pattern.blocks)
			.find(
				(block) => block.type === "target" && block.entityIds.some((id) => compareIds(id, item.id)),
			);
		expect(customizedTarget).toMatchObject({type: "target", tags: ["edible"]});
		expect(compareIds(customized.customization?.targetBlockId, customizedTarget?.id)).toBe(true);
		expect(sourceTarget.entityIds).toEqual([]);

		const sourceIds = new Set(commandBlockIds(source));
		const customizedIds = commandBlockIds(customized);
		expect(customizedIds.every((id) => !sourceIds.has(id))).toBe(true);
		expect(new Set(customizedIds).size).toBe(sourceIds.size);
	});

	it("creates one stable item version without mutating the shared command", () => {
		const world = produce(createInitialWorld(), (draft) => {
			addItemBehaviorDraft(draft.items[0]!, "edible");
		});
		const item = world.items[0]!;
		const source = world.commands.find((command) => command.name === "Eat")!;
		const sourceJson = JSON.stringify(source);
		const target = findItemMatchingTargetBlocks(source, item)[0]!;

		const customized = createItemCommandCustomization(world, item, source, target.id);

		expect(JSON.stringify(source)).toBe(sourceJson);
		expect(idValue(customized.customization!.sourceCommandId)).toBe(idValue(source.id));
	});
});
