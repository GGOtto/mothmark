"use client";

import Link from "next/link";
import {FormEvent, useEffect, useRef, useState} from "react";

import {deleteWorldDraftsForUser} from "@/components/world-autosave/worldDraftStorage";

import "./page.scss";

type AccountSummary = {
	accountType: "anonymous" | "registered";
	cleanupAfter: string | null;
	cleanupWasRecentlyCancelled: boolean;
	createdAt: string;
	email: string | null;
	retentionClass: "authored_editor" | "empty" | "untouched_editor";
	sessions: Array<{createdAt: string; expiresAt: string; id: string; lastSeenAt: string}>;
	siteRole: "admin" | "user";
	usage: {activeWorlds: number; maxWorlds: number; trashedWorlds: number};
	userId: string;
};

const retentionCopy: Record<AccountSummary["retentionClass"], string> = {
	empty: "An unused temporary account is scheduled for cleanup after 24 hours of inactivity.",
	untouched_editor:
		"An account containing only untouched starter worlds is scheduled for cleanup after 7 days of inactivity.",
	authored_editor:
		"An account with saved world changes is scheduled for cleanup after 180 days of inactivity.",
};

const formatDate = (value: string) =>
	new Intl.DateTimeFormat(undefined, {dateStyle: "long"}).format(new Date(value));

async function csrfToken(): Promise<string> {
	const response = await fetch("/api/auth/csrf");
	const body = (await response.json()) as {data?: {csrfToken?: string}};
	if (!response.ok || !body.data?.csrfToken)
		throw new Error("Request security could not be prepared.");
	return body.data.csrfToken;
}

