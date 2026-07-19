import {fireEvent, render, screen} from "@testing-library/react";
import {RoomSchema} from "../../schemas/world/roomSchema";
import {createDefaultFieldObject} from "../../utils/createDefaultFieldObject";
import {RoomCard} from "./Room";

describe("RoomCard special node rails", () => {
	it("renders every special node and handles it like a normal node", () => {
		const room = RoomSchema.parse({
			...createDefaultFieldObject(RoomSchema),
			id: "room-1",
			name: "Atrium",
			metadata: {position: {x: 0, y: 0}},
		});
		const onNodeClick = jest.fn();
		const updateStatus = jest.fn();
		const {container} = render(
			<RoomCard
				room={room}
				width={128}
				height={80}
				isDragging={false}
				isSelected={false}
				onPointerDown={jest.fn()}
				onNodeClick={onNodeClick}
				updateStatus={updateStatus}
				armedDirection="up"
				pulseNodes={false}
				outgoingDirections={["out"]}
			/>,
		);

		for (const direction of ["in", "out", "up", "down"]) {
			expect(container.querySelector(`[data-direction="${direction}"]`)).toBeInTheDocument();
		}

		expect(container.querySelector('[data-direction="up"]')).toHaveClass("node--armed");
		expect(container.querySelector('[data-direction="out"]')).toHaveClass("node--outgoing");
		expect(container.querySelector(".nodeDirectionLabel")).not.toBeInTheDocument();

		fireEvent.click(container.querySelector('[data-direction="in"]')!);
		expect(onNodeClick).toHaveBeenCalledWith(room, "in");
		fireEvent.pointerEnter(container.querySelector('[data-direction="nw"]')!);
		expect(updateStatus).toHaveBeenCalledWith({
			kind: "node",
			label: "Northwest passage node · Click to connect",
		});
		expect(container.querySelector('[data-direction="nw"]')).toHaveAttribute(
			"title",
			"Northwest passage node",
		);
		fireEvent.pointerLeave(container.querySelector('[data-direction="nw"]')!);
		expect(updateStatus).toHaveBeenCalledWith(null);
		expect(screen.getByTitle("Atrium")).toBeInTheDocument();
	});
});
