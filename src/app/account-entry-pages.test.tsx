import {render, screen} from "@testing-library/react";
import {redirect} from "next/navigation";

import {resolveCurrentEditorPageActor} from "@/auth/currentPageActor";

import HomePage from "./page";
import RegisterPage from "./register/page";
import SignInPage from "./sign-in/page";

jest.mock("@/auth/currentPageActor", () => ({resolveCurrentEditorPageActor: jest.fn()}));
jest.mock("./FeaturedPublicationsCarousel", () => ({
	FeaturedPublicationsCarousel: () => <div>Featured publications</div>,
}));
jest.mock("./HomeExample", () => ({HomeExample: () => <div>Corner Shop example</div>}));
jest.mock("./HomeFooter", () => ({HomeFooter: () => <footer>Mothmark footer</footer>}));
jest.mock("next/navigation", () => ({
	redirect: jest.fn(() => {
		throw new Error("NEXT_REDIRECT");
	}),
}));

const actor = (accountType: "anonymous" | "registered") => ({
	userId: "3e816c4d-b957-45dc-8523-d53ec04c8d0f",
	accountType,
	siteRole: "user" as const,
	audience: "editor" as const,
});

describe("home entry", () => {
	it("keeps building and play as the two immediate page actions", () => {
		render(<HomePage />);

		expect(screen.getByRole("link", {name: "Start building"})).toHaveAttribute("href", "/worlds");
		expect(screen.getByRole("link", {name: "Find a world to play"})).toHaveAttribute("href", "/play");
	});

	it("marks unfinished video lessons as unavailable", () => {
		render(<HomePage />);

		for (const button of screen.getAllByRole("button", {name: "Watch video"})) {
			expect(button).toBeDisabled();
		}
	});
});

describe("registered account entry", () => {
	it.each([
		["sign-in", SignInPage],
		["registration", RegisterPage],
	])("redirects a registered session away from %s", async (_label, page) => {
		jest.mocked(resolveCurrentEditorPageActor).mockResolvedValue(actor("registered"));

		await expect(page()).rejects.toThrow("NEXT_REDIRECT");
		expect(redirect).toHaveBeenCalledWith("/");
	});
});