export default function AccountPage() {
	const [account, setAccount] = useState<AccountSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [deletePassword, setDeletePassword] = useState("");
	const deleteTrigger = useRef<HTMLButtonElement | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		fetch("/api/account", {signal: controller.signal})
			.then(async (response) => {
				if (!response.ok) throw new Error("Account details could not be loaded.");
				return ((await response.json()) as {data: AccountSummary | null}).data;
			})
			.then(setAccount)
			.catch((caught: unknown) => {
				if ((caught as {name?: string}).name !== "AbortError")
					setError(caught instanceof Error ? caught.message : "Account details could not be loaded.");
			})
			.finally(() => setLoading(false));
		return () => controller.abort();
	}, []);

	const post = async (path: string, body?: object) => {
		const response = await fetch(path, {
			method: "POST",
			headers: {"content-type": "application/json", "x-csrf-token": await csrfToken()},
			...(body && {body: JSON.stringify(body)}),
		});
		const result =
			response.status === 204 ? {} : ((await response.json()) as {error?: {message?: string}});
		if (!response.ok) throw new Error(result.error?.message || "The request could not be completed.");
	};

	const closeDelete = () => {
		setDeleteOpen(false);
		setDeletePassword("");
		setError("");
		queueMicrotask(() => deleteTrigger.current?.focus());
	};

	const signOut = async () => {
		setBusy(true);
		setError("");
		try {
			await post("/api/auth/sign-out");
			window.location.assign("/");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Sign-out failed.");
			setBusy(false);
		}
	};

	const changePassword = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setBusy(true);
		setError("");
		setNotice("");
		try {
			await post("/api/auth/change-password", {currentPassword, newPassword});
			setNotice("Your password changed and every session was revoked. Sign in again to continue.");
			setTimeout(() => window.location.assign("/sign-in"), 1200);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The password could not be changed.");
			setBusy(false);
		}
	};

	const deleteAccount = async () => {
		if (!account) return;
		setBusy(true);
		setError("");
		try {
			const response = await fetch("/api/account", {
				method: "DELETE",
				headers: {"content-type": "application/json", "x-csrf-token": await csrfToken()},
				body: JSON.stringify(account.accountType === "registered" ? {password: deletePassword} : {}),
			});
			const result = (await response.json()) as {error?: {message?: string}};
			if (!response.ok) throw new Error(result.error?.message || "The account could not be deleted.");
			await deleteWorldDraftsForUser(account.userId).catch(() => undefined);
			window.location.assign("/");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The account could not be deleted.");
			setBusy(false);
		}
	};

	const registered = account?.accountType === "registered";
	return (
		<main className="accountPage">
			<section className="accountPanel" aria-labelledby="account-title">
				<p className="accountLabel">{registered ? "Registered account" : "Temporary account"}</p>
				<h1 id="account-title">
					{registered ? "Your Mothmark account" : "Your worlds stay with this browser"}
				</h1>
				{registered ? (
					<p>
						Your verified account keeps the same worlds and can be opened by signing in on another
						browser.
					</p>
				) : (
					<>
						<p>
							Mothmark uses a private anonymous account and a necessary authentication cookie so other
							visitors cannot see or change your worlds.
						</p>
						<p>
							Clearing site data, using private browsing, or moving to another browser can make these
							worlds inaccessible until you register.
						</p>
					</>
				)}
				{loading ? <p role="status">Checking this browser…</p> : null}
				{error ? (
					<p className="accountError" role="alert">
						{error}
					</p>
				) : null}
				{notice ? (
					<p className="accountNotice" role="status">
						{notice}
					</p>
				) : null}
				{account ? (
					<>
						<dl className="accountDetails">
							<div>
								<dt>Created</dt>
								<dd>{formatDate(account.createdAt)}</dd>
							</div>
							<div>
								<dt>Worlds</dt>
								<dd>
									{account.usage.activeWorlds} of {account.usage.maxWorlds}
								</dd>
							</div>
							<div>
								<dt>Trash</dt>
								<dd>{account.usage.trashedWorlds}</dd>
							</div>
						</dl>
						{registered ? (
							<>
								<p>
									<strong>Verified email:</strong> {account.email}
								</p>
								<section className="accountSection" aria-labelledby="sessions-title">
									<h2 id="sessions-title">Active sessions</h2>
									<ul>
										{account.sessions.map((session) => (
											<li key={session.id}>
												Last used {formatDate(session.lastSeenAt)} · expires {formatDate(session.expiresAt)}
											</li>
										))}
									</ul>
								</section>
								<section className="accountSection" aria-labelledby="password-title">
									<h2 id="password-title">Change password</h2>
									<p>This signs out every browser, including this one.</p>
									<form className="accountPasswordForm" onSubmit={changePassword}>
										<label htmlFor="current-password">Current password</label>
										<input
											id="current-password"
											type="password"
											autoComplete="current-password"
											required
											value={currentPassword}
											onChange={(event) => setCurrentPassword(event.target.value)}
										/>
										<label htmlFor="new-password">New password</label>
										<input
											id="new-password"
											type="password"
											autoComplete="new-password"
											minLength={12}
											maxLength={128}
											required
											value={newPassword}
											onChange={(event) => setNewPassword(event.target.value)}
										/>
										<button type="submit" disabled={busy}>
											Change password
										</button>
									</form>
								</section>
							</>
						) : (
							<>
								<p>
									{retentionCopy[account.retentionClass]} A 7-day recovery grace period follows before
									deletion.
								</p>
								{account.cleanupAfter ? (
									<p className="accountNotice">
										Cleanup is scheduled for {formatDate(account.cleanupAfter)}. Using this account before
										then cancels cleanup.
									</p>
								) : null}
								{account.cleanupWasRecentlyCancelled ? (
									<p className="accountNotice" role="status">
										A pending cleanup was cancelled when you returned. Your work remains available.
									</p>
								) : null}
								<Link className="accountPrimaryAction" href="/register">
									Create an account
								</Link>
							</>
						)}
					</>
				) : !loading ? (
					<p>
						Enter the world library to create a temporary account, or <Link href="/sign-in">sign in</Link>
						.
					</p>
				) : null}
				<nav className="accountNavigation" aria-label="Account actions">
					{account ? <a href="/api/account/export">Export all data</a> : null}
					<div className="accountLinks">
						<Link href="/worlds">{account ? "Return to your worlds" : "Open your worlds"}</Link>
						<Link href="/privacy">Privacy and cookies</Link>
					</div>
					{registered ? (
						<button type="button" onClick={() => void signOut()} disabled={busy}>
							Sign out
						</button>
					) : null}
					{account ? (
						<button
							className="accountDelete"
							ref={deleteTrigger}
							type="button"
							onClick={() => setDeleteOpen(true)}
						>
							Delete account
						</button>
					) : null}
				</nav>
			</section>

			{deleteOpen && account ? (
				<div className="accountDialogBackdrop" role="presentation">
					<section
						className="accountDialog"
						role="dialog"
						aria-modal="true"
						aria-labelledby="delete-account-title"
						onKeyDown={(event) => {
							if (event.key === "Escape" && !busy) closeDelete();
						}}
					>
						<h2 id="delete-account-title">Delete this account?</h2>
						<p>
							This immediately deletes every active and trashed private world, revokes every session, and
							removes local recovery drafts. It cannot be undone.
						</p>
						{registered ? (
							<>
								<label htmlFor="delete-password">Confirm your password</label>
								<input
									id="delete-password"
									type="password"
									autoComplete="current-password"
									autoFocus
									required
									value={deletePassword}
									onChange={(event) => setDeletePassword(event.target.value)}
								/>
							</>
						) : null}
						{error ? (
							<p className="accountError" role="alert">
								{error}
							</p>
						) : null}
						<div className="accountDialogActions">
							<button type="button" autoFocus={!registered} onClick={closeDelete} disabled={busy}>
								Cancel
							</button>
							<button
								type="button"
								className="accountDeleteConfirm"
								onClick={() => void deleteAccount()}
								disabled={busy || (registered && !deletePassword)}
							>
								{busy ? "Deleting…" : "Delete account"}
							</button>
						</div>
					</section>
				</div>
			) : null}
		</main>
	);
}
