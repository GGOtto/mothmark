"use client";

import Link from "next/link";
import {FormEvent, useEffect, useRef, useState} from "react";

import {
	PUBLIC_PROFILE_BIO_MAX_LENGTH,
	PUBLIC_PROFILE_DISPLAY_NAME_MAX_LENGTH,
	PUBLIC_PROFILE_WEBSITE_MAX_LENGTH,
} from "@/auth/publicProfile";
import {deleteWorldDraftsForUser} from "@/components/world-autosave/worldDraftStorage";

import "./page.scss";

type AccountSummary = {
	accountType: "anonymous" | "registered";
	cleanupAfter: string | null;
	cleanupWasRecentlyCancelled: boolean;
	createdAt: string;
	displayName: string | null;
	email: string | null;
	profileBio: string | null;
	profileWebsite: string | null;
	retentionClass: "authored_editor" | "empty" | "untouched_editor";
	sessions: Array<{
		clientLabel: string | null;
		createdAt: string;
		expiresAt: string;
		id: string;
		lastSeenAt: string;
	}>;
	siteRole: "admin" | "user";
	usage: {activeWorlds: number; maxWorlds: number; trashedWorlds: number};
	userId: string;
	username: string | null;
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

const formatDateTime = (value: string) =>
	new Intl.DateTimeFormat(undefined, {dateStyle: "medium", timeStyle: "short"}).format(
		new Date(value),
	);

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
	const [profileBusy, setProfileBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [deletePassword, setDeletePassword] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [profileBio, setProfileBio] = useState("");
	const [profileWebsite, setProfileWebsite] = useState("");
	const deleteTrigger = useRef<HTMLButtonElement | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		fetch("/api/account", {signal: controller.signal})
			.then(async (response) => {
				if (!response.ok) throw new Error("Account details could not be loaded.");
				return ((await response.json()) as {data: AccountSummary | null}).data;
			})
			.then((nextAccount) => {
				setAccount(nextAccount);
				setDisplayName(nextAccount?.displayName ?? "");
				setProfileBio(nextAccount?.profileBio ?? "");
				setProfileWebsite(nextAccount?.profileWebsite ?? "");
			})
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

	const signOutAll = async () => {
		setBusy(true);
		setError("");
		try {
			await post("/api/auth/sign-out-all");
			window.location.assign("/");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The sessions could not be signed out.");
			setBusy(false);
		}
	};

	const savePublicProfile = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setProfileBusy(true);
		setError("");
		setNotice("");
		try {
			const response = await fetch("/api/account", {
				method: "PATCH",
				headers: {"content-type": "application/json", "x-csrf-token": await csrfToken()},
				body: JSON.stringify({bio: profileBio, displayName, website: profileWebsite}),
			});
			const result = (await response.json()) as {
				data?: AccountSummary;
				error?: {message?: string};
			};
			if (!response.ok || !result.data)
				throw new Error(result.error?.message || "The public profile could not be saved.");
			setAccount(result.data);
			setDisplayName(result.data.displayName ?? "");
			setProfileBio(result.data.profileBio ?? "");
			setProfileWebsite(result.data.profileWebsite ?? "");
			setNotice("Public profile saved.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The public profile could not be saved.");
		} finally {
			setProfileBusy(false);
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
			<header className="accountPageHeader">
				<div>
					<h1>Account</h1>
					<span>
						{loading
							? "Checking account"
							: registered
								? "Registered account"
								: account
									? "Temporary account"
									: "No account yet"}
					</span>
				</div>
				{registered ? (
					<button type="button" onClick={() => void signOut()} disabled={busy}>
						{busy ? "Signing out…" : "Sign out"}
					</button>
				) : account ? (
					<Link className="accountPrimaryAction" href="/register">
						Create an account
					</Link>
				) : null}
			</header>

			<div className="accountBody">
				<nav className="accountSectionIndex" aria-label="Account sections">
					<span>On this page</span>
					<a href="#ownership">Ownership</a>
					{registered ? <a href="#public-profile">Public profile</a> : null}
					{registered ? <a href="#security">Security</a> : null}
					{account ? <a href="#data">Your data</a> : null}
					{account ? <a href="#delete-account">Delete account</a> : null}
				</nav>

				<div className="accountRecord">
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
							<section className="accountLedgerSection" id="ownership">
								<div className="accountSectionIntro">
									<h2>Ownership</h2>
									<p>
										{registered
											? "This account holds your private worlds wherever you sign in."
											: "Your worlds stay with this browser until you create an account."}
									</p>
								</div>
								<div>
									<dl className="accountDetails">
										{registered ? (
											<div>
												<dt>Username</dt>
												<dd>{account.username}</dd>
											</div>
										) : null}
										{registered ? (
											<div>
												<dt>Verified email</dt>
												<dd>{account.email}</dd>
											</div>
										) : null}
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
									{!registered ? (
										<>
											<p className="accountSupportingCopy">
												Clearing site data, using private browsing, or moving to another browser can make your
												worlds inaccessible. {retentionCopy[account.retentionClass]} A 7-day recovery grace
												period follows before deletion.
											</p>
											{account.cleanupAfter ? (
												<p className="accountNotice">
													Cleanup is scheduled for {formatDate(account.cleanupAfter)}.
												</p>
											) : null}
											{account.cleanupWasRecentlyCancelled ? (
												<p className="accountNotice" role="status">
													A pending cleanup was cancelled when you returned. Your work remains available.
												</p>
											) : null}
										</>
									) : null}
								</div>
							</section>

							{registered ? (
								<section className="accountLedgerSection" id="public-profile">
									<div className="accountSectionIntro">
										<h2>Public profile</h2>
										<p>These details appear with your listed published worlds.</p>
									</div>
									<div>
										<form className="accountProfileForm" onSubmit={savePublicProfile}>
											<label htmlFor="profile-display-name">Display name</label>
											<input
												id="profile-display-name"
												type="text"
												maxLength={PUBLIC_PROFILE_DISPLAY_NAME_MAX_LENGTH}
												value={displayName}
												onChange={(event) => setDisplayName(event.target.value)}
											/>
											<small>Leave this blank to display your username, {account.username}.</small>

											<label htmlFor="profile-bio">Bio</label>
											<textarea
												id="profile-bio"
												maxLength={PUBLIC_PROFILE_BIO_MAX_LENGTH}
												rows={4}
												value={profileBio}
												onChange={(event) => setProfileBio(event.target.value)}
											/>

											<label htmlFor="profile-website">Website</label>
											<input
												id="profile-website"
												type="text"
												inputMode="url"
												maxLength={PUBLIC_PROFILE_WEBSITE_MAX_LENGTH}
												placeholder="example.com"
												value={profileWebsite}
												onChange={(event) => setProfileWebsite(event.target.value)}
											/>
											<small>You can enter a full address or a domain such as github.com.</small>
											<div className="accountFormActions">
												<button type="submit" disabled={profileBusy}>
													{profileBusy ? "Saving…" : "Save profile"}
												</button>
												<Link href={`/users/${account.username}`}>View public profile</Link>
											</div>
										</form>
									</div>
								</section>
							) : null}

							{registered ? (
								<section className="accountLedgerSection" id="security">
									<div className="accountSectionIntro">
										<h2>Security</h2>
										<p>Manage your password and active browser sessions.</p>
									</div>
									<div>
										<section className="accountSubsection" aria-labelledby="sessions-title">
											<h3 id="sessions-title">Active sessions</h3>
											<p>
												{account.sessions.length
													? `${account.sessions.length} active ${account.sessions.length === 1 ? "browser session" : "browser sessions"}.`
													: "No active browser sessions."}
											</p>
											{account.sessions.length ? (
												<div className="accountSessionList">
													{account.sessions.map((session, index) => (
														<div className="accountSessionRow" key={session.id}>
															<strong>{session.clientLabel || `Browser session ${index + 1}`}</strong>
															<dl>
																<div>
																	<dt>Last used</dt>
																	<dd>{formatDateTime(session.lastSeenAt)}</dd>
																</div>
																<div>
																	<dt>Expires</dt>
																	<dd>{formatDate(session.expiresAt)}</dd>
																</div>
															</dl>
														</div>
													))}
												</div>
											) : null}
											<button
												className="accountSignOutAll"
												type="button"
												disabled={busy || account.sessions.length === 0}
												onClick={() => void signOutAll()}
											>
												{busy ? "Signing out…" : "Sign out all devices"}
											</button>
											<small className="accountSessionHelp">This signs out this browser too.</small>
										</section>
										<section className="accountSubsection" aria-labelledby="password-title">
											<h3 id="password-title">Change password</h3>
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
									</div>
								</section>
							) : null}

							<section className="accountLedgerSection" id="data">
								<div className="accountSectionIntro">
									<h2>Your data</h2>
									<p>Take a copy of your worlds and the account records that belong to you.</p>
								</div>
								<div className="accountDataActions">
									<a href="/api/account/export">Export all data</a>
									<Link href="/worlds">Return to your worlds</Link>
								</div>
							</section>

							<section className="accountLedgerSection" id="delete-account">
								<div className="accountSectionIntro">
									<h2>Delete account</h2>
									<p>Permanently remove this account after taking any data you want to keep.</p>
								</div>
								<div>
									<p className="accountSupportingCopy">
										This deletes every active and trashed private world, revokes every session, and removes
										local recovery drafts. It cannot be undone.
									</p>
									<button
										className="accountDelete"
										ref={deleteTrigger}
										type="button"
										onClick={() => setDeleteOpen(true)}
									>
										Delete account
									</button>
								</div>
							</section>
						</>
					) : !loading ? (
						<section className="accountLedgerSection accountEmptyState" id="ownership">
							<div className="accountSectionIntro">
								<h2>Your worlds stay with this browser</h2>
								<p>A temporary account begins only when you enter the world library.</p>
							</div>
							<div>
								<p className="accountSupportingCopy">
									Clearing site data, using private browsing, or moving to another browser can make these
									worlds inaccessible until you create an account.
								</p>
								<div className="accountEmptyActions">
									<Link href="/worlds">Open your worlds</Link>
									<Link href="/sign-in">Sign in</Link>
								</div>
							</div>
						</section>
					) : null}
				</div>
			</div>

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
