import {render, screen} from "@testing-library/react";

import {SiteFooter} from "./SiteFooter";

jest.mock("../theme/ThemeProvider", () => ({
	useTheme: () => ({setTheme: jest.fn(), theme: "dark", toggleTheme: jest.fn()}),
}));

describe("SiteFooter", () => {
	it("provides the reusable site directory, social links, and newsletter signup", () => {
		render(<SiteFooter />);

		expect(
			screen.getByRole("link", {name: "Mothmark footer home"}).querySelector("img"),
		).toHaveAttribute("src", "/logo/dark/header-primary.png");
		expect(screen.getByRole("link", {name: "Games"})).toHaveAttribute("href", "/play");
		expect(screen.getByRole("link", {name: "Create"})).toHaveAttribute("href", "/worlds");
		expect(screen.getByRole("link", {name: "About the site"})).toHaveAttribute("href", "/info/about");
		expect(screen.getByRole("link", {name: "Terms of service"})).toHaveAttribute(
			"href",
			"/info/terms",
		);
		expect(screen.getByRole("link", {name: "Bluesky"})).toHaveAttribute("href", "/info/bluesky");
		expect(screen.getByRole("textbox", {name: "Email address"})).toHaveAttribute("type", "email");
		expect(screen.getByRole("button", {name: "Subscribe"})).toHaveAttribute("type", "submit");
	});
});
