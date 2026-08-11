import "server-only";

export type FeedbackCategory = "bug" | "general" | "idea";

export type FeedbackEmail = {
	accountEmail?: string | null;
	accountType?: "anonymous" | "registered";
	category: FeedbackCategory;
	feedbackId: string;
	message: string;
	page?: string;
	recipients: string[];
	replyEmail: string;
	subject: string;
	username?: string | null;
};

export type SentFeedbackEmail = {resendEmailId?: string};

export type ReceivedFeedbackEmail = {
	from: string;
	messageId: string;
	text: string;
	to: string[];
};

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const SUPPORT_FROM = "Mothmark Support <support@mothmark.app>";
const DEFAULT_SUPPORT_REPLY_DOMAIN = "mothmark.app";

export function feedbackReplyDomain(): string {
	return process.env.FEEDBACK_REPLY_DOMAIN?.trim().toLowerCase() || DEFAULT_SUPPORT_REPLY_DOMAIN;
}

export function feedbackReplyAddress(feedbackId: string): string {
	return `support+${feedbackId}@${feedbackReplyDomain()}`;
}

export function feedbackEmailIsConfigured(): boolean {
	return Boolean(
		process.env.RESEND_API_KEY?.trim() &&
		process.env.PUBLIC_APP_ORIGIN?.trim() &&
		feedbackReceivingIsConfigured(),
	);
}

export function feedbackReceivingIsConfigured(): boolean {
	return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_WEBHOOK_SECRET?.trim());
}

const parseJsonObject = async (
	response: Response,
): Promise<Record<string, unknown> | undefined> => {
	const text = await response.text();
	if (!text.trim()) return undefined;
	try {
		const value: unknown = JSON.parse(text);
		return value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: undefined;
	} catch {
		return undefined;
	}
};

const sendEmail = async (
	body: Record<string, unknown>,
	idempotencyKey: string,
): Promise<SentFeedbackEmail> => {
	const apiKey = process.env.RESEND_API_KEY?.trim();
	if (!apiKey) throw new Error("Feedback email is not configured.");
	const response = await fetch(RESEND_EMAILS_URL, {
		method: "POST",
		headers: {
			authorization: `Bearer ${apiKey}`,
			"content-type": "application/json",
			"idempotency-key": idempotencyKey,
		},
		body: JSON.stringify(body),
	});
	const result = await parseJsonObject(response);
	if (!response.ok) throw new Error(`Feedback email delivery failed (${response.status}).`);
	return {resendEmailId: typeof result?.id === "string" ? result.id : undefined};
};

const threadHeaders = (messageIds: string[]): Record<string, string> | undefined => {
	const ids = messageIds.slice(-20);
	const last = ids.at(-1);
	return last ? {"In-Reply-To": last, References: ids.join(" ")} : undefined;
};

const threadSubject = (subject: string): string =>
	subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;

export async function sendCustomerFeedbackReceipt(message: {
	category: FeedbackCategory;
	feedbackId: string;
	message: string;
	subject: string;
	to: string;
}): Promise<SentFeedbackEmail> {
	return sendEmail(
		{
			from: SUPPORT_FROM,
			reply_to: feedbackReplyAddress(message.feedbackId),
			subject: message.subject,
			tags: [
				{name: "feedback_id", value: message.feedbackId},
				{name: "message_kind", value: "customer_receipt"},
			],
			text: [
				"Thanks for contacting Mothmark Support. Reply to this email to continue the conversation.",
				"",
				`Category: ${message.category}`,
				"",
				message.message,
			].join("\n"),
			to: [message.to],
		},
		`feedback-receipt/${message.feedbackId}`,
	);
}

export async function sendFeedbackEmail(message: FeedbackEmail): Promise<void> {
	const origin = process.env.PUBLIC_APP_ORIGIN?.trim();
	if (!origin || message.recipients.length === 0) {
		throw new Error("Feedback email is not configured.");
	}
	const identity = message.username || message.accountEmail || message.accountType || "signed out";
	const adminUrl = new URL(`/admin/feedback/${message.feedbackId}`, origin).toString();
	const text = [
		`Category: ${message.category}`,
		`From: ${identity}`,
		`Account type: ${message.accountType ?? "none"}`,
		`Customer email: ${message.replyEmail}`,
		`Page: ${message.page ?? "not included"}`,
		"",
		message.message,
		"",
		"Reply to this email or open the conversation in Mothmark:",
		adminUrl,
	].join("\n");
	await Promise.all(
		message.recipients.map((recipient) =>
			sendEmail(
				{
					from: SUPPORT_FROM,
					reply_to: feedbackReplyAddress(message.feedbackId),
					subject: message.subject,
					tags: [
						{name: "feedback_id", value: message.feedbackId},
						{name: "message_kind", value: "admin_notification"},
					],
					text,
					to: [recipient],
				},
				`feedback-admin-notification/${message.feedbackId}/${recipient.toLowerCase()}`,
			),
		),
	);
}

