import {render} from "@testing-library/react";
import type {EditorControlContext} from "@/types/universalEditorTypes";
import type {EditorRegistries} from "@/types/editor/editorRegistryTypes";
import {ObjectEditor, type ObjectControlMetadata} from "./ObjectEditor";

function context(disclosures: Record<string, boolean> = {}): EditorControlContext {
	return {
		mode: "edit",
		registries: {} as EditorRegistries,
		getValue: () => undefined,
		setValue: () => undefined,
		editorChrome: {
			getSectionDisclosure: (_path, sectionId) => disclosures[sectionId],
			setSectionDisclosure: () => undefined,
		},
	};
}

const metadata: ObjectControlMetadata = {
	type: "object",
	features: {
		groups: [
			{
				id: "parent",
				title: "Parent",
				defaultCollapsed: true,
				groups: [
					{
						id: "child",
						title: "Child",
						defaultCollapsed: true,
					},
				],
			},
		],
		fields: [
			{
				key: "value",
				metadata: {type: "hidden", layout: {group: "child"}},
			},
		],
	},
};

describe("ObjectEditor group disclosure", () => {
	it("honors defaultCollapsed for groups and subgroups", () => {
		const {container} = render(
			<ObjectEditor
				value={{value: "test"}}
				onChange={() => undefined}
				metadata={metadata}
				path={[]}
				context={context()}
			/>,
		);

		const [group, subgroup] = container.querySelectorAll("details");
		expect(group).not.toHaveAttribute("open");
		expect(subgroup).not.toHaveAttribute("open");
		expect(container.querySelector(".objectEditor__sectionCount")).not.toBeInTheDocument();
	});

	it("lets saved disclosure state override defaults independently", () => {
		const {container} = render(
			<ObjectEditor
				value={{value: "test"}}
				onChange={() => undefined}
				metadata={metadata}
				path={[]}
				context={context({parent: true, "parent/child": true})}
			/>,
		);

		const [group, subgroup] = container.querySelectorAll("details");
		expect(group).toHaveAttribute("open");
		expect(subgroup).toHaveAttribute("open");
	});
});
