"use client";

import {MoreHorizontal, X} from "lucide-react";
import Link from "next/link";
import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from "react";

import {readOptionalJson} from "@/auth/apiResponse";
import {ModalLayer} from "@/components/overlay/Overlay";
import type {GameMessage, GameState} from "@/schemas/states/gameStateSchemas";

import {PlayerTerminal} from "./PlayerTerminal";

type Publication = {
	authorUsername: string;
	slug: string;
	title: string;
	summary: string;
	visibility: "listed" | "unlisted";
	release: {id: string; number: number; publishedAt: string};
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
	restartAvailability: {
		allowed: boolean;
		targetRelease: {id: string; number: number};
		unavailableReason?: string;
	};
};

type RestartSource = "player_menu" | "release_notice" | "play_again";

function responseErrorMessage(body: unknown): string | undefined {
	if (!body || typeof body !== "object" || !("error" in body)) return undefined;
	const error = body.error;
	if (!error || typeof error !== "object" || !("message" in error)) return undefined;
	return typeof error.message === "string" ? error.message : undefined;
}

async function hostedResponseJson<T>(
	response: Response,
	fallbackError: string,
): Promise<T | undefined> {
	let body: T | undefined;
	try {
		body = await readOptionalJson<T>(response);
	} catch {
		throw new Error(response.ok ? "The server returned an invalid response." : fallbackError);
	}
	if (!response.ok) throw new Error(responseErrorMessage(body) || fallbackError);
	return body;
}

function requestError(
	caught: unknown,
	fallback: string,
	connectionError = "Connection lost. Try again when you are back online.",
): string {
	if (caught instanceof TypeError) {
		return connectionError;
	}
	return caught instanceof Error ? caught.message : fallback;
}

function subscribeToConnection(callback: () => void) {
	window.addEventListener("online", callback);
	window.addEventListener("offline", callback);
	return () => {
		window.removeEventListener("online", callback);
		window.removeEventListener("offline", callback);
	};
}

function readConnection() {
	return navigator.onLine;
}

function readServerConnection() {
	return true;
}