export async function sendFeedbackReplyEmail(message: {
	adminRecipients: string[];
	feedbackId: string;
	message: string;
	messageIds: string[];
	replyId: string;
	subject: string;
	to: string;
}): Promise<SentFeedbackEmail> {
	return sendEmail(
		{
			bcc: message.adminRecipients,
			from: SUPPORT_FROM,
			headers: threadHeaders(message.messageIds),
			reply_to: feedbackReplyAddress(message.feedbackId),
			subject: threadSubject(message.subject),
			tags: [
				{name: "feedback_id", value: message.feedbackId},
				{name: "feedback_reply_id", value: message.replyId},
				{name: "message_kind", value: "conversation_reply"},
			],
			text: `${message.message}\n\n— Mothmark Support`,
			to: [message.to],
		},
		`feedback-reply/${message.replyId}`,
	);
}

export async function sendCustomerReplyAdminNotifications(message: {
	adminUrl: string;
	feedbackId: string;
	message: string;
	messageId: string;
	recipients: string[];
	replyId: string;
	subject: string;
}): Promise<void> {
	if (message.recipients.length === 0) throw new Error("No feedback administrators are configured.");
	await Promise.all(
		message.recipients.map((recipient) =>
			sendEmail(
				{
					from: SUPPORT_FROM,
					headers: threadHeaders([message.messageId]),
					reply_to: feedbackReplyAddress(message.feedbackId),
					subject: threadSubject(message.subject),
					tags: [
						{name: "feedback_id", value: message.feedbackId},
						{name: "feedback_reply_id", value: message.replyId},
						{name: "message_kind", value: "customer_admin_notification"},
					],
					text: [
						"Customer reply:",
						"",
						message.message,
						"",
						"Reply to this email or open the conversation in Mothmark:",
						message.adminUrl,
					].join("\n"),
					to: [recipient],
				},
				`feedback-customer-reply/${message.replyId}/${recipient.toLowerCase()}`,
			),
		),
	);
}

const stripHtml = (html: string): string =>
	html
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p\s*>/gi, "\n")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'");

const stringArray = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const latestReplyText = (value: string): string => {
	const lines = value.replace(/\r\n/g, "\n").split("\n");
	const marker = lines.findIndex(
		(line, index) =>
			index > 0 &&
			(/^On .+wrote:\s*$/i.test(line.trim()) ||
				/^-{2,}\s*Original Message\s*-{2,}$/i.test(line.trim()) ||
				/^_{5,}$/.test(line.trim()) ||
				/^>/.test(line.trim())),
	);
	const latest = (marker > 0 ? lines.slice(0, marker) : lines).join("\n").trim();
	return latest || value.trim();
};

export async function retrieveReceivedFeedbackEmail(
	emailId: string,
): Promise<ReceivedFeedbackEmail> {
	const apiKey = process.env.RESEND_API_KEY?.trim();
	if (!apiKey) throw new Error("Feedback receiving is not configured.");
	const response = await fetch(`${RESEND_EMAILS_URL}/receiving/${encodeURIComponent(emailId)}`, {
		headers: {authorization: `Bearer ${apiKey}`},
	});
	const result = await parseJsonObject(response);
	if (!response.ok || !result) {
		throw new Error(`Received feedback retrieval failed (${response.status}).`);
	}
	const from = typeof result.from === "string" ? result.from : "";
	const messageId = typeof result.message_id === "string" ? result.message_id : "";
	const plain = typeof result.text === "string" ? result.text : "";
	const html = typeof result.html === "string" ? result.html : "";
	const text = latestReplyText(plain || stripHtml(html)).slice(0, 4_000);
	if (!from || !messageId || !text) throw new Error("The received feedback email was incomplete.");
	return {from, messageId, text, to: stringArray(result.to)};
}

export function mailboxAddress(value: string): string | undefined {
	const angle = value.match(/<([^<>]+)>/);
	const candidate = (angle?.[1] ?? value).trim().toLowerCase();
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : undefined;
}
