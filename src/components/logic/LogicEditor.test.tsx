import {fireEvent, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {produce, type Draft} from "immer";
import {PopupProvider} from "@/components/popup/Popup";
import {world as exampleWorld} from "@/data/worlds/exampleWorld";
import {ConditionWithEffectSchema} from "@/schemas/world/conditionBranchSchemas";
import {EffectGroupSchema} from "@/schemas/world/effectSchema";
import {EventSchema, type Event} from "@/schemas/world/eventSchema";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";
import type {WorldUpdate} from "@/types/worldUpdaterTypes";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue, toID} from "@/utils/idUtils";
import {LogicEditor, LogicHome, LogicToolbar} from "./LogicEditor";

function createWorld(recipe: (draft: Draft<World>) => void): World {
	const configuredWorld = produce(exampleWorld, recipe);
	return {...createDefaultFieldObject(WorldSchema), ...configuredWorld};
}

function createTestEvent(): Event {
	return produce(createDefaultFieldObject(EventSchema), (draft) => {
		draft.id = toID("event", "test-event");
		draft.name = "Test event";
		draft.branch.always = createTestEffectGroup("test-event-always", "Always");
	});
}

function createTestEffectGroup(id: string, name: string) {
	return produce(createDefaultFieldObject(EffectGroupSchema), (draft) => {
		draft.id = toID("effect", id);
		draft.name = name;
	});
}

function createTestConditionalBranch(id: string) {
	return produce(createDefaultFieldObject(ConditionWithEffectSchema), (draft) => {
		draft.effect = createTestEffectGroup(`${id}-effect`, id);
	});
}

describe("LogicHome", () => {
	it("offers the four logic tools", () => {
		render(<LogicHome onOpen={jest.fn()} />);

		expect(screen.getByText("Events")).toBeInTheDocument();
		expect(screen.getByText("Commands")).toBeInTheDocument();
		expect(screen.getByText("Build Complex Conditions")).toBeInTheDocument();
		expect(screen.getByText("Build Complex Effects")).toBeInTheDocument();
	});
});

