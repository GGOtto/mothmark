"use client";

import {useCallback, useEffect, useState} from "react";

import {formatAdminDate, readAdminJson} from "../../adminClient";

type Entry = {
	action: string;
	actorUserId: string | null;
	createdAt: string;
	details: Record<string, unknown>;
	id: string;
	reason: string | null;
	targetId: string;
	targetType: string;
};

export default function AdminAuditPage() {
	const [entries, setEntries] = useState<Entry[]>([]);
	const [error, setError] = useState("");
	const [filters, setFilters] = useState({action: "", actor: "", from: "", target: "", to: ""});
	const load = useCallback(async () => {
		const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
		const result = await readAdminJson<{data: {entries: Entry[]}}>(`/api/admin/audit?${query}`);
		setEntries(result.data.entries);
	}, [filters]);
	useEffect(() => {
		const timeout = window.setTimeout(
			() =>
				void load().catch((caught: unknown) =>
					setError(caught instanceof Error ? caught.message : "Audit history could not be loaded."),
				),
			200,
		);
		return () => window.clearTimeout(timeout);
	}, [load]);
	return (
		<main className="adminPage">
			<header className="adminPageHeader">
				<div>
					<h1>Audit history</h1>
					<p>Successful administrator mutations, newest first</p>
				</div>
				<span>{entries.length} shown</span>
			</header>
			{error ? (
				<p className="adminError" role="alert">
					{error}
				</p>
			) : null}
			<section className="adminSection">
				<h2>Filters</h2>
				<div className="adminFilterGrid">
					<label>
						Actor
						<input
							value={filters.actor}
							onChange={(event) => setFilters({...filters, actor: event.target.value})}
							placeholder="User UUID"
						/>
					</label>
					<label>
						Action
						<input
							value={filters.action}
							onChange={(event) => setFilters({...filters, action: event.target.value})}
							placeholder="world.transferred"
						/>
					</label>
					<label>
						Target
						<input
							value={filters.target}
							onChange={(event) => setFilters({...filters, target: event.target.value})}
							placeholder="Target UUID"
						/>
					</label>
					<label>
						From
						<input
							type="date"
							value={filters.from}
							onChange={(event) => setFilters({...filters, from: event.target.value})}
						/>
					</label>
					<label>
						To
						<input
							type="date"
							value={filters.to}
							onChange={(event) => setFilters({...filters, to: event.target.value})}
						/>
					</label>
				</div>
			</section>
			<section className="adminSection">
				<h2>Events</h2>
				{entries.length ? (
					<div className="adminTableFrame">
						<table>
							<thead>
								<tr>
									<th>Date</th>
									<th>Actor</th>
									<th>Action</th>
									<th>Target</th>
									<th>Reason</th>
									<th>Details</th>
								</tr>
							</thead>
							<tbody>
								{entries.map((entry) => (
									<tr key={entry.id}>
										<td>{formatAdminDate(entry.createdAt)}</td>
										<td>
											<code>{entry.actorUserId?.slice(0, 8) || "removed"}</code>
										</td>
										<td>
											<code>{entry.action}</code>
										</td>
										<td>
											{entry.targetType}
											<small>{entry.targetId}</small>
										</td>
										<td>{entry.reason || "—"}</td>
										<td>
											<code>{JSON.stringify(entry.details)}</code>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<p>No audit events match these filters.</p>
				)}
			</section>
		</main>
	);
}
