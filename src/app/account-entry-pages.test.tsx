import {render, screen} from "@testing-library/react";
import {redirect} from "next/navigation";

import {resolveCurrentEditorPageActor} from "@/auth/currentPageActor";

import HomePage from "./page";
import RegisterPage from "./register/page";
import SignInPage from "./sign-in/page";

jest.mock("@/auth/currentPageActor", () => ({resolveCurrentEditorPageActor: jest.fn()}));
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

describe("registered account entry", () => {
	it("replaces public account choices with a My worlds action", async () => {
		jest.mocked(resolveCurrentEditorPageActor).mockResolvedValue(actor("registered"));

		render(await HomePage());

		expect(screen.getByRole("link", {name: "My worlds"})).toHaveAttribute("href", "/worlds");
		expect(screen.queryByRole("link", {name: "Sign in"})).not.toBeInTheDocument();
		expect(screen.queryByRole("link", {name: "Continue without an account"})).not.toBeInTheDocument();
	});

	it("keeps sign-in available to temporary accounts", async () => {
		jest.mocked(resolveCurrentEditorPageActor).mockResolvedValue(actor("anonymous"));

		render(await HomePage());

		expect(screen.getByRole("link", {name: "Sign in"})).toHaveAttribute("href", "/sign-in");
		expect(screen.queryByRole("link", {name: "My worlds"})).not.toBeInTheDocument();
	});

	it.each([
		["sign-in", SignInPage],
		["registration", RegisterPage],
	])("redirects a registered session away from %s", async (_label, page) => {
		jest.mocked(resolveCurrentEditorPageActor).mockResolvedValue(actor("registered"));

		await expect(page()).rejects.toThrow("NEXT_REDIRECT");
		expect(redirect).toHaveBeenCalledWith("/");
	});
});
