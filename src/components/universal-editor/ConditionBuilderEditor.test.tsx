import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import {
	ConditionSchema,
	FlagConditionSchema,
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
				type: "flag",
				"flag-type": "normal",
				operation: "is",
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
		conditions: [{...createDefaultFieldObject(FlagConditionSchema), flag: "door-open"}],
	}));

	return <UniversalEditor schema={commandSchema} value={value} onChange={setValue} />;
}

describe("ConditionBuilderEditor", () => {
	it("opens a condition from a group for editing", () => {
		jest.spyOn(window, "scrollTo").mockImplementation(() => undefined);
		render(<StatefulConditionEditor />);

		fireEvent.click(screen.getByRole("button", {name: /Edit/}));

		expect(screen.getByRole("button", {name: "Back to conditions"})).toBeInTheDocument();
		expect(screen.getByRole("heading", {name: "Flag 1"})).toBeInTheDocument();
	});

	it("derives command condition options from the command condition schema", () => {
		jest.spyOn(window, "scrollTo").mockImplementation(() => undefined);
		render(<StatefulCommandConditionEditor />);

		fireEvent.click(screen.getByRole("button", {name: /Edit/}));

		expect(screen.getByRole("option", {name: "Flag"})).toBeInTheDocument();
		expect(screen.getByRole("option", {name: "Counter"})).toBeInTheDocument();
		expect(screen.getByRole("option", {name: "Comparison"})).toBeInTheDocument();
	});
});
