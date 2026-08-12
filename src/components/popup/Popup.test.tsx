import {act, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {useState} from "react";
import {PopupProvider, usePopup} from "./Popup";

function PopupExamples() {
	const popup = usePopup();
	const [result, setResult] = useState("none");

	return (
		<>
			<button
				type="button"
				onClick={async () => {
					const confirmed = await popup.confirm({
						title: "Delete room?",
						message: "This cannot be undone.",
						danger: true,
					});
					setResult(String(confirmed));
				}}
			>
				Open confirm
			</button>
			<button
				type="button"
				onClick={async () => {
					const name = await popup.prompt({
						title: "Name room",
						label: "Room name",
						required: true,
					});
					setResult(name ?? "cancelled");
				}}
			>
				Open prompt
			</button>
			<output>{result}</output>
		</>
	);
}

function renderExamples() {
	return render(
		<PopupProvider>
			<PopupExamples />
		</PopupProvider>,
	);
}

describe("PopupProvider", () => {
	const originalVisualViewport = Object.getOwnPropertyDescriptor(window, "visualViewport");

	afterEach(() => {
		if (originalVisualViewport) {
			Object.defineProperty(window, "visualViewport", originalVisualViewport);
		} else {
			Reflect.deleteProperty(window, "visualViewport");
		}
		document.body.style.overflow = "";
	});

	it("resolves a confirmation and restores focus", async () => {
		const user = userEvent.setup();
		renderExamples();
		const trigger = screen.getByRole("button", {name: "Open confirm"});

		await user.click(trigger);

		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
		await user.click(screen.getByRole("button", {name: "Confirm"}));

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(screen.getByText("true")).toBeInTheDocument();
		expect(trigger).toHaveFocus();
	});

	it("validates a required prompt and closes on Escape", async () => {
		const user = userEvent.setup();
		renderExamples();

		await user.click(screen.getByRole("button", {name: "Open prompt"}));
		await user.click(screen.getByRole("button", {name: "Save"}));

		expect(screen.getByRole("alert")).toHaveTextContent("This field is required.");

		await user.keyboard("{Escape}");

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(screen.getByText("cancelled")).toBeInTheDocument();
	});

	it("tracks the visual viewport while the onscreen keyboard changes the available space", async () => {
		const listeners = new Map<string, EventListener>();
		const visualViewport = {
			height: 420,
			offsetLeft: 0,
			offsetTop: 280,
			width: 390,
			addEventListener: jest.fn((type: string, listener: EventListener) =>
				listeners.set(type, listener),
			),
			removeEventListener: jest.fn(),
		};
		Object.defineProperty(window, "visualViewport", {
			configurable: true,
			value: visualViewport,
		});
		const user = userEvent.setup();
		renderExamples();

		await user.click(screen.getByRole("button", {name: "Open prompt"}));
		const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;

		expect(backdrop).toHaveStyle({
			"--overlay-viewport-height": "420px",
			"--overlay-viewport-top": "280px",
			"--overlay-viewport-width": "390px",
		});
		expect(document.body).toHaveStyle({overflow: "hidden"});

		visualViewport.height = 260;
		visualViewport.offsetTop = 120;
		act(() => listeners.get("resize")?.(new Event("resize")));

		expect(backdrop).toHaveStyle({
			"--overlay-viewport-height": "260px",
			"--overlay-viewport-top": "120px",
		});

		await user.keyboard("{Escape}");
		expect(document.body).not.toHaveStyle({overflow: "hidden"});
	});

	it("keeps keyboard focus inside the active popup", async () => {
		const user = userEvent.setup();
		renderExamples();

		await user.click(screen.getByRole("button", {name: "Open confirm"}));
		const cancel = screen.getByRole("button", {name: "Cancel"});
		const confirm = screen.getByRole("button", {name: "Confirm"});
		confirm.focus();

		await user.keyboard("{Tab}");
		expect(cancel).toHaveFocus();
		await user.keyboard("{Shift>}{Tab}{/Shift}");
		expect(confirm).toHaveFocus();
	});
});
