import {fireEvent, render, screen, within} from "@testing-library/react";
import {useState} from "react";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {
	CounterConditionSchema,
	FlagConditionSchema,
	TextConditionSchema,
} from "@/schemas/world/conditionSchema";
import {ItemActionEffectSchema} from "@/schemas/world/effectSchema";
import {
	CommandConditionSchema,
	CommandEffectGroupSchema,
} from "@/schemas/world/commandLogicSchemas";
import type {CommandVariableCatalog} from "./model";
import {UniversalEditor} from "@/components/universal-editor/UniversalEditor";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {produce} from "immer";
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
			entityTypes: ["item"],
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
		{
			blockId: toID("command-block", "direction-block"),
			blockType: "direction",
			label: "route",
			valueType: "direction",
		},
		{
			blockId: toID("command-block", "text-block"),
			blockType: "text",
			label: "note",
			valueType: "string",
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

function UnavailableTypedHarness() {
	const schema = editor.object({
		type: z.literal("values"),
		flagValue: editor.boolean({title: "Flag value", commandVariableType: "boolean"}),
		counterValue: editor.number({title: "Counter value", commandVariableType: "number"}),
		textValue: editor.textarea({title: "Text value", commandVariableType: "string"}),
	});
	const [value, setValue] = useState(() => ({
		...createDefaultFieldObject(schema),
		flagValue: true,
		counterValue: 1,
		textValue: "",
	}));
	return (
		<UniversalEditor
			schema={schema}
			value={value}
			onChange={setValue}
			commandVariableCatalog={{options: []}}
		/>
	);
}

function EntityHarness() {
	const schema = ItemActionEffectSchema;
	const [value, setValue] = useState<Record<string, unknown>>({
		type: "item-action",
		action: "take",
		itemId: toID("item", "torch"),
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

function DirectionConditionHarness() {
	const schema = editor.conditionControl(CommandConditionSchema, {
		title: "Condition",
		features: {navigateChildEditors: false, reuseWorldConditions: false},
	});
	const [value, setValue] = useState({
		type: "group" as const,
		operation: "all" as const,
		conditions: [
			{
				type: "current-room",
				operation: "is-exit-open",
				direction: "n",
			},
		],
	});
	return (
		<>
			<UniversalEditor
				schema={schema}
				value={value}
				onChange={setValue}
				commandVariableCatalog={catalog}
			/>
			<output data-testid="direction-condition-value">{JSON.stringify(value)}</output>
		</>
	);
}

function ComparisonHarness() {
	const schema = editor.conditionControl(CommandConditionSchema, {
		title: "Condition",
		features: {navigateChildEditors: false, reuseWorldConditions: false},
	});
	const [value, setValue] = useState({
		type: "group" as const,
		operation: "all" as const,
		conditions: [
			{
				type: "comparison" as const,
				valueType: "number" as const,
				operator: "eq" as const,
				left: {source: "counter" as const, counter: "turns"},
				right: {source: "literal" as const, value: 1},
			},
		],
	});
	return (
		<>
			<UniversalEditor
				schema={schema}
				value={value}
				onChange={setValue}
				commandVariableCatalog={catalog}
			/>
			<output data-testid="comparison-value">{JSON.stringify(value)}</output>
		</>
	);
}

function FlagConditionHarness() {
	const schema = editor.conditionControl(CommandConditionSchema, {
		title: "Condition",
		features: {navigateChildEditors: false, reuseWorldConditions: false},
	});
	const [value, setValue] = useState(() => ({
		type: "group" as const,
		operation: "all" as const,
		conditions: [
			CommandConditionSchema.parse({
				...createDefaultFieldObject(FlagConditionSchema),
				type: "flag",
				operation: "is",
				flag: "ready",
				value: true,
			}),
		],
	}));
	return (
		<>
			<UniversalEditor
				schema={schema}
				value={value}
				onChange={setValue}
				commandVariableCatalog={catalog}
			/>
			<output data-testid="flag-condition-value">{JSON.stringify(value)}</output>
		</>
	);
}

function TextConditionHarness() {
	const schema = editor.conditionControl(CommandConditionSchema, {
		title: "Condition",
		features: {navigateChildEditors: false, reuseWorldConditions: false},
	});
	const [value, setValue] = useState(() => ({
		type: "group" as const,
		operation: "all" as const,
		conditions: [
			CommandConditionSchema.parse({
				...createDefaultFieldObject(TextConditionSchema),
				type: "text",
				operation: "contains",
				text: "answer",
				value: "moth",
			}),
		],
	}));
	const world = produce(createDefaultFieldObject(WorldSchema), (draft) => {
		draft.initialState.texts = [{text: "answer", value: "moth"}];
	});
	return (
		<>
			<UniversalEditor
				schema={schema}
				value={value}
				onChange={setValue}
				world={world}
				commandVariableCatalog={catalog}
			/>
			<output data-testid="text-condition-value">{JSON.stringify(value)}</output>
		</>
	);
}

function DirectionEffectHarness() {
	const [value, setValue] = useState(() => ({
		...createDefaultFieldObject(CommandEffectGroupSchema),
		id: toID("effect", "direction-effect"),
		name: "Move player",
		effects: [{type: "player", operation: "move-in-direction", direction: "n"}],
	}));
	return (
		<>
			<UniversalEditor
				schema={CommandEffectGroupSchema}
				value={value}
				onChange={setValue}
				commandVariableCatalog={catalog}
			/>
			<output data-testid="direction-effect-value">{JSON.stringify(value)}</output>
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
		fireEvent.click(screen.getByRole("button", {name: "Insert command value"}));
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
		const trigger = screen.getByRole("button", {name: "Insert command value"});
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
		const menu = screen.getByRole("menu", {name: "Insert command value"});

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

	it("filters whole-field menus by type and lets an authored value replace the binding", () => {
		render(<TypedHarness />);
		const enabledField = screen.getByText("Enabled").closest(".objectEditor__field");
		expect(enabledField).not.toBeNull();
		fireEvent.click(
			within(enabledField as HTMLElement).getByRole("button", {name: "Use command value"}),
		);

		expect(screen.getByRole("menuitem", {name: "enabled"})).toBeVisible();
		expect(screen.queryByRole("menuitem", {name: "amount"})).toBeNull();
		expect(screen.queryByRole("menuitem", {name: /object/})).toBeNull();

		fireEvent.click(screen.getByRole("menuitem", {name: "enabled"}));
		expect(screen.getByText("Set a value to replace this variable.")).toBeVisible();
		expect(screen.getByRole("button", {name: "Remove variable"})).toBeVisible();
		expect(screen.queryByRole("button", {name: "Use fallback"})).toBeNull();
		expect(screen.getByTestId("value")).toHaveTextContent(
			'"commandVariables":[{"blockId":{"type":"command-block","id":"boolean-block"},"field":"enabled"}]',
		);

		fireEvent.click(screen.getByRole("switch", {name: "Choose value"}));
		expect(screen.getByTestId("value")).toHaveTextContent('"enabled":true');
		expect(screen.getByTestId("value")).not.toHaveTextContent("commandVariables");
	});

	it("explains which command block unlocks flag, counter, and text values", () => {
		render(<UnavailableTypedHarness />);

		const flagField = screen.getByText("Flag value").closest(".objectEditor__field");
		const counterField = screen.getByText("Counter value").closest(".objectEditor__field");
		const textField = screen.getByText("Text value").closest(".objectEditor__field");
		expect(flagField).not.toBeNull();
		expect(counterField).not.toBeNull();
		expect(textField).not.toBeNull();

		expect(
			within(flagField as HTMLElement).getByRole("button", {name: "Use command value"}),
		).toBeDisabled();
		expect(flagField).toHaveTextContent("Add a Boolean block to this command to use its value.");
		expect(
			within(counterField as HTMLElement).getByRole("button", {name: "Use command value"}),
		).toBeDisabled();
		expect(counterField).toHaveTextContent("Add a Number block to this command to use its value.");
		expect(
			within(textField as HTMLElement).getByRole("button", {name: "Insert command value"}),
		).toBeDisabled();
		expect(textField).toHaveTextContent("Add a command block to insert its raw text.");
	});

	it("keeps a bound entity picker in the normal field flow", () => {
		render(<EntityHarness />);
		const itemField = screen.getByText("Item").closest(".objectEditor__field");
		expect(itemField).not.toBeNull();

		fireEvent.click(
			within(itemField as HTMLElement).getByRole("button", {name: "Use command value"}),
		);
		fireEvent.click(screen.getByRole("menuitem", {name: "object entity"}));

		expect(itemField?.querySelector(".variableFieldEditor--bound")).toBeInTheDocument();
		expect(within(itemField as HTMLElement).getByRole("button", {name: "Item"})).toBeVisible();
		expect(within(itemField as HTMLElement).getByRole("button", {name: "Change"})).toBeVisible();
		expect(
			within(itemField as HTMLElement).getByRole("button", {name: "Remove variable"}),
		).toBeVisible();
		expect(
			within(itemField as HTMLElement).getByRole("button", {name: "Remove variable"}),
		).not.toHaveTextContent("Remove variable");
		expect(screen.getByTestId("entity-value")).toHaveTextContent(
			'"commandVariables":[{"blockId":{"type":"command-block","id":"target-block"},"field":"itemId"}]',
		);
	});

	it("binds compatible variables to fields inside a condition", () => {
		render(<ConditionHarness />);
		expect(screen.queryByRole("combobox", {name: "Reusable world condition"})).toBeNull();
		expect(screen.getByRole("combobox", {name: "Operation"})).toBeVisible();
		expect(screen.getByRole("combobox", {name: "Counter"})).toBeVisible();
		const valueField = screen
			.getByRole("spinbutton", {name: "Value"})
			.closest(".variableFieldEditor");
		expect(valueField).not.toBeNull();

		fireEvent.click(
			within(valueField as HTMLElement).getByRole("button", {name: "Use command value"}),
		);

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

	it("offers a number command value beside the saved counter picker", () => {
		render(<ConditionHarness />);
		const counterField = screen
			.getByRole("combobox", {name: "Counter"})
			.closest(".variableFieldEditor");
		expect(counterField).not.toBeNull();

		fireEvent.click(
			within(counterField as HTMLElement).getByRole("button", {name: "Use command value"}),
		);
		fireEvent.click(screen.getByRole("menuitem", {name: "amount"}));

		expect(screen.getByTestId("condition-value")).toHaveTextContent(
			'"commandVariables":[{"blockId":{"type":"command-block","id":"number-block"},"field":"counter"}]',
		);
	});

	it("offers saved counters and command numbers as comparison operands", () => {
		render(<ComparisonHarness />);
		expect(screen.getByRole("combobox", {name: "Left value"})).toHaveValue("counter");
		expect(screen.getByRole("combobox", {name: "Saved counter"})).toBeVisible();
		const rightField = screen
			.getByRole("combobox", {name: "Right value"})
			.closest(".variableFieldEditor");
		expect(rightField).not.toBeNull();

		fireEvent.click(
			within(rightField as HTMLElement).getByRole("button", {name: "Use command value"}),
		);
		fireEvent.click(screen.getByRole("menuitem", {name: "amount"}));

		expect(screen.getByTestId("comparison-value")).toHaveTextContent(
			'"commandVariables":[{"blockId":{"type":"command-block","id":"number-block"},"field":"right"}]',
		);
	});

	it("binds a boolean command value to an is flag condition", () => {
		render(<FlagConditionHarness />);
		const valueField = screen.getByRole("switch", {name: "True"}).closest(".variableFieldEditor");
		expect(valueField).not.toBeNull();

		fireEvent.click(
			within(valueField as HTMLElement).getByRole("button", {name: "Use command value"}),
		);
		fireEvent.click(screen.getByRole("menuitem", {name: "enabled"}));

		expect(screen.getByTestId("flag-condition-value")).toHaveTextContent(
			'"commandVariables":[{"blockId":{"type":"command-block","id":"boolean-block"},"field":"value"}]',
		);
	});

	it("offers a boolean command value beside the saved flag picker", () => {
		render(<FlagConditionHarness />);
		const flagField = screen.getByRole("combobox", {name: "Flag"}).closest(".variableFieldEditor");
		expect(flagField).not.toBeNull();

		fireEvent.click(
			within(flagField as HTMLElement).getByRole("button", {name: "Use command value"}),
		);
		fireEvent.click(screen.getByRole("menuitem", {name: "enabled"}));

		expect(screen.getByTestId("flag-condition-value")).toHaveTextContent(
			'"commandVariables":[{"blockId":{"type":"command-block","id":"boolean-block"},"field":"flag"}]',
		);
	});

	it("offers saved text and a text command value in the text condition subject", () => {
		render(<TextConditionHarness />);
		const picker = screen.getByRole("combobox", {name: "Text variable"});
		expect(picker).toHaveValue("answer");
		expect(within(picker).getByRole("option", {name: "answer"})).toBeInTheDocument();
		const textField = picker.closest(".variableFieldEditor");
		expect(textField).not.toBeNull();

		fireEvent.click(
			within(textField as HTMLElement).getByRole("button", {name: "Use command value"}),
		);
		fireEvent.click(screen.getByRole("menuitem", {name: "note"}));

		expect(screen.getByTestId("text-condition-value")).toHaveTextContent(
			'"commandVariables":[{"blockId":{"type":"command-block","id":"text-block"},"field":"text"}]',
		);
	});

	it.each([
		["condition", DirectionConditionHarness, "direction-condition-value"],
		["effect", DirectionEffectHarness, "direction-effect-value"],
	])("binds available direction variables inside a %s", (_, Harness, outputTestId) => {
		render(<Harness />);
		const directionField = screen
			.getByRole("combobox", {name: "Direction"})
			.closest(".variableFieldEditor");
		expect(directionField).not.toBeNull();

		fireEvent.click(
			within(directionField as HTMLElement).getByRole("button", {name: "Use command value"}),
		);
		expect(screen.getByRole("menuitem", {name: "route"})).toBeVisible();
		expect(screen.queryByRole("menuitem", {name: "amount"})).toBeNull();

		fireEvent.click(screen.getByRole("menuitem", {name: "route"}));
		expect(screen.getByTestId(outputTestId)).toHaveTextContent(
			'"commandVariables":[{"blockId":{"type":"command-block","id":"direction-block"},"field":"direction"}]',
		);
		expect(screen.getByRole("combobox", {name: "Direction"})).toHaveValue("");

		fireEvent.change(screen.getByRole("combobox", {name: "Direction"}), {
			target: {value: "e"},
		});
		expect(screen.getByTestId(outputTestId)).toHaveTextContent('"direction":"e"');
		expect(screen.getByTestId(outputTestId)).not.toHaveTextContent("commandVariables");
	});
});
