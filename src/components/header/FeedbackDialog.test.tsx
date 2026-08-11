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
		render(<FeedbackDialog onClose={onClose} requiresReplyEmail />);

		await user.selectOptions(screen.getByLabelText("About"), "idea");
		await user.type(screen.getByLabelText("Your email"), "reader@example.test");
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
			replyEmail: "reader@example.test",
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
		render(<FeedbackDialog onClose={jest.fn()} requiresReplyEmail />);

		await user.type(screen.getByLabelText("Your email"), "reader@example.test");
		const message = screen.getByLabelText("Message");
		await user.type(message, "One more note.");
		await user.click(screen.getByRole("button", {name: "Send feedback"}));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"You can send up to 3 feedback messages per hour.",
		);
		expect(message).toHaveValue("One more note.");
	});

	it("uses the registered account email without asking for it again", () => {
		render(<FeedbackDialog onClose={jest.fn()} requiresReplyEmail={false} />);

		expect(screen.queryByLabelText("Your email")).not.toBeInTheDocument();
	});

	it("makes the required reply email clear and focuses it first", () => {
		render(<FeedbackDialog onClose={jest.fn()} requiresReplyEmail />);

		expect(screen.getByLabelText("Your email")).toHaveAttribute("placeholder", "you@example.com");
		expect(screen.getByLabelText("Your email")).toHaveFocus();
	});

	it("accepts an empty successful response", async () => {
		const user = userEvent.setup();
		fetchMock.mockResolvedValue({
			json: async () => {
				throw new SyntaxError("empty response");
			},
			ok: true,
			status: 204,
		});
		render(<FeedbackDialog onClose={jest.fn()} requiresReplyEmail={false} />);

		await user.type(screen.getByLabelText("Message"), "A note.");
		await user.click(screen.getByRole("button", {name: "Send feedback"}));

		expect(await screen.findByText("Feedback sent.")).toBeInTheDocument();
	});

	it("shows a stable error for a malformed error response", async () => {
		const user = userEvent.setup();
		fetchMock.mockResolvedValue({
			json: async () => {
				throw new SyntaxError("malformed response");
			},
			ok: false,
			status: 502,
		});
		render(<FeedbackDialog onClose={jest.fn()} requiresReplyEmail={false} />);

		await user.type(screen.getByLabelText("Message"), "A note.");
		await user.click(screen.getByRole("button", {name: "Send feedback"}));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Feedback could not be sent. Try again later.",
		);
	});
});
