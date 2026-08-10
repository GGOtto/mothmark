"use client";

import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {Suspense, useCallback, useEffect, useState} from "react";

import {formatAdminDate, readAdminJson} from "../../adminClient";
import type {AdminPlaythrough} from "../../adminTypes";

function AdminPlaythroughsContent() {
	const searchParams = useSearchParams();
	const [playthroughs, setPlaythroughs] = useState<AdminPlaythrough[]>([]);
	const [status, setStatus] = useState(searchParams.get("status") ?? "");
	const [minimumCommands, setMinimumCommands] = useState("");
	const [errorsOnly, setErrorsOnly] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		await Promise.resolve();
		setLoading(true);
		setError("");
		const query = new URLSearchParams();
		for (const key of ["publicationId", "worldId", "releaseId"])
			if (searchParams.get(key)) query.set(key, searchParams.get(key)!);
		if (status) query.set("status", status);
		if (minimumCommands) query.set("minimumCommands", minimumCommands);
		if (errorsOnly) query.set("errorsOnly", "true");
		try {
			const result = await readAdminJson<{data: {playthroughs: AdminPlaythrough[]}}>(
				`/api/admin/playthroughs?${query}`,
			);
			setPlaythroughs(result.data.playthroughs);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Playthroughs could not be loaded.");
		} finally {
			setLoading(false);
		}
	}, [errorsOnly, minimumCommands, searchParams, status]);

	useEffect(() => {
		const timeout = window.setTimeout(() => void load(), 0);
		return () => window.clearTimeout(timeout);
	}, [load]);

	return (
		<main className="adminPage">
			<header className="adminPageHeader">
				<div>
					<h1>Playthroughs</h1>
					<p>Recorded player-path evidence for release diagnostics.</p>
				</div>
				<span>{playthroughs.length} results</span>
			</header>
			<form
				className="adminSection adminPlaythroughFilters"
				onSubmit={(event) => {
					event.preventDefault();
					void load();
				}}
			>
				<label>
					Status
					<select value={status} onChange={(event) => setStatus(event.target.value)}>
						<option value="">Any status</option>
						<option value="active">Active</option>
						<option value="completed">Completed</option>
						<option value="abandoned">Abandoned</option>
						<option value="errored">Errored</option>
					</select>
				</label>
				<label>
					Minimum commands
					<input
						type="number"
						min="0"
						value={minimumCommands}
						onChange={(event) => setMinimumCommands(event.target.value)}
					/>
				</label>
				<label className="adminCheckboxLabel">
					<input
						type="checkbox"
						checked={errorsOnly}
						onChange={(event) => setErrorsOnly(event.target.checked)}
					/>
					Errors only
				</label>
				<button type="submit">Apply filters</button>
			</form>
			{loading ? <p role="status">Loading playthroughs…</p> : null}
			{error ? (
				<p className="adminError" role="alert">
					{error}
				</p>
			) : null}
			{!loading && !error ? (
				<div className="adminTableFrame">
					<table>
						<thead>
							<tr>
								<th>World</th>
								<th>Player</th>
								<th>Status</th>
								<th>Commands</th>
								<th>Started</th>
								<th>Last activity</th>
								<th>Retention</th>
							</tr>
						</thead>
						<tbody>
							{playthroughs.map((playthrough) => (
								<tr key={playthrough.id}>
									<td>
										<Link href={`/admin/playthroughs/${playthrough.id}`}>{playthrough.publicationTitle}</Link>
										<small>Release {playthrough.releaseNumber}</small>
									</td>
									<td>{playthrough.playerReference}</td>
									<td>
										<span className={`adminStatus adminStatus-${playthrough.status}`}>
											{playthrough.status}
										</span>
									</td>
									<td>{playthrough.commandCount}</td>
									<td>{formatAdminDate(playthrough.startedAt)}</td>
									<td>{formatAdminDate(playthrough.lastActivityAt)}</td>
									<td>
										{playthrough.anonymizedAt
											? `Anonymized; purge ${formatAdminDate(playthrough.purgeAfter)}`
											: "Identified"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}
		</main>
	);
}

export default function AdminPlaythroughsPage() {
	return (
		<Suspense fallback={<p role="status">Loading playthroughs…</p>}>
			<AdminPlaythroughsContent />
		</Suspense>
	);
}
