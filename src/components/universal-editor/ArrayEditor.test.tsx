import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import {ItemSchema} from "@/schemas/world/itemSchema";
import type {EditorControlContext} from "@/types/universalEditorTypes";
import {ArrayEditor, type ArrayControlMetadata} from "./ArrayEditor";
import {resolveEditorMetadata} from "./utils/resolveEditorMetadata";
import {getSchemaAtPath} from "./utils/schemaIntrospection";

const context: EditorControlContext = {
	mode: "edit",
	getValue: () => undefined,
	setValue: () => undefined,
};

function BehaviorsEditor() {
	const [value, setValue] = useState<unknown[]>([]);
	const schema = getSchemaAtPath(ItemSchema, ["behaviors"]);
	if (!schema) throw new Error("Expected the item behaviors schema.");

	return (
		<>
			<ArrayEditor
				value={value}
				onChange={setValue}
				metadata={resolveEditorMetadata(schema) as ArrayControlMetadata}
				path={["behaviors"]}
				context={context}
			/>
			<output data-testid="behaviors-value">{JSON.stringify(value)}</output>
		</>
	);
}

describe("ArrayEditor multi-select arrays", () => {
	it("shows every schema-backed behavior without duplicate configuration rows", () => {
		const {container} = render(<BehaviorsEditor />);

		expect(screen.getByRole("checkbox", {name: /Takeable/})).toBeInTheDocument();
		expect(
			screen.getByText("Lets the player take, carry, place, and drop this item."),
		).toBeInTheDocument();
		expect(screen.getByRole("checkbox", {name: /Container/})).toBeInTheDocument();
		expect(screen.getByRole("checkbox", {name: /Surface/})).toBeInTheDocument();
		expect(screen.getByRole("checkbox", {name: /Openable/})).toBeInTheDocument();
		expect(screen.getByRole("checkbox", {name: /Lockable/})).toBeInTheDocument();
		expect(screen.getByRole("checkbox", {name: /Door/})).toBeInTheDocument();
		expect(screen.getByRole("checkbox", {name: /Usable/})).toBeInTheDocument();

		fireEvent.click(screen.getByRole("checkbox", {name: /Takeable/}));

		expect(screen.getByText("1 selected")).toBeInTheDocument();
		expect(screen.getByTestId("behaviors-value")).toHaveTextContent('"type":"takeable"');
		expect(container.querySelector(".arrayEditor__item")).not.toBeInTheDocument();
		expect(screen.queryByRole("button", {name: /Delete/})).not.toBeInTheDocument();
	});
});
