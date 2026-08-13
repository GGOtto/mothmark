import {createInitialWorld} from "@/data/worlds/initialWorld";
import {SavedConditionSchema} from "@/schemas/world/conditionSchema";
import {EffectGroupSchema} from "@/schemas/world/effectSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {produce} from "immer";
import {idValue} from "@/utils/idUtils";
import {buildEditorContextSearch, resolveEditorContext} from "./editorContextUrl";

describe("editorContextUrl", () => {
	it("restores a stable item selection and produces its canonical URL", () => {
		const world = createInitialWorld();
		const itemId = idValue(world.items[0].id);
		const resolved = resolveEditorContext(world, `?view=items&item=${itemId}`);

		expect(resolved).toMatchObject({
			notice: null,
			context: {activeTab: "world", selectedItemId: itemId},
		});
		expect(buildEditorContextSearch(resolved.context)).toBe(`?view=items&item=${itemId}`);
	});

	it("restores rooms, connections, and commands", () => {
		const world = createInitialWorld();
		const roomId = idValue(world.rooms[1].id);
		const connectionId = idValue(world.connections[0].id);
		const commandId = idValue(world.commands[0].id);

		expect(resolveEditorContext(world, `?view=map&room=${roomId}`).context.selection).toEqual({
			selectedId: roomId,
			isConnectionSelected: false,
		});
		expect(
			resolveEditorContext(world, `?view=map&connection=${connectionId}`).context.selection,
		).toEqual({selectedId: connectionId, isConnectionSelected: true});
		expect(
			resolveEditorContext(world, `?view=logic&section=commands&command=${commandId}`).context,
		).toMatchObject({activeTab: "logic", logicSection: "commands", selectedCommandId: commandId});
	});

	it("restores reusable condition and effect selections", () => {
		const world = produce(createInitialWorld(), (draft) => {
			const condition = createDefaultFieldObject(SavedConditionSchema);
			condition.identity = toID("condition", "test-condition");
			draft.conditions.push(condition);
			const effect = createDefaultFieldObject(EffectGroupSchema);
			effect.id = toID("effect", "test-effect");
			draft.effects.push(effect);
		});
		const conditionId = idValue(world.conditions[0].identity);
		const effectId = idValue(world.effects[0].id);

		const conditionContext = resolveEditorContext(
			world,
			`?view=logic&section=conditions&condition=${conditionId}`,
		).context;
		const effectContext = resolveEditorContext(
			world,
			`?view=logic&section=effects&effect=${effectId}`,
		).context;

		expect(conditionContext.selectedConditionId).toBe(conditionId);
		expect(buildEditorContextSearch(conditionContext)).toBe(
			`?view=logic&section=conditions&condition=${conditionId}`,
		);
		expect(effectContext.selectedEffectId).toBe(effectId);
		expect(buildEditorContextSearch(effectContext)).toBe(
			`?view=logic&section=effects&effect=${effectId}`,
		);
	});

	it("removes an inaccessible selection and explains the fallback", () => {
		const world = createInitialWorld();
		const resolved = resolveEditorContext(world, "?view=items&item=removed-item");

		expect(resolved.context).toMatchObject({activeTab: "world", selectedItemId: null});
		expect(resolved.notice).toContain("no longer available");
		expect(buildEditorContextSearch(resolved.context)).toBe("?view=items");
	});

	it("falls back from an unknown editor view", () => {
		const resolved = resolveEditorContext(createInitialWorld(), "?view=missing");

		expect(resolved.context.activeTab).toBe("map");
		expect(resolved.notice).toContain("not available");
	});

	it("distinguishes the default room from an explicitly cleared map selection", () => {
		const world = createInitialWorld();

		expect(resolveEditorContext(world, "").context.selection.selectedId).toBe("shop-floor");
		expect(resolveEditorContext(world, "?view=map").context.selection.selectedId).toBeNull();
	});
});
