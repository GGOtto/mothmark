"use client";

import Link from "next/link";
import {FormEvent, useState} from "react";

import {adminNextPath} from "../adminClient";
import {MothmarkLogo} from "@/components/brand/MothmarkLogo";

async function csrfToken(): Promise<string> {
	const response = await fetch("/api/auth/csrf?audience=admin");
	const body = (await response.json()) as {data?: {csrfToken?: string}};
	if (!response.ok || !body.data?.csrfToken)
		throw new Error("Sign-in security could not be prepared.");
	return body.data.csrfToken;
}

async function submit(path: string, body: object): Promise<void> {
	const response = await fetch(path, {
		method: "POST",
		headers: {"content-type": "application/json", "x-csrf-token": await csrfToken()},
		body: JSON.stringify(body),
	});
	const result = (await response.json()) as {error?: {message?: string}};
	if (!response.ok) throw new Error(result.error?.message || "Administrator sign-in failed.");
}

export default function AdminSignInPage() {
	const [phase, setPhase] = useState<"password" | "second-factor">("password");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [secondFactor, setSecondFactor] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setBusy(true);
		setError("");
		try {
			if (phase === "password") {
				await submit("/api/admin/auth/password", {email, password});
				setPassword("");
				setPhase("second-factor");
			} else {
				await submit("/api/admin/auth/second-factor", {secondFactor});
				window.location.assign(adminNextPath(window.location.search));
			}
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Administrator sign-in failed.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<main className="adminSignIn">
			<section className="adminSignInPanel" aria-labelledby="admin-sign-in-title">
				<div className="adminBrand">
					<MothmarkLogo variant="basic" />
					Mothmark administration
				</div>
				<h1 id="admin-sign-in-title">Administrator sign-in</h1>
				<p>
					{phase === "password"
						? "Enter the provisioned administrator credentials. A second factor is always required before administrator access is issued."
						: "Enter the current six-digit authenticator code, or one unused recovery code."}
				</p>
				<form className="adminAuthForm" onSubmit={onSubmit}>
					{phase === "password" ? (
						<>
							<label htmlFor="admin-email">Email</label>
							<input
								id="admin-email"
								name="email"
								type="email"
								autoComplete="username"
								required
								value={email}
								onChange={(event) => setEmail(event.target.value)}
							/>
							<label htmlFor="admin-password">Password</label>
							<input
								id="admin-password"
								name="password"
								type="password"
								autoComplete="current-password"
								required
								value={password}
								onChange={(event) => setPassword(event.target.value)}
							/>
						</>
					) : (
						<>
							<label htmlFor="admin-second-factor">Authentication code</label>
							<input
								id="admin-second-factor"
								name="one-time-code"
								inputMode="numeric"
								autoComplete="one-time-code"
								required
								autoFocus
								value={secondFactor}
								onChange={(event) => setSecondFactor(event.target.value)}
							/>
						</>
					)}
					{error ? (
						<p className="adminError" role="alert">
							{error}
						</p>
					) : null}
					<button className="adminPrimaryAction" disabled={busy} type="submit">
						{busy ? "Checking…" : phase === "password" ? "Continue" : "Sign in"}
					</button>
				</form>
				{phase === "second-factor" ? (
					<button className="adminQuietButton" type="button" onClick={() => setPhase("password")}>
						Start again
					</button>
				) : null}
				<Link className="adminQuietLink" href="/">
					Return to Mothmark
				</Link>
			</section>
		</main>
	);
}
