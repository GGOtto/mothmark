import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {useState} from "react";
import type {EditorRegistries} from "../../types/editor/editorRegistryTypes";
import type {EditorControlContext} from "../../types/universalEditorTypes";
import {toID} from "../../utils/idUtils";
import {EffectGroupSchema, EffectSchema} from "../../schemas/world/effectSchema";
import {CommandEffectGroupSchema} from "../../schemas/world/commandLogicSchemas";
import {PopupProvider} from "../popup/Popup";
import {EffectEditor, type EffectControlMetadata, type EffectGroupValue} from "./EffectEditor";
import {resolveEditorMetadata} from "./utils/resolveEditorMetadata";

const defaultMetadata: EffectControlMetadata = {
	type: "effect",
	title: "Outcome",
	features: {
		effectSchema: EffectSchema,
		showGeneratedSummary: true,
	},
	childControls: {
		name: {control: "input", title: "Group name"},
		id: {control: "hidden", title: "Group ID", hidden: true},
		effects: {control: "effect-list", title: "Effects"},
	},
};

function StatefulEffectEditor({
	withoutId = false,
	withoutName = false,
	emptyEffects = false,
	metadata = defaultMetadata,
}: {
	withoutId?: boolean;
	withoutName?: boolean;
	emptyEffects?: boolean;
	metadata?: EffectControlMetadata;
}) {
	const [value, setValue] = useState<EffectGroupValue>(() => ({
		type: "group",
		name: withoutName ? "" : "Open the gate",
		id: withoutId ? "" : toID("effect", "open-the-gate"),
		effects: emptyEffects ? [] : [{type: "message", operation: "show", message: "The gate opens."}],
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
		<PopupProvider>
			<EffectEditor
				value={value}
				onChange={(nextValue) => {
					if (nextValue) setValue(nextValue);
				}}
				metadata={metadata}
				path={["effect"]}
				context={context}
			/>
			<output data-testid="value">{JSON.stringify(value)}</output>
			<output data-testid="world-effects">{JSON.stringify(worldEffects)}</output>
		</PopupProvider>
	);
}

function OptionalEffectEditor() {
	const [value, setValue] = useState<EffectGroupValue | undefined>();
	return (
		<EffectEditor
			value={value}
			onChange={setValue}
			metadata={defaultMetadata}
			path={["optional-effect"]}
			context={{mode: "edit", getValue: () => undefined, setValue: () => undefined}}
		/>
	);
}

describe("EffectEditor", () => {
	it("offers to create an unset optional outcome instead of crashing", () => {
		render(<OptionalEffectEditor />);
		expect(screen.getByRole("button", {name: "Add outcome"})).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", {name: "Add outcome"}));
		expect(screen.getByRole("button", {name: "Add effect"})).toBeInTheDocument();
	});
	it("edits a complete group and excludes inline group children", () => {
		render(<StatefulEffectEditor />);

		expect(screen.getByText("Outcome")).toBeInTheDocument();
		expect(screen.getByRole("textbox", {name: "Group name"})).toHaveValue("Open the gate");
		expect(screen.queryByText("Group ID")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", {name: /Edit effect:/}));
		expect(screen.getByRole("button", {name: "Add effect"})).toBeInTheDocument();
		expect(screen.queryByRole("option", {name: "Group"})).not.toBeInTheDocument();
	});

	it("derives add options from the effects field in the real group schema", async () => {
		const schemaMetadata = resolveEditorMetadata(EffectGroupSchema) as EffectControlMetadata;
		render(<StatefulEffectEditor metadata={schemaMetadata} emptyEffects />);

		fireEvent.click(screen.getByRole("button", {name: /^Add effect:/}));
		fireEvent.click(screen.getByRole("button", {name: "Add effect"}));
		fireEvent.click(screen.getByRole("option", {name: /Show a message/}));
		fireEvent.click(screen.getByRole("button", {name: "Use effect"}));

		await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent('"type":"message"'));
	});

	it("derives command effect options from the command effect schema", async () => {
		const schemaMetadata = resolveEditorMetadata(CommandEffectGroupSchema) as EffectControlMetadata;
		render(<StatefulEffectEditor metadata={schemaMetadata} emptyEffects />);

		fireEvent.click(screen.getByRole("button", {name: /^Add effect:/}));
		fireEvent.click(screen.getByRole("button", {name: "Add effect"}));

		expect(screen.getByRole("button", {name: /Message \d+/})).toBeInTheDocument();
		expect(screen.getByRole("button", {name: /Player \d+/})).toBeInTheDocument();
		fireEvent.click(screen.getByRole("option", {name: /Show a message/}));
		fireEvent.click(screen.getByRole("button", {name: "Use effect"}));
		await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent('"type":"message"'));
	});

	it("keeps an embedded outcome out of world.effects", () => {
		render(<StatefulEffectEditor />);

		expect(screen.getByTestId("value")).toHaveTextContent('"type":"group"');
		expect(screen.getByTestId("world-effects")).toHaveTextContent("[]");
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
		fireEvent.click(screen.getByRole("button", {name: /Edit effect:/}));
		const messageInput = screen.getByRole("textbox", {name: "Message"});
		expect(nameInput).toHaveValue("Show a message The gate opens.");

		fireEvent.change(messageInput, {target: {value: "The gate closes."}});
		expect(nameInput).toHaveValue("Show a message The gate closes.");

		fireEvent.click(screen.getByRole("button", {name: "Done"}));
		fireEvent.change(nameInput, {target: {value: "Close the gate"}});
		fireEvent.click(screen.getByRole("button", {name: /Edit effect:/}));
		fireEvent.change(screen.getByRole("textbox", {name: "Message"}), {
			target: {value: "The gate slams shut."},
		});
		expect(nameInput).toHaveValue("Close the gate");
		expect(screen.getByTestId("world-effects")).toHaveTextContent("[]");

		fireEvent.click(screen.getByRole("button", {name: "Done"}));
		fireEvent.change(nameInput, {target: {value: ""}});
		expect(nameInput).toHaveValue("");

		fireEvent.click(screen.getByRole("button", {name: "Clear"}));
		expect(nameInput).toHaveValue("Show a message The gate slams shut.");
	});
});
