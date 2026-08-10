"use client";

import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect, useState} from "react";

import {formatAdminDate, mutateAdminJson, readAdminJson} from "../../../adminClient";
import type {AdminPublication} from "../../../adminTypes";

export default function AdminPublicationDetailPage() {
	const id = String(useParams<{id: string}>().id);
	const [publication, setPublication] = useState<AdminPublication | null>(null);
	const [error, setError] = useState("");
	const [working, setWorking] = useState(false);
	useEffect(() => {
		readAdminJson<{data: AdminPublication}>(`/api/admin/publications/${id}`)
			.then((result) => setPublication(result.data))
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : "The publication could not be loaded."),
			);
	}, [id]);
	const setSuspension = async (suspended: boolean) => {
		const reason = suspended
			? window.prompt("Reason for suspending this publication")?.trim()
			: undefined;
		if (suspended && !reason) return;
		setWorking(true);
		setError("");
		try {
			const result = await mutateAdminJson<{data: AdminPublication}>(
				`/api/admin/publications/${id}`,
				"PUT",
				suspended ? {status: "suspended", reason} : {status: "unpublished"},
			);
			setPublication(result.data);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The publication could not be updated.");
		} finally {
			setWorking(false);
		}
	};
	return (
		<main className="adminPage">
			<header className="adminPageHeader">
				<div>
					<Link href="/admin/publications">← Publications</Link>
					<h1>{publication?.title ?? "Publication"}</h1>
					<p>Immutable release history and publication oversight.</p>
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
					<Link href={`/admin/playthroughs?publicationId=${publication.id}`}>
						View publication playthroughs
					</Link>
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
								<Link href={`/admin/users/${publication.ownerUserId}`}>{publication.ownerUsername}</Link>
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
					<h2>Suspension</h2>
					<p>
						Suspension immediately blocks all play. Lifting it leaves the world unpublished so its owner
						can decide when to republish.
					</p>
					{publication.status === "suspended" ? (
						<button type="button" disabled={working} onClick={() => void setSuspension(false)}>
							{working ? "Working…" : "Lift suspension"}
						</button>
					) : (
						<button type="button" disabled={working} onClick={() => void setSuspension(true)}>
							{working ? "Working…" : "Suspend publication"}
						</button>
					)}
				</section>
			) : null}
		</main>
	);
}
