import {fireEvent, render, screen, waitFor, within} from "@testing-library/react";

import {PopupProvider} from "@/components/popup/Popup";

import {HomeExample} from "./HomeExample";

describe("HomeExample", () => {
	it("plays through the real command path and keeps the map read-only", async () => {
		const {container} = render(
			<PopupProvider>
				<HomeExample />
			</PopupProvider>,
		);
		const map = screen.getByLabelText("Pan and zoom map of the Corner Shop example world");
		const input = screen.getByRole("textbox", {name: "Game command"});

		expect(map).toHaveClass("map--read-only");
		expect(screen.queryByRole("button", {name: /Clear .* layer/})).not.toBeInTheDocument();
		expect(container.querySelector('[title="Shop Floor"]')).toHaveClass("roomCardSelected");

		fireEvent.change(input, {target: {value: "east"}});
		fireEvent.submit(input.closest("form")!);

		await waitFor(() =>
			expect(container.querySelector('[title="Stockroom"]')).toHaveClass("roomCardSelected"),
		);
		expect(
			within(container.querySelector(".game-player__output")!).getByText(/^Stockroom/),
		).toBeVisible();
	});
});
