import {fireEvent, render, screen} from "@testing-library/react";
import type {EditorRegistries} from "../../types/editor/editorRegistryTypes";
import type {EditorControlContext} from "../../types/universalEditorTypes";
import {TextField, type TextFieldControlMetadata} from "./TextFieldEditor";

const context: EditorControlContext = {
	mode: "edit",
	registries: {} as EditorRegistries,
	getValue: () => undefined,
	setValue: () => undefined,
};

const metadata: TextFieldControlMetadata = {
	type: "input",
	title: "Name",
};

describe("TextField", () => {
	it("updates its displayed text when the value prop changes", () => {
		const {rerender} = render(
			<TextField
				value="Foyer"
				onChange={() => undefined}
				metadata={metadata}
				path={[]}
				context={context}
			/>,
		);

		expect(screen.getByRole("textbox")).toHaveValue("Foyer");

		rerender(
			<TextField
				value="Library"
				onChange={() => undefined}
				metadata={metadata}
				path={[]}
				context={context}
			/>,
		);

		expect(screen.getByRole("textbox")).toHaveValue("Library");
	});

	it("can emit a metadata-defined value from the Clear button", () => {
		const onChange = jest.fn();
		render(
			<TextField
				value=""
				onChange={onChange}
				metadata={{
					...metadata,
					features: {clearButton: true, clearValue: "Generated name"},
				}}
				path={[]}
				context={context}
			/>,
		);

		fireEvent.click(screen.getByRole("button", {name: "Clear"}));
		expect(onChange).toHaveBeenCalledWith("Generated name");
	});
});
