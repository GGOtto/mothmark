"use client";

import {ArrowLeft, ArrowRight} from "lucide-react";
import Link from "next/link";
import {useEffect, useState} from "react";

type FeaturedPublication = {
	authorUsername: string;
	id: string;
	slug: string;
	title: string;
	summary: string;
	release: {number: number; publishedAt: string};
	playAction?: "play" | "continue" | "play_again";
};

function playLabel(publication: FeaturedPublication) {
	return publication.playAction === "continue"
		? "Continue"
		: publication.playAction === "play_again"
			? "Play again"
			: "Play";
}

export function FeaturedPublicationsCarousel() {
	const [publications, setPublications] = useState<FeaturedPublication[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

	useEffect(() => {
		const controller = new AbortController();
		fetch("/api/play/publications", {signal: controller.signal})
			.then(async (response) => {
				const body = (await response.json()) as {
					data?: {publications?: FeaturedPublication[]};
				};
				if (!response.ok) throw new Error("Published worlds could not be loaded.");
				setPublications((body.data?.publications ?? []).slice(0, 8));
				setStatus("ready");
			})
			.catch((error: unknown) => {
				if ((error as {name?: string}).name !== "AbortError") setStatus("error");
			});
		return () => controller.abort();
	}, []);

	const publication = publications[currentIndex];
	const canMove = publications.length > 1;

	function move(amount: number) {
		if (!canMove) return;
		setCurrentIndex((current) => (current + amount + publications.length) % publications.length);
	}

	return (
		<section className="homeFeatured" id="featured-publications" aria-labelledby="featured-title">
			<header className="homeSectionHeader">
				<div>
					<h2 id="featured-title">Featured publications</h2>
					<p>Published worlds ready to play in the browser.</p>
				</div>
				<div className="homeCarouselControls" aria-label="Featured publication controls">
					{publications.length ? (
						<span aria-live="polite">
							{currentIndex + 1} / {publications.length}
						</span>
					) : null}
					<button
						type="button"
						disabled={!canMove}
						onClick={() => move(-1)}
						aria-label="Previous featured publication"
					>
						<ArrowLeft size={17} aria-hidden="true" />
					</button>
					<button
						type="button"
						disabled={!canMove}
						onClick={() => move(1)}
						aria-label="Next featured publication"
					>
						<ArrowRight size={17} aria-hidden="true" />
					</button>
				</div>
			</header>

			{status === "loading" ? (
				<div className="homeFeaturedStatus" role="status">
					Loading featured worlds…
				</div>
			) : publication ? (
				<article className="homeFeaturedCard">
					<div className="homeFeaturedIdentity" aria-hidden="true">
						<span>{String(currentIndex + 1).padStart(2, "0")}</span>
						<div>
							<i />
							<i />
							<i />
						</div>
					</div>
					<div className="homeFeaturedCopy">
						<span>Featured publication</span>
						<h3>{publication.title}</h3>
						<p>{publication.summary}</p>
						<small>
							By {publication.authorUsername} · Release {publication.release.number}
						</small>
						<Link href={`/play/${publication.slug}`}>
							{playLabel(publication)} {publication.title}
						</Link>
					</div>
				</article>
			) : (
				<div className="homeFeaturedStatus">
					<p>
						{status === "error"
							? "Featured worlds are unavailable right now."
							: "No featured publications are available yet."}
					</p>
				</div>
			)}

			<Link className="homeBrowseAll" href="/play">
				Browse all worlds <ArrowRight size={16} aria-hidden="true" />
			</Link>
		</section>
	);
}
