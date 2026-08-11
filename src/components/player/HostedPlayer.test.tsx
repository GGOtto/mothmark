import {act, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {GameMessageSchema, GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";

import {HostedPlayer} from "./HostedPlayer";

const publication = {
	authorUsername: "archivekeeper",
	slug: "quiet-archive",
	title: "Quiet archive",
	summary: "A compact world for testing hosted play.",
	visibility: "listed" as const,
	release: {number: 1, publishedAt: "2026-08-09T12:00:00.000Z"},
};

function message(id: string, text: string, type: "command" | "room" | "system" = "room") {
	return {...createDefaultFieldObject(GameMessageSchema), id, text, type};
}

function playthrough(
	overrides: {commands?: string; messages?: ReturnType<typeof message>[]; revision?: number} = {},
) {
	const commands = overrides.commands ?? "";
	return {
		id: "playthrough-id",
		revision: overrides.revision ?? 1,
		commandCount: commands ? commands.split("\n").length : 0,
		commands,
		state: {
			...createDefaultFieldObject(GameStateSchema),
			messages: overrides.messages ?? [message("opening", "A quiet archive waits.")],
		},
		status: "active" as const,
		release: {id: "release-id", number: 1},
	};
}

function json(body: unknown, status = 200) {
	return Promise.resolve({
		ok: status >= 200 && status < 300,
		status,
		text: async () => JSON.stringify(body),
	} as Response);
}

function empty(status = 204) {
	return Promise.resolve({
		ok: status >= 200 && status < 300,
		status,
		text: async () => "",
	} as Response);
}

function bootstrapResponse(overrides?: Parameters<typeof playthrough>[0]) {
	return {
		data: {
			publication,
			playthrough: playthrough(overrides),
			newerReleaseAvailable: false,
		},
	};
}

function installBootstrapFetch(commandResponse?: () => Promise<Response>) {
	global.fetch = jest.fn((input: RequestInfo | URL) => {
		const url = String(input);
		if (url.includes("/api/auth/csrf")) return json({data: {csrfToken: "csrf"}});
		if (url.endsWith("/bootstrap")) return json(bootstrapResponse());
		if (url.endsWith("/command") && commandResponse) return commandResponse();
		throw new Error(`Unexpected request: ${url}`);
	}) as jest.MockedFunction<typeof fetch>;
}

describe("HostedPlayer", () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
		jest.restoreAllMocks();
	});

	it("opens a keyboard-contained world menu and returns focus when it closes", async () => {
		installBootstrapFetch();
		const user = userEvent.setup();
		render(<HostedPlayer slug="quiet-archive" />);
		const menuButton = await screen.findByRole("button", {name: "World menu"});

		await user.click(menuButton);
		const dialog = screen.getByRole("dialog", {name: "Quiet archive"});
		expect(within(dialog).getByRole("link", {name: "Return to published worlds"})).toHaveAttribute(
			"href",
			"/play",
		);
		await waitFor(() =>
			expect(within(dialog).getByRole("heading", {name: "Quiet archive"})).toHaveFocus(),
		);

		await user.click(within(dialog).getByRole("button", {name: "Restart playthrough"}));
		await waitFor(() =>
			expect(within(dialog).getByRole("heading", {name: "Restart playthrough?"})).toHaveFocus(),
		);
		expect(within(dialog).getByText(/will be abandoned/)).toBeVisible();

		await user.keyboard("{Escape}");
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(menuButton).toHaveFocus();
	});

	it("keeps the software-keyboard prompt focused and intact while a command is saving", async () => {
		let resolveCommand!: (response: Response) => void;
		installBootstrapFetch(
			() =>
				new Promise<Response>((resolve) => {
					resolveCommand = resolve;
				}),
		);
		render(<HostedPlayer slug="quiet-archive" />);
		const input = await screen.findByRole("textbox", {name: "Game command"});
		fireEvent.change(input, {target: {value: "open the unusually-long-archive-door"}});
		input.focus();
		fireEvent.submit(input.closest("form")!);

		await waitFor(() => expect(input).toHaveAttribute("readonly"));
		expect(input).not.toBeDisabled();
		expect(input).toHaveFocus();
		expect(input).toHaveValue("open the unusually-long-archive-door");

		await act(async () => {
			resolveCommand(
				await json({
					data: {
						...playthrough({
							commands: "open the unusually-long-archive-door",
							messages: [
								message("opening", "A quiet archive waits."),
								message("command", "open the unusually-long-archive-door", "command"),
							],
							revision: 2,
						}),
						outputMessages: [message("command", "open the unusually-long-archive-door", "command")],
					},
				}),
			);
		});

		await waitFor(() => expect(input).not.toHaveAttribute("readonly"));
		expect(input).toHaveValue("");
		expect(input).toHaveFocus();
	});

	it("keeps a command available for retry after a connection failure", async () => {
		installBootstrapFetch(() => Promise.reject(new TypeError("Failed to fetch")));
		render(<HostedPlayer slug="quiet-archive" />);
		const input = await screen.findByRole("textbox", {name: "Game command"});
		fireEvent.change(input, {target: {value: "look"}});
		fireEvent.submit(input.closest("form")!);

		expect(
			await screen.findByText(
				"Connection lost. Your command is still in the prompt; check your connection and try again.",
			),
		).toHaveAttribute("role", "alert");
		expect(input).toHaveValue("look");
		expect(input).not.toHaveAttribute("readonly");
	});

	it("announces connection changes without discarding the loaded playthrough", async () => {
		let online = true;
		jest.spyOn(window.navigator, "onLine", "get").mockImplementation(() => online);
		installBootstrapFetch();
		render(<HostedPlayer slug="quiet-archive" />);
		await screen.findByText("A quiet archive waits.");

		online = false;
		act(() => window.dispatchEvent(new Event("offline")));
		expect(screen.getByRole("status")).toHaveTextContent("Offline");
		expect(screen.getByRole("textbox", {name: "Game command"})).toBeEnabled();

		online = true;
		act(() => window.dispatchEvent(new Event("online")));
		expect(screen.getByRole("status")).toHaveTextContent("Saved");
	});

	it("reconciles after an empty successful command response", async () => {
		let bootstrapCount = 0;
		global.fetch = jest.fn((input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/api/auth/csrf")) return json({data: {csrfToken: "csrf"}});
			if (url.endsWith("/bootstrap")) {
				bootstrapCount += 1;
				return json(
					bootstrapCount === 1
						? bootstrapResponse()
						: bootstrapResponse({
								commands: "look",
								messages: [message("opening", "A quiet archive waits."), message("result", "Still quiet.")],
								revision: 2,
							}),
				);
			}
			if (url.endsWith("/command")) return empty();
			throw new Error(`Unexpected request: ${url}`);
		}) as jest.MockedFunction<typeof fetch>;
		render(<HostedPlayer slug="quiet-archive" />);
		const input = await screen.findByRole("textbox", {name: "Game command"});
		fireEvent.change(input, {target: {value: "look"}});
		fireEvent.submit(input.closest("form")!);

		expect(await screen.findByText("Still quiet.")).toBeVisible();
		expect(input).toHaveValue("");
		expect(bootstrapCount).toBe(2);
	});
});
