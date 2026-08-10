import {EDITOR_CSRF_COOKIE} from "./cookieNames";
import {readBrowserCsrfToken} from "./browserCsrf";

function clearCookies() {
	for (const cookie of document.cookie.split(";")) {
		const name = cookie.split("=")[0]?.trim();
		if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
	}
}

describe("readBrowserCsrfToken", () => {
	beforeEach(clearCookies);
	afterAll(clearCookies);

	it("returns the decoded editor CSRF cookie", () => {
		document.cookie = `${EDITOR_CSRF_COOKIE}=token%20with%20spaces; Path=/`;

		expect(readBrowserCsrfToken()).toBe("token with spaces");
	});

	it("finds the editor token among unrelated cookies", () => {
		document.cookie = "analytics=ignored; Path=/";
		document.cookie = `${EDITOR_CSRF_COOKIE}=editor-token; Path=/`;
		document.cookie = "preference=dark; Path=/";

		expect(readBrowserCsrfToken()).toBe("editor-token");
	});

	it("does not confuse a similarly named cookie for the editor token", () => {
		document.cookie = `${EDITOR_CSRF_COOKIE}-legacy=wrong-token; Path=/`;

		expect(readBrowserCsrfToken()).toBeUndefined();
	});

	it("returns undefined when the cookie is absent", () => {
		expect(readBrowserCsrfToken()).toBeUndefined();
	});

	it("treats a malformed encoded cookie as unavailable instead of crashing the editor", () => {
		document.cookie = `${EDITOR_CSRF_COOKIE}=%not-uri; Path=/`;

		expect(readBrowserCsrfToken()).toBeUndefined();
	});
});
