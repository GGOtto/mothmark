import {fireEvent, render, screen, within} from "@testing-library/react";
import {useState} from "react";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {CounterConditionSchema} from "@/schemas/world/conditionSchema";
import {CommandConditionSchema} from "@/schemas/world/commandLogicSchemas";
import type {CommandVariableCatalog} from "./model";
import {UniversalEditor} from "@/components/universal-editor/UniversalEditor";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {z} from "zod";

beforeEach(() => {
	window.scrollTo = jest.fn();
});

const catalog: CommandVariableCatalog = {
	options: [
		{
			blockId: toID("command-block", "target-block"),
			blockType: "target",
			label: "object",
			detail: "entity",
			valueType: "entity",
			entityTypes: ["feature"],
		},
		{
			blockId: toID("command-block", "target-block"),
			blockType: "target",
			label: "object",
			projection: "name",
			detail: "name",
			valueType: "string",
		},
		{
			blockId: toID("command-block", "boolean-block"),
			blockType: "boolean",
			label: "enabled",
			valueType: "boolean",
		},
		{
			blockId: toID("command-block", "number-block"),
			blockType: "number",
			label: "amount",
			valueType: "number",
		},
	],
};

function TextHarness() {
	const schema = editor.object({
		type: z.literal("message"),
		operation: z.literal("show"),
		message: editor.textarea({title: "Message"}),
	});
	const [value, setValue] = useState(() => ({
		...createDefaultFieldObject(schema),
		message: "Hello ",
	}));
	return (
		<>
			<UniversalEditor
				schema={schema}
				value={value}
				onChange={setValue}
				commandVariableCatalog={catalog}
			/>
			<output data-testid="value">{value.message}</output>
		</>
	);
}

function TypedHarness() {
	const schema = editor.object({
		type: z.literal("flag"),
		operation: z.literal("set"),
		enabled: editor.boolean({title: "Enabled"}).default(true),
		amount: editor.number({title: "Amount"}).default(1),
	});
	const [value, setValue] = useState<Record<string, unknown>>({
		...createDefaultFieldObject(schema),
		enabled: true,
		amount: 1,
	});
	return (
		<>
			<UniversalEditor
				schema={schema}
				value={value}
				onChange={setValue}
				commandVariableCatalog={catalog}
			/>
			<output data-testid="value">{JSON.stringify(value)}</output>
		</>
	);
}

function EntityHarness() {
	const schema = editor.object({
		type: z.literal("feature"),
		operation: z.literal("rename"),
		featureId: editor.reference("feature", {title: "Feature"}),
	});
	const [value, setValue] = useState<Record<string, unknown>>({
		...createDefaultFieldObject(schema),
		featureId: toID("feature", "torch"),
	});
	return (
		<>
			<UniversalEditor
				schema={schema}
				value={value}
				onChange={setValue}
				commandVariableCatalog={catalog}
			/>
			<output data-testid="entity-value">{JSON.stringify(value)}</output>
		</>
	);
}

function ConditionHarness() {
	const schema = editor.conditionControl(CommandConditionSchema, {
		title: "Condition",
		features: {navigateChildEditors: false, reuseWorldConditions: false},
	});
	const [value, setValue] = useState(() => {
		const leaf = CommandConditionSchema.parse({
			...createDefaultFieldObject(CounterConditionSchema),
			type: "counter",
			operation: "compare",
			counter: "turns",
			value: 1,
		});
		return {type: "group" as const, operation: "all" as const, conditions: [leaf]};
	});
	return (
		<>
			<UniversalEditor
				schema={schema}
				value={value}
				onChange={setValue}
				commandVariableCatalog={catalog}
			/>
			<output data-testid="condition-value">{JSON.stringify(value)}</output>
		</>
	);
}