describe("LogicEditor", () => {
	it("deletes the entire conditional chain when deleting If", async () => {
		const user = userEvent.setup();
		let world = createWorld((draft) => {
			const event = produce(createTestEvent(), (eventDraft) => {
				eventDraft.branch.if = createTestConditionalBranch("if");
				eventDraft.branch.elifs = [createTestConditionalBranch("else-if")];
				eventDraft.branch.else = createTestEffectGroup("else-effect", "Else");
			});
			draft.events = [event];
		});
		const updateWorld = jest.fn((update: WorldUpdate) => {
			world = typeof update === "function" ? produce(world, update) : update;
		});

		render(
			<PopupProvider>
				<LogicEditor
					world={world}
					updateWorld={updateWorld}
					selectedEventId="test-event"
					onSelectedEventIdChange={jest.fn()}
					selection={null}
					onSelectionChange={jest.fn()}
				/>
			</PopupProvider>,
		);

		await user.click(screen.getByRole("button", {name: "Delete If branch"}));

		expect(screen.getByText("Delete If and all dependent branches?")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Deleting If also deletes every Else if and Else branch from “Test event”. Always will be kept, and referenced effect groups will remain available.",
			),
		).toBeInTheDocument();

		await user.click(screen.getByRole("button", {name: "Delete branches"}));

		const branch = world.events?.[0].branch;
		expect(branch?.always).toBeDefined();
		expect(branch?.if).toBeUndefined();
		expect(branch?.elifs).toBeUndefined();
		expect(branch?.else).toBeUndefined();
	});

	it("confirms before deleting an individual branch", async () => {
		const user = userEvent.setup();
		let world = createWorld((draft) => {
			draft.events = [createTestEvent()];
		});
		const updateWorld = jest.fn((update: WorldUpdate) => {
			world = typeof update === "function" ? produce(world, update) : update;
		});

		render(
			<PopupProvider>
				<LogicEditor
					world={world}
					updateWorld={updateWorld}
					selectedEventId="test-event"
					onSelectedEventIdChange={jest.fn()}
					selection={null}
					onSelectionChange={jest.fn()}
				/>
			</PopupProvider>,
		);

		await user.click(screen.getByRole("button", {name: "Delete Always branch"}));

		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText("Delete always branch?")).toBeInTheDocument();
		expect(world.events?.[0].branch.always).toBeDefined();

		await user.click(screen.getByRole("button", {name: "Delete branch"}));

		expect(world.events?.[0].branch.always).toBeUndefined();
	});

	it("scrolls a newly added branch into view", () => {
		let world = createWorld((draft) => {
			draft.events = [createTestEvent()];
		});
		const updateWorld = jest.fn((update: WorldUpdate) => {
			world = typeof update === "function" ? produce(world, update) : update;
		});
		const view = render(
			<LogicEditor
				world={world}
				updateWorld={updateWorld}
				selectedEventId="test-event"
				onSelectedEventIdChange={jest.fn()}
				selection={null}
				onSelectionChange={jest.fn()}
			/>,
		);
		const tree = view.container.querySelector<HTMLElement>(".logicTree")!;
		const scrollTo = jest.fn();
		tree.scrollTo = scrollTo;

		fireEvent.click(screen.getByRole("button", {name: "If When a condition passes"}));
		view.rerender(
			<LogicEditor
				world={world}
				updateWorld={updateWorld}
				selectedEventId="test-event"
				onSelectedEventIdChange={jest.fn()}
				selection={null}
				onSelectionChange={jest.fn()}
			/>,
		);

		expect(scrollTo).toHaveBeenCalledWith({top: 0, behavior: "smooth"});
	});

	it("adds a saved one-effect group and stores its reference in the branch group", () => {
		let world = createWorld((draft) => {
			draft.effects = [];
			draft.events = [
				{
					id: toID("event", "test-event"),
					name: "Test event",
					enabled: true,
					disposable: false,
					wait: 0,
					priority: 0,
					lastSuccess: 0,
					branch: {
						id: toID("condition-branch", "test-event-branch"),
						always: {
							id: toID("effect", "test-event-always"),
							name: "Always",
							type: "group",
							effects: [],
							allowMultipleUsesInWorld: true,
						},
					},
				},
			];
		});
		const updateWorld = jest.fn((update: WorldUpdate) => {
			world = typeof update === "function" ? produce(world, update) : update;
		});
		const onSelectionChange = jest.fn();

		render(
			<LogicEditor
				world={world}
				updateWorld={updateWorld}
				selectedEventId="test-event"
				onSelectedEventIdChange={jest.fn()}
				selection={null}
				onSelectionChange={onSelectionChange}
			/>,
		);

		fireEvent.click(screen.getByRole("button", {name: "Add an effect"}));

		expect(world.effects).toHaveLength(1);
		expect(world.effects[0].effects).toEqual([{type: "message", operation: "show", message: ""}]);
		expect(world.events?.[0].branch.always?.effects).toEqual([
			{type: "effect-ref", effectId: toID("effect", idValue(world.effects[0].id))},
		]);
		expect(onSelectionChange).toHaveBeenCalledWith({
			kind: "effect-group",
			eventId: "test-event",
			effectId: idValue(world.effects[0].id),
		});
	});

	it("reorders branch effect-group references while dragging over another effect", () => {
		let world = createWorld((draft) => {
			draft.effects = [
				{
					id: toID("effect", "first"),
					name: "First",
					type: "group",
					effects: [{type: "message", operation: "show", message: "First"}],
					allowMultipleUsesInWorld: true,
				},
				{
					id: toID("effect", "second"),
					name: "Second",
					type: "group",
					effects: [{type: "message", operation: "show", message: "Second"}],
					allowMultipleUsesInWorld: true,
				},
			];
			draft.events = [
				{
					id: toID("event", "test-event"),
					name: "Test event",
					enabled: true,
					disposable: false,
					wait: 0,
					priority: 0,
					lastSuccess: 0,
					branch: {
						id: toID("condition-branch", "test-event-branch"),
						always: {
							id: toID("effect", "test-event-always"),
							name: "Always",
							type: "group",
							effects: [
								{type: "effect-ref", effectId: toID("effect", "first")},
								{type: "effect-ref", effectId: toID("effect", "second")},
							],
							allowMultipleUsesInWorld: true,
						},
					},
				},
			];
		});
		const updateWorld = jest.fn((update: WorldUpdate) => {
			world = typeof update === "function" ? produce(world, update) : update;
		});
		const {container} = render(
			<LogicEditor
				world={world}
				updateWorld={updateWorld}
				selectedEventId="test-event"
				onSelectedEventIdChange={jest.fn()}
				selection={null}
				onSelectionChange={jest.fn()}
			/>,
		);
		const rows = container.querySelectorAll(".logicEffectGroup");
		const dataTransfer = {
			effectAllowed: "",
			setData: jest.fn(),
		};

		fireEvent.dragStart(rows[0], {dataTransfer});
		fireEvent.dragOver(rows[1], {dataTransfer});

		expect(world.events?.[0].branch.always?.effects).toEqual([
			{type: "effect-ref", effectId: toID("effect", "second")},
			{type: "effect-ref", effectId: toID("effect", "first")},
		]);

		fireEvent.drop(rows[1], {dataTransfer});
	});
});

describe("LogicToolbar", () => {
	it("hides the event ID and confirms before deleting", async () => {
		const user = userEvent.setup();
		const event = createTestEvent();
		const onDelete = jest.fn();

		render(
			<PopupProvider>
				<LogicToolbar event={event} updateWorld={jest.fn()} onBack={jest.fn()} onDelete={onDelete} />
			</PopupProvider>,
		);

		expect(screen.queryByText("test-event")).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", {name: "Delete"}));

		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText("Delete event?")).toBeInTheDocument();
		expect(onDelete).not.toHaveBeenCalled();

		await user.click(screen.getByRole("button", {name: "Delete event"}));

		expect(onDelete).toHaveBeenCalledTimes(1);
	});
});
