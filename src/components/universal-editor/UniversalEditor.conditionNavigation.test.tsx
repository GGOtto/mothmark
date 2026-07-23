import {fireEvent, render, screen} from "@testing-library/react";
import {world as exampleWorld} from "@/data/worlds/exampleWorld";
import {evaluateCondition} from "@/engine/conditions/evaluateCondition";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {ConditionSchema} from "@/schemas/world/conditionSchema";
import type {World} from "@/schemas/world/worldSchema";
import {toID} from "@/utils/idUtils";
import {getCondition} from "@/engine/utils/lookupUtils";
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

	it("creates typed condition references that runtime lookup can use immediately", () => {
		const onChange = jest.fn();
		const updateWorld = jest.fn();
		const emptyWorld = {...world, conditions: []};

		render(
			<UniversalEditor
				schema={schema}
				value={{
					activeWhen: {type: "group", operation: "all", conditions: []},
				}}
				onChange={onChange}
				world={emptyWorld}
				updateWorld={updateWorld}
			/>,
		);

		fireEvent.click(screen.getByRole("button", {name: "Add condition"}));

		const nextValue = onChange.mock.calls.at(-1)?.[0];
		const nextWorld = updateWorld.mock.calls.at(-1)?.[0] as World;
		expect(nextValue.activeWhen.conditions[0]).toEqual({
			type: "condition-ref",
			conditionId: toID("condition", "flag-1"),
		});
		expect(schema.safeParse(nextValue).success).toBe(true);
		expect(nextWorld.conditions[0].identity).toEqual(toID("condition", "flag-1"));
		expect(getCondition(nextWorld, nextValue.activeWhen.conditions[0].conditionId)).toEqual(
			nextWorld.conditions[0].condition,
		);
	});

	it("renders and edits current-room references as typed IDs", () => {
		const currentRoomConditionId = toID("condition", "from-room-3");
		const room3 = {...exampleWorld.rooms[0], id: toID("room", "room-3"), name: "Room 3"};
		const room4 = {...exampleWorld.rooms[1], id: toID("room", "room-4"), name: "Room 4"};
		const roomWorld: World = {
			...exampleWorld,
			startRoomId: room3.id,
			rooms: [room3, room4],
			connections: [],
			conditions: [
				{
					identity: currentRoomConditionId,
					condition: {type: "current-room", operation: "is", roomId: room3.id},
				},
			],
		};
		const updateWorld = jest.fn();
		const {container} = render(
			<UniversalEditor
				schema={schema}
				value={{
					activeWhen: {
						type: "group",
						operation: "all",
						conditions: [{type: "condition-ref", conditionId: currentRoomConditionId}],
					},
				}}
				onChange={() => undefined}
				world={roomWorld}
				updateWorld={updateWorld}
			/>,
		);

		expect(screen.getAllByText("current room is room-3").length).toBeGreaterThan(0);
		fireEvent.click(screen.getByRole("button", {name: "Current room 1 current room is room-3 Edit"}));

		const roomPicker = container.querySelector<HTMLSelectElement>(".entityPickerEditor__select");
		expect(roomPicker).toHaveValue("room-3");
		fireEvent.change(roomPicker!, {target: {value: "room-4"}});

		const nextWorld = updateWorld.mock.calls.at(-1)?.[0] as World;
		const nextCondition = nextWorld.conditions[0].condition;
		expect(nextCondition).toMatchObject({roomId: toID("room", "room-4")});
		expect(
			evaluateCondition(
				nextWorld,
				{
					player: {
						currentRoom: room4.id,
						turns: 0,
						freezeState: {},
					},
					variables: {flags: [], counters: []},
					roomStates: [],
					messages: [],
				},
				nextCondition,
			),
		).toBe(true);
	});
});
