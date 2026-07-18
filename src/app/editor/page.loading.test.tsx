import {fireEvent, render, screen, waitFor} from "@testing-library/react";

import {WorldAutosaveProvider} from "@/components/world-autosave/WorldAutosave";
import {ThemeProvider} from "@/components/theme/ThemeProvider";

import EditorPage from "./page";

describe("EditorPage loading", () => {
	afterEach(() => {
		jest.restoreAllMocks();
		Reflect.deleteProperty(globalThis, "fetch");
	});

	it("does not render the example world while the main-world request is pending", () => {
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: jest.fn(() => new Promise(() => {})),
		});

		const {container} = render(
			<ThemeProvider>
				<WorldAutosaveProvider>
					<EditorPage />
				</WorldAutosaveProvider>
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
				<WorldAutosaveProvider>
					<EditorPage />
				</WorldAutosaveProvider>
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
});
