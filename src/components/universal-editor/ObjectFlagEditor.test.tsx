import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import type {EditorRegistries} from "../../types/editor/editorRegistryTypes";
import type {EditorControlContext} from "../../types/universalEditorTypes";
import {ObjectFlagEditor, type ObjectFlagControlMetadata} from "./ObjectFlagEditor";

const context: EditorControlContext = {
	mode: "edit",
	registries: {} as EditorRegistries,
	getValue: () => undefined,
	setValue: () => undefined,
};

const metadata: ObjectFlagControlMetadata = {
	type: "object-flag-editor",
	title: "Flags",
	features: {
		flags: {
			visited: {permanent: true, defaultReadonly: true},
		},
	},
};

function StatefulEditor() {
	const [value, setValue] = useState({visited: false, unlocked: false});
	return (
		<>
			<ObjectFlagEditor
				value={value}
				onChange={setValue}
				metadata={metadata}
				path={[]}
				context={context}
			/>
			<output data-testid="value">{JSON.stringify(value)}</output>
		</>
	);
}

describe("ObjectFlagEditor", () => {
	it("adds, names, defaults, and deletes author flags", () => {
		render(<StatefulEditor />);

		fireEvent.change(screen.getByLabelText("Flag name"), {
			target: {value: "doorOpen"},
		});
		fireEvent.click(screen.getByRole("switch", {name: "Default value for doorOpen"}));

		expect(screen.getByTestId("value")).toHaveTextContent(
			JSON.stringify({visited: false, doorOpen: true}),
		);

		fireEvent.click(screen.getByRole("button", {name: "Delete doorOpen"}));
		expect(screen.getByTestId("value")).toHaveTextContent(JSON.stringify({visited: false}));

		fireEvent.click(screen.getByRole("button", {name: "Add flag"}));
		expect(screen.getByTestId("value")).toHaveTextContent(
			JSON.stringify({visited: false, flag: false}),
		);
	});

	it("locks permanent flag names and prevents their deletion", () => {
		render(<StatefulEditor />);

		expect(screen.queryByRole("button", {name: "Delete visited"})).not.toBeInTheDocument();
		expect(screen.getByRole("switch", {name: "Default value for visited"})).toBeDisabled();
		expect(screen.getByText("visited")).toBeInTheDocument();
	});
});
