import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import {
	ConditionSchema,
	WorldConditionSchema,
	type Condition,
} from "@/schemas/world/conditionSchema";
import {CommandConditionSchema} from "@/schemas/world/commandLogicSchemas";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {UniversalEditor} from "./UniversalEditor";

const schema = editor.conditionControl(ConditionSchema, {title: "Condition"});
const commandSchema = editor.conditionControl(CommandConditionSchema, {title: "Command condition"});

function StatefulConditionEditor() {
	const [value, setValue] = useState<Condition>({
		type: "group",
		operation: "all",
		conditions: [
			{
				type: "world",
				operation: "flag-is",
				flag: "door-open",
				value: true,
			},
		],
	});

	return <UniversalEditor schema={schema} value={value} onChange={setValue} />;
}

function StatefulCommandConditionEditor() {
	const [value, setValue] = useState<Record<string, unknown>>(() => ({
		...createDefaultFieldObject(commandSchema),
		conditions: [{...createDefaultFieldObject(WorldConditionSchema), flag: "door-open"}],
	}));

	return <UniversalEditor schema={commandSchema} value={value} onChange={setValue} />;
}

describe("ConditionBuilderEditor", () => {
	it("opens a condition from a group for editing", () => {
		jest.spyOn(window, "scrollTo").mockImplementation(() => undefined);
		render(<StatefulConditionEditor />);

		fireEvent.click(screen.getByRole("button", {name: /Edit/}));
		expect(screen.getByRole("button", {name: "Back to conditions"})).toBeInTheDocument();
		expect(screen.getByRole("heading", {name: "World state 1"})).toBeInTheDocument();
	});

	it("derives command condition options from the command condition schema", () => {
		jest.spyOn(window, "scrollTo").mockImplementation(() => undefined);
		render(<StatefulCommandConditionEditor />);

		fireEvent.click(screen.getByRole("button", {name: /Edit/}));
		expect(screen.getByRole("button", {name: /Condition .* Change/})).toBeInTheDocument();
		expect(screen.queryByRole("combobox", {name: "Type"})).not.toBeInTheDocument();
	});
});
