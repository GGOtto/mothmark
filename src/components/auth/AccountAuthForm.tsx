"use client";

import {Eye, EyeOff} from "lucide-react";
import Link from "next/link";
import {FormEvent, useEffect, useState} from "react";

import {
	USERNAME_MAX_LENGTH,
	USERNAME_MIN_LENGTH,
	USERNAME_PATTERN,
	usernameValidationMessage,
} from "@/auth/usernames";
import {readOptionalJson} from "@/auth/apiResponse";
import {MothmarkLogo} from "@/components/brand/MothmarkLogo";

import "./AccountAuthForm.scss";

type AuthMode = "forgot" | "register" | "reset" | "sign-in" | "verify";
type UsernameCheck = {
	message: string;
	status: "available" | "checking" | "error" | "idle" | "invalid" | "unavailable";
};

const content: Record<
	Exclude<AuthMode, "verify">,
	{title: string; intro: string; submit: string}
> = {
	register: {
		title: "Create your account",
		intro: "Verify your email to keep the worlds already on this browser with your account.",
		submit: "Send verification email",
	},
	"sign-in": {
		title: "Welcome back",
		intro: "Sign in to return to your worlds.",
		submit: "Sign in",
	},
	forgot: {
		title: "Recover your account",
		intro: "Enter your verified email. The response is the same whether or not an account is found.",
		submit: "Send recovery email",
	},
	reset: {
		title: "Choose a new password",
		intro:
			"Resetting your password revokes every existing session. Sign in again when it is complete.",
		submit: "Reset password",
	},
};

async function csrfToken(): Promise<string> {
	const response = await fetch("/api/auth/csrf");
	const result = await readOptionalJson<{data?: {csrfToken?: string}}>(response);
	if (!response.ok || !result?.data?.csrfToken)
		throw new Error("Request security could not be prepared.");
	return result.data.csrfToken;
}

async function post(path: string, body: object): Promise<{data?: Record<string, unknown>}> {
	const response = await fetch(path, {
		method: "POST",
		headers: {"content-type": "application/json", "x-csrf-token": await csrfToken()},
		body: JSON.stringify(body),
	});
	const result = await readOptionalJson<{
		data?: Record<string, unknown>;
		error?: {message?: string};
	}>(response);
	if (!response.ok) throw new Error(result?.error?.message || "The request could not be completed.");
	return result ?? {};
}

