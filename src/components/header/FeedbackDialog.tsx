"use client";

import {X} from "lucide-react";
import {useEffect, useRef, useState} from "react";

import {readBrowserCsrfToken} from "@/auth/browserCsrf";

type FeedbackDialogProps = {
	onClose: () => void;
};

async function csrfToken(): Promise<string> {
	const existing = readBrowserCsrfToken();
	if (existing) return existing;
	const response = await fetch("/api/auth/csrf");
	const body = (await response.json()) as {data?: {csrfToken?: unknown}};
	if (!response.ok || typeof body.data?.csrfToken !== "string") {
		throw new Error("The feedback form could not be verified.");
	}
	return body.data.csrfToken;
}

export function FeedbackDialog({onClose}: FeedbackDialogProps) {
	const [category, setCategory] = useState<"bug" | "general" | "idea">("general");
	const [message, setMessage] = useState("");
	const [includePage, setIncludePage] = useState(true);
	const [website, setWebsite] = useState("");
	const [status, setStatus] = useState<"editing" | "sending" | "sent">("editing");
	const [error, setError] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	useEffect(() => {
		textareaRef.current?.focus();
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape" && status !== "sending") onClose();
		};
		document.addEventListener("keydown", closeOnEscape);
		return () => document.removeEventListener("keydown", closeOnEscape);
	}, [onClose, status]);

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
					website,
				}),
			});
			const body = (await response.json()) as {error?: {message?: string}};
			if (!response.ok) throw new Error(body.error?.message || "Feedback could not be sent.");
			setStatus("sent");
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : "Feedback could not be sent.");
			setStatus("editing");
		}
	}

	return (
		<div
			className="feedbackDialogBackdrop"
			role="presentation"
			onPointerDown={(event) => {
				if (event.target === event.currentTarget && status !== "sending") onClose();
			}}
		>
			<section
				className="feedbackDialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="feedback-dialog-title"
			>
				<header>
					<div>
						<h2 id="feedback-dialog-title">Send feedback</h2>
						<p>Tell us what worked, what got in your way, or what you would like to see.</p>
					</div>
					<button type="button" onClick={onClose} aria-label="Close feedback">
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

						<footer>
							<button type="button" onClick={onClose} disabled={status === "sending"}>
								Cancel
							</button>
							<button type="submit" disabled={status === "sending" || !message.trim()}>
								{status === "sending" ? "Sending…" : "Send feedback"}
							</button>
						</footer>
					</form>
				)}
			</section>
		</div>
	);
}
