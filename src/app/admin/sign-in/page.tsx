"use client";

import {Eye, EyeOff, KeyRound} from "lucide-react";
import Link from "next/link";
import {FormEvent, useState} from "react";

import {adminNextPath} from "../adminClient";
import {readOptionalJson} from "@/auth/apiResponse";
import {MothmarkLogo} from "@/components/brand/MothmarkLogo";

async function csrfToken(): Promise<string> {
	const response = await fetch("/api/auth/csrf?audience=admin");
	const body = await readOptionalJson<{data?: {csrfToken?: string}}>(response);
	if (!response.ok || !body?.data?.csrfToken)
		throw new Error("Sign-in security could not be prepared.");
	return body.data.csrfToken;
}

async function submit(path: string, body: object): Promise<void> {
	const response = await fetch(path, {
		method: "POST",
		headers: {"content-type": "application/json", "x-csrf-token": await csrfToken()},
		body: JSON.stringify(body),
	});
	const result = await readOptionalJson<{error?: {message?: string}}>(response);
	if (!response.ok) throw new Error(result?.error?.message || "Administrator sign-in failed.");
}

export default function AdminSignInPage() {
	const [phase, setPhase] = useState<"password" | "second-factor">("password");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
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
			<aside className="adminSignInStory">
				<Link href="/" aria-label="Mothmark home">
					<MothmarkLogo variant="headerCompact" priority />
				</Link>
				<div>
					<h2>Administration</h2>
					<p>Open the private workspace used to look after Mothmark.</p>
				</div>
				<small>Restricted to authorized administrators.</small>
			</aside>
			<div className="adminSignInContent">
				<header className="adminSignInMobileBrand">
					<Link href="/" aria-label="Mothmark home">
						<MothmarkLogo variant="headerCompact" priority />
					</Link>
				</header>
				<section className="adminSignInPanel" aria-labelledby="admin-sign-in-title">
					<div className="adminAccessNotice">
						<span>
							<KeyRound size={16} aria-hidden="true" />
						</span>
						<p>
							<strong>Admin access</strong>
							<br />
							Use your administrator account to continue.
						</p>
					</div>
					<h1 id="admin-sign-in-title">
						{phase === "password" ? "Sign in to admin" : "Verify admin sign-in"}
					</h1>
					<p>
						{phase === "password"
							? "Enter your administrator credentials. A second factor is required next."
							: "Enter the current authenticator code or an unused recovery code."}
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
								<div className="adminPasswordField">
									<input
										id="admin-password"
										name="password"
										type={showPassword ? "text" : "password"}
										autoComplete="current-password"
										required
										value={password}
										onChange={(event) => setPassword(event.target.value)}
									/>
									<button
										className="adminPasswordToggle"
										type="button"
										aria-label={showPassword ? "Hide entered characters" : "Show entered characters"}
										onClick={() => setShowPassword((shown) => !shown)}
									>
										{showPassword ? (
											<EyeOff size={17} aria-hidden="true" />
										) : (
											<Eye size={17} aria-hidden="true" />
										)}
									</button>
								</div>
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
			</div>
		</main>
	);
}
