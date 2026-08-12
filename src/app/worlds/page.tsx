"use client";

import {ArrowUpRight, Ellipsis, FilePlus2, Trash2} from "lucide-react";
import {useCallback, useEffect, useRef, useState} from "react";

import {SiteFooter} from "@/components/footer/SiteFooter";
import {PageShell, PageShellBody, PageShellHeader} from "@/components/layout/ResponsivePage";
import {AnchoredLayer, ModalLayer} from "@/components/overlay/Overlay";
import {
	deleteWorldDraft,
	deleteWorldDraftsExceptUser,
} from "@/components/world-autosave/worldDraftStorage";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";

import {WorldFolioPreview} from "./WorldFolioPreview";

import "./page.scss";

type LibraryWorld = {
	deletedAt: string | null;
	editorSlug: string | null;
	id: string;
	lastOpenedAt: string | null;
	name: string;
	ownerUserId: string;
	revision: number;
	trashPurgeAfter: string | null;
	updatedAt: string;
	world: World;
	publication: {
		status: "published" | "unpublished" | "suspended";
		visibility: "listed" | "unlisted";
		slug: string;
		releaseNumber: number;
		worldRevision: number;
		unpublishedChanges: boolean;
	} | null;
};

type WorldLibrary = {worlds: LibraryWorld[]; usage: {count: number; max: number}};
type DialogState =
	{kind: "create"} | {kind: "delete" | "permanent" | "rename"; world: LibraryWorld} | null;
type NewWorldSource = "blank" | "import" | "starter";

async function readJson<T>(response: Response): Promise<T> {
	const body = (await response.json()) as T & {error?: {message?: string}};
	if (!response.ok)
		throw new Error(body.error?.message || "The world request could not be completed.");
	return body;
}

const formatActivity = (value: string | null) => {
	if (!value) return "Not opened yet";
	return new Intl.DateTimeFormat(undefined, {dateStyle: "medium", timeStyle: "short"}).format(
		new Date(value),
	);
};

const formatCount = (count: number, singular: string) =>
	`${count} ${singular}${count === 1 ? "" : "s"}`;

