import {render, screen} from "@testing-library/react";

import {WorldAutosaveProvider} from "@/components/world-autosave/WorldAutosave";

import EditorPage from "./page";

describe("EditorPage loading", () => {
	afterEach(() => {
		Reflect.deleteProperty(globalThis, "fetch");
	});

	it("does not render the example world while the main-world request is pending", () => {
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: jest.fn(() => new Promise(() => {})),
		});

		const {container} = render(
			<WorldAutosaveProvider>
				<EditorPage />
			</WorldAutosaveProvider>,
		);

		expect(screen.getByRole("status")).toHaveTextContent("Loading world…");
		expect(container.querySelector("[data-map].map--loading")).toBeInTheDocument();
		expect(screen.getByRole("button", {name: "Map"})).toBeInTheDocument();
		expect(container.querySelector(".command-line")).toBeInTheDocument();
		expect(screen.getByRole("textbox", {name: "Game command"})).toBeDisabled();
		expect(screen.queryByRole("button", {name: "Dungeon Entrance"})).not.toBeInTheDocument();
	});
});
