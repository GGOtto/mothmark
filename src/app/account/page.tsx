"use client";

import Link from "next/link";
import {useEffect, useRef, useState} from "react";

import {deleteWorldDraftsForUser} from "@/components/world-autosave/worldDraftStorage";

import "./page.scss";

type AccountSummary = {
	accountType: "anonymous" | "registered";
	cleanupAfter: string | null;
	cleanupCancelledAt: string | null;
	cleanupWasRecentlyCancelled: boolean;
	createdAt: string;
	retentionClass: "authored_editor" | "empty" | "untouched_editor";
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

export default function AccountPage() {
	const [account, setAccount] = useState<AccountSummary | null>(null);
	const [loading, setLoading] = useState(true);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState("");
	const deleteTrigger = useRef<HTMLButtonElement | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		fetch("/api/account", {signal: controller.signal})
			.then(async (response) => {
				if (response.status === 401) return null;
				if (!response.ok) throw new Error("Account details could not be loaded.");
				return ((await response.json()) as {data: AccountSummary}).data;
			})
			.then((summary) => setAccount(summary))
			.catch((caught: unknown) => {
				if ((caught as {name?: string}).name !== "AbortError") {
					setError(caught instanceof Error ? caught.message : "Account details could not be loaded.");
				}
			})
			.finally(() => setLoading(false));
		return () => controller.abort();
	}, []);

	const closeDelete = () => {
		setDeleteOpen(false);
		setError("");
		queueMicrotask(() => deleteTrigger.current?.focus());
	};

	const deleteAccount = async () => {
		if (!account) return;
		setDeleting(true);
		setError("");
		try {
			const csrfResponse = await fetch("/api/auth/csrf");
			const csrf = ((await csrfResponse.json()) as {data?: {csrfToken?: string}}).data?.csrfToken;
			if (!csrf) throw new Error("The account deletion could not be verified.");
			const response = await fetch("/api/account", {
				method: "DELETE",
				headers: {"x-csrf-token": csrf},
			});
			if (!response.ok) throw new Error("The account could not be deleted.");
			await deleteWorldDraftsForUser(account.userId).catch(() => undefined);
			window.location.assign("/");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The account could not be deleted.");
			setDeleting(false);
		}
	};

	return (
		<main className="accountPage">
			<section className="accountPanel" aria-labelledby="account-title">
				<p className="accountLabel">Temporary account</p>
				<h1 id="account-title">Your worlds stay with this browser</h1>
				<p>
					Mothmark uses a private anonymous account and a necessary authentication cookie so other
					visitors cannot see or change your worlds.
				</p>
				<p>
					There is not yet a sign-in or account-recovery flow. Clearing this browser’s site data, using
					private browsing, or moving to another browser can make these worlds inaccessible.
				</p>

				{loading ? <p role="status">Checking this browser…</p> : null}
				{error ? (
					<p className="accountError" role="alert">
						{error}
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
						<p>
							{retentionCopy[account.retentionClass]} A 7-day recovery grace period follows before
							deletion.
						</p>
						{account.cleanupAfter ? (
							<p className="accountNotice">
								Cleanup is scheduled for {formatDate(account.cleanupAfter)}. Using this account before then
								cancels cleanup.
							</p>
						) : null}
						{account.cleanupWasRecentlyCancelled ? (
							<p className="accountNotice" role="status">
								A pending cleanup was cancelled when you returned. Your work remains available.
							</p>
						) : null}
						<div className="accountActions">
							<a href="/api/account/export">Export all data</a>
							<button ref={deleteTrigger} type="button" onClick={() => setDeleteOpen(true)}>
								Delete account
							</button>
						</div>
					</>
				) : !loading ? (
					<p>Enter the world library to create a temporary account on this browser.</p>
				) : null}
				<div className="accountLinks">
					<Link href="/worlds">{account ? "Return to your worlds" : "Open your worlds"}</Link>
					<Link href="/privacy">Privacy and cookies</Link>
				</div>
			</section>

			{deleteOpen && account ? (
				<div className="accountDialogBackdrop" role="presentation">
					<section
						className="accountDialog"
						role="dialog"
						aria-modal="true"
						aria-labelledby="delete-account-title"
						onKeyDown={(event) => {
							if (event.key === "Escape" && !deleting) closeDelete();
						}}
					>
						<h2 id="delete-account-title">Delete this account?</h2>
						<p>
							This immediately deletes every active and trashed private world, revokes this browser
							session, and removes local recovery drafts. It cannot be undone.
						</p>
						{error ? (
							<p className="accountError" role="alert">
								{error}
							</p>
						) : null}
						<div className="accountDialogActions">
							<button type="button" autoFocus onClick={closeDelete} disabled={deleting}>
								Cancel
							</button>
							<button
								type="button"
								className="accountDeleteConfirm"
								onClick={() => void deleteAccount()}
								disabled={deleting}
							>
								{deleting ? "Deleting…" : "Delete account"}
							</button>
						</div>
					</section>
				</div>
			) : null}
		</main>
	);
}