export default function WorldsPage() {
	const [library, setLibrary] = useState<WorldLibrary | null>(null);
	const [trash, setTrash] = useState<LibraryWorld[]>([]);
	const [csrfToken, setCsrfToken] = useState("");
	const [userId, setUserId] = useState("");
	const [loadingError, setLoadingError] = useState("");
	const [view, setView] = useState<"active" | "trash">("active");
	const [dialog, setDialog] = useState<DialogState>(null);
	const [menuWorldId, setMenuWorldId] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [source, setSource] = useState<NewWorldSource>("starter");
	const [importedWorld, setImportedWorld] = useState<World | null>(null);
	const [importFileName, setImportFileName] = useState("");
	const [working, setWorking] = useState(false);
	const [actionError, setActionError] = useState("");
	const loadStarted = useRef(false);
	const lastActionTrigger = useRef<HTMLElement | null>(null);
	const libraryScroll = useRef<HTMLDivElement | null>(null);

	const loadWorlds = useCallback(
		async (nextView: "active" | "trash" = view) => {
			if (nextView === "trash") {
				const result = await readJson<{data: {worlds: LibraryWorld[]}}>(
					await fetch("/api/world?view=trash"),
				);
				setTrash(result.data.worlds);
				return;
			}
			const result = await readJson<{data: WorldLibrary}>(await fetch("/api/world"));
			setLibrary(result.data);
		},
		[view],
	);

	const loadLibrary = useCallback(async () => {
		const csrf = await readJson<{data: {csrfToken: string}}>(await fetch("/api/auth/csrf"));
		setCsrfToken(csrf.data.csrfToken);
		const bootstrap = await readJson<{meta: {userId: string}}>(
			await fetch("/api/editor/bootstrap", {
				method: "POST",
				headers: {"x-csrf-token": csrf.data.csrfToken},
			}),
		);
		setUserId(bootstrap.meta.userId);
		await deleteWorldDraftsExceptUser(bootstrap.meta.userId).catch(() => undefined);
		await loadWorlds("active");
	}, [loadWorlds]);

	useEffect(() => {
		if (loadStarted.current) return;
		loadStarted.current = true;
		if (window.location.search === "?new=1") queueMicrotask(() => setDialog({kind: "create"}));
		loadLibrary().catch((error: unknown) => {
			setLoadingError(error instanceof Error ? error.message : "Worlds could not be loaded.");
		});
	}, [loadLibrary]);

	useEffect(() => {
		libraryScroll.current?.scrollTo({top: 0});
		window.scrollTo({left: 0, top: 0});
	}, [view]);

	const atLimit = Boolean(library && library.usage.count >= library.usage.max);
	const closeDialog = () => {
		setDialog(null);
		setActionError("");
		setWorking(false);
		queueMicrotask(() => lastActionTrigger.current?.focus());
	};

	const mutate = async (path: string, method: string, body?: unknown) => {
		const response = await fetch(path, {
			method,
			headers: {
				"x-csrf-token": csrfToken,
				...(body === undefined ? {} : {"content-type": "application/json"}),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		if (!response.ok) await readJson(response);
		return response;
	};

	const createWorld = async (event: React.FormEvent) => {
		event.preventDefault();
		setWorking(true);
		setActionError("");
		try {
			const result = await readJson<{data: {editorSlug?: string | null; id: string}}>(
				await fetch("/api/world", {
					method: "POST",
					headers: {"content-type": "application/json", "x-csrf-token": csrfToken},
					body: JSON.stringify({
						name,
						source,
						...(source === "import" && importedWorld ? {world: importedWorld} : {}),
					}),
				}),
			);
			window.location.assign(`/worlds/${result.data.editorSlug ?? result.data.id}`);
		} catch (error) {
			setActionError(error instanceof Error ? error.message : "The world could not be created.");
			setWorking(false);
		}
	};

	const readImportFile = async (file: File | undefined) => {
		setImportedWorld(null);
		setImportFileName("");
		setActionError("");
		if (!file) return;
		try {
			const parsedJson = JSON.parse(await file.text()) as unknown;
			const candidate =
				typeof parsedJson === "object" && parsedJson !== null && "world" in parsedJson
					? (parsedJson as {world: unknown}).world
					: parsedJson;
			const parsedWorld = WorldSchema.safeParse(candidate);
			if (!parsedWorld.success) throw new Error("The file is not a valid current Mothmark world.");
			setImportedWorld(parsedWorld.data);
			setImportFileName(file.name);
			if (!name.trim()) {
				const envelopeName =
					typeof parsedJson === "object" &&
					parsedJson !== null &&
					"worldName" in parsedJson &&
					typeof (parsedJson as {worldName?: unknown}).worldName === "string"
						? (parsedJson as {worldName: string}).worldName
						: parsedWorld.data.metadata.title;
				setName(envelopeName || file.name.replace(/(?:\.mothmark)?\.json$/i, ""));
			}
		} catch (error) {
			setActionError(error instanceof Error ? error.message : "The JSON file could not be read.");
		}
	};

	const performDialogAction = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!dialog || dialog.kind === "create") return;
		setWorking(true);
		setActionError("");
		try {
			if (dialog.kind === "rename") {
				await mutate(`/api/world/${dialog.world.id}`, "PUT", {
					name: name.trim(),
					expectedRevision: dialog.world.revision,
				});
			} else if (dialog.kind === "delete") {
				await mutate(`/api/world/${dialog.world.id}`, "DELETE");
				await deleteWorldDraft(userId, dialog.world.id).catch(() => undefined);
			} else {
				await mutate(`/api/world/${dialog.world.id}?permanent=1`, "DELETE");
				await deleteWorldDraft(userId, dialog.world.id).catch(() => undefined);
			}
			closeDialog();
			await loadWorlds(view);
		} catch (error) {
			setActionError(error instanceof Error ? error.message : "The world could not be changed.");
			setWorking(false);
		}
	};

	const duplicate = async (world: LibraryWorld) => {
		setMenuWorldId(null);
		setActionError("");
		try {
			await mutate(`/api/world/${world.id}/duplicate`, "POST");
			await loadWorlds("active");
		} catch (error) {
			setActionError(error instanceof Error ? error.message : "The world could not be duplicated.");
		}
	};

	const restore = async (world: LibraryWorld) => {
		setActionError("");
		try {
			await mutate(`/api/world/${world.id}/restore`, "POST");
			await loadWorlds("trash");
			await loadWorlds("active");
		} catch (error) {
			setActionError(error instanceof Error ? error.message : "The world could not be restored.");
		}
	};

	const openDialog = (nextDialog: NonNullable<DialogState>, trigger: HTMLElement) => {
		const cardTrigger = trigger
			.closest(".worldCardActions")
			?.querySelector<HTMLElement>(".worldActionsTrigger");
		lastActionTrigger.current = trigger.closest(".worldActionsMenu")
			? lastActionTrigger.current
			: (cardTrigger ?? trigger);
		setMenuWorldId(null);
		setActionError("");
		setDialog(nextDialog);
		if (nextDialog.kind === "rename") setName(nextDialog.world.name);
		if (nextDialog.kind === "create") {
			setName("");
			setSource("starter");
			setImportedWorld(null);
			setImportFileName("");
		}
	};

	const visibleWorlds = view === "active" ? (library?.worlds ?? []) : trash;

	return (
		<PageShell className="worldsPage" variant="catalog">
			<PageShellHeader className="worldLibraryHeader">
				<div className="worldLibraryHeading">
					<div>
						<h1 id="world-library-title">{view === "active" ? "My worlds" : "Trash"}</h1>
						<p>
							{view === "active"
								? "Private work kept with this browser."
								: "Deleted worlds stay recoverable for 30 days."}
						</p>
					</div>
					{view === "active" ? (
						<button
							type="button"
							className="worldLibraryNew"
							disabled={!library || atLimit}
							onClick={(event) => openDialog({kind: "create"}, event.currentTarget)}
						>
							<FilePlus2 size={15} aria-hidden="true" /> New world
						</button>
					) : null}
				</div>
				<div className="worldLibraryControls">
					<nav className="worldLibraryViews" aria-label="World library views">
						<button
							type="button"
							aria-current={view === "active" ? "page" : undefined}
							onClick={() => {
								setView("active");
								void loadWorlds("active");
							}}
						>
							Worlds
						</button>
						<button
							type="button"
							aria-current={view === "trash" ? "page" : undefined}
							onClick={() => {
								setView("trash");
								void loadWorlds("trash");
							}}
						>
							Trash{trash.length ? ` (${trash.length})` : ""}
						</button>
					</nav>
					{view === "active" && library ? (
						<div className="worldLibraryUsage">
							<strong>
								{library.usage.count} of {library.usage.max} worlds
							</strong>
							{atLimit ? <span>Move a world to trash before creating or restoring another.</span> : null}
						</div>
					) : null}
				</div>
			</PageShellHeader>

			<PageShellBody className="worldLibraryScroll" ref={libraryScroll}>
				<main className="worldLibrary" aria-labelledby="world-library-title">
					{loadingError || actionError ? (
						<p className="worldLibraryError" role="alert">
							{loadingError || actionError}
						</p>
					) : null}

					{library ? (
						visibleWorlds.length ? (
							<ul className="worldGrid">
								{visibleWorlds.map((world) => (
									<li
										className={view === "trash" ? "worldCard worldCard--trash" : "worldCard"}
										key={world.id}
									>
										<article>
											{view === "active" ? (
												<a href={`/worlds/${world.editorSlug ?? world.id}`} className="worldCardLink">
													<WorldFolioPreview world={world.world} />
													<div className="worldCardContent">
														<h2>{world.name}</h2>
														<p>Edited {formatActivity(world.updatedAt)}</p>
														<div className="worldCardMeta">
															<span>
																{formatCount(world.world.rooms.length, "room")} ·{" "}
																{formatCount(world.world.items.length, "item")}
															</span>
															<small>Opened {formatActivity(world.lastOpenedAt)}</small>
														</div>
														{world.publication ? (
															<span className="worldCardPublication">
																Release {world.publication.releaseNumber} · {world.publication.status}
																{world.publication.unpublishedChanges ? " · unpublished changes" : ""}
															</span>
														) : null}
														<span className="worldCardOpen">
															Open editor <ArrowUpRight size={14} aria-hidden="true" />
														</span>
													</div>
												</a>
											) : (
												<div className="worldCardStatic">
													<WorldFolioPreview world={world.world} />
													<div className="worldCardContent">
														<h2>{world.name}</h2>
														<p className="worldCardDeleted">
															<Trash2 size={13} aria-hidden="true" /> Deleted {formatActivity(world.deletedAt)}
														</p>
														<div className="worldCardMeta">
															<span>
																{formatCount(world.world.rooms.length, "room")} ·{" "}
																{formatCount(world.world.items.length, "item")}
															</span>
														</div>
													</div>
												</div>
											)}
											<div className="worldCardActions">
												{view === "trash" ? (
													<>
														<button type="button" onClick={() => void restore(world)}>
															Restore
														</button>
														<button
															className="worldDangerAction"
															type="button"
															onClick={(event) => openDialog({kind: "permanent", world}, event.currentTarget)}
														>
															Delete permanently
														</button>
													</>
												) : (
													<>
														<button
															type="button"
															className="worldActionsTrigger"
															aria-label={`Actions for ${world.name}`}
															aria-haspopup="menu"
															aria-expanded={menuWorldId === world.id}
															onClick={(event) => {
																lastActionTrigger.current = event.currentTarget;
																setMenuWorldId((current) => (current === world.id ? null : world.id));
															}}
														>
															<Ellipsis size={17} aria-hidden="true" />
														</button>
														{menuWorldId === world.id ? (
															<AnchoredLayer
																anchorRef={lastActionTrigger}
																ariaLabel={`Actions for ${world.name}`}
																className="worldActionsMenu"
																onClose={() => setMenuWorldId(null)}
																preferredWidth={158}
																role="menu"
															>
																<button
																	role="menuitem"
																	type="button"
																	autoFocus
																	onClick={(event) => openDialog({kind: "rename", world}, event.currentTarget)}
																>
																	Rename
																</button>
																<button role="menuitem" type="button" onClick={() => void duplicate(world)}>
																	Duplicate
																</button>
																<a
																	role="menuitem"
																	href={`/api/world/${world.id}/export`}
																	onClick={() => setMenuWorldId(null)}
																>
																	Export
																</a>
																<button
																	role="menuitem"
																	className="worldDangerAction"
																	type="button"
																	onClick={(event) => openDialog({kind: "delete", world}, event.currentTarget)}
																>
																	Move to trash
																</button>
															</AnchoredLayer>
														) : null}
													</>
												)}
											</div>
										</article>
									</li>
								))}
							</ul>
						) : (
							<p className="worldLibraryEmpty">
								{view === "trash" ? "Trash is empty." : "No active worlds. Create one when you are ready."}
							</p>
						)
					) : loadingError ? null : (
						<p className="worldLibraryLoading" role="status">
							Loading worlds…
						</p>
					)}
				</main>
				<SiteFooter />
			</PageShellBody>

			{dialog ? (
				<ModalLayer
					ariaLabelledBy="world-dialog-title"
					backdropClassName="worldDialogBackdrop"
					className="worldDialog"
					closeOnBackdropClick={!working}
					closeOnEscape={!working}
					mobilePresentation="sheet"
					onClose={closeDialog}
					returnFocusRef={lastActionTrigger}
				>
					<h2 id="world-dialog-title">
						{dialog.kind === "create"
							? "New world"
							: dialog.kind === "rename"
								? "Rename world"
								: dialog.kind === "delete"
									? "Move world to trash?"
									: "Delete world permanently?"}
					</h2>
					<p>
						{dialog.kind === "create"
							? "Choose a starting point. You can change everything later."
							: dialog.kind === "rename"
								? "This changes the private library name."
								: dialog.kind === "delete"
									? "You can restore this world from Trash for 30 days."
									: "This immediately removes the world and cannot be undone."}
					</p>
					<form
						onSubmit={(event) =>
							void (dialog.kind === "create" ? createWorld(event) : performDialogAction(event))
						}
					>
						{dialog.kind === "create" || dialog.kind === "rename" ? (
							<>
								<label htmlFor="world-name">World name</label>
								<input
									id="world-name"
									value={name}
									onChange={(event) => setName(event.target.value)}
									maxLength={80}
									autoFocus
									required
								/>
							</>
						) : null}
						{dialog.kind === "create" ? (
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
								<label>
									<input
										type="radio"
										name="source"
										checked={source === "import"}
										onChange={() => setSource("import")}
									/>{" "}
									Import JSON file
								</label>
							</fieldset>
						) : null}
						{dialog.kind === "create" && source === "import" ? (
							<div className="worldImportField">
								<label htmlFor="world-import-file">World JSON file</label>
								<input
									id="world-import-file"
									type="file"
									accept=".json,.mothmark.json,application/json"
									onChange={(event) => void readImportFile(event.target.files?.[0])}
								/>
								{importFileName ? <small>Loaded {importFileName}</small> : null}
							</div>
						) : null}
						{actionError ? (
							<p className="worldDialogError" role="alert">
								{actionError}
							</p>
						) : null}
						<div className="worldDialogActions">
							<button
								type="button"
								autoFocus={dialog.kind === "delete" || dialog.kind === "permanent"}
								onClick={closeDialog}
								disabled={working}
							>
								Cancel
							</button>
							<button
								type="submit"
								className={
									dialog.kind === "delete" || dialog.kind === "permanent" ? "worldDialogDanger" : ""
								}
								disabled={
									working ||
									((dialog.kind === "create" || dialog.kind === "rename") && !name.trim()) ||
									(dialog.kind === "create" && source === "import" && !importedWorld)
								}
							>
								{working
									? "Working…"
									: dialog.kind === "create"
										? "Create world"
										: dialog.kind === "rename"
											? "Rename"
											: dialog.kind === "delete"
												? "Move to trash"
												: "Delete permanently"}
							</button>
						</div>
					</form>
				</ModalLayer>
			) : null}
		</PageShell>
	);
}
