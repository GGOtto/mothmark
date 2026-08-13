import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import type {EditorRegistries} from "../../types/editor/editorRegistryTypes";
import type {EditorControlContext} from "../../types/universalEditorTypes";
import {EffectSchema} from "../../schemas/world/effectSchema";
import {createDefaultFieldObject} from "../../utils/createDefaultFieldObject";
import {toID} from "../../utils/idUtils";
import {EffectListEditor, type EffectListControlMetadata} from "./EffectListEditor";
import {findEditorSchemaVariant} from "./utils/editorSchemaVariants";
import {PopupProvider} from "@/components/popup/Popup";

const metadata: EffectListControlMetadata = {
	type: "effect-list",
	title: "Effects",
	features: {
		effectSchema: EffectSchema,
	},
};

function EffectListHarness({
	initialValue,
	initialWorldEffects = [],
	embeddedGroups = [],
}: {
	initialValue: Record<string, unknown>[];
	initialWorldEffects?: Record<string, unknown>[];
	embeddedGroups?: Record<string, unknown>[];
}) {
	const [value, setValue] = useState(initialValue);
	const [worldEffects, setWorldEffects] = useState<Record<string, unknown>[]>(initialWorldEffects);
	const context: EditorControlContext = {
		mode: "edit",
		registries: {} as EditorRegistries,
		getValue: () => undefined,
		setValue: () => undefined,
		getWorldValue: (path) =>
			path.length === 0
				? {effects: worldEffects, commands: embeddedGroups}
				: path[0] === "effects"
					? worldEffects
					: undefined,
		setWorldValue: (path, nextValue) => {
			if (path[0] === "effects" && Array.isArray(nextValue)) {
				setWorldEffects(nextValue as Record<string, unknown>[]);
			}
		},
	};

	return (
		<PopupProvider>
			<EffectListEditor
				value={value}
				onChange={setValue}
				metadata={metadata}
				path={["effects"]}
				context={context}
			/>
			<output data-testid="value">{JSON.stringify(value)}</output>
			<output data-testid="world-effects">{JSON.stringify(worldEffects)}</output>
		</PopupProvider>
	);
}

describe("EffectListEditor", () => {
	it("shows unset optional fields for the selected operation", () => {
		render(<EffectListHarness initialValue={[{type: "player", operation: "freeze"}]} />);

		expect(screen.getByRole("textbox", {name: "Freeze message"})).toHaveValue("");
		expect(screen.getByRole("textbox", {name: "Freeze message"})).toHaveAttribute(
			"placeholder",
			"Optional message while frozen",
		);
		expect(screen.getByRole("spinbutton", {name: "Turns"})).toHaveValue(null);
		expect(screen.getByRole("spinbutton", {name: "Turns"})).toHaveAttribute(
			"placeholder",
			"No turn limit",
		);
	});

	it("preserves schema-derived options for variant select fields", () => {
		const appendMessageSchema = findEditorSchemaVariant(EffectSchema, {
			type: "message",
			operation: "append-to-last",
		})?.schema;
		expect(appendMessageSchema).toBeDefined();
		const appendMessage = createDefaultFieldObject(appendMessageSchema!);
		if (!appendMessage || typeof appendMessage !== "object" || Array.isArray(appendMessage)) {
			throw new Error("Expected an object default for the append-message effect schema.");
		}
		render(
			<EffectListHarness
				initialValue={[
					{
						...appendMessage,
						message: "The passage continues east.",
					},
				]}
			/>,
		);

		expect(screen.getByRole("option", {name: "Inline"})).toBeInTheDocument();
		expect(screen.getByRole("option", {name: "Newline"})).toBeInTheDocument();
	});

	it("does not offer inline groups as child effects", () => {
		render(
			<EffectListHarness
				initialValue={[
					{
						type: "message",
						operation: "show",
						message: "One",
					},
				]}
			/>,
		);
		fireEvent.click(screen.getByRole("button", {name: "Add effect"}));

		expect(screen.queryByRole("option", {name: "Group"})).not.toBeInTheDocument();
		expect(screen.queryByRole("option", {name: "Use saved effect"})).not.toBeInTheDocument();
		expect(screen.getByRole("heading", {name: "Choose an effect"})).toBeInTheDocument();
	});

	it("offers explicit reusable groups with a summary of their effects", () => {
		render(
			<EffectListHarness
				initialValue={[]}
				initialWorldEffects={[
					{
						type: "group",
						id: toID("effect", "open-gate"),
						name: "Open the gate",
						effects: [{type: "message", operation: "show", message: "The gate opens."}],
						allowMultipleUsesInWorld: true,
					},
				]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", {name: "Add effect"}));

		expect(screen.getByRole("option", {name: /Open the gate/})).toBeInTheDocument();
		expect(screen.getAllByText("Show a message The gate opens.").length).toBeGreaterThan(0);
		expect(screen.queryByText("Unknown effect")).not.toBeInTheDocument();
	});

	it("hides legacy copies of embedded outcome groups from reusable choices", () => {
		const embeddedGroup = {
			type: "group",
			id: toID("effect", "command-1-always"),
			name: "Always",
			effects: [{type: "message", operation: "show", message: "That does not work."}],
			allowMultipleUsesInWorld: true,
		};
		render(
			<EffectListHarness
				initialValue={[]}
				initialWorldEffects={[embeddedGroup]}
				embeddedGroups={[{behavior: {always: embeddedGroup}}]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", {name: "Add effect"}));

		expect(screen.queryByRole("option", {name: /^Always/})).not.toBeInTheDocument();
		expect(screen.queryByText("Unknown effect")).not.toBeInTheDocument();
	});

	it("keeps reuse controls off concrete child effects", () => {
		render(
			<EffectListHarness
				initialValue={[
					{
						type: "message",
						operation: "show",
						message: "A bell rings.",
					},
				]}
			/>,
		);

		expect(screen.queryByRole("checkbox", {name: "Use multiple times"})).not.toBeInTheDocument();
		expect(screen.getByTestId("world-effects")).toHaveTextContent("[]");
	});
});
