import {fireEvent, render, screen} from "@testing-library/react";
import {produce, type Draft} from "immer";
import {world as exampleWorld} from "@/data/worlds/exampleWorld";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";
import type {WorldUpdate} from "@/types/worldUpdaterTypes";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue, toID} from "@/utils/idUtils";
import {LogicEditor, LogicHome} from "./LogicEditor";

function createWorld(recipe: (draft: Draft<World>) => void): World {
	const configuredWorld = produce(exampleWorld, recipe);
	return {...createDefaultFieldObject(WorldSchema), ...configuredWorld};
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
