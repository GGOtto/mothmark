import {render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {LeftSideBar} from "./LeftSideBar";

describe("LeftSideBar", () => {
	it("exposes every editor destination through the mobile navigator", async () => {
		const user = userEvent.setup();
		const onTabChange = jest.fn();
		render(<LeftSideBar activeTab="map" onTabChange={onTabChange} />);

		const trigger = screen.getByRole("button", {name: "Map", expanded: false});
		await user.click(trigger);

		const menu = screen.getByRole("menu");
		expect(
			within(menu)
				.getAllByRole("menuitem")
				.map((item) => item.textContent),
		).toEqual(["Map", "Items", "NPCs", "Logic", "Debug", "World settings", "Settings"]);

		await user.click(within(menu).getByRole("menuitem", {name: "Items"}));
		expect(onTabChange).toHaveBeenCalledWith("world");
		expect(screen.queryByRole("menu")).not.toBeInTheDocument();
	});

	it("closes the mobile navigator with Escape and returns focus", async () => {
		const user = userEvent.setup();
		render(<LeftSideBar activeTab="logic" onTabChange={jest.fn()} />);

		const trigger = screen.getByRole("button", {name: "Logic", expanded: false});
		await user.click(trigger);
		await user.keyboard("{Escape}");

		expect(screen.queryByRole("menu")).not.toBeInTheDocument();
		expect(trigger).toHaveFocus();
	});
});
