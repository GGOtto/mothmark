import {produce} from "immer";
import {ITEM_BEHAVIOR_SCHEMAS, ItemBehaviorSchema, ItemSchema} from "@/schemas/world/itemSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {
	addItemBehaviorDraft,
	effectiveItemTags,
	isDefaultItemBehavior,
	ITEM_BEHAVIOR_DEFINITIONS,
	replaceItemTagsAndBehaviorsDraft,
} from "./itemBehaviors";

describe("item behavior tags", () => {
	it("derives the behavior catalog from the supported schemas", () => {
		expect(ITEM_BEHAVIOR_DEFINITIONS).toHaveLength(ITEM_BEHAVIOR_SCHEMAS.length);
		expect(ITEM_BEHAVIOR_DEFINITIONS.find(({type}) => type === "takeable")).toMatchObject({
			label: "Takeable",
			description: expect.stringContaining("take"),
		});
	});

	it("keeps canonical behavior tags out of authored tags and synchronizes both directions", () => {
		const source = createDefaultFieldObject(ItemSchema);
		const enabled = produce(source, (draft) => {
			replaceItemTagsAndBehaviorsDraft(draft, ["food", "takeable"]);
		});

		expect(enabled.tags).toEqual(["food"]);
		expect(enabled.behaviors.map(({type}) => type)).toEqual(["takeable"]);
		expect([...effectiveItemTags(enabled)]).toEqual(["food", "takeable"]);

		const removed = produce(enabled, (draft) => {
			replaceItemTagsAndBehaviorsDraft(draft, ["food"]);
		});
		expect(removed.tags).toEqual(["food"]);
		expect(removed.behaviors).toEqual([]);
	});

	it("adds schema-declared requirements and prevents orphaning them", () => {
		const locked = produce(createDefaultFieldObject(ItemSchema), (draft) => {
			replaceItemTagsAndBehaviorsDraft(draft, ["lockable"]);
		});
		expect([...effectiveItemTags(locked)]).toEqual(["openable", "lockable"]);

		const attemptedRemoval = produce(locked, (draft) => {
			replaceItemTagsAndBehaviorsDraft(draft, ["lockable"]);
		});
		expect(attemptedRemoval.behaviors.map(({type}) => type)).toEqual(["openable", "lockable"]);
	});

	it("creates a door with an existing connection and its openable requirement", () => {
		const connectionId = toID("connection", "hallway");
		const withDoor = produce(createDefaultFieldObject(ItemSchema), (draft) => {
			expect(addItemBehaviorDraft(draft, "door", {connectionId})).toBe(true);
		});

		expect(withDoor.behaviors).toEqual([
			expect.objectContaining({type: "openable"}),
			{type: "door", connectionId, controls: "both-directions"},
		]);
		expect(
			withDoor.behaviors.every((behavior) => ItemBehaviorSchema.safeParse(behavior).success),
		).toBe(true);
		expect(isDefaultItemBehavior(withDoor.behaviors[1]!)).toBe(true);
	});

	it("does not create an invalid door when no connection exists", () => {
		const source = createDefaultFieldObject(ItemSchema);
		let added = true;
		const unchanged = produce(source, (draft) => {
			added = addItemBehaviorDraft(draft, "door");
		});

		expect(added).toBe(false);
		expect(unchanged.behaviors).toEqual([]);
	});
});
