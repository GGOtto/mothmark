import {fireEvent, render, screen} from "@testing-library/react";
import {produce} from "immer";
import {world as initialWorld} from "@/data/worlds/initialWorld";
import {DefaultConditionGroup, SavedConditionSchema} from "@/schemas/world/conditionSchema";
import {EffectGroupSchema} from "@/schemas/world/effectSchema";
import type {World} from "@/schemas/world/worldSchema";
import type {WorldUpdate} from "@/types/worldUpdaterTypes";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {LogicLibraryWorkspace} from "./LogicLibraryWorkspace";

function libraryWorld() {
	return produce(initialWorld, (draft) => {
		const condition = produce(createDefaultFieldObject(SavedConditionSchema), (conditionDraft) => {
			conditionDraft.identity = toID("condition", "outside-with-shovel");
			conditionDraft.name = "Outside with a shovel";
			conditionDraft.condition = DefaultConditionGroup;
		});
		draft.conditions = [condition];

		const effect = produce(createDefaultFieldObject(EffectGroupSchema), (effectDraft) => {
			effectDraft.id = toID("effect", "bury-item");
			effectDraft.name = "Bury an item";
		});
		draft.effects = [effect];
	});
}

function renderWorkspace(
	kind: "condition" | "effect",
	options: {selectedId?: string | null; onDone?: (selectedId: string) => void} = {},
) {
	let world: World = libraryWorld();
	let selectedId = options.selectedId ?? null;
	const updateWorld = (update: WorldUpdate) => {
		world = typeof update === "function" ? produce(world, update) : update;
	};
	const view = render(
		<LogicLibraryWorkspace
			kind={kind}
			world={world}
			updateWorld={updateWorld}
			selectedId={selectedId}
			onSelectedIdChange={(nextId) => {
				selectedId = nextId;
			}}
			onBackToLogic={jest.fn()}
			returnTo={
				options.onDone
					? {label: "Bury an item · Allowed when", onCancel: jest.fn(), onDone: options.onDone}
					: null
			}
		/>,
	);
	return {view, getWorld: () => world, getSelectedId: () => selectedId, updateWorld};
}

describe("LogicLibraryWorkspace", () => {
	beforeAll(() => {
		window.scrollTo = jest.fn();
	});

	it("searches the condition library by identifier and summary", () => {
		renderWorkspace("condition");

		expect(screen.getByRole("heading", {name: "Conditions"})).toBeInTheDocument();
		fireEvent.change(screen.getByRole("searchbox", {name: "Search conditions"}), {
			target: {value: "outside-with-shovel"},
		});
		expect(document.querySelectorAll(".logicLibraryList > button")).toHaveLength(1);

		fireEvent.change(screen.getByRole("searchbox", {name: "Search conditions"}), {
			target: {value: "does not exist"},
		});
		expect(screen.getByText("No matching conditions")).toBeInTheDocument();
	});

	it("creates a schema-backed reusable effect in the library", () => {
		const {getWorld, getSelectedId} = renderWorkspace("effect");

		fireEvent.click(screen.getByRole("button", {name: "New effect"}));

		expect(getWorld().effects).toHaveLength(1);
		expect(screen.getByRole("button", {name: "Save"})).toBeEnabled();
		fireEvent.click(screen.getByRole("button", {name: "Save"}));

		expect(getWorld().effects[1]).toMatchObject({name: "New effect", type: "group", effects: []});
		expect(getSelectedId()).toBeNull();
	});

	it("shows redirected navigation and saves the selected reusable entry", () => {
		const onDone = jest.fn();
		renderWorkspace("condition", {selectedId: "outside-with-shovel", onDone});

		expect(screen.getByText("Bury an item · Allowed when")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", {name: "Save"}));
		expect(onDone).toHaveBeenCalledWith("outside-with-shovel");
	});

	it("finishes a context-specific draft when no reusable entry is selected", () => {
		const onDone = jest.fn();
		const draft = createDefaultFieldObject(EffectGroupSchema);

		render(
			<LogicLibraryWorkspace
				kind="effect"
				world={libraryWorld()}
				updateWorld={jest.fn()}
				selectedId={null}
				onSelectedIdChange={jest.fn()}
				onBackToLogic={jest.fn()}
				returnTo={{
					label: "Say · Always effects",
					onCancel: jest.fn(),
					draftEditor: {schema: EffectGroupSchema, value: draft, onDone},
				}}
			/>,
		);

		expect(screen.getByRole("button", {name: "Save"})).toBeEnabled();
		fireEvent.click(screen.getByRole("button", {name: "Save"}));
		expect(onDone).toHaveBeenCalledWith(
			expect.objectContaining({type: "group", effects: [], allowMultipleUsesInWorld: true}),
		);
	});
});
