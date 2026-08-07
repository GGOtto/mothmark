import {fireEvent, render, screen} from "@testing-library/react";
import {produce} from "immer";
import {useState} from "react";
import {ItemSchema} from "@/schemas/world/itemSchema";
import {RoomSchema} from "@/schemas/world/roomSchema";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";
import type {WorldUpdate} from "@/types/worldUpdaterTypes";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {RoomStartingItems} from "./RoomStartingItems";

function createWorld() {
	const room = createDefaultFieldObject(RoomSchema);
	room.id = toID("room", "atrium");
	room.name = "Atrium";

	const otherRoom = createDefaultFieldObject(RoomSchema);
	otherRoom.id = toID("room", "cellar");
	otherRoom.name = "Cellar";

	const atriumItem = createDefaultFieldObject(ItemSchema);
	atriumItem.id = toID("item", "lantern");
	atriumItem.name = "Lantern";
	atriumItem.initialState.location = {type: "room", roomId: room.id};

	const cellarItem = createDefaultFieldObject(ItemSchema);
	cellarItem.id = toID("item", "rope");
	cellarItem.name = "Rope";
	cellarItem.initialState.location = {type: "room", roomId: otherRoom.id};

	const world = createDefaultFieldObject(WorldSchema);
	world.rooms = [room, otherRoom];
	world.items = [atriumItem, cellarItem];
	world.startRoomId = room.id;
	return world;
}

function RoomItemsHarness({onOpenItem}: {onOpenItem: (itemId: string) => void}) {
	const [world, setWorld] = useState<World>(createWorld);
	const room = world.rooms[0];

	function updateWorld(update: WorldUpdate) {
		setWorld((current) => (typeof update === "function" ? produce(current, update) : update));
	}

	return (
		<>
			<RoomStartingItems room={room} world={world} updateWorld={updateWorld} onOpenItem={onOpenItem} />
			<button
				type="button"
				onClick={() =>
					updateWorld((draft) => {
						draft.items[1].initialState.location = {type: "room", roomId: room.id};
					})
				}
			>
				Move rope from item editor
			</button>
			<output data-testid="world-value">{JSON.stringify(world)}</output>
		</>
	);
}

describe("RoomStartingItems", () => {
	it("derives linked starting items from item locations and creates new items in the room", () => {
		const onOpenItem = jest.fn();
		render(<RoomItemsHarness onOpenItem={onOpenItem} />);

		expect(screen.getByRole("button", {name: /Lantern/})).toBeInTheDocument();
		expect(screen.queryByRole("button", {name: /Rope/})).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", {name: /Lantern/}));
		expect(onOpenItem).toHaveBeenCalledWith("lantern");

		fireEvent.click(screen.getByRole("button", {name: "Add item"}));
		expect(screen.getByRole("button", {name: /New item/})).toBeInTheDocument();
		expect(screen.getByTestId("world-value")).toHaveTextContent(
			'"location":{"type":"room","roomId":{"type":"room","id":"atrium"}}',
		);

		fireEvent.click(screen.getByRole("button", {name: "Move rope from item editor"}));
		expect(screen.getByRole("button", {name: /Rope/})).toBeInTheDocument();
	});
});
