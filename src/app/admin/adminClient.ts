"use client";

export function adminNextPath(search: string): string {
	const candidate = new URLSearchParams(search).get("next");
	if (!candidate) return "/admin/users";
	try {
		const destination = new URL(candidate, "https://mothmark.invalid");
		return destination.origin === "https://mothmark.invalid" &&
			destination.pathname.startsWith("/admin/")
			? `${destination.pathname}${destination.search}${destination.hash}`
			: "/admin/users";
	} catch {
		return "/admin/users";
	}
}

export async function readAdminJson<T>(path: string): Promise<T> {
	const response = await fetch(path, {cache: "no-store"});
	if (response.status === 401) {
		window.location.replace(`/admin/sign-in?next=${encodeURIComponent(window.location.pathname)}`);
		throw new Error("Administrator sign-in is required.");
	}
	const body = (await response.json()) as T & {error?: {message?: string}};
	if (!response.ok) throw new Error(body.error?.message || "The administrator request failed.");
	return body;
}

export async function mutateAdminJson<T>(
	path: string,
	method: "DELETE" | "POST" | "PUT",
	body?: unknown,
): Promise<T> {
	const csrfResponse = await fetch("/api/auth/csrf?audience=admin", {cache: "no-store"});
	const csrfBody = (await csrfResponse.json()) as {data?: {csrfToken?: string}};
	const csrf = csrfBody.data?.csrfToken;
	if (!csrf) throw new Error("Administrator request verification failed.");
	const response = await fetch(path, {
		body: body === undefined ? undefined : JSON.stringify(body),
		headers: {"content-type": "application/json", "x-csrf-token": csrf},
		method,
	});
	if (response.status === 401) {
		window.location.replace(`/admin/sign-in?next=${encodeURIComponent(window.location.pathname)}`);
		throw new Error("Administrator sign-in is required.");
	}
	if (response.status === 204) return undefined as T;
	const responseBody = (await response.json()) as T & {error?: {message?: string}};
	if (!response.ok)
		throw new Error(responseBody.error?.message || "The administrator request failed.");
	return responseBody;
}

export const formatAdminDate = (value: string | null): string =>
	value
		? new Intl.DateTimeFormat(undefined, {dateStyle: "medium", timeStyle: "short"}).format(
				new Date(value),
			)
		: "—";

export const formatBytes = (bytes: number): string =>
	bytes < 1_024 ? `${bytes} B` : `${(bytes / 1_024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
