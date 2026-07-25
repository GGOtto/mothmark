import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import type {EditorRegistries} from "../../types/editor/editorRegistryTypes";
import type {EditorControlContext} from "../../types/universalEditorTypes";
import {toID} from "../../utils/idUtils";
import {EffectEditor, type EffectControlMetadata, type EffectGroupValue} from "./EffectEditor";

const metadata: EffectControlMetadata = {
	type: "effect",
	title: "Outcome",
	features: {
		effectTypeOptions: [
			{label: "Show message", value: "message"},
			{label: "Group", value: "group"},
			{label: "Use saved effect", value: "effect-ref"},
		],
		operationOptionsByType: {
			message: [{label: "Show", value: "show"}],
		},
		showGeneratedSummary: true,
	},
	childControls: {
		name: {control: "input", title: "Group name"},
		id: {control: "hidden", title: "Group ID", hidden: true},
		effects: {control: "effect-list", title: "Effects"},
		effectType: {control: "select", title: "Effect type"},
		operator: {control: "select", title: "Action"},
		message: {control: "input", title: "Message"},
		effectId: {control: "entity-picker", title: "Saved effect"},
	},
};

function StatefulEffectEditor({
	withoutId = false,
	withoutName = false,
}: {
	withoutId?: boolean;
	withoutName?: boolean;
}) {
	const [value, setValue] = useState<EffectGroupValue>(() => ({
		type: "group",
		name: withoutName ? "" : "Open the gate",
		id: withoutId ? "" : toID("effect", "open-the-gate"),
		effects: [{type: "message", operation: "show", message: "The gate opens."}],
		allowMultipleUsesInWorld: true,
	}));
	const [worldEffects, setWorldEffects] = useState<EffectGroupValue[]>([]);
	const context: EditorControlContext = {
		mode: "edit",
		registries: {} as EditorRegistries,
		getValue: () => undefined,
		setValue: () => undefined,
		getWorldValue: (path) => (path[0] === "effects" ? worldEffects : undefined),
		setWorldValue: (path, nextValue) => {
			if (path[0] === "effects" && Array.isArray(nextValue)) {
				setWorldEffects(nextValue as EffectGroupValue[]);
			}
		},
	};

	return (
		<>
			<EffectEditor
				value={value}
				onChange={setValue}
				metadata={metadata}
				path={["effect"]}
				context={context}
			/>
			<output data-testid="value">{JSON.stringify(value)}</output>
			<output data-testid="world-effects">{JSON.stringify(worldEffects)}</output>
		</>
	);
}

describe("EffectEditor", () => {
	it("edits a complete group and excludes inline group children", () => {
		render(<StatefulEffectEditor />);

		expect(screen.getByText("Outcome")).toBeInTheDocument();
		expect(screen.getByRole("textbox", {name: "Group name"})).toHaveValue("Open the gate");
		expect(screen.queryByText("Group ID")).not.toBeInTheDocument();
		expect(screen.getByRole("button", {name: "Add effect"})).toBeInTheDocument();
		expect(screen.queryByRole("option", {name: "Group"})).not.toBeInTheDocument();
	});

	it("always saves the whole group to world.effects", () => {
		render(<StatefulEffectEditor />);

		expect(screen.getByTestId("value")).toHaveTextContent('"type":"group"');
		expect(screen.getByTestId("world-effects")).toHaveTextContent('"name":"Open the gate"');
		expect(screen.getByTestId("world-effects")).toHaveTextContent('"message":"The gate opens."');
		expect(screen.queryByText("Saved in world effects")).not.toBeInTheDocument();
		expect(screen.queryByText("1 effect")).not.toBeInTheDocument();
		expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
	});

	it("hands a new group an internal ID without exposing an ID field", () => {
		render(<StatefulEffectEditor withoutId />);

		expect(screen.getByTestId("value")).toHaveTextContent(
			/"id":\{"type":"effect","id":"effect-[^"]+"\}/,
		);
		expect(screen.queryByText("Group ID")).not.toBeInTheDocument();
	});

	it("generates a name from the effects until the name is customized", () => {
		render(<StatefulEffectEditor withoutName />);

		const nameInput = screen.getByRole("textbox", {name: "Group name"});
		const messageInput = screen.getByRole("textbox", {name: "Message"});
		expect(nameInput).toHaveValue("Show message The gate opens.");

		fireEvent.change(messageInput, {target: {value: "The gate closes."}});
		expect(nameInput).toHaveValue("Show message The gate closes.");

		fireEvent.change(nameInput, {target: {value: "Close the gate"}});
		fireEvent.change(messageInput, {target: {value: "The gate slams shut."}});
		expect(nameInput).toHaveValue("Close the gate");
		expect(screen.getByTestId("world-effects")).toHaveTextContent('"name":"Close the gate"');

		fireEvent.change(nameInput, {target: {value: ""}});
		expect(nameInput).toHaveValue("");

		fireEvent.click(screen.getByRole("button", {name: "Clear"}));
		expect(nameInput).toHaveValue("Show message The gate slams shut.");
	});
});
