import {fireEvent, render, screen} from "@testing-library/react";
import {world as exampleWorld} from "@/data/worlds/exampleWorld";
import {toID} from "@/utils/idUtils";
import {GamePlayer} from "./GamePlayer";
import {CommandLine} from "./CommandLine";

describe("GamePlayer focus", () => {
	it("only focuses the command input after the user clicks it", () => {
		render(
			<>
				<GamePlayer world={exampleWorld} startingRoomId={exampleWorld.startRoomId} />
				<button type="button">Map control</button>
			</>,
		);
		const commandInput = screen.getByRole("textbox", {name: "Game command"});

		expect(commandInput).not.toHaveFocus();
		fireEvent.click(commandInput);
		commandInput.focus();
		expect(commandInput).toHaveFocus();

		fireEvent.pointerDown(screen.getByRole("button", {name: "Map control"}));
		expect(commandInput).not.toHaveFocus();
	});

	it("falls back to an existing room when the requested room was deleted", () => {
		render(<GamePlayer world={exampleWorld} startingRoomId={toID("room", "missing-room")} />);

		expect(screen.getByText(new RegExp(exampleWorld.rooms[0].name))).toBeInTheDocument();
	});

	it("renders an empty state when the world has no rooms", () => {
		render(
			<GamePlayer
				world={{...exampleWorld, rooms: []}}
				startingRoomId={toID("room", "missing-room")}
			/>,
		);

		expect(
			screen.getByText("No rooms available. Add a room to begin exploring."),
		).toBeInTheDocument();
		expect(screen.getByRole("textbox", {name: "Game command"})).toBeDisabled();
	});
});

describe("CommandLine room sync", () => {
	it("teleports to the selected room without resetting prior player output", () => {
		render(<CommandLine world={exampleWorld} selectedRoomId="guardroom" />);

		expect(screen.getByText(/Dungeon Entrance/)).toBeInTheDocument();
		expect(screen.queryByText(/^Guardroom/)).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", {name: "Sync Room"}));

		expect(screen.getByText(/Dungeon Entrance/)).toBeInTheDocument();
		expect(screen.getByText(/^Guardroom/)).toBeInTheDocument();
	});
});
