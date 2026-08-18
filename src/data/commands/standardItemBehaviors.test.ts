import {produce} from "immer";
import {resolveEffects} from "@/engine/effects/resolveEffects";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {addItemBehaviorDraft, ITEM_BEHAVIOR_DEFINITIONS} from "@/features/items/itemBehaviors";
import {EffectGroupSchema} from "@/schemas/world/effectSchema";
import {
	ITEM_BEHAVIOR_SCHEMAS,
	ItemBehaviorSchema,
	ItemSchema,
	StandardItemActionSchema,
	type ItemBehavior,
	type StandardItemAction,
} from "@/schemas/world/itemSchema";
import {RoomSchema} from "@/schemas/world/roomSchema";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID, type ID} from "@/utils/idUtils";

const roomId = toID("room", "room");

function behaviorWorld(
	type: Exclude<ItemBehavior["type"], "door">,
	configure?: (behavior: Extract<ItemBehavior, {actions: unknown}>) => void,
) {
	const item = produce(createDefaultFieldObject(ItemSchema), (draft) => {
		draft.id = toID("item", "subject");
		draft.name = "subject";
		draft.initialState.location = {type: "room", roomId};
		addItemBehaviorDraft(draft, type);
		const behavior = draft.behaviors.find((candidate) => candidate.type === type);
		if (behavior && "actions" in behavior) configure?.(behavior);
	});
	const tool = produce(createDefaultFieldObject(ItemSchema), (draft) => {
		draft.id = toID("item", "tool");
		draft.name = "tool";
		draft.tags = ["sharp"];
		draft.initialState.location = {type: "inventory"};
	});
	const wrongTool = produce(createDefaultFieldObject(ItemSchema), (draft) => {
		draft.id = toID("item", "wrong-tool");
		draft.name = "wrong tool";
		draft.initialState.location = {type: "inventory"};
	});
	const world = produce(createDefaultFieldObject(WorldSchema), (draft) => {
		draft.startRoomId = roomId;
		draft.rooms = [
			produce(createDefaultFieldObject(RoomSchema), (room) => {
				room.id = roomId;
				room.name = "Room";
			}),
		];
		draft.items = [item, tool, wrongTool];
	});
	return {world, game: createInitialGameState(world, roomId)};
}

function actionGroup(action: StandardItemAction, targetItemId?: ID<"item">) {
	return produce(createDefaultFieldObject(EffectGroupSchema), (draft) => {
		draft.id = toID("effect", `${action}-effects`);
		draft.name = action;
		draft.effects = [
			{
				type: "player",
				operation: "perform-item-action",
				action,
				itemId: toID("item", "subject"),
				...(targetItemId ? {targetItemId} : {}),
			},
		];
	});
}

describe("standard item behavior contracts", () => {
	it("derives all 30 behaviors from schema variants and covers every standard action", () => {
		expect(ITEM_BEHAVIOR_SCHEMAS).toHaveLength(30);
		expect(ITEM_BEHAVIOR_DEFINITIONS).toHaveLength(30);
		const actions = new Set<StandardItemAction>();
		for (const schema of ITEM_BEHAVIOR_SCHEMAS) {
			const behavior = createDefaultFieldObject(schema);
			if (behavior.type === "door") continue;
			expect(ItemBehaviorSchema.safeParse(behavior).success).toBe(true);
			if (!("actions" in behavior)) continue;
			expect(behavior.actions.length).toBeGreaterThan(0);
			for (const settings of behavior.actions) {
				expect(actions.has(settings.action)).toBe(false);
				actions.add(settings.action);
				expect(settings.message).not.toBe("");
				expect(settings.blockedMessage).not.toBe("");
			}
		}
		expect(actions).toEqual(new Set(StandardItemActionSchema.options));
	});

	it("honors customized availability, messages, and after-action effects", () => {
		const {world, game} = behaviorWorld("readable", (behavior) => {
			const read = behavior.actions.find((action) => action.action === "read")!;
			read.message = "The hidden inscription becomes clear.";
			read.blockedMessage = "The ink is still invisible.";
			read.allowedWhen = {
				type: "group",
				operation: "all",
				conditions: [
					{
						type: "item",
						operation: "flag-is",
						itemId: toID("item", "subject"),
						flag: "visible-ink",
						value: true,
					},
				],
			};
			read.after = produce(createDefaultFieldObject(EffectGroupSchema), (draft) => {
				draft.id = toID("effect", "after-read");
				draft.name = "After read";
				draft.effects = [
					{
						type: "item",
						operation: "add-tag",
						itemId: toID("item", "subject"),
						value: "understood",
					},
				];
			});
		});
		const blocked = resolveEffects(world, game, actionGroup("read"));
		expect(blocked.messages.at(-1)?.text).toBe("The ink is still invisible.");
		const enabled = produce(game, (draft) => {
			draft.itemStates[0]!.flags["visible-ink"] = true;
		});
		const read = resolveEffects(world, enabled, actionGroup("read"));
		expect(read.messages.at(-1)?.text).toBe("The hidden inscription becomes clear.");
		expect(read.itemStates[0]!.tags).toContain("understood");
	});

	it("enforces specific target tags without revealing inaccessible alternatives", () => {
		const {world, game} = behaviorWorld("cuttable", (behavior) => {
			const cut = behavior.actions.find((action) => action.action === "cut")!;
			cut.target = {type: "tag", tag: "sharp"};
			cut.message = "A clean cut parts it.";
			cut.blockedMessage = "That tool cannot cut it.";
		});
		const wrong = resolveEffects(world, game, actionGroup("cut", toID("item", "wrong-tool")));
		expect(wrong.messages.at(-1)?.text).toBe("That tool cannot cut it.");
		const right = resolveEffects(world, game, actionGroup("cut", toID("item", "tool")));
		expect(right.messages.at(-1)?.text).toBe("A clean cut parts it.");
		expect(right.itemStates[0]!.flags["behavior.cut"]).toBe(true);
	});

	it("can disable one command without disabling the rest of the behavior", () => {
		const {world, game} = behaviorWorld("sound-making", (behavior) => {
			behavior.actions.find((action) => action.action === "ring")!.enabled = false;
			behavior.actions.find((action) => action.action === "play")!.message = "A tune sounds.";
		});
		const ring = resolveEffects(world, game, actionGroup("ring"));
		expect(ring.messages.at(-1)?.text).toBe("You can't do that right now.");
		const play = resolveEffects(world, game, actionGroup("play"));
		expect(play.messages.at(-1)?.text).toBe("A tune sounds.");
	});
});
