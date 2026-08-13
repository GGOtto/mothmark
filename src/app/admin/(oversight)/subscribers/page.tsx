"use client";

import {useEffect, useMemo, useState} from "react";

import {ModalLayer} from "@/components/overlay/Overlay";
import {formatAdminDate, readAdminJson} from "../../adminClient";
import type {AdminSubscriber} from "../../adminTypes";

const sourceLabel: Record<AdminSubscriber["source"], string> = {
	footer: "Footer form",
	registration: "Registration",
};

export default function AdminSubscribersPage() {
	const [subscribers, setSubscribers] = useState<AdminSubscriber[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [emailWarningOpen, setEmailWarningOpen] = useState(false);
	const emails = useMemo(() => subscribers.map(({email}) => email), [subscribers]);
	const mailto = `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent("Notes from Mothmark")}`;

	useEffect(() => {
		readAdminJson<{data: {subscribers: AdminSubscriber[]}}>("/api/admin/subscribers")
			.then((result) => setSubscribers(result.data.subscribers))
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : "Subscribers could not be loaded."),
			)
			.finally(() => setLoading(false));
	}, []);

	const copyAll = async () => {
		setError("");
		setNotice("");
		try {
			await navigator.clipboard.writeText(emails.join("\n"));
			setNotice(`${emails.length} email${emails.length === 1 ? "" : "s"} copied.`);
		} catch {
			setError("The email list could not be copied. Check this browser's clipboard permission.");
		}
	};

	return (
		<main className="adminPage">
			<header className="adminPageHeader adminSubscriberHeader">
				<div>
					<h1>Subscribers</h1>
					<p>Email addresses that opted in to Notes from Mothmark.</p>
				</div>
				<div className="adminSubscriberActions">
					<button type="button" disabled={emails.length === 0} onClick={() => void copyAll()}>
						Copy all
					</button>
					<button
						className="adminPrimaryButton"
						type="button"
						disabled={emails.length === 0}
						onClick={() => setEmailWarningOpen(true)}
					>
						Email all
					</button>
				</div>
			</header>
			<p className="adminSubscriberCount">{subscribers.length} active subscribers</p>
			{loading ? <p role="status">Loading subscribers…</p> : null}
			{notice ? (
				<p className="adminNotice" role="status">
					{notice}
				</p>
			) : null}
			{error ? (
				<p className="adminError" role="alert">
					{error}
				</p>
			) : null}
			{!loading && !error && subscribers.length === 0 ? (
				<section className="adminSection">
					<p>No one has subscribed yet.</p>
				</section>
			) : null}
			{!loading && subscribers.length > 0 ? (
				<div className="adminTableFrame">
					<table>
						<thead>
							<tr>
								<th>Email</th>
								<th>Source</th>
								<th>Subscribed</th>
							</tr>
						</thead>
						<tbody>
							{subscribers.map((subscriber) => (
								<tr key={subscriber.email.toLowerCase()}>
									<td className="adminSubscriberEmail">{subscriber.email}</td>
									<td>{sourceLabel[subscriber.source]}</td>
									<td>{formatAdminDate(subscriber.subscribedAt)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}
			{emailWarningOpen ? (
				<ModalLayer
					ariaLabelledBy="subscriber-email-warning-title"
					className="adminConfirmDialog"
					mobilePresentation="sheet"
					onClose={() => setEmailWarningOpen(false)}
				>
					<h2 id="subscriber-email-warning-title">Email every subscriber?</h2>
					<p>
						This opens a draft addressed to {emails.length} subscriber
						{emails.length === 1 ? "" : "s"}. Their addresses are placed in BCC so recipients cannot see
						one another.
					</p>
					<p>
						Check the BCC field before sending. Some mail apps limit how many recipients a draft can
						contain.
					</p>
					<div className="adminDialogActions">
						<button type="button" onClick={() => setEmailWarningOpen(false)}>
							Cancel
						</button>
						<a className="adminPrimaryButton" href={mailto} onClick={() => setEmailWarningOpen(false)}>
							Open BCC draft
						</a>
					</div>
				</ModalLayer>
			) : null}
		</main>
	);
}
