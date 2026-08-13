"use client";

import Link from "next/link";
import {useEffect, useState} from "react";

import {formatAdminDate, readAdminJson} from "../../adminClient";
import type {AdminPublication} from "../../adminTypes";

export default function AdminPublicationsPage() {
	const [publications, setPublications] = useState<AdminPublication[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	useEffect(() => {
		readAdminJson<{data: {publications: AdminPublication[]}}>("/api/admin/publications")
			.then((result) => setPublications(result.data.publications))
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : "Publications could not be loaded."),
			)
			.finally(() => setLoading(false));
	}, []);
	return (
		<main className="adminPage">
			<header className="adminPageHeader">
				<div>
					<h1>Publications</h1>
					<p>Publication lifecycle and the selected immutable release.</p>
				</div>
				<span>{publications.length} publications</span>
			</header>
			{loading ? <p role="status">Loading publications…</p> : null}
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
								<th>Publication</th>
								<th>Owner</th>
								<th>Release</th>
								<th>Status</th>
								<th>Discovery</th>
								<th>Published</th>
							</tr>
						</thead>
						<tbody>
							{publications.map((publication) => (
								<tr key={publication.id}>
									<td>
										<Link href={`/admin/publications/${publication.id}`}>{publication.title}</Link>
										<small>/play/{publication.slug}</small>
									</td>
									<td>
										<Link href={`/admin/users/${publication.ownerUserId}`}>{publication.ownerUsername}</Link>
									</td>
									<td>{publication.release.number}</td>
									<td>
										<span className={`adminStatus adminStatus-${publication.status}`}>
											{publication.status}
										</span>
									</td>
									<td>
										{publication.isOfficial ? "Official" : "Community"}
										<small>
											{publication.visibility === "listed" ? "Published worlds" : "Direct link only"}
											{publication.listedOnHomepage ? ` · Home page #${publication.homepagePosition}` : ""}
										</small>
									</td>
									<td>{formatAdminDate(publication.release.publishedAt)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}
		</main>
	);
}
