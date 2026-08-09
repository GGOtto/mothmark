import {fireEvent, render, screen} from "@testing-library/react";
import {AdjustableBox} from "./AdjustableBox";

function setRect(element: Element, value: Partial<DOMRect>) {
	jest.spyOn(element, "getBoundingClientRect").mockReturnValue({
		top: 100,
		bottom: 300,
		left: 100,
		right: 400,
		x: 100,
		y: 100,
		width: 300,
		height: 200,
		toJSON: () => ({}),
		...value,
	});
}

describe("AdjustableBox", () => {
	beforeAll(() => {
		Object.defineProperty(window, "PointerEvent", {
			configurable: true,
			value: MouseEvent,
		});
	});

	it("applies numeric and authored CSS size constraints", () => {
		const {container} = render(
			<AdjustableBox width={320} height="40%" minWidth={120} maxHeight="60%">
				Content
			</AdjustableBox>,
		);

		expect(container.firstChild).toHaveStyle({
			width: "320px",
			height: "40%",
			minWidth: "120px",
			maxHeight: "60%",
		});
	});

	it("renders only the requested resize handles with useful semantics", () => {
		render(<AdjustableBox adjustableEdges={["top", "right"]}>Content</AdjustableBox>);

		expect(screen.getByRole("separator", {name: "Resize top edge"})).toHaveAttribute(
			"aria-orientation",
			"horizontal",
		);
		expect(screen.getByRole("separator", {name: "Resize right edge"})).toHaveAttribute(
			"aria-orientation",
			"vertical",
		);
		expect(screen.queryByRole("separator", {name: "Resize left edge"})).not.toBeInTheDocument();
	});

	it("resizes from the bottom edge and clamps to the maximum", () => {
		const {container} = render(
			<div>
				<AdjustableBox adjustableEdges={["bottom"]} minHeight={120} maxHeight={360}>
					Content
				</AdjustableBox>
			</div>,
		);
		const box = container.querySelector(".adjustableBox")!;
		setRect(box.parentElement!, {height: 800, bottom: 800});
		setRect(box, {top: 100, bottom: 300, height: 200});

		fireEvent.pointerDown(screen.getByRole("separator", {name: "Resize bottom edge"}));
		fireEvent.pointerMove(window, {clientY: 600});

		expect(box).toHaveStyle({height: "360px"});
		expect(box).toHaveClass("adjustableBox--resizing");
		fireEvent.pointerUp(window);
		expect(box).not.toHaveClass("adjustableBox--resizing");
	});

	it("resizes from the left edge and clamps to the minimum", () => {
		const {container} = render(
			<div>
				<AdjustableBox adjustableEdges={["left"]} minWidth={180} maxWidth={500}>
					Content
				</AdjustableBox>
			</div>,
		);
		const box = container.querySelector(".adjustableBox")!;
		setRect(box.parentElement!, {width: 800, right: 800});
		setRect(box, {left: 100, right: 400, width: 300});

		fireEvent.pointerDown(screen.getByRole("separator", {name: "Resize left edge"}));
		fireEvent.pointerMove(window, {clientX: 350});

		expect(box).toHaveStyle({width: "180px"});
	});
});
