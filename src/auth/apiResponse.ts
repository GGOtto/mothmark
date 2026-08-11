export async function readOptionalJson<T>(response: Response): Promise<T | undefined> {
	const body = await response.text();
	if (!body.trim()) return undefined;

	try {
		return JSON.parse(body) as T;
	} catch {
		throw new Error(
			response.ok ? "The server returned an invalid response." : "The request could not be completed.",
		);
	}
}
