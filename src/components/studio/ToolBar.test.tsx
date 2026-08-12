import {act, fireEvent, render, screen} from "@testing-library/react";
import {ToolBar, useToolBarStatus} from "./ToolBar";

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

describe("ToolBar", () => {
	it("uses one explicit control to arm and cancel room placement", () => {
		const onAddingRoomChange = jest.fn();
		const {rerender} = render(
			<ToolBar
				isAddingRoom={false}
				onAddingRoomChange={onAddingRoomChange}
				zoom={1}
				onRecenter={jest.fn()}
				status={{kind: "idle", label: "4 rooms"}}
			/>,
		);

		fireEvent.click(screen.getByRole("button", {name: "Add room"}));
		expect(onAddingRoomChange).toHaveBeenCalledWith(true);
		expect(screen.queryByRole("button", {name: "Edit"})).not.toBeInTheDocument();
		expect(screen.queryByRole("button", {name: "Pan"})).not.toBeInTheDocument();

		rerender(
			<ToolBar
				isAddingRoom
				onAddingRoomChange={onAddingRoomChange}
				zoom={1}
				onRecenter={jest.fn()}
				status={{kind: "placement", label: "Choose where to place the room"}}
			/>,
		);
		fireEvent.click(screen.getByRole("button", {name: "Cancel room placement"}));
		expect(onAddingRoomChange).toHaveBeenLastCalledWith(false);
	});
});
