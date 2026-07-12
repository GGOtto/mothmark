import {resolveEditorControlAppearance} from "./editorMetadataTypes";

describe("resolveEditorControlAppearance", () => {
	it("prioritizes control appearance over the inherited editor context", () => {
		expect(
			resolveEditorControlAppearance(
				{
					theme: "parchment",
					scheme: "dark",
					tone: "quiet",
					chrome: "card",
					size: "lg",
					defaultCollapsed: true,
				},
				{
					tone: "paper",
					chrome: "inline",
					size: "sm",
				},
			),
		).toEqual({
			theme: "parchment",
			scheme: "dark",
			tone: "paper",
			chrome: "inline",
			size: "sm",
			defaultCollapsed: true,
		});
	});
});
