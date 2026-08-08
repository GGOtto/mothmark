import {produce} from "immer";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {
	ItemSchema,
	LockableBehaviorSchema,
	OpenableBehaviorSchema,
	TakeableBehaviorSchema,
	UsableBehaviorSchema,
} from "./itemSchema";

describe("ItemSchema", () => {
	it("keeps examine useful for fixed items and configures standard actions as behaviors", () => {
		const item = produce(createDefaultFieldObject(ItemSchema), (draft) => {
			draft.id = toID("item", "brass-key");
			draft.name = "Brass key";
			draft.initialState.location = {type: "hidden"};
			draft.examine.text = "Tiny teeth have been filed into one edge.";
			draft.behaviors = [
				{...createDefaultFieldObject(TakeableBehaviorSchema), type: "takeable", size: "tiny"},
				{
					...createDefaultFieldObject(UsableBehaviorSchema),
					type: "usable",
					fallbackMessage: "The key fits nothing here.",
				},
			];
		});

		expect(ItemSchema.parse(item)).toMatchObject({
			examine: {text: "Tiny teeth have been filed into one edge."},
			behaviors: [{type: "takeable", size: "tiny"}, {type: "usable"}],
		});
	});

	it("requires lockable items to also be openable", () => {
		const item = produce(createDefaultFieldObject(ItemSchema), (draft) => {
			draft.id = toID("item", "chest");
			draft.name = "Chest";
			draft.initialState.location = {type: "hidden"};
			draft.behaviors = [{...createDefaultFieldObject(LockableBehaviorSchema), type: "lockable"}];
		});

		expect(ItemSchema.safeParse(item).success).toBe(false);
		const validItem = produce(item, (draft) => {
			draft.behaviors.unshift({
				...createDefaultFieldObject(OpenableBehaviorSchema),
				type: "openable",
			});
		});
		expect(ItemSchema.safeParse(validItem).success).toBe(true);
	});
});
