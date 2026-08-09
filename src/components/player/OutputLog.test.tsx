import {render, screen} from "@testing-library/react";
import {GameMessageSchema} from "@/schemas/states/gameStateSchemas";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {OutputLog} from "./OutputLog";

function message(
	id: string,
	text: string,
	type: "command" | "death" | "error" | "room" | "system",
) {
	return {...createDefaultFieldObject(GameMessageSchema), id, text, type};
}

describe("OutputLog", () => {
	it("renders an uninterrupted transcript in message order", () => {
		const {container} = render(
			<OutputLog
				messages={[
					message("room", "The archive is quiet.", "room"),
					message("command", "look", "command"),
					message("system", "A distant bell rings.", "system"),
				]}
			/>,
		);

		expect(Array.from(container.querySelectorAll("p")).map((node) => node.textContent)).toEqual([
			"The archive is quiet.",
			"> look",
			"A distant bell rings.",
		]);
	});

	it.each([
		["error", "output-log__message--error"],
		["system", "output-log__message--system"],
		["death", "output-log__message--death"],
	] as const)("visually distinguishes %s messages", (type, className) => {
		render(<OutputLog messages={[message(type, `${type} message`, type)]} />);

		expect(screen.getByText(`${type} message`)).toHaveClass(className);
	});

	it("scrolls the newest transcript content into view after messages change", () => {
		const scrollIntoView = jest.fn();
		Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
			configurable: true,
			value: scrollIntoView,
		});
		const {rerender} = render(<OutputLog messages={[]} />);
		scrollIntoView.mockClear();

		rerender(<OutputLog messages={[message("new", "New output", "room")]} />);

		expect(scrollIntoView).toHaveBeenCalledWith({block: "end"});
	});
});
