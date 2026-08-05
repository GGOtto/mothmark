import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {PopupProvider} from "@/components/popup/Popup";
import type {EntityRegistry, EditorRegistries} from "@/types/editor/editorRegistryTypes";
import type {EditorControlContext} from "@/types/universalEditorTypes";
import {toID} from "@/utils/idUtils";
import {EntityPickerEditor, type EntityPickerControlMetadata} from "./EntityPickerEditor";

const registry: EntityRegistry = {
	getEntities: (type) =>
		type === "feature"
			? [
					{id: "table", label: "Kitchen table", parentId: "kitchen"},
					{id: "table", label: "Library table", parentId: "library"},
				]
			: [],
	getEntityById: () => undefined,
	isValidEntityId: () => true,
};

const metadata: EntityPickerControlMetadata = {
	type: "entity-picker",
	title: "Feature",
	features: {entityType: "feature", scope: "sibling-room"},
};

describe("EntityPickerEditor", () => {
	it("uses metadata and scopes features to the sibling room reference", async () => {
		const user = userEvent.setup();
		const onChange = jest.fn();
		const context: EditorControlContext = {
			mode: "edit",
			registries: {} as EditorRegistries,
			getValue: (path) => (path.at(-1) === "roomId" ? toID("room", "kitchen") : undefined),
			setValue: () => undefined,
			registerEntityPicker: registry,
		};

		render(
			<PopupProvider>
				<EntityPickerEditor
					value={toID("feature", "")}
					onChange={onChange}
					metadata={metadata}
					path={["effects", 0, "featureId"]}
					context={context}
				/>
			</PopupProvider>,
		);

		await user.click(screen.getByRole("button", {name: "Feature"}));
		expect(screen.getByRole("option", {name: /Kitchen table/})).toBeInTheDocument();
		expect(screen.queryByRole("option", {name: /Library table/})).not.toBeInTheDocument();
		await user.click(screen.getByRole("option", {name: /Kitchen table/}));
		expect(onChange).toHaveBeenCalledWith(toID("feature", "table"));
	});
});
