import "server-only";

export type FeedbackEmail = {
	accountEmail?: string | null;
	accountType?: "anonymous" | "registered";
	category: "bug" | "general" | "idea";
	message: string;
	page?: string;
	username?: string | null;
};

export function feedbackEmailIsConfigured(): boolean {
	return Boolean(
		process.env.RESEND_API_KEY?.trim() &&
		process.env.AUTH_EMAIL_FROM?.trim() &&
		process.env.FEEDBACK_EMAIL_TO?.trim(),
	);
}

export async function sendFeedbackEmail(message: FeedbackEmail): Promise<void> {
	const apiKey = process.env.RESEND_API_KEY;
	const from = process.env.AUTH_EMAIL_FROM;
	const to = process.env.FEEDBACK_EMAIL_TO;
	if (!apiKey || !from || !to) throw new Error("Feedback email is not configured.");

	const identity = message.username || message.accountEmail || message.accountType || "signed out";
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {authorization: `Bearer ${apiKey}`, "content-type": "application/json"},
		body: JSON.stringify({
			from,
			to: [to],
			subject: `Mothmark feedback: ${message.category}`,
			text: [
				`Category: ${message.category}`,
				`From: ${identity}`,
				`Account type: ${message.accountType ?? "none"}`,
				`Page: ${message.page ?? "not included"}`,
				"",
				message.message,
			].join("\n"),
		}),
	});
	if (!response.ok) throw new Error(`Feedback email delivery failed (${response.status}).`);
}
