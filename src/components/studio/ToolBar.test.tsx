import {act, fireEvent, render, screen} from "@testing-library/react";
import {useToolBarStatus} from "./ToolBar";

function StatusHarness() {
	const {hoverStatus, noticeStatus, updateStatus} = useToolBarStatus();

	return (
		<>
			<button
				type="button"
				onClick={() => updateStatus({kind: "cancelled", label: "Cancelled"}, {channel: "notice"})}
			>
				Cancel
			</button>
			<button
				type="button"
				onPointerEnter={() => updateStatus({kind: "node", label: "North passage"})}
				onPointerLeave={() => updateStatus(null)}
			>
				Node
			</button>
			<div data-testid="hover-status">{hoverStatus?.label}</div>
			<div data-testid="notice-status">{noticeStatus?.label}</div>
		</>
	);
}

describe("useToolBarStatus", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it("keeps hover and timed notice statuses independent", () => {
		render(<StatusHarness />);

		fireEvent.click(screen.getByRole("button", {name: "Cancel"}));
		expect(screen.getByTestId("notice-status")).toHaveTextContent("Cancelled");

		fireEvent.pointerEnter(screen.getByRole("button", {name: "Node"}));
		expect(screen.getByTestId("hover-status")).toHaveTextContent("North passage");
		expect(screen.getByTestId("notice-status")).toHaveTextContent("Cancelled");

		fireEvent.pointerLeave(screen.getByRole("button", {name: "Node"}));
		expect(screen.getByTestId("hover-status")).toBeEmptyDOMElement();

		act(() => jest.advanceTimersByTime(1799));
		expect(screen.getByTestId("notice-status")).toHaveTextContent("Cancelled");

		act(() => jest.advanceTimersByTime(1));
		expect(screen.getByTestId("notice-status")).toBeEmptyDOMElement();
	});
});
