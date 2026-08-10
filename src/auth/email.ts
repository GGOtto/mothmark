import "server-only";

export type AuthenticationEmail = {
	email: string;
	kind: "password_reset" | "verify_email";
	token: string;
};

export function authenticationEmailIsConfigured(): boolean {
	return Boolean(
		process.env.RESEND_API_KEY?.trim() &&
		process.env.AUTH_EMAIL_FROM?.trim() &&
		process.env.PUBLIC_APP_ORIGIN?.trim(),
	);
}

export async function sendAuthenticationEmail(message: AuthenticationEmail): Promise<void> {
	const apiKey = process.env.RESEND_API_KEY;
	const from = process.env.AUTH_EMAIL_FROM;
	const origin = process.env.PUBLIC_APP_ORIGIN;
	if (!apiKey || !from || !origin) {
		throw new Error("Authentication email is not configured.");
	}
	const path = message.kind === "verify_email" ? "/verify-email" : "/reset-password";
	const action = message.kind === "verify_email" ? "Verify email" : "Reset password";
	const url = new URL(path, origin);
	url.searchParams.set("token", message.token);
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {authorization: `Bearer ${apiKey}`, "content-type": "application/json"},
		body: JSON.stringify({
			from,
			to: [message.email],
			subject: `${action} for Mothmark`,
			text: `${action}: ${url.toString()}\n\nIf you did not request this, you can ignore this message.`,
		}),
	});
	if (!response.ok) throw new Error(`Authentication email delivery failed (${response.status}).`);
}
