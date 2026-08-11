"use client";

import Link from "next/link";
import {useEffect, useState} from "react";

import {formatAdminDate, readAdminJson} from "../../adminClient";
import type {AdminFeedback} from "../../adminTypes";

const categoryLabel = {
	bug: "Something is not working",
	general: "General feedback",
	idea: "Idea or request",
} as const;

export default function AdminFeedbackPage() {
	const [feedback, setFeedback] = useState<AdminFeedback[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		readAdminJson<{data: {feedback: AdminFeedback[]}}>("/api/admin/feedback")
			.then((result) => setFeedback(result.data.feedback))
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : "Feedback could not be loaded."),
			)
			.finally(() => setLoading(false));
	}, []);

	return (
		<main className="adminPage">
			<header className="adminPageHeader">
				<div>
					<h1>Feedback</h1>
					<p>Messages sent by Mothmark visitors and authors.</p>
				</div>
				<span>{feedback.length} messages</span>
			</header>
			{loading ? <p role="status">Loading feedback…</p> : null}
			{error ? (
				<p className="adminError" role="alert">
					{error}
				</p>
			) : null}
			{!loading && !error && feedback.length === 0 ? (
				<section className="adminSection">
					<p>No feedback has been received.</p>
				</section>
			) : null}
			{!loading && !error && feedback.length > 0 ? (
				<div className="adminTableFrame">
					<table>
						<thead>
							<tr>
								<th>Message</th>
								<th>From</th>
								<th>Status</th>
								<th>Received</th>
							</tr>
						</thead>
						<tbody>
							{feedback.map((item) => (
								<tr key={item.id}>
									<td>
										<Link href={`/admin/feedback/${item.id}`}>{categoryLabel[item.category]}</Link>
										<small className="adminFeedbackExcerpt">{item.message}</small>
									</td>
									<td>
										{item.username || item.replyEmail}
										{item.username ? <small>{item.replyEmail}</small> : null}
									</td>
									<td>
										<span className={`adminStatus adminStatus-${item.status}`}>{item.status}</span>
										{item.notificationStatus === "failed" ? <small>Notification failed</small> : null}
										{item.customerReceiptStatus === "failed" ? <small>Customer receipt failed</small> : null}
									</td>
									<td>{formatAdminDate(item.createdAt)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}
		</main>
	);
}
