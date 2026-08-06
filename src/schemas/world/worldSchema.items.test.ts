import {produce} from "immer";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {ContainerBehaviorSchema, ItemSchema, TakeableBehaviorSchema} from "./itemSchema";
import {RoomSchema} from "./roomSchema";
import {WorldSchema} from "./worldSchema";

function item(id: string, name: string) {
	return produce(createDefaultFieldObject(ItemSchema), (draft) => {
		draft.id = toID("item", id);
		draft.name = name;
		draft.initialState.location = {type: "room", roomId: toID("room", "room")};
	});
}

function worldWithItems(items: ReturnType<typeof item>[]) {
	return produce(createDefaultFieldObject(WorldSchema), (draft) => {
		const room = produce(createDefaultFieldObject(RoomSchema), (roomDraft) => {
			roomDraft.id = toID("room", "room");
			roomDraft.name = "Room";
		});
		draft.rooms = [room];
		draft.startRoomId = room.id;
		draft.items = items;
	});
}

describe("WorldSchema item placement", () => {
	it("uses takeable size for capacity without changing a full bag's own size", () => {
		const bag = produce(item("bag", "Bag"), (draft) => {
			draft.behaviors = [
				{...createDefaultFieldObject(TakeableBehaviorSchema), type: "takeable", size: "small"},
				{
					...createDefaultFieldObject(ContainerBehaviorSchema),
					type: "container",
					capacity: {capacity: 2, maximumItemSize: "small"},
				},
			];
		});
		const key = produce(item("key", "Key"), (draft) => {
			draft.behaviors = [
				{...createDefaultFieldObject(TakeableBehaviorSchema), type: "takeable", size: "small"},
			];
			draft.initialState.location = {type: "item", itemId: bag.id, placement: "inside"};
		});

		const result = WorldSchema.safeParse(worldWithItems([bag, key]));

		expect(result.success).toBe(true);
		if (result.success) {
			expect(
				result.data.items[0].behaviors.find((behavior) => behavior.type === "takeable"),
			).toMatchObject({
				size: "small",
			});
		}
	});

	it("rejects initial contents whose combined size exceeds capacity", () => {
		const bag = produce(item("bag", "Bag"), (draft) => {
			draft.behaviors = [
				{
					...createDefaultFieldObject(ContainerBehaviorSchema),
					type: "container",
					capacity: {capacity: 1, maximumItemSize: "small"},
				},
			];
		});
		const key = produce(item("key", "Key"), (draft) => {
			draft.behaviors = [
				{...createDefaultFieldObject(TakeableBehaviorSchema), type: "takeable", size: "small"},
			];
			draft.initialState.location = {type: "item", itemId: bag.id, placement: "inside"};
		});

		expect(WorldSchema.safeParse(worldWithItems([bag, key])).success).toBe(false);
	});
});
