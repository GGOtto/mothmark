"use client";

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

export const formatAdminDate = (value: string | null): string =>
	value
		? new Intl.DateTimeFormat(undefined, {dateStyle: "medium", timeStyle: "short"}).format(
				new Date(value),
			)
		: "—";

export const formatBytes = (bytes: number): string =>
	bytes < 1_024 ? `${bytes} B` : `${(bytes / 1_024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
