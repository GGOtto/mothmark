"use client";

import Link from "next/link";
import {useEffect, useState} from "react";

import {formatAdminDate, formatBytes, readAdminJson} from "../../adminClient";
import type {AdminWorld} from "../../adminTypes";

export default function AdminWorldsPage() {
	const [worlds, setWorlds] = useState<AdminWorld[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	useEffect(() => {
		readAdminJson<{data: {worlds: AdminWorld[]}}>("/api/admin/worlds")
			.then((result) => setWorlds(result.data.worlds))
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : "Worlds could not be loaded."),
			)
			.finally(() => setLoading(false));
	}, []);
	return (
		<main className="adminPage">
			<header className="adminPageHeader">
				<div>
					<h1>Worlds</h1>
					<p>Read-only inspection across private editor worlds.</p>
				</div>
				<span>{worlds.length} worlds</span>
			</header>
			{loading ? <p role="status">Loading worlds…</p> : null}
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
								<th>Owner</th>
								<th>Revision</th>
								<th>Size</th>
								<th>Lifecycle</th>
								<th>Updated</th>
							</tr>
						</thead>
						<tbody>
							{worlds.map((world) => (
								<tr key={world.id}>
									<td>
										<Link href={`/admin/worlds/${world.id}`}>{world.name}</Link>
										<small>{world.editorSlug}</small>
									</td>
									<td>
										<Link href={`/admin/users/${world.owner.id}`}>
											{world.owner.displayName || `Anonymous ${world.owner.id.slice(0, 8)}`}
										</Link>
										<small>{world.owner.accountType}</small>
									</td>
									<td>{world.revision}</td>
									<td>{formatBytes(world.worldSizeBytes)}</td>
									<td>
										<span className={`adminStatus adminStatus-${world.lifecycle}`}>{world.lifecycle}</span>
									</td>
									<td>{formatAdminDate(world.updatedAt)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}
		</main>
	);
}
