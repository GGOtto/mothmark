"use client";

import {X} from "lucide-react";
import {type RefObject, useRef, useState} from "react";

import {readBrowserCsrfToken} from "@/auth/browserCsrf";
import {ModalLayer} from "../overlay/Overlay";

type FeedbackDialogProps = {
	onClose: () => void;
	requiresReplyEmail: boolean;
	returnFocusRef?: RefObject<HTMLElement | null>;
};

async function responseJson(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		return undefined;
	}
}

function responseErrorMessage(body: unknown): string | undefined {
	if (!body || typeof body !== "object" || !("error" in body)) return undefined;
	const error = body.error;
	if (!error || typeof error !== "object" || !("message" in error)) return undefined;
	return typeof error.message === "string" ? error.message : undefined;
}

async function csrfToken(): Promise<string> {
	const existing = readBrowserCsrfToken();
	if (existing) return existing;
	const response = await fetch("/api/auth/csrf");
	const body = await responseJson(response);
	const token =
		body && typeof body === "object" && "data" in body && body.data && typeof body.data === "object"
			? "csrfToken" in body.data
				? body.data.csrfToken
				: undefined
			: undefined;
	if (!response.ok || typeof token !== "string") {
		throw new Error("The feedback form could not be verified.");
	}
	return token;
}

export function FeedbackDialog({onClose, requiresReplyEmail, returnFocusRef}: FeedbackDialogProps) {
	const [category, setCategory] = useState<"bug" | "general" | "idea">("general");
	const [replyEmail, setReplyEmail] = useState("");
	const [message, setMessage] = useState("");
	const [includePage, setIncludePage] = useState(true);
	const [website, setWebsite] = useState("");
	const [status, setStatus] = useState<"editing" | "sending" | "sent">("editing");
	const [error, setError] = useState("");
	const emailRef = useRef<HTMLInputElement | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setStatus("sending");
		setError("");
		try {
			const token = await csrfToken();
			const response = await fetch("/api/feedback", {
				method: "POST",
				headers: {"content-type": "application/json", "x-csrf-token": token},
				body: JSON.stringify({
					category,
					includePage,
					message,
					page: includePage ? window.location.href : undefined,
					replyEmail: requiresReplyEmail ? replyEmail : undefined,
					website,
				}),
			});
			const body = await responseJson(response);
			if (!response.ok) {
				throw new Error(responseErrorMessage(body) || "Feedback could not be sent. Try again later.");
			}
			setStatus("sent");
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Feedback could not be sent.");
			setStatus("editing");
		}
	}

	return (
		<ModalLayer
			ariaLabelledBy="feedback-dialog-title"
			backdropClassName="feedbackDialogBackdrop"
			className="feedbackDialog"
			closeOnBackdropClick={status !== "sending"}
			closeOnEscape={status !== "sending"}
			initialFocusRef={requiresReplyEmail ? emailRef : textareaRef}
			mobilePresentation="sheet"
			onClose={onClose}
			returnFocusRef={returnFocusRef}
		>
			<>
				<header>
					<div>
						<h2 id="feedback-dialog-title">Send feedback</h2>
						<p>Tell us what worked, what got in your way, or what you would like to see.</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						disabled={status === "sending"}
						aria-label="Close feedback"
					>
						<X size={19} aria-hidden="true" />
					</button>
				</header>

				{status === "sent" ? (
					<div className="feedbackDialogSuccess" role="status">
						<strong>Feedback sent.</strong>
						<p>Thank you for taking the time to help improve Mothmark.</p>
						<button type="button" onClick={onClose}>
							Close
						</button>
					</div>
				) : (
					<form onSubmit={(event) => void submit(event)}>
						<div className="feedbackDialogFields">
							<label htmlFor="feedback-category">About</label>
							<select
								id="feedback-category"
								value={category}
								onChange={(event) => setCategory(event.target.value as typeof category)}
							>
								<option value="general">General feedback</option>
								<option value="bug">Something is not working</option>
								<option value="idea">An idea or request</option>
							</select>

							{requiresReplyEmail ? (
								<>
									<label htmlFor="feedback-email">Your email</label>
									<input
										ref={emailRef}
										id="feedback-email"
										type="email"
										autoComplete="email"
										placeholder="you@example.com"
										value={replyEmail}
										onChange={(event) => setReplyEmail(event.target.value)}
										aria-describedby="feedback-email-note"
										maxLength={254}
										required
									/>
									<p id="feedback-email-note" className="feedbackDialogFieldNote">
										We will only use this address to reply to your feedback.
									</p>
								</>
							) : null}

							<label htmlFor="feedback-message">Message</label>
							<textarea
								ref={textareaRef}
								id="feedback-message"
								value={message}
								onChange={(event) => setMessage(event.target.value)}
								maxLength={4_000}
								placeholder="What would you like us to know?"
								required
							/>

							<label className="feedbackDialogPage">
								<input
									type="checkbox"
									checked={includePage}
									onChange={(event) => setIncludePage(event.target.checked)}
								/>
								Include the page I am viewing
							</label>
							<label className="feedbackDialogHoneypot" aria-hidden="true">
								Website
								<input
									tabIndex={-1}
									autoComplete="off"
									value={website}
									onChange={(event) => setWebsite(event.target.value)}
								/>
							</label>

							<p className="feedbackDialogLimit">You can send up to 3 messages per hour.</p>
							{error ? (
								<p className="feedbackDialogError" role="alert">
									{error}
								</p>
							) : null}
						</div>

						<footer>
							<button type="button" onClick={onClose} disabled={status === "sending"}>
								Cancel
							</button>
							<button
								type="submit"
								disabled={
									status === "sending" || !message.trim() || (requiresReplyEmail && !replyEmail.trim())
								}
							>
								{status === "sending" ? "Sending…" : "Send feedback"}
							</button>
						</footer>
					</form>
				)}
			</>
		</ModalLayer>
	);
}
