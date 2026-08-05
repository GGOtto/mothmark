import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import {ConditionSchema, type Condition} from "@/schemas/world/conditionSchema";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {UniversalEditor} from "./UniversalEditor";

const schema = editor.conditionControl(ConditionSchema, {title: "Condition"});

function StatefulConditionEditor() {
	const [value, setValue] = useState<Condition>({
		type: "group",
		operation: "all",
		conditions: [
			{
				type: "flag",
				"flag-type": "normal",
				operation: "true",
				flag: "door-open",
			},
		],
	});

	return <UniversalEditor schema={schema} value={value} onChange={setValue} />;
}

describe("ConditionBuilderEditor", () => {
	it("opens a condition from a group for editing", () => {
		jest.spyOn(window, "scrollTo").mockImplementation(() => undefined);
		render(<StatefulConditionEditor />);

		fireEvent.click(screen.getByRole("button", {name: /Edit/}));

		expect(screen.getByRole("button", {name: "Back to conditions"})).toBeInTheDocument();
		expect(screen.getByRole("heading", {name: "Flag 1"})).toBeInTheDocument();
	});
});
