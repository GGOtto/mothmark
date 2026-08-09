"use client";

import {ExternalLink} from "lucide-react";
import {useEffect, useState} from "react";

import {readBrowserCsrfToken} from "@/auth/browserCsrf";

import "./PublishingPanel.scss";

type Publication = {
	id: string;
	slug: string;
	title: string;
	summary: string;
	visibility: "listed" | "unlisted";
	release: {number: number; publishedAt: string};
	worldRevision: number;
};

export function PublishingPanel({
	worldId,
	worldName,
	revision,
}: {
	worldId: string | null;
	worldName: string;
	revision: number | null;
}) {
	const [eligible, setEligible] = useState(false);
	const [loading, setLoading] = useState(true);
	const [publication, setPublication] = useState<Publication | null>(null);
	const [title, setTitle] = useState(worldName);
	const [slug, setSlug] = useState(worldName);
	const [summary, setSummary] = useState("");
	const [visibility, setVisibility] = useState<"listed" | "unlisted">("listed");
	const [working, setWorking] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!worldId) return;
		let cancelled = false;
		Promise.all([fetch("/api/account"), fetch(`/api/world/${worldId}/publication`)])
			.then(async ([accountResponse, publicationResponse]) => {
				const accountBody = (await accountResponse.json()) as {data?: {accountType?: string}};
				if (cancelled || accountBody.data?.accountType !== "registered") return;
				setEligible(true);
				if (publicationResponse.ok) {
					const body = (await publicationResponse.json()) as {data?: Publication | null};
					setPublication(body.data ?? null);
				}
			})
			.catch(() => undefined)
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [worldId]);

	if (loading || !eligible || !worldId || !revision) return null;

	const publish = async (event: React.FormEvent) => {
		event.preventDefault();
		setWorking(true);
		setError("");
		try {
			const csrf = readBrowserCsrfToken();
			if (!csrf) throw new Error("The editor security token is missing.");
			const response = await fetch(`/api/world/${worldId}/publication`, {
				method: "POST",
				headers: {"content-type": "application/json", "x-csrf-token": csrf},
				body: JSON.stringify({expectedRevision: revision, title, slug, summary, visibility}),
			});
			const body = (await response.json()) as {data?: Publication; error?: {message?: string}};
			if (!response.ok || !body.data)
				throw new Error(body.error?.message || "The world could not be published.");
			setPublication(body.data);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The world could not be published.");
		} finally {
			setWorking(false);
		}
	};

	return publication ? (
		<section className="publishingPanel" aria-labelledby="publishing-title">
			<h2 id="publishing-title">Publishing</h2>
			<p>
				Release {publication.release.number} is live from saved revision {publication.worldRevision}.
			</p>
			<dl>
				<div>
					<dt>Public title</dt>
					<dd>{publication.title}</dd>
				</div>
				<div>
					<dt>Visibility</dt>
					<dd>{publication.visibility}</dd>
				</div>
			</dl>
			<a href={`/play/${publication.slug}`} target="_blank" rel="noreferrer">
				Open published world <ExternalLink size={14} aria-hidden="true" />
			</a>
			<small>/play/{publication.slug}</small>
		</section>
	) : (
		<section className="publishingPanel" aria-labelledby="publishing-title">
			<h2 id="publishing-title">Publishing</h2>
			<p>Publish the current server-saved revision as an immutable first release.</p>
			<form onSubmit={(event) => void publish(event)}>
				<label htmlFor="publication-title">Public title</label>
				<input
					id="publication-title"
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					maxLength={80}
					required
				/>
				<label htmlFor="publication-slug">Stable public slug</label>
				<input
					id="publication-slug"
					value={slug}
					onChange={(event) => setSlug(event.target.value)}
					maxLength={100}
					required
				/>
				<label htmlFor="publication-summary">Short summary</label>
				<textarea
					id="publication-summary"
					value={summary}
					onChange={(event) => setSummary(event.target.value)}
					maxLength={280}
					required
				/>
				<label htmlFor="publication-visibility">Catalog visibility</label>
				<select
					id="publication-visibility"
					value={visibility}
					onChange={(event) => setVisibility(event.target.value as "listed" | "unlisted")}
				>
					<option value="listed">Listed</option>
					<option value="unlisted">Unlisted</option>
				</select>
				{error ? (
					<p className="publishingPanelError" role="alert">
						{error}
					</p>
				) : null}
				<button type="submit" disabled={working}>
					{working ? "Publishing…" : "Publish current version"}
				</button>
			</form>
		</section>
	);
}
