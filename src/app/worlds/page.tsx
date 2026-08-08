"use client";

import {BookOpen, FilePlus2} from "lucide-react";
import {useCallback, useEffect, useRef, useState} from "react";

import {listWorldDrafts} from "@/components/world-autosave/worldDraftStorage";

import "./page.scss";

type LibraryWorld = {
	id: string;
	name: string;
	ownerUserId: string;
	updatedAt: string;
	lastOpenedAt: string | null;
	revision: number;
};

type WorldLibrary = {
	worlds: LibraryWorld[];
	usage: {count: number; max: number};
};

type NewWorldSource = "starter" | "blank";

async function readJson<T>(response: Response): Promise<T> {
	const body = (await response.json()) as T & {error?: {message?: string}};
	if (!response.ok) {
		throw new Error(body.error?.message || "The world request could not be completed.");
	}
	return body;
}

const formatActivity = (value: string | null) => {
	if (!value) return "Not opened yet";
	return new Intl.DateTimeFormat(undefined, {dateStyle: "medium", timeStyle: "short"}).format(
		new Date(value),
	);
};

export default function WorldsPage() {
	const [library, setLibrary] = useState<WorldLibrary | null>(null);
	const [csrfToken, setCsrfToken] = useState("");
	const [localDraftWorldIds, setLocalDraftWorldIds] = useState<Set<string>>(new Set());
	const [loadingError, setLoadingError] = useState("");
	const [createOpen, setCreateOpen] = useState(false);
	const [name, setName] = useState("");
	const [source, setSource] = useState<NewWorldSource>("starter");
	const [creating, setCreating] = useState(false);
	const [createError, setCreateError] = useState("");
	const loadStarted = useRef(false);

	const loadLibrary = useCallback(async () => {
		const csrf = await readJson<{data: {csrfToken: string}}>(await fetch("/api/auth/csrf"));
		setCsrfToken(csrf.data.csrfToken);
		const bootstrap = await readJson<{data: {ownerUserId: string}}>(
			await fetch("/api/editor/bootstrap", {
				method: "POST",
				headers: {"x-csrf-token": csrf.data.csrfToken},
			}),
		);
		const result = await readJson<{data: WorldLibrary}>(await fetch("/api/world"));
		setLibrary(result.data);
		const drafts = await listWorldDrafts(bootstrap.data.ownerUserId).catch(() => []);
		setLocalDraftWorldIds(new Set(drafts.map((draft) => draft.worldId)));
	}, []);

	useEffect(() => {
		if (loadStarted.current) return;
		loadStarted.current = true;
		if (window.location.search === "?new=1") queueMicrotask(() => setCreateOpen(true));
		loadLibrary().catch((error: unknown) => {
			setLoadingError(error instanceof Error ? error.message : "Worlds could not be loaded.");
		});
	}, [loadLibrary]);

	const atLimit = Boolean(library && library.usage.count >= library.usage.max);

	const createWorld = async (event: React.FormEvent) => {
		event.preventDefault();
		setCreating(true);
		setCreateError("");
		try {
			const result = await readJson<{data: {id: string}}>(
				await fetch("/api/world", {
					method: "POST",
					headers: {"content-type": "application/json", "x-csrf-token": csrfToken},
					body: JSON.stringify({name, source}),
				}),
			);
			window.location.assign(`/worlds/${result.data.id}`);
		} catch (error) {
			setCreateError(error instanceof Error ? error.message : "The world could not be created.");
			setCreating(false);
		}
	};

	return (
		<main className="worldsPage">
			<section className="worldLibrary" aria-labelledby="world-library-title">
				<header className="worldLibraryHeader">
					<div>
						<h1 id="world-library-title">Your worlds</h1>
						<p>Private work kept with this browser.</p>
					</div>
					<button
						type="button"
						className="worldLibraryNew"
						disabled={!library || atLimit}
						onClick={() => setCreateOpen(true)}
					>
						<FilePlus2 size={15} aria-hidden="true" />
						New world
					</button>
				</header>

				{loadingError ? (
					<p className="worldLibraryError" role="alert">
						{loadingError}
					</p>
				) : null}
				{library ? (
					<>
						<div className="worldLibraryUsage">
							<strong>
								{library.usage.count} of {library.usage.max} worlds
							</strong>
							{atLimit ? <span>Delete a world before creating another.</span> : null}
						</div>
						<ul className="worldList">
							{library.worlds.map((world) => (
								<li key={world.id}>
									<a href={`/worlds/${world.id}`}>
										<span className="worldListIcon" aria-hidden="true">
											<BookOpen size={16} />
										</span>
										<span className="worldListIdentity">
											<strong>{world.name}</strong>
											<span>Last edited {formatActivity(world.updatedAt)}</span>
										</span>
										<span className="worldListActivity">
											<span>{localDraftWorldIds.has(world.id) ? "Saving..." : "Saved"}</span>
											<small>Opened {formatActivity(world.lastOpenedAt)}</small>
										</span>
									</a>
								</li>
							))}
						</ul>
					</>
				) : loadingError ? null : (
					<p className="worldLibraryLoading" role="status">
						Loading worlds…
					</p>
				)}
			</section>

			{createOpen ? (
				<div className="worldDialogBackdrop" role="presentation">
					<section
						className="worldDialog"
						role="dialog"
						aria-modal="true"
						aria-labelledby="new-world-title"
					>
						<h2 id="new-world-title">New world</h2>
						<p>Choose a starting point. You can change everything later.</p>
						<form onSubmit={(event) => void createWorld(event)}>
							<label htmlFor="new-world-name">World name</label>
							<input
								id="new-world-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								maxLength={80}
								autoFocus
								required
							/>
							<fieldset>
								<legend>Starting point</legend>
								<label>
									<input
										type="radio"
										name="source"
										checked={source === "starter"}
										onChange={() => setSource("starter")}
									/>{" "}
									Starter world
								</label>
								<label>
									<input
										type="radio"
										name="source"
										checked={source === "blank"}
										onChange={() => setSource("blank")}
									/>{" "}
									Blank world
								</label>
							</fieldset>
							{createError ? (
								<p className="worldDialogError" role="alert">
									{createError}
								</p>
							) : null}
							<div className="worldDialogActions">
								<button type="button" onClick={() => setCreateOpen(false)}>
									Cancel
								</button>
								<button type="submit" disabled={creating || !name.trim()}>
									{creating ? "Creating…" : "Create world"}
								</button>
							</div>
						</form>
					</section>
				</div>
			) : null}
		</main>
	);
}
