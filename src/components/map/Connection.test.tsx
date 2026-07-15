import {fireEvent, render, screen} from "@testing-library/react";
import {createDefaultConnection, createDefaultRoom} from "../../utils/createDefaultWorld";
import {world as exampleWorld} from "../../data/worlds/exampleWorld";
import {Connection, getStubTagAnchorOffset} from "./Connection";

describe("stub tag anchors", () => {
	it("uses the opposite fixed edge or corner", () => {
		expect(getStubTagAnchorOffset("n", 100)).toEqual({x: 0, y: 13});
		expect(getStubTagAnchorOffset("ne", 100)).toEqual({x: -50, y: 13});
		expect(getStubTagAnchorOffset("e", 100)).toEqual({x: -50, y: 0});
		expect(getStubTagAnchorOffset("sw", 100)).toEqual({x: 50, y: -13});
	});

	it("centers special vertical anchors", () => {
		expect(getStubTagAnchorOffset("up", 100)).toEqual({x: 0, y: 13});
		expect(getStubTagAnchorOffset("out", 100)).toEqual({x: 0, y: 13});
		expect(getStubTagAnchorOffset("down", 100)).toEqual({x: 0, y: -13});
		expect(getStubTagAnchorOffset("in", 100)).toEqual({x: 0, y: -13});
	});
});

describe("Connection pathway glyph", () => {
	it("shows the current pathway through the shared status updater", () => {
		const fromRoom = createDefaultRoom("room-1", "Gate", {x: 40, y: 40});
		const toRoom = createDefaultRoom("room-2", "Hall", {x: 200, y: 40});
		const connection = createDefaultConnection({
			id: "connection-1",
			fromRoomId: fromRoom.id,
			toRoomId: toRoom.id,
			direction: "e",
			returnDirection: "w",
			pathway: "two-way",
		});
		const updateStatus = jest.fn();
		const changePathway = jest.fn(() => "forwards" as const);
		const currentLayer = {
			name: "Ground",
			layer: 0,
			rooms: [fromRoom.id, toRoom.id],
		};
		const world = {
			...exampleWorld,
			metadata: {...exampleWorld.metadata, layers: [currentLayer]},
			rooms: [fromRoom, toRoom],
			connections: [connection],
		};

		const {container} = render(
			<svg>
				<Connection
					world={world}
					connection={connection}
					fromRoom={fromRoom}
					toRoom={toRoom}
					selectConnection={jest.fn()}
					changePathway={changePathway}
					updateStatus={updateStatus}
					currentLayer={currentLayer}
					onStubPointChange={jest.fn()}
				/>
			</svg>,
		);

		const glyph = screen.getByRole("button", {name: "Change Two way pathway"});
		expect(glyph.querySelector("title")).toHaveTextContent("Two way pathway");
		for (const element of container.querySelectorAll("[transform]")) {
			expect(element.getAttribute("transform")).not.toMatch(/\.\d{7}/);
		}

		fireEvent.pointerEnter(glyph);
		expect(updateStatus).toHaveBeenLastCalledWith({
			kind: "pathway",
			label: "Two way pathway · Click to change",
		});

		fireEvent.click(glyph);
		expect(updateStatus).toHaveBeenLastCalledWith({
			kind: "pathway",
			label: "One way pathway · Click to change",
		});

		fireEvent.pointerLeave(glyph);
		expect(updateStatus).toHaveBeenLastCalledWith(null);
	});
});
