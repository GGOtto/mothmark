"use client";

import {Search} from "lucide-react";
import Link from "next/link";
import {useEffect, useState} from "react";

import "./play.scss";

type Publication = {
	authorUsername: string;
	id: string;
	slug: string;
	title: string;
	summary: string;
	release: {number: number; publishedAt: string};
	playAction?: "play" | "continue" | "play_again";
};

export default function PlayCatalogPage() {
	const [publications, setPublications] = useState<Publication[]>([]);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		const controller = new AbortController();
		const timeout = window.setTimeout(() => {
			setLoading(true);
			fetch(`/api/play/publications?search=${encodeURIComponent(search)}`, {signal: controller.signal})
				.then(async (response) => {
					const body = (await response.json()) as {
						data?: {publications?: Publication[]};
						error?: {message?: string};
					};
					if (!response.ok)
						throw new Error(body.error?.message || "Published worlds could not be loaded.");
					setPublications(body.data?.publications ?? []);
					setError("");
				})
				.catch((caught: unknown) => {
					if ((caught as {name?: string}).name !== "AbortError")
						setError(caught instanceof Error ? caught.message : "Published worlds could not be loaded.");
				})
				.finally(() => setLoading(false));
		}, 150);
		return () => {
			window.clearTimeout(timeout);
			controller.abort();
		};
	}, [search]);

	return (
		<main className="playCatalogPage">
			<header className="playCatalogHeader">
				<div>
					<Link href="/">Mothmark</Link>
					<h1>Published worlds</h1>
					<p>Text adventures made and shared with Mothmark.</p>
				</div>
				<label className="playCatalogSearch">
					<Search size={15} aria-hidden="true" />
					<span className="playVisuallyHidden">Search published worlds</span>
					<input
						type="search"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Search worlds"
					/>
				</label>
			</header>
			{error ? (
				<p className="playCatalogError" role="alert">
					{error}
				</p>
			) : null}
			{loading ? (
				<p className="playCatalogStatus" role="status">
					Loading worlds…
				</p>
			) : publications.length ? (
				<ul className="playCatalogGrid">
					{publications.map((publication) => {
						const action =
							publication.playAction === "continue"
								? "Continue"
								: publication.playAction === "play_again"
									? "Play again"
									: "Play";
						return (
							<li key={publication.id}>
								<article>
									<div>
										<Link className="playCatalogWorldLink" href={`/play/${publication.slug}`}>
											<h2>{publication.title}</h2>
										</Link>
										<small className="playCatalogAuthor">
											by{" "}
											<Link href={`/users/${encodeURIComponent(publication.authorUsername)}`}>
												{publication.authorUsername}
											</Link>
										</small>
										<p>{publication.summary}</p>
									</div>
									<footer>
										<small>
											Published{" "}
											{new Intl.DateTimeFormat(undefined, {dateStyle: "medium"}).format(
												new Date(publication.release.publishedAt),
											)}
										</small>
										<Link
											className="playCatalogAction"
											href={`/play/${publication.slug}`}
											aria-label={`${action} ${publication.title}`}
										>
											{action}
										</Link>
									</footer>
								</article>
							</li>
						);
					})}
				</ul>
			) : (
				<p className="playCatalogStatus">No published worlds match this search.</p>
			)}
		</main>
	);
}
