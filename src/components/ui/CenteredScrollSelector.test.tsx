import {fireEvent, render, screen} from "@testing-library/react";
import {CenteredScrollSelector} from "./CenteredScrollSelector";

const items = [
	{id: "lower", label: "Lower"},
	{id: "ground", label: "Ground"},
	{id: "upper", label: "Upper"},
];

function renderSelector(
	input: {
		activeId?: string;
		deferClickActivationUntilScroll?: boolean;
		onActiveChange?: jest.Mock;
	} = {},
) {
	const onActiveChange = input.onActiveChange ?? jest.fn();
	const result = render(
		<CenteredScrollSelector
			items={items}
			activeId={input.activeId ?? "ground"}
			onActiveChange={onActiveChange}
			getId={(item) => item.id}
			renderLabel={(item) => item.label}
			ariaLabel="Test layers"
			deferClickActivationUntilScroll={input.deferClickActivationUntilScroll}
		/>,
	);
	return {...result, onActiveChange};
}

function rect(top: number, height = 40) {
	return {
		top,
		bottom: top + height,
		left: 0,
		right: 100,
		x: 0,
		y: top,
		width: 100,
		height,
	} as DOMRect;
}

describe("CenteredScrollSelector", () => {
	it("communicates the active item without hiding the other choices", () => {
		renderSelector();

		expect(screen.getByRole("button", {name: "Ground"})).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByRole("button", {name: "Lower"})).toHaveAttribute("aria-pressed", "false");
		expect(screen.getByRole("button", {name: "Upper"})).toHaveAttribute("aria-pressed", "false");
	});

	it("activates a clicked item when native centering is unavailable", () => {
		const {onActiveChange} = renderSelector();

		fireEvent.click(screen.getByRole("button", {name: "Upper"}));

		expect(onActiveChange).toHaveBeenCalledWith(items[2]);
	});

	it("can defer click activation until scrolling chooses the centered item", () => {
		const {onActiveChange} = renderSelector({deferClickActivationUntilScroll: true});
		const upper = screen.getByRole("button", {name: "Upper"});
		const scrollIntoView = jest.fn();
		Object.defineProperty(upper, "scrollIntoView", {configurable: true, value: scrollIntoView});

		fireEvent.click(upper);

		expect(scrollIntoView).toHaveBeenCalledWith({
			behavior: "smooth",
			block: "center",
			inline: "nearest",
		});
		expect(onActiveChange).not.toHaveBeenCalled();
	});

	it("selects the item closest to the visual center after scrolling", () => {
		const {onActiveChange} = renderSelector();
		const list = screen.getByLabelText("Test layers");
		jest.spyOn(list, "getBoundingClientRect").mockReturnValue(rect(0, 300));
		jest
			.spyOn(screen.getByRole("button", {name: "Lower"}), "getBoundingClientRect")
			.mockReturnValue(rect(20));
		jest
			.spyOn(screen.getByRole("button", {name: "Ground"}), "getBoundingClientRect")
			.mockReturnValue(rect(70));
		jest
			.spyOn(screen.getByRole("button", {name: "Upper"}), "getBoundingClientRect")
			.mockReturnValue(rect(130));

		fireEvent.scroll(list);

		expect(onActiveChange).toHaveBeenCalledWith(items[2]);
	});

	it("moves one item at a time with vertical arrow keys", () => {
		const {onActiveChange} = renderSelector();
		const list = screen.getByLabelText("Test layers");

		fireEvent.keyDown(list, {key: "ArrowUp"});
		fireEvent.keyDown(list, {key: "ArrowDown"});

		expect(onActiveChange).toHaveBeenNthCalledWith(1, items[0]);
		expect(onActiveChange).toHaveBeenNthCalledWith(2, items[2]);
	});

	it.each([
		["lower", "ArrowUp"],
		["upper", "ArrowDown"],
	])("does not emit a redundant change past the %s boundary", (activeId, key) => {
		const {onActiveChange} = renderSelector({activeId});

		fireEvent.keyDown(screen.getByLabelText("Test layers"), {key});

		expect(onActiveChange).not.toHaveBeenCalled();
	});

	it("leaves ordinary keys available to their normal controls", () => {
		const {onActiveChange} = renderSelector();

		const event = new KeyboardEvent("keydown", {key: "Enter", bubbles: true, cancelable: true});
		screen.getByLabelText("Test layers").dispatchEvent(event);

		expect(event.defaultPrevented).toBe(false);
		expect(onActiveChange).not.toHaveBeenCalled();
	});
});
