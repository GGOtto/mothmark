import {fireEvent, render, screen, waitFor, within} from "@testing-library/react";

import {WorldAutosaveProvider} from "@/components/world-autosave/WorldAutosave";
import {ThemeProvider} from "@/components/theme/ThemeProvider";
import {PopupProvider} from "@/components/popup/Popup";
import {world as initialWorld} from "@/data/worlds/initialWorld";
import {PERSISTED_SCHEMA_VERSION} from "@/compat/migrations";

import EditorPage from "./page";

jest.mock("next/navigation", () => ({
	usePathname: () => "/worlds/8ebc3f3f-b9ca-4f75-898f-e196bae50be4",
}));

describe("EditorPage loading", () => {
	const installSuccessfulEditorFetch = (world = initialWorld, revision = 1) => {
		const worldId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: jest.fn(async (input: RequestInfo | URL) => {
				if (String(input) === "/api/auth/csrf") {
					return {status: 200, ok: true, json: async () => ({data: {csrfToken: "csrf"}})} as Response;
				}
				return {
					status: 200,
					ok: true,
					json: async () => ({
						data: {
							editorSlug: "my-private-world",
							id: worldId,
							name: "My private world",
							ownerUserId: "3e816c4d-b957-45dc-8523-d53ec04c8d0f",
							revision,
							schemaVersion: PERSISTED_SCHEMA_VERSION,
							world,
						},
					}),
				} as Response;
			}),
		});
		return worldId;
	};

	afterEach(() => {
		jest.restoreAllMocks();
		Reflect.deleteProperty(globalThis, "fetch");
	});

	it("does not render the initial world while the main-world request is pending", () => {
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: jest.fn(() => new Promise(() => {})),
		});

		const {container} = render(
			<ThemeProvider>
				<PopupProvider>
					<WorldAutosaveProvider>
						<EditorPage />
					</WorldAutosaveProvider>
				</PopupProvider>
			</ThemeProvider>,
		);

		expect(screen.getByRole("status")).toHaveTextContent("Loading world…");
		expect(container.querySelector("[data-map].map--loading")).toBeInTheDocument();
		expect(
			within(container.querySelector(".leftSideBar") as HTMLElement).getByRole("button", {
				name: "Map",
			}),
		).toBeInTheDocument();
		expect(container.querySelector(".command-line")).toBeInTheDocument();
		expect(screen.getByRole("textbox", {name: "Game command", hidden: true})).toBeDisabled();
		expect(screen.queryByRole("button", {name: "Shop Floor"})).not.toBeInTheDocument();
	});

	it("temporarily pans with Space without changing room placement", async () => {
		jest.spyOn(window, "scrollTo").mockImplementation(() => {});
		installSuccessfulEditorFetch();

		const {container} = render(
			<ThemeProvider>
				<PopupProvider>
					<WorldAutosaveProvider>
						<EditorPage />
					</WorldAutosaveProvider>
				</PopupProvider>
			</ThemeProvider>,
		);
		await waitFor(() =>
			expect(container.querySelector("[data-map].map--loading")).not.toBeInTheDocument(),
		);

		const map = container.querySelector<HTMLElement>("[data-map]")!;
		const addRoomButton = screen.getByRole("button", {name: "Add room"});
		addRoomButton.focus();

		fireEvent.keyDown(window, {key: " ", code: "Space"});
		expect(map).toHaveClass("map--space-pan");
		expect(addRoomButton).toHaveAttribute("aria-pressed", "false");
		expect(addRoomButton).not.toHaveFocus();
		fireEvent.keyUp(window, {key: " ", code: "Space"});
		expect(map).not.toHaveClass("map--space-pan");

		fireEvent.click(addRoomButton);
		const cancelRoomPlacement = screen.getByRole("button", {name: "Cancel room placement"});
		fireEvent.keyDown(cancelRoomPlacement, {key: " ", code: "Space"});
		expect(map).toHaveClass("map--space-pan");
		expect(cancelRoomPlacement).toHaveAttribute("aria-pressed", "true");
		fireEvent.keyUp(cancelRoomPlacement, {key: " ", code: "Space"});
		expect(screen.getByRole("button", {name: "Cancel room placement"})).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});

	it("does not expose fallback world data when private loading fails", async () => {
		jest.spyOn(window, "scrollTo").mockImplementation(() => {});
		const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: jest.fn(async () => ({status: 500, ok: false}) as Response),
		});

		const {container} = render(
			<ThemeProvider>
				<PopupProvider>
					<WorldAutosaveProvider>
						<EditorPage />
					</WorldAutosaveProvider>
				</PopupProvider>
			</ThemeProvider>,
		);

		await waitFor(() => expect(warning).toHaveBeenCalled());

		expect(container.querySelector("[data-map].map--loading")).toBeInTheDocument();
		expect(screen.queryByRole("button", {name: "Shop Floor"})).not.toBeInTheDocument();
		expect(warning).toHaveBeenCalledWith(
			"Could not load the private editor world.",
			expect.any(Error),
		);
	});

	it("opens the empty command library for the initial world", async () => {
		jest.spyOn(window, "scrollTo").mockImplementation(() => {});
		installSuccessfulEditorFetch();

		const {container} = render(
			<ThemeProvider>
				<PopupProvider>
					<WorldAutosaveProvider>
						<EditorPage />
					</WorldAutosaveProvider>
				</PopupProvider>
			</ThemeProvider>,
		);
		await waitFor(() =>
			expect(container.querySelector("[data-map].map--loading")).not.toBeInTheDocument(),
		);

		const desktopNavigation = within(container.querySelector(".leftSideBar") as HTMLElement);
		fireEvent.click(desktopNavigation.getByRole("button", {name: "Logic"}));
		fireEvent.click(screen.getByRole("button", {name: /Commands Define the commands/}));

		expect(screen.getByRole("heading", {name: "Commands"})).toBeInTheDocument();
		expect(screen.getByRole("searchbox", {name: "Find a command"})).toBeInTheDocument();
		expect(container.querySelector(".rightSideBar")).toBeInTheDocument();
		expect(screen.getByRole("button", {name: /Travel/})).toBeInTheDocument();
		expect(screen.getByRole("button", {name: "New command"})).toBeInTheDocument();
		expect(screen.getByRole("button", {name: "Edit command"})).toBeInTheDocument();

		fireEvent.click(desktopNavigation.getByRole("button", {name: "Logic"}));

		expect(screen.getByRole("heading", {name: "Logic"})).toBeInTheDocument();
		expect(screen.getByText("Choose what you want to build.")).toBeInTheDocument();
		expect(screen.queryByRole("button", {name: "Back to Commands"})).not.toBeInTheDocument();
	});
});
