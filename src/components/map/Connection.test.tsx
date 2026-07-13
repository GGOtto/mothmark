import {fireEvent, render, screen} from "@testing-library/react";
import {createDefaultConnection, createDefaultRoom} from "../../utils/createDefaultWorld";
import {Connection} from "./Connection";

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

		const {container} = render(
			<svg>
				<Connection
					connection={connection}
					fromRoom={fromRoom}
					toRoom={toRoom}
					selectConnection={jest.fn()}
					changePathway={changePathway}
					updateStatus={updateStatus}
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