export function AccountAuthForm({mode, token = ""}: {mode: AuthMode; token?: string}) {
	const [username, setUsername] = useState("");
	const [usernameCheck, setUsernameCheck] = useState<UsernameCheck>({message: "", status: "idle"});
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmation, setShowConfirmation] = useState(false);
	const [subscribeToUpdates, setSubscribeToUpdates] = useState(false);
	const [busy, setBusy] = useState(mode === "verify" && Boolean(token));
	const [message, setMessage] = useState("");
	const [error, setError] = useState(
		mode === "verify" && !token
			? "This verification link is incomplete."
			: mode === "reset" && !token
				? "This password reset link is incomplete. Request a new recovery email."
				: "",
	);

	useEffect(() => {
		if (mode !== "register" || !username) return;
		const validationMessage = usernameValidationMessage(username);
		if (validationMessage) return;
		const controller = new AbortController();
		const timeout = window.setTimeout(() => {
			fetch(`/api/auth/username-availability?username=${encodeURIComponent(username)}`, {
				signal: controller.signal,
			})
				.then(async (response) => {
					const body = await readOptionalJson<{
						data?: {available?: boolean; message?: string; valid?: boolean};
						error?: {message?: string};
					}>(response);
					if (!response.ok)
						throw new Error(body?.error?.message || "Username availability could not be checked.");
					if (!body?.data?.valid) {
						setUsernameCheck({
							message: body?.data?.message || "Enter a valid username.",
							status: "invalid",
						});
						return;
					}
					setUsernameCheck({
						message:
							body.data.message ||
							(body.data.available ? "Username is available." : "That username is already in use."),
						status: body.data.available ? "available" : "unavailable",
					});
				})
				.catch((caught: unknown) => {
					if ((caught as {name?: string}).name === "AbortError") return;
					setUsernameCheck({
						message:
							caught instanceof Error ? caught.message : "Username availability could not be checked.",
						status: "error",
					});
				});
		}, 250);
		return () => {
			window.clearTimeout(timeout);
			controller.abort();
		};
	}, [mode, username]);

	const changeUsername = (value: string) => {
		const nextUsername = value;
		setUsername(nextUsername);
		const validationMessage = usernameValidationMessage(nextUsername);
		setUsernameCheck(
			!nextUsername
				? {message: "", status: "idle"}
				: validationMessage
					? {message: validationMessage, status: "invalid"}
					: {message: "Checking username…", status: "checking"},
		);
	};

	useEffect(() => {
		if (mode !== "verify" || !token) return;
		post("/api/auth/verify-email", {token})
			.then(() => {
				window.location.assign("/");
			})
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : "Verification failed."),
			)
			.finally(() => setBusy(false));
	}, [mode, token]);

	if (mode === "verify") {
		return (
			<AuthShell mode="verify" title="Verify your email">
				{busy ? <p role="status">Checking this link…</p> : null}
				{error ? (
					<p className="authError" role="alert">
						{error}
					</p>
				) : null}
				{error ? <Link href="/register">Request another verification email</Link> : null}
			</AuthShell>
		);
	}

	const copy = content[mode];
	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setBusy(true);
		setError("");
		setMessage("");
		if ((mode === "register" || mode === "reset") && password !== confirmation) {
			setError("The passwords do not match.");
			setBusy(false);
			return;
		}
		try {
			if (mode === "register") {
				const result = await post("/api/auth/register", {
					email,
					password,
					subscribeToUpdates,
					username,
				});
				setMessage(String(result.data?.message ?? "Check your email for a verification link."));
			} else if (mode === "sign-in") {
				await post("/api/auth/sign-in", {email, password});
				window.location.assign("/worlds");
			} else if (mode === "forgot") {
				const result = await post("/api/auth/forgot-password", {email});
				setMessage(String(result.data?.message ?? "Check your email for a recovery link."));
			} else {
				await post("/api/auth/reset-password", {password, token});
				setMessage("Your password was reset and all existing sessions were revoked.");
				setPassword("");
				setConfirmation("");
			}
		} catch (caught) {
			if (
				mode === "register" &&
				caught instanceof Error &&
				caught.message === "That username is already in use."
			) {
				setUsernameCheck({message: caught.message, status: "unavailable"});
			}
			setError(caught instanceof Error ? caught.message : "The request could not be completed.");
		} finally {
			setBusy(false);
		}
	};
	const resend = async () => {
		setBusy(true);
		setError("");
		try {
			const result = await post("/api/auth/resend-verification", {email});
			setMessage(
				String(result.data?.message ?? "If a verification is pending, a new message is on its way."),
			);
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "The verification message could not be resent.",
			);
		} finally {
			setBusy(false);
		}
	};

	return (
		<AuthShell mode={mode} title={copy.title}>
			<p className="authIntro">{copy.intro}</p>
			<form className="authForm" onSubmit={onSubmit}>
				{mode === "register" ? (
					<>
						<label htmlFor="account-username">Username</label>
						<input
							id="account-username"
							name="username"
							type="text"
							autoComplete="username"
							autoCapitalize="none"
							spellCheck={false}
							minLength={USERNAME_MIN_LENGTH}
							maxLength={USERNAME_MAX_LENGTH}
							pattern={USERNAME_PATTERN}
							aria-describedby="account-username-feedback"
							aria-invalid={usernameCheck.status === "invalid" || usernameCheck.status === "unavailable"}
							required
							value={username}
							onChange={(event) => changeUsername(event.target.value)}
						/>
						<p
							id="account-username-feedback"
							className={`authHint authUsernameStatus authUsernameStatus-${usernameCheck.status}`}
							aria-live="polite"
						>
							{usernameCheck.message ||
								"Use 3–30 letters, numbers, periods, underscores, or hyphens. Capitalization will appear publicly."}
						</p>
					</>
				) : null}
				{mode !== "reset" ? (
					<>
						<label htmlFor="account-email">Email</label>
						<input
							id="account-email"
							name="email"
							type="email"
							autoComplete="email"
							required
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
					</>
				) : null}
				{mode === "register" || mode === "sign-in" || mode === "reset" ? (
					<>
						<div className="authLabelRow">
							<label htmlFor="account-password">{mode === "reset" ? "New password" : "Password"}</label>
							{mode === "sign-in" ? <Link href="/forgot-password">Forgot password?</Link> : null}
						</div>
						<div className="authPasswordField">
							<input
								id="account-password"
								name="password"
								type={showPassword ? "text" : "password"}
								minLength={12}
								maxLength={128}
								autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
								required
								value={password}
								onChange={(event) => setPassword(event.target.value)}
							/>
							<button
								className="authPasswordToggle"
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
				) : null}
				{mode === "register" || mode === "reset" ? (
					<>
						<label htmlFor="account-password-confirmation">Confirm password</label>
						<div className="authPasswordField">
							<input
								id="account-password-confirmation"
								name="password-confirmation"
								type={showConfirmation ? "text" : "password"}
								minLength={12}
								maxLength={128}
								autoComplete="new-password"
								required
								value={confirmation}
								onChange={(event) => setConfirmation(event.target.value)}
							/>
							<button
								className="authPasswordToggle"
								type="button"
								aria-label={
									showConfirmation ? "Hide confirmation characters" : "Show confirmation characters"
								}
								onClick={() => setShowConfirmation((shown) => !shown)}
							>
								{showConfirmation ? (
									<EyeOff size={17} aria-hidden="true" />
								) : (
									<Eye size={17} aria-hidden="true" />
								)}
							</button>
						</div>
						<p className="authHint">Use 12–128 characters and avoid a commonly compromised password.</p>
					</>
				) : null}
				{mode === "register" ? (
					<label className="authSubscribe" htmlFor="account-subscribe">
						<input
							id="account-subscribe"
							name="subscribeToUpdates"
							type="checkbox"
							aria-label="Subscribe to Notes from Mothmark"
							checked={subscribeToUpdates}
							onChange={(event) => setSubscribeToUpdates(event.target.checked)}
						/>
						<span>
							<strong>Email me Notes from Mothmark.</strong> Occasional news from the workbench.
							Unsubscribe anytime.
						</span>
					</label>
				) : null}
				{message ? (
					<p className="authNotice" role="status">
						{message}
					</p>
				) : null}
				{mode === "register" && message ? (
					<button
						className="authSecondaryAction"
						type="button"
						disabled={busy}
						onClick={() => void resend()}
					>
						Resend verification email
					</button>
				) : null}
				{error ? (
					<p className="authError" role="alert">
						{error}
					</p>
				) : null}
				{mode === "reset" && !token ? (
					<Link href="/forgot-password">Request a new recovery email</Link>
				) : null}
				<button
					type="submit"
					disabled={
						busy ||
						(mode === "reset" && !token) ||
						(mode === "register" && usernameCheck.status !== "available")
					}
				>
					{busy ? "Working…" : copy.submit}
				</button>
			</form>
			<nav className="authLinks" aria-label="Account links">
				{mode !== "sign-in" ? (
					<span>
						Already have an account? <Link href="/sign-in">Sign in</Link>
					</span>
				) : null}
				{mode === "sign-in" ? (
					<span>
						New to Mothmark? <Link href="/register">Create an account</Link>
					</span>
				) : null}
			</nav>
			{mode === "register" ? (
				<p className="authTerms">
					By creating an account, you agree to the <Link href="/info/terms">terms</Link> and{" "}
					<Link href="/privacy">privacy policy</Link>.
				</p>
			) : null}
		</AuthShell>
	);
}