describe("variable-aware editors", () => {
	it("keeps the caret where the browser left it after emitting text", () => {
		render(<TextHarness />);
		const textEditor = screen.getByRole("textbox", {name: "Message"});
		const textNode = textEditor.firstChild;
		expect(textNode).toBeInstanceOf(Text);

		textNode!.textContent = "Hello there";
		const selection = window.getSelection();
		const range = document.createRange();
		range.setStart(textNode!, 11);
		range.collapse(true);
		selection?.removeAllRanges();
		selection?.addRange(range);

		fireEvent.input(textEditor);

		expect(screen.getByTestId("value")).toHaveTextContent("Hello there");
		expect(selection?.anchorNode).toBe(textNode);
		expect(selection?.anchorOffset).toBe(11);
		expect(screen.queryByText("Variables stay linked when their labels change.")).toBeNull();
	});

	it("renders stored tokens as atomic colored chips and inserts stable syntax", () => {
		render(<TextHarness />);
		const editor = screen.getByRole("textbox", {name: "Message"});
		fireEvent.focus(editor);
		fireEvent.click(screen.getByRole("button", {name: "Insert variable"}));
		fireEvent.click(screen.getByRole("menuitem", {name: "object name"}));

		expect(screen.getByTestId("value")).toHaveTextContent("Hello {variable target-block name}");
		expect(editor.querySelector("[data-variable-token]")).toHaveTextContent("object · name");

		const selection = window.getSelection();
		const range = document.createRange();
		range.selectNodeContents(editor);
		selection?.removeAllRanges();
		selection?.addRange(range);
		const setData = jest.fn();
		fireEvent.copy(editor, {clipboardData: {setData}});
		expect(setData).toHaveBeenCalledWith("text/plain", "Hello {variable target-block name}");
	});

	it("renders the variable menu in a viewport-positioned portal", () => {
		render(<TextHarness />);
		const trigger = screen.getByRole("button", {name: "Insert variable"});
		jest.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
			x: 300,
			y: 370,
			left: 300,
			right: 410,
			top: 370,
			bottom: 396,
			width: 110,
			height: 26,
			toJSON: () => ({}),
		});
		const originalWidth = window.innerWidth;
		const originalHeight = window.innerHeight;
		Object.defineProperty(window, "innerWidth", {configurable: true, value: 320});
		Object.defineProperty(window, "innerHeight", {configurable: true, value: 400});

		fireEvent.click(trigger);
		const menu = screen.getByRole("menu", {name: "Insert variable"});

		expect(menu.parentElement).toBe(document.body);
		expect(trigger.parentElement).not.toContainElement(menu);
		expect(menu).toHaveStyle({position: "fixed", left: "58px", bottom: "36px", width: "250px"});

		Object.defineProperty(window, "innerWidth", {configurable: true, value: originalWidth});
		Object.defineProperty(window, "innerHeight", {configurable: true, value: originalHeight});
	});

	it("parses pasted stable syntax back into atomic chips", () => {
		render(<TextHarness />);
		const editor = screen.getByRole("textbox", {name: "Message"});
		fireEvent.paste(editor, {
			clipboardData: {getData: () => "{variable target-block name}"},
		});

		expect(screen.getByTestId("value")).toHaveTextContent("Hello {variable target-block name}");
		expect(editor.querySelector("[data-variable-token]")).toHaveTextContent("object · name");
	});

	it("shows an invalid chip when a stored token references a deleted block", () => {
		const schema = editor.object({
			type: z.literal("message"),
			operation: z.literal("show"),
			message: editor.textarea({title: "Message"}),
		});
		render(
			<UniversalEditor
				schema={schema}
				value={{
					...createDefaultFieldObject(schema),
					message: "{variable deleted-block name}",
				}}
				onChange={() => undefined}
				commandVariableCatalog={catalog}
			/>,
		);

		expect(screen.getByText("Unavailable variable")).toBeInTheDocument();
	});

	it("filters whole-field menus by type and keeps the authored fallback visible", () => {
		render(<TypedHarness />);
		const enabledField = screen.getByText("Enabled").closest(".objectEditor__field");
		expect(enabledField).not.toBeNull();
		fireEvent.click(within(enabledField as HTMLElement).getByRole("button", {name: "Use variable"}));

		expect(screen.getByRole("menuitem", {name: "enabled"})).toBeVisible();
		expect(screen.queryByRole("menuitem", {name: "amount"})).toBeNull();
		expect(screen.queryByRole("menuitem", {name: /object/})).toBeNull();

		fireEvent.click(screen.getByRole("menuitem", {name: "enabled"}));
		expect(screen.getByText("Used when the command has no value for this variable.")).toBeVisible();
		expect(screen.getByRole("button", {name: "Remove variable"})).toBeVisible();
		expect(screen.queryByRole("button", {name: "Use fallback"})).toBeNull();
		expect(screen.getByTestId("value")).toHaveTextContent(
			'"commandVariables":[{"blockId":{"type":"command-block","id":"boolean-block"},"field":"enabled"}]',
		);
	});

	it("keeps a bound entity picker in the normal field flow", () => {
		render(<EntityHarness />);
		const featureField = screen.getByText("Feature").closest(".objectEditor__field");
		expect(featureField).not.toBeNull();

		fireEvent.click(within(featureField as HTMLElement).getByRole("button", {name: "Use variable"}));
		fireEvent.click(screen.getByRole("menuitem", {name: "object entity"}));

		expect(featureField?.querySelector(".variableFieldEditor--bound")).toBeInTheDocument();
		expect(within(featureField as HTMLElement).getByRole("button", {name: "Feature"})).toBeVisible();
		expect(within(featureField as HTMLElement).getByRole("button", {name: "Change"})).toBeVisible();
		expect(
			within(featureField as HTMLElement).getByRole("button", {name: "Remove variable"}),
		).toBeVisible();
		expect(
			within(featureField as HTMLElement).getByRole("button", {name: "Remove variable"}),
		).not.toHaveTextContent("Remove variable");
		expect(screen.getByTestId("entity-value")).toHaveTextContent(
			'"commandVariables":[{"blockId":{"type":"command-block","id":"target-block"},"field":"featureId"}]',
		);
	});

	it("binds compatible variables to fields inside a condition", () => {
		render(<ConditionHarness />);
		expect(screen.queryByRole("combobox", {name: "Reusable world condition"})).toBeNull();
		expect(screen.getByRole("combobox", {name: "Operation"})).toBeVisible();
		expect(screen.getByRole("textbox", {name: "Counter"})).toBeVisible();
		const valueField = screen
			.getByRole("spinbutton", {name: "Value"})
			.closest(".variableFieldEditor");
		expect(valueField).not.toBeNull();

		fireEvent.click(within(valueField as HTMLElement).getByRole("button", {name: "Use variable"}));

		expect(screen.getByRole("menuitem", {name: "amount"})).toBeVisible();
		expect(screen.queryByRole("menuitem", {name: "enabled"})).toBeNull();
		expect(screen.queryByRole("menuitem", {name: /object/})).toBeNull();

		fireEvent.click(screen.getByRole("menuitem", {name: "amount"}));

		expect(screen.getByTestId("condition-value")).toHaveTextContent(
			'"commandVariables":[{"blockId":{"type":"command-block","id":"number-block"},"field":"value"}]',
		);
		expect(
			within(valueField as HTMLElement).getByRole("button", {name: "Remove variable"}),
		).toBeVisible();
	});
});
