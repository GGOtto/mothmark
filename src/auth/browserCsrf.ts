import {EDITOR_CSRF_COOKIE} from "./cookieNames";

export function readBrowserCsrfToken(): string | undefined {
	if (typeof document === "undefined") return undefined;
	for (const part of document.cookie.split(";")) {
		const separator = part.indexOf("=");
		if (separator < 0) continue;
		if (part.slice(0, separator).trim() === EDITOR_CSRF_COOKIE) {
			return decodeURIComponent(part.slice(separator + 1).trim());
		}
	}
	return undefined;
}