const sideCopy: Record<AuthMode, {description: string; heading: string}> = {
	"sign-in": {
		heading: "Return to the worlds waiting for you.",
		description: "Pick up where you left off in your Mothmark workbench.",
	},
	register: {
		heading: "Make your dream world come to life.",
		description: "Your workbench keeps the story close while you shape it.",
	},
	forgot: {
		heading: "Find your way back.",
		description: "A recovery link can return you to your saved worlds.",
	},
	reset: {
		heading: "Choose a new key.",
		description: "Your worlds will be ready after you sign in again.",
	},
	verify: {
		heading: "Keep your worlds within reach.",
		description: "Verification connects this browser's workbench to your account.",
	},
};

function AuthShell({
	children,
	mode,
	title,
}: {
	children: React.ReactNode;
	mode: AuthMode;
	title: string;
}) {
	const story = sideCopy[mode];
	return (
		<main className={`authPage authPage-${mode}`}>
			<aside className="authStory">
				<Link className="authStoryBrand" href="/" aria-label="Mothmark home">
					<MothmarkLogo variant="headerCompact" priority />
				</Link>
				<div>
					<h2>{story.heading}</h2>
					<p>{story.description}</p>
				</div>
				<small>A quiet workbench for living stories.</small>
			</aside>
			<div className="authContent">
				<header className="authMobileBrand">
					<Link href="/" aria-label="Mothmark home">
						<MothmarkLogo variant="headerCompact" priority />
					</Link>
				</header>
				<section className="authPanel" aria-labelledby="auth-title">
					<h1 id="auth-title">{title}</h1>
					{children}
					<Link className="authHome" href="/">
						Return to Mothmark
					</Link>
				</section>
			</div>
		</main>
	);
}
