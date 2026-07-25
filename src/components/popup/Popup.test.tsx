import {render, screen} from "@testing-library/react";
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
});
