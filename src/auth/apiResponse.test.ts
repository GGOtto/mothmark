/** @jest-environment node */

import {readOptionalJson} from "./apiResponse";

describe("readOptionalJson", () => {
	it("accepts a successful response with no body", async () => {
		const response = new Response(null, {status: 204});

		await expect(readOptionalJson(response)).resolves.toBeUndefined();
	});

	it("parses a JSON response", async () => {
		const response = Response.json({data: {userId: "user-id"}});

		await expect(readOptionalJson(response)).resolves.toEqual({data: {userId: "user-id"}});
	});

	it("uses a stable request error for malformed error responses", async () => {
		const response = new Response("not-json", {status: 500});

		await expect(readOptionalJson(response)).rejects.toThrow("The request could not be completed.");
	});
});
