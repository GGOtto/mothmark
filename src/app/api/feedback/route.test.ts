/** @jest-environment node */

import {resolveCurrentActor} from "@/auth/currentActor";
import {getOwnedAccountSummary} from "@/db/dbal/accountRepository";
import {enforceFeedbackRateLimit, FeedbackRateLimitError} from "@/db/dbal/feedbackRepository";
import {feedbackEmailIsConfigured, sendFeedbackEmail} from "@/feedback/feedbackEmail";

import {POST} from "./route";

jest.mock("@/auth/currentActor", () => ({resolveCurrentActor: jest.fn()}));
jest.mock("@/db/dbal/accountRepository", () => ({getOwnedAccountSummary: jest.fn()}));
jest.mock("@/db/dbal/feedbackRepository", () => ({
	enforceFeedbackRateLimit: jest.fn(),
	FeedbackRateLimitError: class FeedbackRateLimitError extends Error {
		readonly retryAfterSeconds = 3600;
		constructor() {
			super("You can send up to 3 feedback messages per hour.");
		}
	},
}));
jest.mock("@/feedback/feedbackEmail", () => ({
	feedbackEmailIsConfigured: jest.fn(),
	sendFeedbackEmail: jest.fn(),
}));

const feedbackRequest = (body: unknown) =>
	new Request("http://localhost/api/feedback", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: "http://localhost",
			cookie: "mothmark_editor_csrf=csrf",
			"x-csrf-token": "csrf",
			"x-forwarded-for": "203.0.113.7",
		},
		body: JSON.stringify(body),
	});

describe("feedback API", () => {
	beforeEach(() => {
		jest.mocked(feedbackEmailIsConfigured).mockReturnValue(true);
		jest.mocked(resolveCurrentActor).mockResolvedValue(undefined);
		jest.mocked(enforceFeedbackRateLimit).mockResolvedValue(undefined);
		jest.mocked(sendFeedbackEmail).mockResolvedValue(undefined);
	});

	it("rate limits and delivers valid signed-out feedback", async () => {
		const response = await POST(
			feedbackRequest({
				category: "idea",
				includePage: true,
				message: "A focused piece of feedback.",
				page: "http://localhost/play",
				website: "",
			}),
		);

		expect(response.status).toBe(201);
		expect(enforceFeedbackRateLimit).toHaveBeenCalledWith({
			actorUserId: undefined,
			network: "203.0.113.7",
		});
		expect(sendFeedbackEmail).toHaveBeenCalledWith({
			accountEmail: undefined,
			accountType: undefined,
			category: "idea",
			message: "A focused piece of feedback.",
			page: "http://localhost/play",
			username: undefined,
		});
		expect(getOwnedAccountSummary).not.toHaveBeenCalled();
	});

	it("rejects empty feedback before recording a rate-limit event", async () => {
		const response = await POST(feedbackRequest({category: "general", message: ""}));
		expect(response.status).toBe(400);
		expect(enforceFeedbackRateLimit).not.toHaveBeenCalled();
	});

	it("returns a retry window when the sender reaches the limit", async () => {
		jest.mocked(enforceFeedbackRateLimit).mockRejectedValue(new FeedbackRateLimitError());
		const response = await POST(feedbackRequest({category: "bug", message: "A fourth note."}));

		expect(response.status).toBe(429);
		expect(response.headers.get("retry-after")).toBe("3600");
		expect(await response.json()).toEqual({
			error: {
				code: "RATE_LIMITED",
				message: "You can send up to 3 feedback messages per hour.",
			},
		});
		expect(sendFeedbackEmail).not.toHaveBeenCalled();
	});

	it("fails closed when feedback delivery is not configured", async () => {
		jest.mocked(feedbackEmailIsConfigured).mockReturnValue(false);
		const response = await POST(feedbackRequest({category: "general", message: "A note."}));

		expect(response.status).toBe(503);
		expect(enforceFeedbackRateLimit).not.toHaveBeenCalled();
	});
});
