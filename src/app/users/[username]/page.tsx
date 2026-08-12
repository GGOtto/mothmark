"use client";

import {BookOpen, CalendarDays, ExternalLink} from "lucide-react";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect, useState} from "react";

import {publicProfileDisplayName} from "@/auth/publicProfile";

import "./page.scss";

type PublicProfile = {
	bio: string | null;
	createdAt: string;
	displayName: string | null;
	publications: Array<{
		authorUsername: string;
		id: string;
		release: {id: string; number: number; publishedAt: string};
		slug: string;
		summary: string;
		title: string;
	}>;
	username: string;
	website: string | null;
};

const formatDate = (value: string) =>
	new Intl.DateTimeFormat(undefined, {dateStyle: "medium"}).format(new Date(value));

function profileInitials(name: string): string {
	return name
		.split(/[\s._-]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}

export default function PublicUserProfilePage() {
	const {username} = useParams<{username: string}>();
	const [profile, setProfile] = useState<PublicProfile | null>(null);
	const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
	const [loadedUsername, setLoadedUsername] = useState<string | null>(null);
	const currentStatus = loadedUsername === username ? status : "loading";
	const currentProfile = loadedUsername === username ? profile : null;

	useEffect(() => {
		const controller = new AbortController();
		fetch(`/api/users/${encodeURIComponent(username)}`, {signal: controller.signal})
			.then(async (response) => {
				const body = (await response.json()) as {
					data?: PublicProfile;
					error?: {message?: string};
				};
				if (response.status === 404) {
					setProfile(null);
					setLoadedUsername(username);
					setStatus("missing");
					return;
				}
				if (!response.ok || !body.data)
					throw new Error(body.error?.message || "The public profile could not be loaded.");
				setProfile(body.data);
				setLoadedUsername(username);
				setStatus("ready");
			})
			.catch((error: unknown) => {
				if ((error as {name?: string}).name !== "AbortError") {
					setProfile(null);
					setLoadedUsername(username);
					setStatus("error");
				}
			});
		return () => controller.abort();
	}, [username]);

	if (currentStatus === "loading") {
		return (
			<main className="publicProfilePage publicProfileState" role="status">
				Loading profile…
			</main>
		);
	}
	if (currentStatus === "missing") {
		return (
			<main className="publicProfilePage publicProfileState">
				<h1>Profile not found</h1>
				<p>This user does not have an active public Mothmark profile.</p>
				<Link href="/play">Browse published worlds</Link>
			</main>
		);
	}
	if (currentStatus === "error" || !currentProfile) {
		return (
			<main className="publicProfilePage publicProfileState" role="alert">
				<h1>Profile unavailable</h1>
				<p>The public profile could not be loaded right now.</p>
			</main>
		);
	}

	const displayName = publicProfileDisplayName(currentProfile);
	return (
		<main className="publicProfilePage">
			<header className="publicProfileHeader">
				<div className="publicProfileIdentity">
					<div className="publicProfileMonogram" aria-hidden="true">
						{profileInitials(displayName)}
					</div>
					<div>
						<div className="publicProfileName">
							<h1>{displayName}</h1>
							<span>@{currentProfile.username}</span>
						</div>
						{currentProfile.bio ? <p className="publicProfileBio">{currentProfile.bio}</p> : null}
						<div className="publicProfileFacts">
							<span>
								<CalendarDays size={14} aria-hidden="true" /> Joined {formatDate(currentProfile.createdAt)}
							</span>
							{currentProfile.website ? (
								<a href={currentProfile.website} target="_blank" rel="noreferrer">
									<ExternalLink size={14} aria-hidden="true" />
									{new URL(currentProfile.website).hostname.replace(/^www\./, "")}
								</a>
							) : null}
						</div>
					</div>
				</div>
			</header>

			<section className="publicProfileWorlds" aria-labelledby="published-worlds-title">
				<header>
					<h2 id="published-worlds-title">Published worlds</h2>
					<span>
						{currentProfile.publications.length}{" "}
						{currentProfile.publications.length === 1 ? "world" : "worlds"}
					</span>
				</header>
				{currentProfile.publications.length ? (
					<ul>
						{currentProfile.publications.map((publication) => (
							<li key={publication.id}>
								<div className="publicProfileWorldCover" aria-hidden="true">
									<BookOpen size={18} />
									<strong>{publication.title}</strong>
								</div>
								<div className="publicProfileWorldBody">
									<h3>{publication.title}</h3>
									<p>{publication.summary}</p>
									<small>Published {formatDate(publication.release.publishedAt)}</small>
									<Link href={`/play/${publication.slug}`}>Play</Link>
								</div>
							</li>
						))}
					</ul>
				) : (
					<p className="publicProfileEmpty">This user has not published any listed worlds.</p>
				)}
			</section>
		</main>
	);
}
