import {render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {produce} from "immer";
import {useState} from "react";
import {createInitialWorld} from "@/data/worlds/initialWorld";
import {ConnectionSchema, type Connection} from "@/schemas/world/roomSchema";
import type {World} from "@/schemas/world/worldSchema";
import type {WorldUpdate} from "@/types/worldUpdaterTypes";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {ConnectionEditor} from "./ConnectionEditor";

function Harness() {
	const [world, setWorld] = useState<World>(() => {
		const initialWorld = createInitialWorld();
		const connection: Connection = {
			...createDefaultFieldObject(ConnectionSchema),
			id: toID("connection", "test-route"),
			fromRoomId: initialWorld.rooms[0]!.id,
			toRoomId: initialWorld.rooms[1]!.id,
			direction: "n",
			returnDirection: "s",
		};
		return produce(initialWorld, (draft) => {
			draft.connections = [connection];
		});
	});

	function updateWorld(update: WorldUpdate) {
		setWorld((currentWorld) =>
			typeof update === "function" ? produce(currentWorld, update) : update,
		);
	}

	return (
		<ConnectionEditor
			selectedConnection={world.connections[0]!}
			connections={world.connections}
			world={world}
			updateWorld={updateWorld}
		/>
	);
}

function fieldNamed(name: string) {
	const title = screen.getByText(name);
	const field = title.closest(".universalField");
	if (!(field instanceof HTMLElement)) throw new Error(`Could not find ${name} field`);
	return within(field);
}

describe("ConnectionEditor", () => {
	it("uses the shared direction picker for both route directions", async () => {
		const user = userEvent.setup();
		render(<Harness />);

		const startDirection = fieldNamed("Start direction");
		const returnDirection = fieldNamed("Return direction");
		expect(startDirection.queryByRole("combobox")).not.toBeInTheDocument();
		expect(returnDirection.queryByRole("combobox")).not.toBeInTheDocument();

		await user.click(startDirection.getByRole("button", {name: "North N"}));
		await user.click(
			within(screen.getByRole("dialog", {name: "Choose direction"})).getByRole("button", {
				name: "Out",
			}),
		);
		expect(startDirection.getByRole("button", {name: "Out OUT"})).toBeVisible();

		await user.click(returnDirection.getByRole("button", {name: "South S"}));
		await user.click(
			within(screen.getByRole("dialog", {name: "Choose direction"})).getByRole("button", {
				name: "In",
			}),
		);
		expect(returnDirection.getByRole("button", {name: "In IN"})).toBeVisible();
	});
});
