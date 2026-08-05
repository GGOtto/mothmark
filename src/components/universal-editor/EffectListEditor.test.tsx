import {render, screen} from "@testing-library/react";
import {useState} from "react";
import type {EditorRegistries} from "../../types/editor/editorRegistryTypes";
import type {EditorControlContext} from "../../types/universalEditorTypes";
import {EffectSchema} from "../../schemas/world/effectSchema";
import {createDefaultFieldObject} from "../../utils/createDefaultFieldObject";
import {EffectListEditor, type EffectListControlMetadata} from "./EffectListEditor";
import {findEditorSchemaVariant} from "./utils/editorSchemaVariants";

const metadata: EffectListControlMetadata = {
	type: "effect-list",
	title: "Effects",
	features: {
		effectSchema: EffectSchema,
	},
};

function EffectListHarness({initialValue}: {initialValue: Record<string, unknown>[]}) {
	const [value, setValue] = useState(initialValue);
	const [worldEffects, setWorldEffects] = useState<Record<string, unknown>[]>([]);
	const context: EditorControlContext = {
		mode: "edit",
		registries: {} as EditorRegistries,
		getValue: () => undefined,
		setValue: () => undefined,
		getWorldValue: (path) => (path[0] === "effects" ? worldEffects : undefined),
		setWorldValue: (path, nextValue) => {
			if (path[0] === "effects" && Array.isArray(nextValue)) {
				setWorldEffects(nextValue as Record<string, unknown>[]);
			}
		},
	};

	return (
		<>
			<EffectListEditor
				value={value}
				onChange={setValue}
				metadata={metadata}
				path={["effects"]}
				context={context}
			/>
			<output data-testid="value">{JSON.stringify(value)}</output>
			<output data-testid="world-effects">{JSON.stringify(worldEffects)}</output>
		</>
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
			operation: "append-last-message",
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

		expect(screen.queryByRole("option", {name: "Group"})).not.toBeInTheDocument();
		expect(screen.getByRole("option", {name: "Use saved effect"})).toBeInTheDocument();
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
