/** @jest-environment node */

import {subscribeEmail} from "@/db/dbal/subscriberRepository";
import {POST} from "./route";

jest.mock("@/db/dbal/subscriberRepository", () => ({subscribeEmail: jest.fn()}));

const request = (body: unknown, csrf = true) =>
	new Request("http://localhost/api/subscribers", {
		body: JSON.stringify(body),
		headers: {
			"content-type": "application/json",
			origin: "http://localhost",
			...(csrf && {cookie: "mothmark_editor_csrf=proof", "x-csrf-token": "proof"}),
		},
		method: "POST",
	});

describe("public email subscriptions", () => {
	it("requires same-origin request proof", async () => {
		const response = await POST(request({email: "reader@example.com"}, false));
		expect(response.status).toBe(403);
		expect(subscribeEmail).not.toHaveBeenCalled();
	});

	it("stores a normalized valid footer subscription", async () => {
		const response = await POST(request({email: "reader@example.com"}));
		expect(response.status).toBe(200);
		expect(subscribeEmail).toHaveBeenCalledWith({
			email: "reader@example.com",
			source: "footer",
		});
		expect(await response.json()).toEqual({
			data: {message: "You're subscribed to Notes from Mothmark."},
		});
	});

	it("rejects malformed email addresses", async () => {
		const response = await POST(request({email: "not an email"}));
		expect(response.status).toBe(400);
		expect(subscribeEmail).not.toHaveBeenCalled();
	});
});
