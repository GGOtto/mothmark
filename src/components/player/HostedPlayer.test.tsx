import {act, fireEvent, render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {world as initialWorld} from "@/data/worlds/initialWorld";
import {resolveTurn} from "@/engine/player/resolveTurn";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {GameMessageSchema, type GameMessage} from "@/schemas/states/gameStateSchemas";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";

import {HostedPlayer} from "./HostedPlayer";

const publication = {
	authorUsername: "archivekeeper",
	slug: "quiet-archive",
	title: "Quiet archive",
	summary: "A compact world for testing hosted play.",
	visibility: "listed" as const,
	release: {
		id: "66d79031-600d-49cf-b7b0-85bc7bbf1fb2",
		number: 1,
		publishedAt: "2026-08-09T12:00:00.000Z",
	},
	world: initialWorld,
};

function message(id: string, text: string, type: "command" | "room" | "system" = "room") {
	return {...createDefaultFieldObject(GameMessageSchema), id, text, type};
}

function playthrough(
	overrides: {
		commands?: string;
		messages?: GameMessage[];
		revision?: number;
		status?: "active" | "completed";
	} = {},
) {
	const commands = overrides.commands ?? "";
	return {
		id: "playthrough-id",
		revision: overrides.revision ?? 1,
		commandCount: commands ? commands.split("\n").length : 0,
		commands,
		state: {
			...createInitialGameState(initialWorld, initialWorld.startRoomId),
			messages: overrides.messages ?? [message("opening", "A quiet archive waits.")],
		},
		status: overrides.status ?? ("active" as const),
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
			restartAvailability: {
				allowed: true,
				targetRelease: {id: publication.release.id, number: publication.release.number},
			},
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
		expect(within(dialog).getByText(/will remain in an abandoned playthrough/)).toBeVisible();

		await user.keyboard("{Escape}");
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(menuButton).toHaveFocus();
	});

	it("shows engine output immediately and keeps the prompt usable while a command saves", async () => {
		let resolveCommand!: (response: Response) => void;
		installBootstrapFetch(
			() =>
				new Promise<Response>((resolve) => {
					resolveCommand = resolve;
				}),
		);
		render(<HostedPlayer slug="quiet-archive" />);
		const input = await screen.findByRole("textbox", {name: "Game command"});
		fireEvent.change(input, {target: {value: "east"}});
		input.focus();
		fireEvent.submit(input.closest("form")!);

		await screen.findByText(/Shelves hold boxes waiting to be unpacked/);
		expect(input).not.toHaveAttribute("readonly");
		expect(input).toBeEnabled();
		expect(input).toHaveFocus();
		expect(input).toHaveValue("");
		expect(screen.getByRole("status")).toHaveTextContent("Saving…");

		const serverState = resolveTurn(initialWorld, playthrough().state, "east");

		await act(async () => {
			resolveCommand(
				await json({
					data: {
						...playthrough({
							commands: "east",
							messages: serverState.messages,
							revision: 2,
						}),
						state: serverState,
						outputMessages: serverState.messages.slice(1),
					},
				}),
			);
		});

		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
		expect(input).toHaveValue("");
		expect(input).toHaveFocus();
	});

	it("serializes rapid background saves without holding up the next turn", async () => {
		const resolvers: Array<(response: Response) => void> = [];
		installBootstrapFetch(
			() =>
				new Promise<Response>((resolve) => {
					resolvers.push(resolve);
				}),
		);
		render(<HostedPlayer slug="quiet-archive" />);
		const input = await screen.findByRole("textbox", {name: "Game command"});

		fireEvent.change(input, {target: {value: "east"}});
		fireEvent.submit(input.closest("form")!);
		await screen.findByText(/Shelves hold boxes waiting to be unpacked/);
		fireEvent.change(input, {target: {value: "west"}});
		fireEvent.submit(input.closest("form")!);
		await screen.findByText(/A narrow shop with a counter by the door/);
		expect(resolvers).toHaveLength(1);

		const startingPlaythrough = playthrough();
		const eastState = resolveTurn(initialWorld, startingPlaythrough.state, "east");
		await act(async () => {
			resolvers[0]?.(
				await json({
					data: {
						...startingPlaythrough,
						revision: 2,
						commandCount: 1,
						commands: "east",
						state: eastState,
						outputMessages: eastState.messages.slice(startingPlaythrough.state.messages.length),
					},
				}),
			);
		});
		await waitFor(() => expect(resolvers).toHaveLength(2));

		const westState = resolveTurn(initialWorld, eastState, "west");
		await act(async () => {
			resolvers[1]?.(
				await json({
					data: {
						...startingPlaythrough,
						revision: 3,
						commandCount: 2,
						commands: "east\nwest",
						state: westState,
						outputMessages: westState.messages.slice(eastState.messages.length),
					},
				}),
			);
		});

		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
		expect(input).toBeEnabled();
	});

	it("explains when an unpublished world cannot be restarted", async () => {
		const available = bootstrapResponse();
		const unavailable = {
			data: {
				...available.data,
				restartAvailability: {
					allowed: false,
					targetRelease: {id: publication.release.id, number: 1},
					unavailableReason: "This world is no longer published, so it cannot be restarted.",
				},
			},
		};
		global.fetch = jest.fn((input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/api/auth/csrf")) return json({data: {csrfToken: "csrf"}});
			if (url.endsWith("/bootstrap")) return json(unavailable);
			throw new Error(`Unexpected request: ${url}`);
		}) as jest.MockedFunction<typeof fetch>;
		const user = userEvent.setup();
		render(<HostedPlayer slug="quiet-archive" />);
		await user.click(await screen.findByRole("button", {name: "World menu"}));
		const dialog = screen.getByRole("dialog", {name: "Quiet archive"});
		expect(within(dialog).getByRole("button", {name: "Restart playthrough"})).toBeDisabled();
		expect(
			within(dialog).getByText("This world is no longer published, so it cannot be restarted."),
		).toBeVisible();
	});

	it("reuses one restart request id after a connection failure", async () => {
		const restartBodies: Array<Record<string, string>> = [];
		let restartAttempts = 0;
		global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.includes("/api/auth/csrf")) return json({data: {csrfToken: "csrf"}});
			if (url.endsWith("/bootstrap")) return json(bootstrapResponse());
			if (url.endsWith("/restart")) {
				restartAttempts += 1;
				restartBodies.push(JSON.parse(String(init?.body)) as Record<string, string>);
				if (restartAttempts === 1) return Promise.reject(new TypeError("Failed to fetch"));
				return json({
					data: {
						...bootstrapResponse().data,
						playthrough: {...playthrough(), id: "new-playthrough-id"},
					},
				});
			}
			throw new Error(`Unexpected request: ${url}`);
		}) as jest.MockedFunction<typeof fetch>;
		const user = userEvent.setup();
		render(<HostedPlayer slug="quiet-archive" />);
		await user.click(await screen.findByRole("button", {name: "World menu"}));
		const dialog = screen.getByRole("dialog", {name: "Quiet archive"});
		await user.click(within(dialog).getByRole("button", {name: "Restart playthrough"}));
		const confirm = within(dialog).getByRole("button", {name: "Restart playthrough"});
		await user.click(confirm);
		expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
		await user.click(confirm);
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
		expect(restartBodies).toHaveLength(2);
		expect(restartBodies[0]).toMatchObject({
			sourcePlaythroughId: "playthrough-id",
			expectedTargetReleaseId: publication.release.id,
			source: "player_menu",
		});
		expect(restartBodies[1]?.restartRequestId).toBe(restartBodies[0]?.restartRequestId);
	});

	it("keeps optimistic progress visible and offers a background-save retry after a connection failure", async () => {
		installBootstrapFetch(() => Promise.reject(new TypeError("Failed to fetch")));
		render(<HostedPlayer slug="quiet-archive" />);
		const input = await screen.findByRole("textbox", {name: "Game command"});
		fireEvent.change(input, {target: {value: "look"}});
		fireEvent.submit(input.closest("form")!);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Connection lost. Your progress is still visible here; reconnect and retry saving.",
		);
		expect(screen.getByText(/look/, {selector: ".output-log__message"})).toBeVisible();
		expect(screen.getByRole("button", {name: "Retry saving"})).toBeEnabled();
		expect(input).toHaveValue("");
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

	it("keeps grouped help output in one wrapping terminal message", async () => {
		const helpText =
			"Useful commands:\nlist exits — Show directions you can currently travel.\ngo <direction> — Travel through an available exit.\n\nMore commands:\nexamine <item> — Inspect a visible item.";
		global.fetch = jest.fn((input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/api/auth/csrf")) return json({data: {csrfToken: "csrf"}});
			if (url.endsWith("/bootstrap")) {
				return json(bootstrapResponse({messages: [message("opening", helpText, "system")]}));
			}
			throw new Error(`Unexpected request: ${url}`);
		}) as jest.MockedFunction<typeof fetch>;

		render(<HostedPlayer slug="quiet-archive" />);
		const helpMessage = await screen.findByText(/Useful commands:/);

		expect(helpMessage).toHaveClass("output-log__message--system");
		expect(helpMessage.textContent).toBe(helpText);
		expect(helpMessage.closest('[role="log"]')).toHaveAccessibleName("Game transcript");
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
