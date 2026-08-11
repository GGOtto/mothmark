"use client";

import Link from "next/link";
import {useParams} from "next/navigation";
import {FormEvent, useEffect, useState} from "react";

import {formatAdminDate, mutateAdminJson, readAdminJson} from "../../../adminClient";
import type {AdminFeedbackDetail} from "../../../adminTypes";

const categoryLabel = {
	bug: "Something is not working",
	general: "General feedback",
	idea: "Idea or request",
} as const;

export default function AdminFeedbackDetailPage() {
	const {id} = useParams<{id: string}>();
	const [feedback, setFeedback] = useState<AdminFeedbackDetail>();
	const [reply, setReply] = useState("");
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	useEffect(() => {
		readAdminJson<{data: AdminFeedbackDetail}>(`/api/admin/feedback/${id}`)
			.then((result) => setFeedback(result.data))
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : "Feedback could not be loaded."),
			)
			.finally(() => setLoading(false));
	}, [id]);

	const sendReply = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!reply.trim()) return;
		setSending(true);
		setError("");
		setNotice("");
		try {
			const result = await mutateAdminJson<{data: AdminFeedbackDetail}>(
				`/api/admin/feedback/${id}/replies`,
				"POST",
				{message: reply},
			);
			setFeedback(result.data);
			setReply("");
			setNotice(`Reply sent from support@mothmark.app to ${result.data.replyEmail}.`);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The reply could not be sent.");
		} finally {
			setSending(false);
		}
	};

	return (
		<main className="adminPage adminFeedbackDetail">
			<Link className="adminBackLink" href="/admin/feedback">
				← Feedback
			</Link>
			{loading ? <p role="status">Loading feedback…</p> : null}
			{error ? (
				<p className="adminError" role="alert">
					{error}
				</p>
			) : null}
			{notice ? (
				<p className="adminNotice" role="status">
					{notice}
				</p>
			) : null}
			{feedback ? (
				<>
					<header className="adminPageHeader">
						<div>
							<h1>{categoryLabel[feedback.category]}</h1>
							<p>Received {formatAdminDate(feedback.createdAt)}</p>
						</div>
						<span className={`adminStatus adminStatus-${feedback.status}`}>{feedback.status}</span>
					</header>

					<section className="adminSection">
						<h2>Sender</h2>
						<dl className="adminDefinitionGrid">
							<div>
								<dt>Reply email</dt>
								<dd>{feedback.replyEmail}</dd>
							</div>
							<div>
								<dt>Account</dt>
								<dd>
									{feedback.actorUserId ? (
										<Link href={`/admin/users/${feedback.actorUserId}`}>
											{feedback.username || feedback.accountType || "Account"}
										</Link>
									) : (
										"Signed out"
									)}
								</dd>
							</div>
							<div>
								<dt>Page</dt>
								<dd>
									{feedback.page ? (
										<a href={feedback.page} target="_blank" rel="noreferrer">
											Open submitted page
										</a>
									) : (
										"Not included"
									)}
								</dd>
							</div>
						</dl>
					</section>

					<section className="adminSection">
						<h2>Conversation</h2>
						<ul className="adminFeedbackReplies">
							<li>
								<header>
									<span>Customer · {formatAdminDate(feedback.createdAt)}</span>
									<span>Submitted on Mothmark</span>
								</header>
								<p>{feedback.message}</p>
							</li>
							{feedback.replies.length > 0
								? feedback.replies.map((item) => (
										<li key={item.id}>
											<header>
												<span>
													{item.authorType === "admin" ? "Admin" : "Customer"} ·{" "}
													{formatAdminDate(item.createdAt)}
												</span>
												<span>
													{item.source === "email" ? "Email" : "Admin page"}
													{item.authorType === "admin" ? ` · ${item.deliveryStatus}` : ""}
												</span>
											</header>
											<p>{item.message}</p>
										</li>
									))
								: null}
						</ul>
					</section>

					<section className="adminSection">
						<h2>Reply</h2>
						<p>
							This response will be delivered to {feedback.replyEmail} from support@mothmark.app. Admins
							can also reply directly to feedback notification emails.
						</p>
						<form onSubmit={(event) => void sendReply(event)}>
							<label htmlFor="admin-feedback-reply">Message</label>
							<textarea
								id="admin-feedback-reply"
								value={reply}
								onChange={(event) => setReply(event.target.value)}
								maxLength={4_000}
								required
							/>
							<button type="submit" disabled={sending || !reply.trim()}>
								{sending ? "Sending…" : "Send reply"}
							</button>
						</form>
					</section>
				</>
			) : null}
		</main>
	);
}
