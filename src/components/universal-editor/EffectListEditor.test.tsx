import {render, screen} from "@testing-library/react";
import {useState} from "react";
import type {EditorRegistries} from "../../types/editor/editorRegistryTypes";
import type {EditorControlContext} from "../../types/universalEditorTypes";
import {EffectListEditor, type EffectListControlMetadata} from "./EffectListEditor";

const metadata: EffectListControlMetadata = {
	type: "effect-list",
	title: "Effects",
	features: {
		effectTypeOptions: [
			{label: "Message", value: "message"},
			{label: "Player", value: "player"},
			{label: "Group", value: "group"},
			{label: "Use saved effect", value: "effect-ref"},
		],
		operationOptionsByType: {
			message: [{label: "Show", value: "show"}],
			player: [
				{label: "Kill", value: "kill"},
				{label: "Teleport", value: "teleport"},
				{label: "Freeze", value: "freeze"},
				{label: "Unfreeze", value: "unfreeze"},
			],
		},
	},
	childControls: {
		effectType: {control: "select", title: "Effect type"},
		operator: {control: "select", title: "Action"},
		roomId: {control: "entity-picker", title: "Room"},
		message: {control: "textarea", title: "Message"},
		freezeMessage: {
			control: "input",
			title: "Freeze message",
			placeholder: "Optional message while frozen",
		},
		turns: {control: "number", title: "Turns", placeholder: "No turn limit"},
		mode: {
			control: "select",
			title: "Run",
			features: {
				options: [
					{label: "All effects", value: "all"},
					{label: "First effect", value: "first"},
					{label: "Last effect", value: "last"},
				],
			},
		},
		effects: {control: "effect-list", title: "Effects in group"},
		effectId: {control: "entity-picker", title: "Saved effect"},
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
