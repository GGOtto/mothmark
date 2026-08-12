import {act, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {useRef, useState} from "react";
import {AnchoredLayer, ModalLayer} from "./Overlay";

function AnchoredExample() {
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	return (
		<>
			<button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
				Open values
			</button>
			{open ? (
				<AnchoredLayer
					anchorRef={triggerRef}
					ariaLabel="Values"
					mobilePresentation="sheet"
					onClose={() => setOpen(false)}
					preferredWidth={250}
				>
					<button type="button">Choose value</button>
				</AnchoredLayer>
			) : null}
		</>
	);
}

describe("overlay primitives", () => {
	const originalMatchMedia = window.matchMedia;
	const originalVisualViewport = Object.getOwnPropertyDescriptor(window, "visualViewport");

	afterEach(() => {
		window.matchMedia = originalMatchMedia;
		if (originalVisualViewport) {
			Object.defineProperty(window, "visualViewport", originalVisualViewport);
		} else {
			Reflect.deleteProperty(window, "visualViewport");
		}
		document.body.style.overflow = "";
	});

	it("tracks the visible viewport and restores focus after a modal closes", async () => {
		const listeners = new Map<string, EventListener>();
		const viewport = {
			height: 300,
			offsetLeft: 0,
			offsetTop: 180,
			width: 390,
			addEventListener: jest.fn((type: string, listener: EventListener) =>
				listeners.set(type, listener),
			),
			removeEventListener: jest.fn(),
		};
		Object.defineProperty(window, "visualViewport", {configurable: true, value: viewport});
		const close = jest.fn();
		const trigger = document.createElement("button");
		document.body.append(trigger);
		trigger.focus();
		const {rerender, unmount} = render(
			<ModalLayer ariaLabel="Example" onClose={close}>
				<button type="button">First action</button>
				<button type="button">Last action</button>
			</ModalLayer>,
		);

		const dialog = screen.getByRole("dialog", {name: "Example"});
		expect(dialog.parentElement).toHaveStyle({
			"--overlay-viewport-height": "300px",
			"--overlay-viewport-top": "180px",
		});
		expect(screen.getByRole("button", {name: "First action"})).toHaveFocus();
		expect(document.body).toHaveStyle({overflow: "hidden"});

		viewport.height = 220;
		act(() => listeners.get("resize")?.(new Event("resize")));
		expect(dialog.parentElement).toHaveStyle({"--overlay-viewport-height": "220px"});

		rerender(<></>);
		expect(trigger).toHaveFocus();
		unmount();
		trigger.remove();
	});

	it("promotes a complex anchored layer to a focus-contained mobile sheet", async () => {
		window.matchMedia = jest.fn().mockReturnValue({
			matches: true,
			addEventListener: jest.fn(),
			removeEventListener: jest.fn(),
		});
		const user = userEvent.setup();
		render(<AnchoredExample />);
		const trigger = screen.getByRole("button", {name: "Open values"});

		await user.click(trigger);
		const menu = screen.getByRole("menu", {name: "Values"});
		expect(menu).toHaveClass("anchoredLayer--sheet");
		expect(document.body).toHaveStyle({overflow: "hidden"});
		expect(screen.getByRole("button", {name: "Choose value"})).toHaveFocus();

		await user.keyboard("{Escape}");
		expect(screen.queryByRole("menu", {name: "Values"})).not.toBeInTheDocument();
		expect(trigger).toHaveFocus();
		expect(document.body).not.toHaveStyle({overflow: "hidden"});
	});
});
