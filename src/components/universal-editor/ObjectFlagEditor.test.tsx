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
	const [value, setValue] = useState<Record<string, boolean>>({
		visited: false,
		unlocked: false,
	});
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

function BehaviorStateFlagsEditor() {
	const [item, setItem] = useState({
		behaviors: [{type: "openable"}, {type: "lockable"}],
		initialState: {
			open: false,
			locked: true,
			flags: {examined: false} as Record<string, boolean>,
		},
	});
	const linkedMetadata: ObjectFlagControlMetadata = {
		type: "object-flag-editor",
		title: "Flags",
		features: {
			flags: {examined: {permanent: true, defaultReadonly: true}},
			linkedFlags: [
				{
					name: "open",
					valueField: "open",
					sourceArrayField: "behaviors",
					sourceValue: "openable",
				},
				{
					name: "locked",
					valueField: "locked",
					sourceArrayField: "behaviors",
					sourceValue: "lockable",
				},
			],
		},
	};
	const linkedContext: EditorControlContext = {
		...context,
		getValue: (path) =>
			path.reduce<unknown>(
				(current, segment) =>
					current && typeof current === "object"
						? (current as Record<string | number, unknown>)[segment]
						: undefined,
				item,
			),
		setValue: (path, nextValue) => {
			if (path[0] !== "initialState" || typeof path[1] !== "string") return;
			setItem((current) => ({
				...current,
				initialState: {...current.initialState, [path[1]]: nextValue},
			}));
		},
	};

	return (
		<>
			<button
				type="button"
				onClick={() =>
					setItem((current) => ({
						...current,
						behaviors: current.behaviors.filter((behavior) => behavior.type !== "lockable"),
					}))
				}
			>
				Remove lockable behavior
			</button>
			<ObjectFlagEditor
				value={item.initialState.flags}
				onChange={(flags) =>
					setItem((current) => ({
						...current,
						initialState: {...current.initialState, flags},
					}))
				}
				metadata={linkedMetadata}
				path={["initialState", "flags"]}
				context={linkedContext}
			/>
			<output data-testid="item-state">{JSON.stringify(item.initialState)}</output>
		</>
	);
}

describe("ObjectFlagEditor", () => {
	it("adds, names, defaults, and deletes author flags", () => {
		render(<StatefulEditor />);

		const nameInput = screen.getByLabelText("Flag name");
		nameInput.focus();
		fireEvent.change(nameInput, {
			target: {value: "doorOpen"},
		});
		expect(screen.getByLabelText("Flag name")).toHaveFocus();
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

	it("shows behavior-provided state as fixed, controllable flags", () => {
		render(<BehaviorStateFlagsEditor />);

		expect(screen.queryByRole("button", {name: "Delete open"})).not.toBeInTheDocument();
		expect(screen.queryByRole("button", {name: "Delete locked"})).not.toBeInTheDocument();
		expect(screen.getByRole("switch", {name: "Default value for open"})).toBeEnabled();
		expect(screen.getByRole("switch", {name: "Default value for locked"})).toBeChecked();

		fireEvent.click(screen.getByRole("switch", {name: "Default value for open"}));

		expect(screen.getByTestId("item-state")).toHaveTextContent('"open":true');

		fireEvent.click(screen.getByRole("button", {name: "Remove lockable behavior"}));
		expect(screen.queryByText("locked")).not.toBeInTheDocument();
	});
});
