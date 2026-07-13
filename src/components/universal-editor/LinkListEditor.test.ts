import {editorValues} from "./LinkListEditor";

describe("editorValues", () => {
	it("loads embedded entities with parsed ID objects", () => {
		expect(
			editorValues(
				[
					{
						id: {type: "feature", id: "stone-arch"},
						name: "Stone Arch",
					},
				],
				{kind: "entity", entityType: "feature"},
			),
		).toEqual([{type: "feature", id: "stone-arch", label: "Stone Arch"}]);
	});
});
