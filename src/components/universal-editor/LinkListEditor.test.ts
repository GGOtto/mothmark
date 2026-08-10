import {editorValues} from "./LinkListEditor";

describe("editorValues", () => {
	it("loads embedded entities with parsed ID objects", () => {
		expect(
			editorValues(
				[
					{
						id: {type: "item", id: "stone-arch"},
						name: "Stone Arch",
					},
				],
				{kind: "entity", entityType: "item"},
			),
		).toEqual([{type: "item", id: "stone-arch", label: "Stone Arch"}]);
	});
});
