/** @jest-environment node */

import {RequestBodyError, readBoundedJson} from "./requestBody";

describe("bounded request JSON", () => {
	it("parses a body within its endpoint limit", async () => {
		await expect(
			readBoundedJson(
				new Request("http://localhost", {method: "POST", body: JSON.stringify({value: "ok"})}),
				64,
			),
		).resolves.toEqual({value: "ok"});
	});

	it("rejects both declared and measured oversized bodies", async () => {
		await expect(
			readBoundedJson(
				new Request("http://localhost", {
					method: "POST",
					headers: {"content-length": "100"},
					body: "{}",
				}),
				10,
			),
		).rejects.toMatchObject({code: "REQUEST_TOO_LARGE"});
		await expect(
			readBoundedJson(new Request("http://localhost", {method: "POST", body: '"123456"'}), 4),
		).rejects.toBeInstanceOf(RequestBodyError);
	});

	it("distinguishes malformed JSON", async () => {
		await expect(
			readBoundedJson(new Request("http://localhost", {method: "POST", body: "{"}), 10),
		).rejects.toMatchObject({code: "INVALID_JSON"});
	});
});
