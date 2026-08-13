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

type PublicationPosition = "current" | "hidden" | "next" | "previous";

function playLabel(publication: FeaturedPublication) {
	return publication.playAction === "continue"
		? "Continue"
		: publication.playAction === "play_again"
			? "Play again"
			: "Play";
}

function publicationPosition(index: number, currentIndex: number, publicationCount: number) {
	if (index === currentIndex) return "current" satisfies PublicationPosition;
	if (publicationCount === 2) {
		return index < currentIndex
			? ("previous" satisfies PublicationPosition)
			: ("next" satisfies PublicationPosition);
	}
	if (index === (currentIndex - 1 + publicationCount) % publicationCount) {
		return "previous" satisfies PublicationPosition;
	}
	if (index === (currentIndex + 1) % publicationCount) {
		return "next" satisfies PublicationPosition;
	}
	return "hidden" satisfies PublicationPosition;
}

export function FeaturedPublicationsCarousel() {
	const [publications, setPublications] = useState<FeaturedPublication[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

	useEffect(() => {
		const controller = new AbortController();
		fetch("/api/play/publications?surface=homepage", {signal: controller.signal})
			.then(async (response) => {
				const body = (await response.json()) as {
					data?: {publications?: FeaturedPublication[]};
				};
				if (!response.ok) throw new Error("Published worlds could not be loaded.");
				const featuredPublications = (body.data?.publications ?? []).slice(0, 8);
				setPublications(featuredPublications);
				setCurrentIndex(0);
				setStatus("ready");
			})
			.catch((error: unknown) => {
				if ((error as {name?: string}).name !== "AbortError") setStatus("error");
			});
		return () => controller.abort();
	}, []);

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
				{publications.length ? (
					<span className="homeCarouselCount" aria-live="polite">
						{currentIndex + 1} / {publications.length}
					</span>
				) : null}
			</header>

			{status === "loading" ? (
				<div className="homeFeaturedStatus" role="status">
					Loading featured worlds…
				</div>
			) : publications.length ? (
				<div
					className="homeFeaturedDeck"
					role="group"
					aria-roledescription="carousel"
					aria-label="Featured publication carousel"
				>
					<button
						className="homeCarouselArrow homeCarouselArrow--previous"
						type="button"
						disabled={!canMove}
						onClick={() => move(-1)}
						aria-label="Previous featured publication"
					>
						<ArrowLeft size={18} aria-hidden="true" />
					</button>

					<div className={`homeFeaturedPages homeFeaturedPages--${Math.min(publications.length, 3)}`}>
						{publications.map((publication, index) => {
							const position = publicationPosition(index, currentIndex, publications.length);
							const isCurrent = position === "current";
							return (
								<article
									key={publication.id}
									className={`homeFeaturedPage homeFeaturedPage--${position}`}
									aria-current={isCurrent ? "true" : undefined}
									aria-hidden={position !== "current" ? "true" : undefined}
									hidden={position === "hidden"}
								>
									<header className="homeFeaturedPageHeader">
										<h3>{publication.title}</h3>
										<span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
									</header>
									<div className="homeFeaturedPageBody">
										<p>{publication.summary}</p>
										<small>
											By {publication.authorUsername} · Release {publication.release.number}
										</small>
										{isCurrent ? (
											<Link href={`/play/${publication.slug}`}>
												{playLabel(publication)} &quot;{publication.title}&quot;
											</Link>
										) : null}
									</div>
								</article>
							);
						})}
					</div>

					<button
						className="homeCarouselArrow homeCarouselArrow--next"
						type="button"
						disabled={!canMove}
						onClick={() => move(1)}
						aria-label="Next featured publication"
					>
						<ArrowRight size={18} aria-hidden="true" />
					</button>
				</div>
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
