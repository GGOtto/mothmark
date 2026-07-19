import {mergeEditorMetadata} from "./mergeEditorMetadata";
import type {EditorFieldMetadata} from "@/types/editor/editorMetadataTypes";

describe("mergeEditorMetadata", () => {
	it("preserves base metadata while merging nested layout and appearance overrides", () => {
		const base: EditorFieldMetadata = {
			control: "object",
			title: "Description",
			appearance: {
				chrome: "field",
			},
			layout: {
				width: "full",
			},
		};

		expect(
			mergeEditorMetadata(base, {
				layout: {
					order: 3,
				},
			}),
		).toEqual({
			control: "object",
			title: "Description",
			appearance: {
				chrome: "field",
			},
			layout: {
				width: "full",
				order: 3,
			},
		});
	});
});
