import {createDefaultFeature} from "./createDefaultWorld";

describe("createDefaultFeature", () => {
	it("creates a valid room feature with editable blank content", () => {
		expect(createDefaultFeature("feature-1")).toMatchObject({
			id: "feature-1",
			name: "New feature",
			aliases: [],
			tags: [],
			kind: "feature",
			description: {
				default: "",
				variants: [],
			},
			activeWhen: [],
			visibleWhen: [],
			usableWhen: [],
			initialItems: [],
		});
	});
});
