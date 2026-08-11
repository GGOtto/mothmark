import {sessionClientLabel} from "./sessionClient";

describe("account session client labels", () => {
	it.each([
		[
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
			"Safari on macOS",
		],
		[
			"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36",
			"Chrome on Android",
		],
		["Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/128.0", "Firefox on Windows"],
		[
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
			"Safari on iPhone",
		],
	] as const)("derives a limited browser and device label", (userAgent, expected) => {
		expect(sessionClientLabel(userAgent)).toBe(expected);
	});

	it("does not invent a label when the request has no user agent", () => {
		expect(sessionClientLabel(null)).toBeNull();
	});
});
