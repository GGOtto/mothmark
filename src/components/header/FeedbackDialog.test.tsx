import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {readBrowserCsrfToken} from "@/auth/browserCsrf";
import {FeedbackDialog} from "./FeedbackDialog";

jest.mock("@/auth/browserCsrf", () => ({readBrowserCsrfToken: jest.fn()}));

describe("FeedbackDialog", () => {
	const fetchMock = jest.fn();

	beforeEach(() => {
		jest.mocked(readBrowserCsrfToken).mockReturnValue("csrf-token");
		Object.defineProperty(global, "fetch", {configurable: true, value: fetchMock});
	});

	it("submits categorized feedback with the current page", async () => {
		const user = userEvent.setup();
		const onClose = jest.fn();
		fetchMock.mockResolvedValue({
			json: async () => ({data: {sent: true}}),
			ok: true,
			status: 201,
		});
		render(<FeedbackDialog onClose={onClose} />);

		await user.selectOptions(screen.getByLabelText("About"), "idea");
		await user.type(screen.getByLabelText("Message"), "Please add another publishing option.");
		await user.click(screen.getByRole("button", {name: "Send feedback"}));

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/feedback",
			expect.objectContaining({
				method: "POST",
				headers: {"content-type": "application/json", "x-csrf-token": "csrf-token"},
			}),
		);
		const options = fetchMock.mock.calls[0][1] as RequestInit;
		expect(JSON.parse(String(options.body))).toEqual({
			category: "idea",
			includePage: true,
			message: "Please add another publishing option.",
			page: window.location.href,
			website: "",
		});
		expect(await screen.findByText("Feedback sent.")).toBeInTheDocument();
	});

	it("shows the server's rate-limit message and preserves the draft", async () => {
		const user = userEvent.setup();
		fetchMock.mockResolvedValue({
			json: async () => ({error: {message: "You can send up to 3 feedback messages per hour."}}),
			ok: false,
			status: 429,
		});
		render(<FeedbackDialog onClose={jest.fn()} />);

		const message = screen.getByLabelText("Message");
		await user.type(message, "One more note.");
		await user.click(screen.getByRole("button", {name: "Send feedback"}));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"You can send up to 3 feedback messages per hour.",
		);
		expect(message).toHaveValue("One more note.");
	});
});
