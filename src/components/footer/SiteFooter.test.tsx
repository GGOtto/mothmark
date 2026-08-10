import {render, screen} from "@testing-library/react";

import {SiteFooter} from "./SiteFooter";

describe("SiteFooter", () => {
	it("provides the reusable site directory, social links, and newsletter stub", () => {
		const {container} = render(<SiteFooter />);

		expect(screen.getByRole("link", {name: "Games"})).toHaveAttribute("href", "/play");
		expect(screen.getByRole("link", {name: "Create"})).toHaveAttribute("href", "/worlds");
		expect(screen.getByRole("link", {name: "About the site"})).toHaveAttribute("href", "/info/about");
		expect(screen.getByRole("link", {name: "Terms of service"})).toHaveAttribute(
			"href",
			"/info/terms",
		);
		expect(screen.getByRole("link", {name: "Bluesky"})).toHaveAttribute("href", "/info/bluesky");
		expect(screen.getByRole("textbox", {name: "Email address"})).toHaveAttribute("type", "email");
		expect(container.querySelector("form")).toHaveAttribute("action", "/info/newsletter");
	});
});
