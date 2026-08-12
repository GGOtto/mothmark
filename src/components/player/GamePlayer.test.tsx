import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {world as initialWorld} from "@/data/worlds/initialWorld";
import {toID} from "@/utils/idUtils";
import {GamePlayer} from "./GamePlayer";
import {CommandLine} from "./CommandLine";

describe("GamePlayer focus", () => {
	it("only focuses the command input after the user clicks it", () => {
		render(
			<>
				<GamePlayer world={initialWorld} startingRoomId={initialWorld.startRoomId} />
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
		render(<GamePlayer world={initialWorld} startingRoomId={toID("room", "missing-room")} />);

		expect(screen.getByText(new RegExp(initialWorld.rooms[0].name))).toBeInTheDocument();
	});

	it("renders an empty state when the world has no rooms", () => {
		render(
			<GamePlayer
				world={{...initialWorld, rooms: []}}
				startingRoomId={toID("room", "missing-room")}
			/>,
		);

		expect(
			screen.getByText("No rooms available. Add a room to begin exploring."),
		).toBeInTheDocument();
		expect(screen.getByRole("textbox", {name: "Game command"})).toBeDisabled();
	});

	it("reports the current room as commands move the player", async () => {
		const onCurrentRoomChange = jest.fn();
		render(
			<GamePlayer
				world={initialWorld}
				startingRoomId={initialWorld.startRoomId}
				onCurrentRoomChange={onCurrentRoomChange}
			/>,
		);
		const input = screen.getByRole("textbox", {name: "Game command"});

		await waitFor(() => expect(onCurrentRoomChange).toHaveBeenCalledWith(initialWorld.startRoomId));
		fireEvent.change(input, {target: {value: "east"}});
		fireEvent.submit(input.closest("form")!);

		await waitFor(() => expect(onCurrentRoomChange).toHaveBeenCalledWith(toID("room", "stockroom")));
	});
});

describe("CommandLine", () => {
	it("renders the player directly without a separate toolbar", () => {
		render(<CommandLine contained world={initialWorld} />);

		expect(screen.queryByRole("button", {name: "Sync Room"})).not.toBeInTheDocument();
		expect(screen.getByText(/Shop Floor/)).toBeInTheDocument();
		expect(screen.getByRole("textbox", {name: "Game command"})).toBeEnabled();
	});
});
