import {fireEvent, render, screen, within} from "@testing-library/react";
import {useState} from "react";
import {PopupProvider} from "@/components/popup/Popup";
import type {CommandVariableCatalog} from "@/features/command-variables";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {CounterConditionSchema} from "@/schemas/world/conditionSchema";
import {
	CommandConditionSchema,
	CommandEffectGroupSchema,
} from "@/schemas/world/commandLogicSchemas";
import {PlayerEffectSchema} from "@/schemas/world/effectSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {UniversalEditor} from "./UniversalEditor";

beforeEach(() => {
	window.scrollTo = jest.fn();
});

const commandVariables: CommandVariableCatalog = {
	options: [
		{
			blockId: toID("command-block", "number-block"),
			blockType: "number",
			label: "amount",
			valueType: "number",
		},
		{
			blockId: toID("command-block", "direction-block"),
			blockType: "direction",
			label: "direction",
			valueType: "direction",
		},
	],
};

function ConditionHarness() {
	const schema = editor.conditionControl(CommandConditionSchema, {
		title: "Allowed when",
		features: {navigateChildEditors: false, reuseWorldConditions: false},
	});
	const [value, setValue] = useState(() => ({
		...createDefaultFieldObject(schema),
		conditions: [
			{
				...createDefaultFieldObject(CounterConditionSchema),
				type: "counter",
				operation: "compare",
				counter: "turns",
				value: 1,
			},
		],
	}));

	return (
		<PopupProvider>
			<UniversalEditor
				schema={schema}
				value={value}
				onChange={setValue}
				commandVariableCatalog={commandVariables}
			/>
			<output data-testid="condition-value">{JSON.stringify(value)}</output>
		</PopupProvider>
	);
}

function EffectHarness() {
	const [value, setValue] = useState(() => ({
		...createDefaultFieldObject(CommandEffectGroupSchema),
		id: toID("effect", "movement"),
		name: "Move the player",
		effects: [
			{
				...createDefaultFieldObject(PlayerEffectSchema),
				type: "player",
				operation: "move-in-direction",
				direction: "n",
			},
		],
	}));

	return (
		<PopupProvider>
			<UniversalEditor
				schema={CommandEffectGroupSchema}
				value={value}
				onChange={setValue}
				commandVariableCatalog={commandVariables}
			/>
			<output data-testid="effect-value">{JSON.stringify(value)}</output>
		</PopupProvider>
	);
}

describe("LogicControlPopup", () => {
	it("turns a condition control into an activation button and keeps variable edits live", () => {
		render(<ConditionHarness />);

		expect(screen.queryByRole("combobox", {name: "Operation"})).toBeNull();
		fireEvent.click(screen.getByRole("button", {name: /Edit condition:/}));

		const dialog = screen.getByRole("dialog");
		expect(within(dialog).getByRole("heading", {name: "Edit condition"})).toBeVisible();
		fireEvent.click(within(dialog).getByRole("button", {name: /Edit/}));
		const valueField = within(dialog)
			.getByRole("spinbutton", {name: "Value"})
			.closest(".variableFieldEditor");
		expect(valueField).not.toBeNull();

		fireEvent.click(within(valueField as HTMLElement).getByRole("button", {name: "Use variable"}));
		fireEvent.click(screen.getByRole("menuitem", {name: "amount"}));

		expect(screen.getByTestId("condition-value")).toHaveTextContent(
			'"commandVariables":[{"blockId":{"type":"command-block","id":"number-block"},"field":"value"}]',
		);
	});

	it("opens an effect group in the same popup without nesting another activation button", () => {
		render(<EffectHarness />);

		expect(screen.queryByRole("combobox", {name: "Action"})).toBeNull();
		fireEvent.click(screen.getByRole("button", {name: /Edit effect:/}));

		const dialog = screen.getByRole("dialog");
		expect(within(dialog).getByRole("heading", {name: "Edit effect"})).toBeVisible();
		expect(within(dialog).getByRole("combobox", {name: "Action"})).toHaveValue("move-in-direction");
		expect(within(dialog).queryByRole("button", {name: /Edit effect:/})).toBeNull();

		const directionField = within(dialog)
			.getByRole("combobox", {name: "Direction"})
			.closest(".variableFieldEditor");
		expect(directionField).not.toBeNull();
		fireEvent.click(
			within(directionField as HTMLElement).getByRole("button", {name: "Use variable"}),
		);
		fireEvent.click(screen.getByRole("menuitem", {name: "direction"}));

		expect(screen.getByTestId("effect-value")).toHaveTextContent(
			'"commandVariables":[{"blockId":{"type":"command-block","id":"direction-block"},"field":"direction"}]',
		);
	});
});
