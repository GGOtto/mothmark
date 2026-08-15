import {fireEvent, render, screen, within} from "@testing-library/react";
import {useState} from "react";
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
	options: {
		selectedId?: string | null;
		onDone?: (selectedId: string) => void;
		onOpenUsage?: jest.Mock;
	} = {},
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
			onOpenUsage={options.onOpenUsage}
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
		fireEvent.click(screen.getByRole("button", {name: "Conditions"}));
		fireEvent.change(screen.getByRole("searchbox", {name: "Search conditions"}), {
			target: {value: "outside-with-shovel"},
		});
		expect(document.querySelectorAll(".logicLibraryList > button")).toHaveLength(1);

		fireEvent.change(screen.getByRole("searchbox", {name: "Search conditions"}), {
			target: {value: "does not exist"},
		});
		expect(screen.getByText("No matching conditions")).toBeInTheDocument();
	});

	it("searches parents and inline groups with schema discovery metadata", () => {
		renderWorkspace("condition");
		const search = screen.getByRole("searchbox", {name: "Search conditions"});

		fireEvent.change(search, {target: {value: "within reach"}});
		expect(screen.getByRole("button", {name: /Take .*condition/})).toBeVisible();
		expect(screen.queryByRole("button", {name: /Travel .*condition/})).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", {name: "Conditions"}));
		expect(screen.getByRole("button", {name: /Take · If condition/})).toBeVisible();
	});

	it("searches effect metadata such as situations and author notes", () => {
		renderWorkspace("effect");
		const search = screen.getByRole("searchbox", {name: "Search effects"});

		fireEvent.change(search, {target: {value: "pick up a reward"}});
		expect(screen.getByRole("button", {name: /Take .*effect/})).toBeVisible();

		fireEvent.click(screen.getByRole("button", {name: "Effects"}));
		expect(screen.getByRole("button", {name: /Take · Take item/})).toBeVisible();
	});

	it("opens a parent detail without navigating until See Command is used", () => {
		const onOpenUsage = jest.fn();
		renderWorkspace("condition", {onOpenUsage});

		expect(screen.getByRole("heading", {name: "By parent"})).toBeVisible();
		const takeButton = screen.getByRole("button", {name: /Take .*condition/});
		fireEvent.click(takeButton);

		expect(screen.getByRole("heading", {name: "Take"})).toBeVisible();
		expect(document.querySelectorAll(".logicOccurrenceList > button").length).toBeGreaterThan(0);
		expect(onOpenUsage).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", {name: "See Command"}));
		expect(onOpenUsage).toHaveBeenCalledWith(
			expect.objectContaining({kind: "command", label: "Take"}),
		);
	});

	it("opens inline parent logic in a focused editor and returns to the parent detail", () => {
		renderWorkspace("condition");
		fireEvent.click(screen.getByRole("button", {name: /Take .*condition/}));
		const occurrenceList = document.querySelector(".logicOccurrenceList");
		expect(occurrenceList).not.toBeNull();
		const occurrenceButtons = within(occurrenceList as HTMLElement).getAllByRole("button");

		fireEvent.click(occurrenceButtons[0]!);

		expect(screen.getByRole("button", {name: "Save"})).toBeEnabled();
		expect(screen.queryByRole("button", {name: "See Command"})).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", {name: /Back Take/}));
		expect(screen.getByRole("button", {name: "See Command"})).toBeVisible();
	});

	it("switches to saved-condition view and opens a saved condition directly", () => {
		function StatefulWorkspace() {
			const [selectedId, setSelectedId] = useState<string | null>(null);
			return (
				<LogicLibraryWorkspace
					kind="condition"
					world={libraryWorld()}
					updateWorld={jest.fn()}
					selectedId={selectedId}
					onSelectedIdChange={setSelectedId}
					onBackToLogic={jest.fn()}
				/>
			);
		}
		render(<StatefulWorkspace />);

		fireEvent.click(screen.getByRole("button", {name: "Conditions"}));
		fireEvent.click(screen.getByRole("button", {name: /Outside with a shovel/}));

		expect(screen.getByRole("heading", {name: "Outside with a shovel"})).toBeVisible();
		expect(screen.getByRole("button", {name: "Save"})).toBeEnabled();
	});

	it("shows inline groups in Conditions and opens the group editor directly", () => {
		const world = produce(initialWorld, (draft) => {
			draft.conditions = [];
		});
		render(
			<LogicLibraryWorkspace
				kind="condition"
				world={world}
				updateWorld={jest.fn()}
				selectedId={null}
				onSelectedIdChange={jest.fn()}
				onBackToLogic={jest.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole("button", {name: "Conditions"}));
		const takeGroup = screen.getByRole("button", {name: /Take · If condition/});
		expect(takeGroup).toBeVisible();
		fireEvent.click(takeGroup);

		expect(screen.getByText("Group logic")).toBeVisible();
		expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", {name: /Back/}));
		expect(screen.getByRole("button", {name: /Take · If condition/})).toBeVisible();
	});

	it("shows inline groups alongside saved and unused effects", () => {
		const world = produce(initialWorld, (draft) => {
			draft.effects = [];
		});
		const {container} = render(
			<LogicLibraryWorkspace
				kind="effect"
				world={world}
				updateWorld={jest.fn()}
				selectedId={null}
				onSelectedIdChange={jest.fn()}
				onBackToLogic={jest.fn()}
			/>,
		);

		fireEvent.click(screen.getByRole("button", {name: "Effects"}));
		const inlineGroups = container.querySelectorAll(".logicLibraryList > button");
		expect(inlineGroups.length).toBeGreaterThan(0);
		fireEvent.click(inlineGroups[0]!);

		expect(container.querySelector(".effectListEditor")).toBeInTheDocument();
		expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
	});

	it("offers parent, usage, alphabetical, and document-order sorting", () => {
		renderWorkspace("effect");
		const sort = screen.getByRole("combobox", {name: "Sort by"});

		expect(within(sort).getByRole("option", {name: "Parent type"})).toBeInTheDocument();
		expect(within(sort).getByRole("option", {name: "Most logic"})).toBeInTheDocument();
		expect(within(sort).getByRole("option", {name: "Recently added"})).toBeInTheDocument();
		expect(within(sort).getByRole("option", {name: "Least recently added"})).toBeInTheDocument();
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
