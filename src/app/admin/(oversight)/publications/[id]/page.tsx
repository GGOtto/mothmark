"use client";

import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect, useState} from "react";

import {formatAdminDate, readAdminJson} from "../../../adminClient";
import type {AdminPublication} from "../../../adminTypes";

export default function AdminPublicationDetailPage() {
	const id = String(useParams<{id: string}>().id);
	const [publication, setPublication] = useState<AdminPublication | null>(null);
	const [error, setError] = useState("");
	useEffect(() => {
		readAdminJson<{data: AdminPublication}>(`/api/admin/publications/${id}`)
			.then((result) => setPublication(result.data))
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : "The publication could not be loaded."),
			);
	}, [id]);
	return (
		<main className="adminPage">
			<header className="adminPageHeader">
				<div>
					<Link href="/admin/publications">← Publications</Link>
					<h1>{publication?.title ?? "Publication"}</h1>
					<p>Immutable release 1 and active listing metadata.</p>
				</div>
			</header>
			{error ? (
				<p className="adminError" role="alert">
					{error}
				</p>
			) : null}
			{!publication && !error ? <p role="status">Loading publication…</p> : null}
			{publication ? (
				<section className="adminDetailSection">
					<h2>Publication metadata</h2>
					<dl className="adminDefinitionList">
						<div>
							<dt>Public URL</dt>
							<dd>
								<a href={`/play/${publication.slug}`}>/play/{publication.slug}</a>
							</dd>
						</div>
						<div>
							<dt>Status</dt>
							<dd>{publication.status}</dd>
						</div>
						<div>
							<dt>Visibility</dt>
							<dd>{publication.visibility}</dd>
						</div>
						<div>
							<dt>Release</dt>
							<dd>{publication.release.number}</dd>
						</div>
						<div>
							<dt>Published</dt>
							<dd>{formatAdminDate(publication.release.publishedAt)}</dd>
						</div>
						<div>
							<dt>Owner</dt>
							<dd>
								<Link href={`/admin/users/${publication.ownerUserId}`}>
									{publication.ownerName || publication.ownerUserId}
								</Link>
							</dd>
						</div>
						<div>
							<dt>Private world</dt>
							<dd>
								<Link href={`/admin/worlds/${publication.worldId}`}>{publication.worldId}</Link>
							</dd>
						</div>
					</dl>
					<h2>Public summary</h2>
					<p>{publication.summary}</p>
				</section>
			) : null}
		</main>
	);
}
