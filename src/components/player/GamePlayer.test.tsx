import {fireEvent, render, screen} from "@testing-library/react";
import {world as exampleWorld} from "@/data/worlds/exampleWorld";
import {idValue} from "@/utils/idUtils";
import {GamePlayer} from "./GamePlayer";

describe("GamePlayer focus", () => {
	it("only focuses the command input after the user clicks it", () => {
		render(
			<>
				<GamePlayer world={exampleWorld} startingRoomId={idValue(exampleWorld.startRoomId)} />
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
});
