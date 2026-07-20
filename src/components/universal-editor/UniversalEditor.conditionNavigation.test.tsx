import {fireEvent, render, screen} from "@testing-library/react";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {ConditionSchema} from "@/schemas/world/conditionSchema";
import type {World} from "@/schemas/world/worldSchema";
import {toID} from "@/utils/idUtils";
import {UniversalEditor} from "./UniversalEditor";

const conditionId = toID("condition", "gate-open");
const schema = editor.object({
	activeWhen: editor.conditionControl(ConditionSchema, {title: "Active When"}),
});

const world = {
	conditions: [
		{
			identity: conditionId,
			condition: {type: "flag", operation: "true", flag: "gate.open"},
		},
	],
	rooms: [],
	connections: [],
} as unknown as World;

describe("condition link navigation", () => {
	beforeEach(() => {
		jest.spyOn(window, "scrollTo").mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("opens a stored condition payload from a condition reference", () => {
		render(
			<UniversalEditor
				schema={schema}
				value={{
					activeWhen: {
						type: "group",
						operation: "all",
						conditions: [{type: "condition-ref", conditionId}],
					},
				}}
				onChange={() => undefined}
				world={world}
				updateWorld={() => undefined}
			/>,
		);

		fireEvent.click(screen.getByRole("button", {name: "Flag 1 gate.open true Edit"}));

		expect(screen.getByRole("button", {name: "Back to conditions"})).toBeInTheDocument();
		expect(screen.getByText("gate.open true")).toBeInTheDocument();
	});
});
