"use client";

import Link from "next/link";
import {useEffect, useState} from "react";

import type {GameMessage, GameState} from "@/schemas/states/gameStateSchemas";

import {PlayerTerminal} from "./PlayerTerminal";

type Publication = {
	authorUsername: string;
	slug: string;
	title: string;
	summary: string;
	visibility: "listed" | "unlisted";
	release: {number: number; publishedAt: string};
};

type Playthrough = {
	id: string;
	revision: number;
	commandCount: number;
	commands: string;
	state: GameState;
	status: "active" | "completed" | "abandoned" | "errored";
	release: {id: string; number: number};
};

type BootstrapData = {
	publication: Publication;
	playthrough: Playthrough;
	newerReleaseAvailable: boolean;
};

async function responseJson<T>(response: Response): Promise<T> {
	const body = (await response.json()) as T & {error?: {message?: string}};
	if (!response.ok) throw new Error(body.error?.message || "The hosted world could not be loaded.");
	return body;
}

export function HostedPlayer({slug}: {slug: string}) {
	const [publication, setPublication] = useState<Publication | null>(null);
	const [playthrough, setPlaythrough] = useState<Playthrough | null>(null);
	const [csrf, setCsrf] = useState("");
	const [command, setCommand] = useState("");
	const [status, setStatus] = useState<"loading" | "saving" | "saved" | "failed">("loading");
	const [error, setError] = useState("");
	const [aboutOpen, setAboutOpen] = useState(false);
	const [newerReleaseAvailable, setNewerReleaseAvailable] = useState(false);

	useEffect(() => {
		const controller = new AbortController();
		(async () => {
			try {
				const csrfBody = await responseJson<{data: {csrfToken: string}}>(
					await fetch("/api/auth/csrf?audience=play", {signal: controller.signal}),
				);
				setCsrf(csrfBody.data.csrfToken);
				const body = await responseJson<{data: BootstrapData}>(
					await fetch(`/api/play/publications/${encodeURIComponent(slug)}/bootstrap`, {
						method: "POST",
						headers: {"x-csrf-token": csrfBody.data.csrfToken},
						signal: controller.signal,
					}),
				);
				setPublication(body.data.publication);
				setPlaythrough(body.data.playthrough);
				setNewerReleaseAvailable(body.data.newerReleaseAvailable);
				setStatus("saved");
			} catch (caught) {
				if ((caught as {name?: string}).name === "AbortError") return;
				setError(caught instanceof Error ? caught.message : "The hosted world could not be loaded.");
				setStatus("failed");
			}
		})();
		return () => controller.abort();
	}, [slug]);

	const submit = async (value: string) => {
		if (!playthrough || !csrf) return;
		setStatus("saving");
		setError("");
		try {
			const body = await responseJson<{
				data: Playthrough & {outputMessages: GameMessage[]};
			}>(
				await fetch(`/api/play/publications/${encodeURIComponent(slug)}/command`, {
					method: "POST",
					headers: {"content-type": "application/json", "x-csrf-token": csrf},
					body: JSON.stringify({command: value, expectedRevision: playthrough.revision}),
				}),
			);
			setPlaythrough(body.data);
			setCommand("");
			setStatus("saved");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The command could not be saved.");
			setStatus("failed");
		}
	};

	const restart = async () => {
		if (!csrf || !playthrough) return;
		const releaseMessage = newerReleaseAvailable
			? " Restarting will abandon this playthrough and begin the newer published release."
			: " Restarting will abandon this playthrough and begin again from the start.";
		if (!window.confirm(releaseMessage.trim())) return;
		setStatus("saving");
		setError("");
		try {
			const body = await responseJson<{data: BootstrapData}>(
				await fetch(`/api/play/publications/${encodeURIComponent(slug)}/restart`, {
					method: "POST",
					headers: {"x-csrf-token": csrf},
				}),
			);
			setPublication(body.data.publication);
			setPlaythrough(body.data.playthrough);
			setNewerReleaseAvailable(false);
			setAboutOpen(false);
			setCommand("");
			setStatus("saved");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The playthrough could not be restarted.");
			setStatus("failed");
		}
	};

	const deleteProgress = async () => {
		if (!csrf || !playthrough) return;
		if (
			!window.confirm("Delete this saved playthrough and its command history? This cannot be undone.")
		)
			return;
		setStatus("saving");
		try {
			const response = await fetch(`/api/play/publications/${encodeURIComponent(slug)}/playthrough`, {
				method: "DELETE",
				headers: {"x-csrf-token": csrf},
			});
			if (!response.ok) throw new Error("The saved playthrough could not be deleted.");
			window.location.assign("/play");
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "The saved playthrough could not be deleted.",
			);
			setStatus("failed");
		}
	};

	return (
		<main className="hostedPlayerPage">
			<header className="hostedPlayerHeader">
				<Link href="/play">Published worlds</Link>
				<strong>
					{publication ? `${publication.title} · by ${publication.authorUsername}` : "Loading world…"}
				</strong>
				<div className="hostedPlayerHeaderActions">
					<span className={`hostedSaveState hostedSaveState-${status}`} role="status">
						{status === "loading"
							? "Loading…"
							: status === "saving"
								? "Saving…"
								: status === "saved"
									? "Saved"
									: "Save failed"}
					</span>
					{publication ? (
						<button type="button" onClick={() => setAboutOpen((open) => !open)} aria-expanded={aboutOpen}>
							About
						</button>
					) : null}
				</div>
			</header>
			{aboutOpen && publication ? (
				<aside className="hostedAbout" aria-label="About this published world">
					<small>By {publication.authorUsername}</small>
					<p>{publication.summary}</p>
					<small>
						Release {publication.release.number} · Published{" "}
						{new Intl.DateTimeFormat(undefined, {dateStyle: "medium"}).format(
							new Date(publication.release.publishedAt),
						)}
					</small>
					<Link href="/privacy">Privacy</Link>
					<button
						type="button"
						onClick={() => void restart()}
						disabled={!playthrough || status === "saving"}
					>
						{playthrough?.status === "completed" ? "Play again" : "Restart playthrough"}
					</button>
					<button
						type="button"
						className="hostedDeleteProgress"
						onClick={() => void deleteProgress()}
						disabled={!playthrough || status === "saving"}
					>
						Delete saved playthrough
					</button>
				</aside>
			) : null}
			{newerReleaseAvailable ? (
				<div className="hostedReleaseNotice" role="status">
					<span>
						A new version is available. You can keep playing this release or restart into the new one.
					</span>
					<button type="button" onClick={() => void restart()}>
						Restart with new version
					</button>
				</div>
			) : null}
			{error ? (
				<p className="hostedPlayerError" role="alert">
					{error}
				</p>
			) : null}
			<div className="hostedTerminal">
				<PlayerTerminal
					disabled={!playthrough || playthrough.status !== "active" || status === "saving"}
					command={command}
					messages={playthrough?.state.messages ?? []}
					onCommandChange={setCommand}
					onSubmit={submit}
					commandHistory={playthrough?.commands ? playthrough.commands.split("\n").slice(-20) : []}
				/>
			</div>
		</main>
	);
}