export function HostedPlayer({slug}: {slug: string}) {
	const pageRef = useRef<HTMLElement | null>(null);
	const menuButtonRef = useRef<HTMLButtonElement | null>(null);
	const menuTitleRef = useRef<HTMLHeadingElement | null>(null);
	const restartRequestIdRef = useRef<string | null>(null);
	const [publication, setPublication] = useState<Publication | null>(null);
	const [playthrough, setPlaythrough] = useState<Playthrough | null>(null);
	const [csrf, setCsrf] = useState("");
	const [command, setCommand] = useState("");
	const [status, setStatus] = useState<"loading" | "saving" | "saved" | "failed">("loading");
	const [error, setError] = useState("");
	const [menuOpen, setMenuOpen] = useState(false);
	const [menuView, setMenuView] = useState<"about" | "restart" | "delete">("about");
	const [newerReleaseAvailable, setNewerReleaseAvailable] = useState(false);
	const [restartAvailability, setRestartAvailability] = useState<
		BootstrapData["restartAvailability"] | null
	>(null);
	const [restartSource, setRestartSource] = useState<RestartSource>("player_menu");
	const online = useSyncExternalStore(subscribeToConnection, readConnection, readServerConnection);

	const applyBootstrap = useCallback((data: BootstrapData) => {
		setPublication(data.publication);
		setPlaythrough(data.playthrough);
		setNewerReleaseAvailable(data.newerReleaseAvailable);
		setRestartAvailability(data.restartAvailability);
	}, []);

	const bootstrap = useCallback(
		async (token: string, signal?: AbortSignal) => {
			const body = await hostedResponseJson<{data?: BootstrapData}>(
				await fetch(`/api/play/publications/${encodeURIComponent(slug)}/bootstrap`, {
					method: "POST",
					headers: {"x-csrf-token": token},
					signal,
				}),
				"The hosted world could not be loaded.",
			);
			if (!body?.data) throw new Error("The hosted world returned an empty response. Try again.");
			return body.data;
		},
		[slug],
	);

	useEffect(() => {
		const controller = new AbortController();
		(async () => {
			try {
				const csrfBody = await hostedResponseJson<{data?: {csrfToken?: string}}>(
					await fetch("/api/auth/csrf?audience=play", {signal: controller.signal}),
					"The play session could not be verified.",
				);
				const token = csrfBody?.data?.csrfToken;
				if (!token) throw new Error("The play session could not be verified.");
				setCsrf(token);
				applyBootstrap(await bootstrap(token, controller.signal));
				setStatus("saved");
			} catch (caught) {
				if ((caught as {name?: string}).name === "AbortError") return;
				setError(requestError(caught, "The hosted world could not be loaded."));
				setStatus("failed");
			}
		})();
		return () => controller.abort();
	}, [applyBootstrap, bootstrap]);

	useEffect(() => {
		const page = pageRef.current;
		const viewport = window.visualViewport;
		if (!page || !viewport) return;
		const updateViewport = () => {
			page.style.setProperty("--hosted-player-visual-height", `${Math.round(viewport.height)}px`);
			page.style.setProperty("--hosted-player-visual-top", `${Math.round(viewport.offsetTop)}px`);
		};
		updateViewport();
		window.addEventListener("resize", updateViewport);
		viewport.addEventListener("resize", updateViewport);
		viewport.addEventListener("scroll", updateViewport);
		return () => {
			window.removeEventListener("resize", updateViewport);
			viewport.removeEventListener("resize", updateViewport);
			viewport.removeEventListener("scroll", updateViewport);
		};
	}, []);

	useEffect(() => {
		if (menuOpen)
			window.requestAnimationFrame(() => menuTitleRef.current?.focus({preventScroll: true}));
	}, [menuOpen, menuView]);

	const submit = async (value: string) => {
		if (!playthrough || !csrf) return;
		setStatus("saving");
		setError("");
		try {
			const body = await hostedResponseJson<{
				data?: Playthrough & {outputMessages: GameMessage[]};
			}>(
				await fetch(`/api/play/publications/${encodeURIComponent(slug)}/command`, {
					method: "POST",
					headers: {"content-type": "application/json", "x-csrf-token": csrf},
					body: JSON.stringify({command: value, expectedRevision: playthrough.revision}),
				}),
				"The command could not be saved.",
			);
			if (body?.data) setPlaythrough(body.data);
			else applyBootstrap(await bootstrap(csrf));
			setCommand("");
			setStatus("saved");
		} catch (caught) {
			setError(
				requestError(
					caught,
					"The command could not be saved.",
					"Connection lost. Your command is still in the prompt; check your connection and try again.",
				),
			);
			setStatus("failed");
		}
	};

	const restart = async () => {
		if (!csrf || !playthrough || !restartAvailability?.allowed) return;
		const restartRequestId = restartRequestIdRef.current ?? crypto.randomUUID();
		restartRequestIdRef.current = restartRequestId;
		setStatus("saving");
		setError("");
		try {
			const body = await hostedResponseJson<{data?: BootstrapData}>(
				await fetch(`/api/play/publications/${encodeURIComponent(slug)}/restart`, {
					method: "POST",
					headers: {"content-type": "application/json", "x-csrf-token": csrf},
					body: JSON.stringify({
						sourcePlaythroughId: playthrough.id,
						expectedTargetReleaseId: restartAvailability.targetRelease.id,
						restartRequestId,
						source: restartSource,
					}),
				}),
				"The playthrough could not be restarted.",
			);
			if (body?.data) applyBootstrap(body.data);
			else applyBootstrap(await bootstrap(csrf));
			setNewerReleaseAvailable(false);
			setMenuOpen(false);
			setMenuView("about");
			setCommand("");
			setStatus("saved");
			restartRequestIdRef.current = null;
		} catch (caught) {
			setError(requestError(caught, "The playthrough could not be restarted."));
			setStatus("failed");
		}
	};

	const deleteProgress = async () => {
		if (!csrf || !playthrough) return;
		setStatus("saving");
		setError("");
		try {
			const response = await fetch(`/api/play/publications/${encodeURIComponent(slug)}/playthrough`, {
				method: "DELETE",
				headers: {"x-csrf-token": csrf},
			});
			await hostedResponseJson(response, "The saved playthrough could not be deleted.");
			window.location.assign("/play");
		} catch (caught) {
			setError(requestError(caught, "The saved playthrough could not be deleted."));
			setStatus("failed");
		}
	};

	const openMenu = (view: typeof menuView = "about", source: RestartSource = "player_menu") => {
		if (view === "restart") {
			setRestartSource(source);
			restartRequestIdRef.current = crypto.randomUUID();
		}
		setMenuView(view);
		setMenuOpen(true);
	};

	const closeMenu = () => {
		if (status === "saving") return;
		setMenuOpen(false);
		setMenuView("about");
	};

	const displayedStatus = !online ? "offline" : status;

	return (
		<main ref={pageRef} className="hostedPlayerPage">
			<header className="hostedPlayerHeader">
				<Link href="/play">Published worlds</Link>
				<strong>
					{publication ? `${publication.title} · by ${publication.authorUsername}` : "Loading world…"}
				</strong>
				<div className="hostedPlayerHeaderActions">
					<span className={`hostedSaveState hostedSaveState-${displayedStatus}`} role="status">
						{displayedStatus === "offline"
							? "Offline"
							: status === "loading"
								? "Loading…"
								: status === "saving"
									? "Saving…"
									: status === "saved"
										? "Saved"
										: "Save failed"}
					</span>
					{publication ? (
						<button
							ref={menuButtonRef}
							type="button"
							className="hostedMenuButton"
							onClick={() => (menuOpen ? closeMenu() : openMenu())}
							aria-haspopup="dialog"
							aria-expanded={menuOpen}
							aria-label="World menu"
						>
							<MoreHorizontal size={18} aria-hidden="true" />
							<span>Menu</span>
						</button>
					) : null}
				</div>
			</header>
			{menuOpen && publication ? (
				<ModalLayer
					ariaLabelledBy="hosted-menu-title"
					backdropClassName="hostedMenuBackdrop"
					className="hostedMenu"
					closeOnBackdropClick={status !== "saving"}
					closeOnEscape={status !== "saving"}
					initialFocusRef={menuTitleRef}
					mobilePresentation="sheet"
					onClose={closeMenu}
					returnFocusRef={menuButtonRef}
				>
					<>
						<header>
							<h2 ref={menuTitleRef} id="hosted-menu-title" tabIndex={-1}>
								{menuView === "restart"
									? playthrough?.status === "completed"
										? "Play again?"
										: "Restart playthrough?"
									: menuView === "delete"
										? "Delete saved playthrough?"
										: publication.title}
							</h2>
							<button
								type="button"
								onClick={closeMenu}
								disabled={status === "saving"}
								aria-label="Close world menu"
							>
								<X size={18} aria-hidden="true" />
							</button>
						</header>
						{menuView === "about" ? (
							<>
								<div className="hostedMenuAbout">
									<small>By {publication.authorUsername}</small>
									<p>{publication.summary}</p>
									<small>
										Release {publication.release.number} · Published{" "}
										{new Intl.DateTimeFormat(undefined, {dateStyle: "medium"}).format(
											new Date(publication.release.publishedAt),
										)}
									</small>
								</div>
								<nav className="hostedMenuLinks" aria-label="World links">
									<Link href="/play">Return to published worlds</Link>
									<Link href={`/users/${encodeURIComponent(publication.authorUsername)}`}>
										View {publication.authorUsername}&apos;s profile
									</Link>
								</nav>
								<div className="hostedMenuActions">
									<button
										type="button"
										onClick={() =>
											openMenu("restart", playthrough?.status === "completed" ? "play_again" : "player_menu")
										}
										disabled={!playthrough || !restartAvailability?.allowed || status === "saving"}
									>
										{playthrough?.status === "completed" ? "Play again" : "Restart playthrough"}
									</button>
									{restartAvailability && !restartAvailability.allowed ? (
										<small>{restartAvailability.unavailableReason}</small>
									) : null}
									<button
										type="button"
										className="hostedDeleteProgress"
										onClick={() => setMenuView("delete")}
										disabled={!playthrough || status === "saving"}
									>
										Delete saved playthrough
									</button>
								</div>
							</>
						) : (
							<div className="hostedMenuConfirmation">
								<p>
									{menuView === "delete"
										? "This permanently removes this playthrough and its command history. This cannot be undone."
										: !restartAvailability?.allowed
											? (restartAvailability?.unavailableReason ?? "This playthrough cannot be restarted.")
											: playthrough?.status === "completed"
												? `This completed playthrough will remain in history. A new playthrough will begin on release ${restartAvailability.targetRelease.number} from the start.`
												: playthrough
													? `Your progress in release ${playthrough.release.number} will remain in an abandoned playthrough. A new playthrough will begin on release ${restartAvailability.targetRelease.number} from the start.`
													: "A new playthrough will begin from the start."}
								</p>
								<div className="hostedMenuConfirmationActions">
									<button type="button" onClick={() => setMenuView("about")} disabled={status === "saving"}>
										Cancel
									</button>
									<button
										type="button"
										className={menuView === "delete" ? "hostedDeleteProgress" : "hostedPrimaryAction"}
										onClick={() => void (menuView === "delete" ? deleteProgress() : restart())}
										disabled={
											status === "saving" || (menuView === "restart" && !restartAvailability?.allowed)
										}
									>
										{status === "saving"
											? "Working…"
											: menuView === "delete"
												? "Delete playthrough"
												: playthrough?.status === "completed"
													? "Play again"
													: "Restart playthrough"}
									</button>
								</div>
							</div>
						)}
					</>
				</ModalLayer>
			) : null}
			{newerReleaseAvailable ? (
				<div className="hostedReleaseNotice" role="status">
					<span>
						A new version is available. You can keep playing this release or restart into the new one.
					</span>
					<button type="button" onClick={() => openMenu("restart", "release_notice")}>
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
					busy={status === "saving"}
					disabled={!playthrough || playthrough.status !== "active"}
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
