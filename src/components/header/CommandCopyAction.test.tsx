import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {world} from "@/data/worlds/exampleWorld";
import {
	CommandCopyButton,
	CommandCopyProvider,
	useCommandCopyRegistration,
} from "./CommandCopyAction";

function RegisteredCopyAction() {
	useCommandCopyRegistration(world.commands[0]);
	return <CommandCopyButton />;
}

describe("CommandCopyButton", () => {
	it("copies the selected command as formatted JSON", async () => {
		const user = userEvent.setup();
		const writeText = jest.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {configurable: true, value: {writeText}});

		render(
			<CommandCopyProvider>
				<RegisteredCopyAction />
			</CommandCopyProvider>,
		);

		await user.click(await screen.findByRole("button", {name: "Copy command"}));

		expect(writeText).toHaveBeenCalledWith(JSON.stringify(world.commands[0], null, 2));
		expect(screen.getByRole("button", {name: "Copied"})).toBeInTheDocument();
	});
});
