import {fireEvent, render, screen} from "@testing-library/react";
import {useState} from "react";
import {CommandInput} from "./CommandInput";

function CommandInputHarness({commandList = []}: {commandList?: string[]}) {
	const [command, setCommand] = useState("");
	const [currentCommandInHistory, setCurrentCommandInHistory] = useState(0);

	return (
		<>
			<CommandInput
				command={command}
				commandList={commandList}
				currentCommandInHistory={currentCommandInHistory}
				setCurrentCommandInHistory={setCurrentCommandInHistory}
				setCommand={setCommand}
				submitCommand={jest.fn()}
			/>
			<output data-testid="history-position">{currentCommandInHistory}</output>
		</>
	);
}

describe("CommandInput", () => {
	it("accepts ordinary player input without browser text transformations", () => {
		render(<CommandInputHarness />);
		const input = screen.getByRole("textbox", {name: "Game command"});

		fireEvent.change(input, {target: {value: "take Brass Key"}});

		expect(input).toHaveValue("take Brass Key");
		expect(input).toHaveAttribute("autocomplete", "off");
		expect(input).toHaveAttribute("autocapitalize", "off");
		expect(input).toHaveAttribute("spellcheck", "false");
	});

	it("walks backward and forward through command history", () => {
		render(<CommandInputHarness commandList={["look", "take key", "north"]} />);
		const input = screen.getByRole("textbox", {name: "Game command"});

		fireEvent.keyDown(input, {key: "ArrowUp"});
		expect(input).toHaveValue("north");
		fireEvent.keyDown(input, {key: "ArrowUp"});
		expect(input).toHaveValue("take key");
		fireEvent.keyDown(input, {key: "ArrowDown"});
		expect(input).toHaveValue("north");
		fireEvent.keyDown(input, {key: "ArrowDown"});
		expect(input).toHaveValue("");
		expect(screen.getByTestId("history-position")).toHaveTextContent("0");
	});

	it("stops at the oldest command instead of wrapping", () => {
		render(<CommandInputHarness commandList={["look", "north"]} />);
		const input = screen.getByRole("textbox", {name: "Game command"});

		fireEvent.keyDown(input, {key: "ArrowUp"});
		fireEvent.keyDown(input, {key: "ArrowUp"});
		fireEvent.keyDown(input, {key: "ArrowUp"});

		expect(input).toHaveValue("look");
		expect(screen.getByTestId("history-position")).toHaveTextContent("2");
	});

	it("leaves an empty history unchanged", () => {
		render(<CommandInputHarness />);
		const input = screen.getByRole("textbox", {name: "Game command"});

		fireEvent.keyDown(input, {key: "ArrowUp"});
		fireEvent.keyDown(input, {key: "ArrowDown"});

		expect(input).toHaveValue("");
		expect(screen.getByTestId("history-position")).toHaveTextContent("0");
	});
});
