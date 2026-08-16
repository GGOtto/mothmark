import {produce} from "immer";
import {createInitialWorld} from "@/data/worlds/initialWorld";
import {TakeableBehaviorSchema} from "@/schemas/world/itemSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {EffectGroupSchema} from "@/schemas/world/effectSchema";
import {toID} from "@/utils/idUtils";
import {
	findItemCommandRelationships,
	findLogicOccurrences,
	findLogicSources,
	replaceLogicOccurrence,
} from "./editorRelationships";

describe("dynamic editor relationships", () => {
	it("derives condition and effect sources from commands as the world changes", () => {
		const world = createInitialWorld();
		const conditionSources = findLogicSources(world, "condition");
		const effectSources = findLogicSources(world, "effect");

		expect(conditionSources).toEqual(
			expect.arrayContaining([
				expect.objectContaining({usage: expect.objectContaining({kind: "command", label: "Take"})}),
			]),
		);
		expect(effectSources).toEqual(
			expect.arrayContaining([
				expect.objectContaining({usage: expect.objectContaining({kind: "command", label: "Examine"})}),
			]),
		);
	});

	it("lists and updates inline logic without opening the parent editor", () => {
		const world = createInitialWorld();
		const take = findLogicSources(world, "condition").find(
			(source) => source.usage.kind === "command" && source.usage.label === "Take",
		);
		expect(take).toBeDefined();
		const occurrences = findLogicOccurrences(world, take!.usage, "condition");
		const reachableGroup = occurrences.find((occurrence) => {
			const value = occurrence.value as {conditions?: Array<{operation?: string}>};
			return value.conditions?.some((condition) => condition.operation === "is-reachable");
		});
		expect(reachableGroup).toBeDefined();
		const replacement = produce(
			reachableGroup!.value as {conditions: Array<{operation?: string; value?: boolean}>},
			(draft) => {
				const reachable = draft.conditions.find((condition) => condition.operation === "is-reachable");
				if (reachable) reachable.value = false;
			},
		);
		const updated = replaceLogicOccurrence(world, take!.usage, reachableGroup!.path, replacement);
		const updatedOccurrence = findLogicOccurrences(updated, take!.usage, "condition").find(
			(occurrence) => occurrence.key === reachableGroup!.key,
		);

		expect(updatedOccurrence?.value).toEqual(
			expect.objectContaining({
				conditions: expect.arrayContaining([
					expect.objectContaining({operation: "is-reachable", value: false}),
				]),
			}),
		);
		expect(world).not.toBe(updated);
	});

	it("lists commands whose target filters can resolve the selected item", () => {
		const world = createInitialWorld();
		const item = world.items[0]!;
		const fixedItemCommands = findItemCommandRelationships(world, item).map(
			(relationship) => relationship.command.name,
		);

		expect(fixedItemCommands).toContain("Examine");
		expect(fixedItemCommands).not.toContain("Take");

		const takeableWorld = produce(world, (draft) => {
			draft.items[0]!.behaviors.push(createDefaultFieldObject(TakeableBehaviorSchema));
		});
		const takeableCommands = findItemCommandRelationships(takeableWorld, takeableWorld.items[0]!).map(
			(relationship) => relationship.command.name,
		);

		expect(takeableCommands).toEqual(expect.arrayContaining(["Examine", "Take", "Drop"]));
	});

	it("includes commands that affect an item through a saved effect", () => {
		const world = produce(createInitialWorld(), (draft) => {
			const effect = {
				...createDefaultFieldObject(EffectGroupSchema),
				id: toID("effect", "rename-counter"),
				name: "Rename counter",
				effects: [
					{
						type: "item" as const,
						operation: "set-name" as const,
						itemId: draft.items[0]!.id,
						value: "Old counter",
					},
				],
			};
			draft.effects.push(effect);
			draft.commands[0]!.behavior.always?.effects.push({
				type: "effect-ref",
				effectId: effect.id,
			});
		});

		expect(findItemCommandRelationships(world, world.items[0]!)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					command: expect.objectContaining({name: "Help"}),
					reasons: expect.arrayContaining(["A saved condition or effect can use or affect this item"]),
				}),
			]),
		);
	});
});
