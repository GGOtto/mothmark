import type {EditorFieldMetadata} from "@/types/editor/editorMetadataTypes";
import {mergeEditorMetadata} from "./mergeEditorMetadata";

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
					pinned: true,
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
				pinned: true,
			},
		});
	});
});
