import {fireEvent, render, screen, waitFor, within} from "@testing-library/react";

import {PopupProvider} from "@/components/popup/Popup";

import {createHomeExampleWorld, HomeExample} from "./HomeExample";

describe("HomeExample", () => {
	it("uses a deliberately small, one-layer world", () => {
		const world = createHomeExampleWorld();

		expect(world.metadata.layers).toHaveLength(1);
		expect(world.metadata.layers[0]?.rooms).toEqual(world.rooms.map((room) => room.id));
		expect(world.rooms.map((room) => room.name)).toEqual(["Shop Floor", "Stockroom"]);
		expect(world.items.map((item) => item.name)).toEqual(["Shop Counter"]);
		expect(world.connections).toHaveLength(1);
	});

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
