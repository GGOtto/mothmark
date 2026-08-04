import {fireEvent, render, screen, waitFor} from "@testing-library/react";

import {WorldAutosaveProvider} from "@/components/world-autosave/WorldAutosave";
import {ThemeProvider} from "@/components/theme/ThemeProvider";
import {PopupProvider} from "@/components/popup/Popup";

import EditorPage from "./page";

describe("EditorPage loading", () => {
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
		expect(screen.getByRole("button", {name: "Map"})).toBeInTheDocument();
		expect(container.querySelector(".command-line")).toBeInTheDocument();
		expect(screen.getByRole("textbox", {name: "Game command"})).toBeDisabled();
		expect(screen.queryByRole("button", {name: "Dungeon Entrance"})).not.toBeInTheDocument();
	});

	it("shows the temporary opposite tool while Space is held", async () => {
		jest.spyOn(window, "scrollTo").mockImplementation(() => {});
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: jest.fn(async () => ({status: 404, ok: false}) as Response),
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
		await waitFor(() =>
			expect(container.querySelector("[data-map].map--loading")).not.toBeInTheDocument(),
		);

		const editButton = screen.getByRole("button", {name: "Edit"});
		const panButton = screen.getByRole("button", {name: "Pan"});

		fireEvent.keyDown(window, {key: " ", code: "Space"});
		expect(editButton).toHaveAttribute("aria-pressed", "false");
		expect(panButton).toHaveAttribute("aria-pressed", "true");
		fireEvent.keyUp(window, {key: " ", code: "Space"});
		expect(editButton).toHaveAttribute("aria-pressed", "true");

		fireEvent.click(panButton);
		panButton.focus();
		fireEvent.keyDown(panButton, {key: " ", code: "Space"});
		expect(editButton).toHaveAttribute("aria-pressed", "true");
		expect(panButton).toHaveAttribute("aria-pressed", "false");
		expect(panButton).not.toHaveFocus();
		editButton.focus();
		expect(editButton).not.toHaveFocus();
		fireEvent.keyUp(panButton, {key: " ", code: "Space"});
		expect(panButton).toHaveAttribute("aria-pressed", "true");
	});

	it("recovers with the initial world when the world API fails", async () => {
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

		await waitFor(() =>
			expect(container.querySelector("[data-map].map--loading")).not.toBeInTheDocument(),
		);

		expect(screen.getByRole("button", {name: "Dungeon Entrance"})).toBeInTheDocument();
		expect(warning).toHaveBeenCalledWith(
			"Could not load the main world; using the initial world instead.",
			expect.any(Error),
		);
	});

	it("opens the empty command library for the initial world", async () => {
		jest.spyOn(window, "scrollTo").mockImplementation(() => {});
		jest.spyOn(console, "warn").mockImplementation(() => {});
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
		await waitFor(() =>
			expect(container.querySelector("[data-map].map--loading")).not.toBeInTheDocument(),
		);

		fireEvent.click(screen.getByRole("button", {name: "Logic"}));
		fireEvent.click(screen.getByRole("button", {name: /Commands Define the commands/}));

		expect(screen.getByRole("heading", {name: "Commands"})).toBeInTheDocument();
		expect(screen.getByRole("searchbox", {name: "Find a command"})).toBeInTheDocument();
		expect(container.querySelector(".rightSideBar")).toBeInTheDocument();
		expect(screen.getByText("Create a command to begin.")).toBeInTheDocument();
		expect(screen.getByRole("button", {name: "New command"})).toBeInTheDocument();
		expect(screen.queryByRole("button", {name: "Edit command"})).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", {name: "Logic"}));

		expect(screen.getByRole("heading", {name: "Logic"})).toBeInTheDocument();
		expect(screen.getByText("Choose what you want to build.")).toBeInTheDocument();
		expect(screen.queryByRole("button", {name: "Back to Commands"})).not.toBeInTheDocument();
	});
});
