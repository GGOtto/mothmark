"use client";

import {FormEvent, useState} from "react";

import {readOptionalJson} from "@/auth/apiResponse";

async function csrfToken(): Promise<string> {
	const response = await fetch("/api/auth/csrf");
	const result = await readOptionalJson<{data?: {csrfToken?: string}}>(response);
	if (!response.ok || !result?.data?.csrfToken)
		throw new Error("Subscription security could not be prepared.");
	return result.data.csrfToken;
}

export function NewsletterSignup() {
	const [email, setEmail] = useState("");
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setBusy(true);
		setMessage("");
		setError("");
		try {
			const response = await fetch("/api/subscribers", {
				method: "POST",
				headers: {"content-type": "application/json", "x-csrf-token": await csrfToken()},
				body: JSON.stringify({email}),
			});
			const result = await readOptionalJson<{
				data?: {message?: string};
				error?: {message?: string};
			}>(response);
			if (!response.ok)
				throw new Error(result?.error?.message || "The email could not be subscribed. Try again.");
			setMessage(result?.data?.message || "You're subscribed to Notes from Mothmark.");
			setEmail("");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The email could not be subscribed.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<form onSubmit={onSubmit}>
			<label htmlFor="footer-email">Email address</label>
			<div>
				<input
					id="footer-email"
					name="email"
					type="email"
					autoComplete="email"
					placeholder="you@example.com"
					required
					value={email}
					onChange={(event) => setEmail(event.target.value)}
				/>
				<button type="submit" disabled={busy}>
					{busy ? "Subscribing…" : "Subscribe"}
				</button>
			</div>
			{message ? (
				<p className="siteFooter__newsletterNotice" role="status">
					{message}
				</p>
			) : null}
			{error ? (
				<p className="siteFooter__newsletterError" role="alert">
					{error}
				</p>
			) : null}
		</form>
	);
}
