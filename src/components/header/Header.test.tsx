import {render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {usePathname} from "next/navigation";

import {Header} from "./Header";

const setTheme = jest.fn();
const allowNextUnload = jest.fn();
const prepareForNavigation = jest.fn().mockResolvedValue(true);

jest.mock("next/navigation", () => ({usePathname: jest.fn()}));
jest.mock("../theme/ThemeProvider", () => ({
	useTheme: () => ({setTheme, theme: "dark", toggleTheme: jest.fn()}),
}));
jest.mock("../world-autosave/WorldAutosave", () => ({
	WorldAutosaveIndicator: () => null,
	WorldSaveButton: () => null,
	WorldSwitcher: () => null,
	useWorldAutosave: () => ({allowNextUnload, prepareForNavigation}),
}));
jest.mock("./CommandCopyAction", () => ({CommandCopyButton: () => null}));

describe("Header", () => {
	beforeEach(() => {
		jest.mocked(usePathname).mockReturnValue("/");
		prepareForNavigation.mockReset().mockResolvedValue(true);
		allowNextUnload.mockReset();
	});

	afterEach(() => {
		jest.restoreAllMocks();
		Reflect.deleteProperty(globalThis, "fetch");
	});

	it("shows Home, Create, and Play in the left page selector", async () => {
		const user = userEvent.setup();
		render(<Header account={null} />);

		const primary = screen.getByRole("navigation", {name: "Primary navigation"});
		const selector = within(primary).getByRole("button", {name: "Choose page, current: Home"});
		expect(screen.getByRole("button", {name: "Send feedback"})).toBeInTheDocument();
		expect(screen.getByRole("link", {name: "Log in"})).toHaveAttribute("href", "/sign-in");
		expect(screen.getByRole("link", {name: "Sign up"})).toHaveAttribute("href", "/register");

		await user.click(selector);
		const menu = screen.getByRole("menu");
		const create = within(menu).getByRole("menuitem", {name: "Create"});
		const play = within(menu).getByRole("menuitem", {name: "Play"});
		expect(within(menu).getByRole("menuitem", {name: "Home"})).toHaveAttribute("href", "/");
		expect(create).toHaveAttribute("href", "/worlds");
		expect(play).toHaveAttribute("href", "/play");
		expect(create.compareDocumentPosition(play) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(within(menu).queryByRole("menuitem", {name: "Admin"})).not.toBeInTheDocument();
	});

	it("puts appearance and account actions in the signed-in account menu", async () => {
		const user = userEvent.setup();
		render(
			<Header account={{accountType: "registered", siteRole: "user", username: "archivekeeper"}} />,
		);

		expect(screen.getByRole("button", {name: "Notifications"})).toBeInTheDocument();
		expect(screen.queryByRole("link", {name: "Log in"})).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", {name: /archivekeeper/}));
		const menu = screen.getByRole("menu");
		expect(within(menu).getByRole("menuitem", {name: "View public profile"})).toHaveAttribute(
			"href",
			"/users/archivekeeper",
		);
		expect(within(menu).getByRole("menuitem", {name: "Account settings"})).toHaveAttribute(
			"href",
			"/account",
		);
		expect(within(menu).getByRole("group", {name: "Appearance"})).toBeInTheDocument();
		expect(within(menu).getByRole("menuitem", {name: "Sign out"})).toBeInTheDocument();

		await user.click(within(menu).getByRole("button", {name: "Light"}));
		expect(setTheme).toHaveBeenCalledWith("light");
	});

	it("stops sign-out when the current editor revision cannot be server-confirmed", async () => {
		const user = userEvent.setup();
		prepareForNavigation.mockResolvedValue(false);
		const fetchMock = jest.fn();
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});
		jest.mocked(usePathname).mockReturnValue("/worlds/private-world");
		render(
			<Header account={{accountType: "registered", siteRole: "user", username: "archivekeeper"}} />,
		);

		await user.click(screen.getByRole("button", {name: /archivekeeper/}));
		await user.click(screen.getByRole("menuitem", {name: "Sign out"}));

		expect(prepareForNavigation).toHaveBeenCalledTimes(1);
		expect(fetchMock).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Sign-out cancelled. This world still has unsaved changes.",
		);
	});

	it("adds the Admin selection only for administrators", async () => {
		const user = userEvent.setup();
		render(
			<Header account={{accountType: "registered", siteRole: "admin", username: "administrator"}} />,
		);

		await user.click(screen.getByRole("button", {name: "Choose page, current: Home"}));
		expect(screen.getByRole("menuitem", {name: "Admin"})).toHaveAttribute("href", "/admin");
	});

	it("asks temporary anonymous accounts for a feedback reply email", async () => {
		const user = userEvent.setup();
		render(<Header account={{accountType: "anonymous", siteRole: "user", username: null}} />);

		await user.click(screen.getByRole("button", {name: "Send feedback"}));

		expect(screen.getByLabelText("Your email")).toBeRequired();
	});

	it("keeps feedback in the mobile menu and hides the shell on hosted game routes", async () => {
		const user = userEvent.setup();
		const {rerender} = render(<Header account={null} />);

		await user.click(screen.getByRole("button", {name: "Open menu"}));
		const mobile = screen.getByRole("navigation", {name: "Mobile navigation"});
		expect(within(mobile).getByRole("button", {name: "Send feedback"})).toBeInTheDocument();

		jest.mocked(usePathname).mockReturnValue("/play/a-published-world");
		rerender(<Header account={null} />);
		expect(screen.queryByRole("banner")).not.toBeInTheDocument();
	});
});
