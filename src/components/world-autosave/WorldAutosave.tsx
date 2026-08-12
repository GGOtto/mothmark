"use client";

import {ChevronDown, RotateCcw, Save} from "lucide-react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";

import type {World} from "@/schemas/world/worldSchema";
import {readOptionalJson} from "@/auth/apiResponse";
import {readBrowserCsrfToken} from "@/auth/browserCsrf";
import {AnchoredLayer} from "@/components/overlay/Overlay";
import {useOptionalPopup} from "@/components/popup/Popup";
import {deleteWorldDraft, writeWorldDraft} from "./worldDraftStorage";

import "./WorldAutosave.scss";

const LOCAL_DRAFT_DEBOUNCE_MS = 500;
const SAVE_DEBOUNCE_MS = 1_000;
const SAVE_MAX_WAIT_MS = 60_000;
const SAVED_INDICATOR_VISIBLE_MS = 2_000;
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000] as const;

type SaveStatus = "idle" | "saving" | "saved" | "error";

type SaveTarget = {
	world: World;
	worldId: string | null;
	userId: string | null;
	worldName: string;
	revision: number | null;
	restoredFromLocalDraft?: boolean;
	onPersisted: (worldId: string, revision: number) => void;
	onReset: () => void;
};

type SavedWorld = {
	id: string;
	revision: number;
};

export type ConfirmedWorldRevision = SavedWorld;

export type WorldSaveConfirmation =
	({ok: true} & ConfirmedWorldRevision) | {ok: false; message: string};

type WorldAutosaveContextValue = {
	clearTarget: () => void;
	registerTarget: (target: SaveTarget) => void;
	updateTarget: (target: SaveTarget) => void;
	target: SaveTarget | null;
	isDirty: boolean;
	indicatorVisible: boolean;
	status: SaveStatus;
	errorMessage: string | null;
	saveNow: () => Promise<void>;
	confirmCurrentRevision: () => Promise<WorldSaveConfirmation>;
	prepareForNavigation: () => Promise<boolean>;
	resetWorld: () => void;
};

const WorldAutosaveContext = createContext<WorldAutosaveContextValue | null>(null);

const serializeWorld = (world: World): string => JSON.stringify(world);

class WorldSaveError extends Error {
	constructor(
		message: string,
		readonly retryable: boolean,
	) {
		super(message);
		this.name = "WorldSaveError";
	}
}

const readSavedWorld = async (response: Response): Promise<SavedWorld> => {
	let body:
		| {
				data?: {id?: unknown; revision?: unknown};
				error?: {message?: unknown; issues?: unknown};
		  }
		| undefined;
	try {
		body = await readOptionalJson(response);
	} catch {
		throw new WorldSaveError(
			response.ok
				? "The server returned an invalid save response. Your changes are still stored on this device."
				: "Save failed because the server returned an invalid response.",
			response.ok || response.status >= 500,
		);
	}

	if (!response.ok) {
		const sessionMessage =
			response.status === 401
				? "Your session expired. Sign in again, then retry saving."
				: response.status === 403
					? "Your session can no longer save this world. Sign in again or export your draft."
					: null;
		const baseMessage =
			sessionMessage ??
			(typeof body?.error?.message === "string" ? body.error.message : "Save failed.");
		const issueDetails = Array.isArray(body?.error?.issues)
			? body.error.issues
					.slice(0, 3)
					.flatMap((issue) => {
						if (!issue || typeof issue !== "object") return [];
						const {path, message} = issue as {path?: unknown; message?: unknown};
						if (typeof message !== "string") return [];
						const location = Array.isArray(path) ? path.join(".") : "request";
						return [`${location || "request"}: ${message}`];
					})
					.join("; ")
			: "";
		const message = issueDetails ? `${baseMessage} ${issueDetails}` : baseMessage;
		const retryable = response.status >= 500 || response.status === 408 || response.status === 429;
		throw new WorldSaveError(message, retryable);
	}

	if (typeof body?.data?.id !== "string" || typeof body.data.revision !== "number") {
		throw new WorldSaveError(
			"The server returned an incomplete save response. Your changes are still stored on this device.",
			true,
		);
	}

	return {id: body.data.id, revision: body.data.revision};
};

const persistWorld = async (target: SaveTarget): Promise<SavedWorld> => {
	if (!target.worldId) throw new WorldSaveError("The private world is not ready to save.", false);
	const csrfToken = readBrowserCsrfToken();
	if (!csrfToken) throw new WorldSaveError("The editor security token is missing.", false);
	let response: Response;
	try {
		response = await fetch(`/api/world/${target.worldId}`, {
			method: "PUT",
			headers: {"content-type": "application/json", "x-csrf-token": csrfToken},
			body: JSON.stringify({world: target.world, expectedRevision: target.revision ?? undefined}),
		});
	} catch {
		throw new WorldSaveError(
			"Connection lost. Your changes are safe on this device and will retry when you are back online.",
			true,
		);
	}

	return readSavedWorld(response);
};

export function WorldAutosaveProvider({children}: {children: ReactNode}) {
	const [target, setTarget] = useState<SaveTarget | null>(null);
	const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
	const [localSnapshot, setLocalSnapshot] = useState<string | null>(null);
	const [status, setStatus] = useState<SaveStatus>("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [indicatorVisible, setIndicatorVisible] = useState(false);

	const targetRef = useRef<SaveTarget | null>(null);
	const savedSnapshotRef = useRef<string | null>(null);
	const localSnapshotRef = useRef<string | null>(null);
	const localOperationQueueRef = useRef<Promise<void>>(Promise.resolve());
	const inFlightRef = useRef<Promise<void> | null>(null);
	const queuedSaveRef = useRef(false);
	const localDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const indicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const errorMessageRef = useRef<string | null>(null);
	const retryAttemptRef = useRef(0);
	const generationRef = useRef(0);
	const saveRef = useRef<() => Promise<void>>(async () => {});
	const scheduleRef = useRef<() => void>(() => {});
	const persistLocalRef = useRef<() => void>(() => {});
	const scheduleLocalRef = useRef<() => void>(() => {});

	const currentSnapshot = useMemo(() => (target ? serializeWorld(target.world) : null), [target]);
	const isDirty = currentSnapshot !== null && currentSnapshot !== savedSnapshot;
	const isLocallyDirty =
		currentSnapshot !== null &&
		currentSnapshot !== savedSnapshot &&
		currentSnapshot !== localSnapshot;

	const clearScheduledSaves = useCallback(() => {
		if (localDraftTimerRef.current) clearTimeout(localDraftTimerRef.current);
		if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
		if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
		if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
		if (indicatorTimerRef.current) clearTimeout(indicatorTimerRef.current);

		localDraftTimerRef.current = null;
		debounceTimerRef.current = null;
		maxWaitTimerRef.current = null;
		retryTimerRef.current = null;
		indicatorTimerRef.current = null;
	}, []);

	const queueLocalOperation = useCallback((operation: () => Promise<void>) => {
		localOperationQueueRef.current = localOperationQueueRef.current
			.then(operation)
			.catch((error: unknown) => {
				console.warn("Could not update the local world draft.", error);
			});
		return localOperationQueueRef.current;
	}, []);

	const persistLocalDraftNow = useCallback(() => {
		if (localDraftTimerRef.current) clearTimeout(localDraftTimerRef.current);
		localDraftTimerRef.current = null;

		const currentTarget = targetRef.current;
		if (!currentTarget) return;

		const snapshot = serializeWorld(currentTarget.world);
		if (snapshot === savedSnapshotRef.current || snapshot === localSnapshotRef.current) return;
		const generation = generationRef.current;

		void queueLocalOperation(async () => {
			const persisted = await writeWorldDraft({
				userId: currentTarget.userId,
				world: currentTarget.world,
				worldId: currentTarget.worldId,
				baseServerRevision: currentTarget.revision,
			});
			if (!persisted || generationRef.current !== generation) return;
			localSnapshotRef.current = snapshot;
			setLocalSnapshot(snapshot);
		});
	}, [queueLocalOperation]);

	const scheduleLocalDraft = useCallback(() => {
		if (localDraftTimerRef.current) clearTimeout(localDraftTimerRef.current);
		localDraftTimerRef.current = setTimeout(() => {
			localDraftTimerRef.current = null;
			persistLocalRef.current();
		}, LOCAL_DRAFT_DEBOUNCE_MS);
	}, []);

	useEffect(() => {
		persistLocalRef.current = persistLocalDraftNow;
		scheduleLocalRef.current = scheduleLocalDraft;
	}, [persistLocalDraftNow, scheduleLocalDraft]);

	const showIndicator = useCallback(() => {
		if (indicatorTimerRef.current) clearTimeout(indicatorTimerRef.current);
		indicatorTimerRef.current = null;
		setIndicatorVisible(true);
	}, []);

	const hideSavedIndicatorAfterDelay = useCallback(() => {
		const hideIndicator = () => {
			indicatorTimerRef.current = null;
			setIndicatorVisible(false);
		};

		indicatorTimerRef.current = setTimeout(hideIndicator, SAVED_INDICATOR_VISIBLE_MS);
	}, []);

	const saveNow = useCallback(async () => {
		if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
		if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
		if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
		debounceTimerRef.current = null;
		maxWaitTimerRef.current = null;
		retryTimerRef.current = null;

		const targetAtSaveStart = targetRef.current;
		if (!targetAtSaveStart) return;

		if (inFlightRef.current) {
			queuedSaveRef.current = true;
			await inFlightRef.current;
			const latestTarget = targetRef.current;
			if (latestTarget && serializeWorld(latestTarget.world) !== savedSnapshotRef.current) {
				await saveRef.current();
			}
			return;
		}

		const snapshotAtSaveStart = serializeWorld(targetAtSaveStart.world);
		if (snapshotAtSaveStart === savedSnapshotRef.current) return;

		const generationAtSaveStart = generationRef.current;
		setStatus("saving");
		errorMessageRef.current = null;
		setErrorMessage(null);
		showIndicator();

		const request = (async () => {
			let succeeded = false;

			try {
				const savedWorld = await persistWorld(targetAtSaveStart);
				if (generationRef.current !== generationAtSaveStart) return;

				succeeded = true;
				retryAttemptRef.current = 0;
				savedSnapshotRef.current = snapshotAtSaveStart;
				setSavedSnapshot(snapshotAtSaveStart);
				const currentTarget = targetRef.current;
				if (currentTarget) {
					const updatedTarget = {
						...currentTarget,
						worldId: savedWorld.id,
						revision: savedWorld.revision,
					};
					targetRef.current = updatedTarget;
					setTarget(updatedTarget);
				}
				localSnapshotRef.current = snapshotAtSaveStart;
				setLocalSnapshot(snapshotAtSaveStart);
				void queueLocalOperation(async () => {
					const latestTarget = targetRef.current;
					if (!latestTarget || generationRef.current !== generationAtSaveStart) return;

					const latestSnapshot = serializeWorld(latestTarget.world);
					if (latestSnapshot === snapshotAtSaveStart) {
						if (latestTarget.userId && latestTarget.worldId) {
							await deleteWorldDraft(latestTarget.userId, latestTarget.worldId);
						}
						return;
					}

					const persisted = await writeWorldDraft({
						userId: latestTarget.userId,
						world: latestTarget.world,
						worldId: savedWorld.id,
						baseServerRevision: savedWorld.revision,
					});
					if (!persisted || generationRef.current !== generationAtSaveStart) return;
					localSnapshotRef.current = latestSnapshot;
					setLocalSnapshot(latestSnapshot);
				});
				setStatus("saved");
				targetAtSaveStart.onPersisted(savedWorld.id, savedWorld.revision);
			} catch (error) {
				if (generationRef.current !== generationAtSaveStart) return;

				if (error instanceof WorldSaveError) {
					console.warn("Could not autosave the world", error.message);
				} else {
					console.error("Could not autosave the world", error);
				}
				const message =
					error instanceof Error ? error.message : "Save failed. Your local draft is still available.";
				errorMessageRef.current = message;
				setErrorMessage(message);
				setStatus("error");
				if (error instanceof WorldSaveError && !error.retryable) return;

				const retryDelay =
					RETRY_DELAYS_MS[Math.min(retryAttemptRef.current, RETRY_DELAYS_MS.length - 1)];
				retryAttemptRef.current += 1;
				retryTimerRef.current = setTimeout(() => {
					retryTimerRef.current = null;
					void saveRef.current();
				}, retryDelay);
			} finally {
				inFlightRef.current = null;
				const queuedSave = queuedSaveRef.current;
				queuedSaveRef.current = false;
				const targetChanged = generationRef.current !== generationAtSaveStart;

				const shouldSaveAgain =
					(queuedSave && (succeeded || targetChanged)) ||
					(succeeded &&
						!targetChanged &&
						targetRef.current &&
						serializeWorld(targetRef.current.world) !== savedSnapshotRef.current);

				if (shouldSaveAgain) {
					void saveRef.current();
				} else if (succeeded) {
					hideSavedIndicatorAfterDelay();
				}
			}
		})();

		inFlightRef.current = request;
		await request;
	}, [hideSavedIndicatorAfterDelay, queueLocalOperation, showIndicator]);

	useEffect(() => {
		saveRef.current = saveNow;
	}, [saveNow]);

	const scheduleAutosave = useCallback(() => {
		const currentTarget = targetRef.current;
		if (!currentTarget || serializeWorld(currentTarget.world) === savedSnapshotRef.current) return;

		if (retryTimerRef.current) {
			clearTimeout(retryTimerRef.current);
			retryTimerRef.current = null;
		}

		if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
		debounceTimerRef.current = setTimeout(() => {
			debounceTimerRef.current = null;
			void saveRef.current();
		}, SAVE_DEBOUNCE_MS);

		if (!maxWaitTimerRef.current) {
			maxWaitTimerRef.current = setTimeout(() => {
				maxWaitTimerRef.current = null;
				void saveRef.current();
			}, SAVE_MAX_WAIT_MS);
		}
	}, []);

	useEffect(() => {
		scheduleRef.current = scheduleAutosave;
	}, [scheduleAutosave]);

	const registerTarget = useCallback(
		(nextTarget: SaveTarget) => {
			generationRef.current += 1;
			clearScheduledSaves();
			queuedSaveRef.current = false;
			retryAttemptRef.current = 0;
			targetRef.current = nextTarget;
			const snapshot = serializeWorld(nextTarget.world);
			const serverSnapshot = nextTarget.restoredFromLocalDraft ? null : snapshot;
			savedSnapshotRef.current = serverSnapshot;
			localSnapshotRef.current = snapshot;
			setTarget(nextTarget);
			setSavedSnapshot(serverSnapshot);
			setLocalSnapshot(snapshot);
			setStatus("idle");
			errorMessageRef.current = null;
			setErrorMessage(null);
			setIndicatorVisible(false);
			if (nextTarget.restoredFromLocalDraft) scheduleAutosave();
		},
		[clearScheduledSaves, scheduleAutosave],
	);

	const updateTarget = useCallback((nextTarget: SaveTarget) => {
		const currentTarget = targetRef.current;
		const targetsSameWorld =
			currentTarget && (nextTarget.worldId === currentTarget.worldId || nextTarget.worldId === null);
		const mergedTarget = {
			...nextTarget,
			worldId: nextTarget.worldId ?? currentTarget?.worldId ?? null,
			revision: targetsSameWorld
				? Math.max(nextTarget.revision ?? 0, currentTarget.revision ?? 0) || null
				: nextTarget.revision,
		};

		targetRef.current = mergedTarget;
		setTarget(mergedTarget);
		scheduleLocalRef.current();
		scheduleRef.current();
	}, []);

	const clearTarget = useCallback(() => {
		persistLocalDraftNow();
		generationRef.current += 1;
		clearScheduledSaves();
		queuedSaveRef.current = false;
		retryAttemptRef.current = 0;
		targetRef.current = null;
		savedSnapshotRef.current = null;
		localSnapshotRef.current = null;
		setTarget(null);
		setSavedSnapshot(null);
		setLocalSnapshot(null);
		setStatus("idle");
		errorMessageRef.current = null;
		setErrorMessage(null);
		setIndicatorVisible(false);
	}, [clearScheduledSaves, persistLocalDraftNow]);

	const confirmCurrentRevision = useCallback(async (): Promise<WorldSaveConfirmation> => {
		persistLocalRef.current();
		await localOperationQueueRef.current;
		await saveRef.current();
		await localOperationQueueRef.current;

		const latestTarget = targetRef.current;
		if (
			latestTarget?.worldId &&
			latestTarget.revision &&
			serializeWorld(latestTarget.world) === savedSnapshotRef.current
		) {
			return {ok: true, id: latestTarget.worldId, revision: latestTarget.revision};
		}

		return {
			ok: false,
			message:
				errorMessageRef.current ??
				"This revision has not reached the server yet. Your local draft is still available.",
		};
	}, []);

	const resetWorld = useCallback(() => {
		targetRef.current?.onReset();
	}, []);

	const prepareForNavigation = useCallback(async () => {
		const currentTarget = targetRef.current;
		if (!currentTarget) return true;
		if (serializeWorld(currentTarget.world) === savedSnapshotRef.current) return true;
		return (await confirmCurrentRevision()).ok;
	}, [confirmCurrentRevision]);

	useEffect(() => {
		const saveBeforeInternalNavigation = (event: MouseEvent) => {
			if (!targetRef.current) return;
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			)
				return;
			const targetElement = event.target;
			if (!(targetElement instanceof Element)) return;
			const anchor = targetElement.closest<HTMLAnchorElement>("a[href]");
			if (!anchor || anchor.download || (anchor.target && anchor.target !== "_self")) return;

			const destination = new URL(anchor.href, window.location.href);
			if (destination.origin !== window.location.origin) return;
			if (
				destination.pathname === window.location.pathname &&
				destination.search === window.location.search
			)
				return;

			event.preventDefault();
			event.stopPropagation();
			void prepareForNavigation().then((ready) => {
				if (ready) window.location.assign(destination.href);
			});
		};

		document.addEventListener("click", saveBeforeInternalNavigation, true);
		return () => document.removeEventListener("click", saveBeforeInternalNavigation, true);
	}, [prepareForNavigation]);

	useEffect(() => clearScheduledSaves, [clearScheduledSaves]);

	useEffect(() => {
		if (!isLocallyDirty) return;

		const warnAboutUnsavedChanges = (event: BeforeUnloadEvent) => {
			persistLocalRef.current();
			event.preventDefault();
			event.returnValue = "";
		};

		window.addEventListener("beforeunload", warnAboutUnsavedChanges);
		return () => window.removeEventListener("beforeunload", warnAboutUnsavedChanges);
	}, [isLocallyDirty]);

	useEffect(() => {
		const persistBeforeBackgrounding = () => {
			if (document.visibilityState === "hidden") persistLocalRef.current();
		};
		const saveWhenOnline = () => void saveRef.current();

		document.addEventListener("visibilitychange", persistBeforeBackgrounding);
		window.addEventListener("pagehide", persistLocalRef.current);
		window.addEventListener("online", saveWhenOnline);
		return () => {
			document.removeEventListener("visibilitychange", persistBeforeBackgrounding);
			window.removeEventListener("pagehide", persistLocalRef.current);
			window.removeEventListener("online", saveWhenOnline);
		};
	}, []);

	const value = useMemo<WorldAutosaveContextValue>(
		() => ({
			clearTarget,
			registerTarget,
			updateTarget,
			target,
			isDirty,
			indicatorVisible,
			status,
			errorMessage,
			saveNow,
			confirmCurrentRevision,
			prepareForNavigation,
			resetWorld,
		}),
		[
			clearTarget,
			confirmCurrentRevision,
			errorMessage,
			indicatorVisible,
			isDirty,
			registerTarget,
			resetWorld,
			saveNow,
			prepareForNavigation,
			status,
			target,
			updateTarget,
		],
	);

	return <WorldAutosaveContext.Provider value={value}>{children}</WorldAutosaveContext.Provider>;
}

export const useWorldAutosave = (): WorldAutosaveContextValue => {
	const context = useContext(WorldAutosaveContext);

	if (!context) {
		throw new Error("World autosave controls require WorldAutosaveProvider.");
	}

	return context;
};

export function useWorldAutosaveRegistration({
	ready,
	world,
	worldId,
	revision,
	userId,
	worldName,
	restoredFromLocalDraft,
	onPersisted,
	onReset,
}: SaveTarget & {ready: boolean}) {
	const {clearTarget, registerTarget, updateTarget} = useWorldAutosave();
	const registered = useRef(false);

	useEffect(() => {
		if (!ready) return;

		const target = {
			world,
			worldId,
			userId,
			worldName,
			revision,
			restoredFromLocalDraft,
			onPersisted,
			onReset,
		};

		if (!registered.current) {
			registerTarget(target);
			registered.current = true;
		} else {
			updateTarget(target);
		}
	}, [
		onPersisted,
		onReset,
		ready,
		registerTarget,
		restoredFromLocalDraft,
		revision,
		userId,
		worldName,
		updateTarget,
		world,
		worldId,
	]);

	useEffect(
		() => () => {
			registered.current = false;
			clearTarget();
		},
		[clearTarget],
	);
}

export function WorldAutosaveIndicator() {
	const {errorMessage, indicatorVisible, saveNow, status, target} = useWorldAutosave();
	if (!target) return null;

	return (
		<span className="worldAutosaveIndicatorSlot" role="status" aria-live="polite">
			{indicatorVisible ? (
				<span
					className={`worldAutosaveIndicator worldAutosaveIndicator--${status}`}
					title={status === "error" ? (errorMessage ?? undefined) : undefined}
				>
					<span className="worldAutosaveIndicatorDot" aria-hidden="true" />
					{status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save failed"}
					{status === "error" ? (
						<button type="button" onClick={() => void saveNow()}>
							Retry
						</button>
					) : null}
				</span>
			) : null}
		</span>
	);
}

export function CurrentWorldName({showLoading = false}: {showLoading?: boolean}) {
	const {target} = useWorldAutosave();
	if (!target && !showLoading) return null;
	return (
		<span className="headerWorldName" aria-label="Current world">
			{target ? target.worldName || "Untitled world" : "Loading world…"}
		</span>
	);
}

type SwitcherWorld = {editorSlug: string | null; id: string; name: string};

export function WorldSwitcher({showLoading = false}: {showLoading?: boolean}) {
	const {prepareForNavigation, target} = useWorldAutosave();
	const [open, setOpen] = useState(false);
	const [worlds, setWorlds] = useState<SwitcherWorld[]>([]);
	const [navigationError, setNavigationError] = useState("");
	const firstItemRef = useRef<HTMLButtonElement | null>(null);
	const triggerRef = useRef<HTMLButtonElement | null>(null);

	useEffect(() => {
		if (!open || !target) return;
		const controller = new AbortController();
		fetch("/api/world", {signal: controller.signal})
			.then(async (response) => {
				if (!response.ok) throw new Error("Worlds could not be loaded.");
				const body = (await response.json()) as {data?: {worlds?: SwitcherWorld[]}};
				setWorlds(Array.isArray(body.data?.worlds) ? body.data.worlds : []);
			})
			.catch((error: unknown) => {
				if ((error as {name?: string}).name !== "AbortError")
					setNavigationError("Worlds could not be loaded.");
			});
		return () => controller.abort();
	}, [open, target]);

	useEffect(() => {
		if (open) firstItemRef.current?.focus();
	}, [open, worlds]);

	if (!target) return showLoading ? <CurrentWorldName showLoading /> : null;

	const navigate = async (path: string) => {
		setNavigationError("");
		if (!(await prepareForNavigation())) {
			setNavigationError("Save this world before switching.");
			return;
		}
		window.location.assign(path);
	};

	return (
		<div className="worldSwitcher">
			<button
				ref={triggerRef}
				type="button"
				className="worldSwitcherTrigger"
				aria-label={`Current world: ${target.worldName}`}
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
			>
				<span>{target.worldName || "Untitled world"}</span>
				<ChevronDown size={13} aria-hidden="true" />
			</button>
			{open ? (
				<AnchoredLayer
					anchorRef={triggerRef}
					ariaLabel="Switch worlds"
					className="worldSwitcherMenu"
					mobilePresentation="sheet"
					onClose={() => setOpen(false)}
					preferredWidth={220}
					role="menu"
				>
					{worlds
						.filter((world) => world.id !== target.worldId)
						.slice(0, 5)
						.map((world, index) => (
							<button
								ref={index === 0 ? firstItemRef : undefined}
								key={world.id}
								type="button"
								role="menuitem"
								onClick={() => void navigate(`/worlds/${world.editorSlug ?? world.id}`)}
							>
								{world.name}
							</button>
						))}
					<div className="worldSwitcherMenuDivider" />
					<button type="button" role="menuitem" onClick={() => void navigate("/worlds")}>
						View all worlds
					</button>
					<button type="button" role="menuitem" onClick={() => void navigate("/worlds?new=1")}>
						New world
					</button>
					{navigationError ? <p role="alert">{navigationError}</p> : null}
				</AnchoredLayer>
			) : null}
		</div>
	);
}

export function WorldResetButton() {
	const {resetWorld, target} = useWorldAutosave();
	const popup = useOptionalPopup();

	if (!target) return null;

	const confirmReset = async () => {
		const message =
			"Replace every authored room, item, connection, command, condition, effect, event, and metadata field with the bundled starter world? This replacement will be autosaved.";
		const confirmed = popup
			? await popup.confirm({
					title: "Reset to the starter world?",
					message,
					confirmLabel: "Reset world",
					cancelLabel: "Keep world",
					danger: true,
				})
			: globalThis.confirm(message);
		if (confirmed) resetWorld();
	};

	return (
		<button
			type="button"
			className="worldResetButton"
			onClick={() => void confirmReset()}
			title="Reset world to the bundled starter"
		>
			<RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
			Reset to starter world
		</button>
	);
}

/** Kept for debugging and recovery, but intentionally not rendered in the header. */
export function WorldSaveButton() {
	const {isDirty, saveNow, status, target} = useWorldAutosave();

	if (!target) return null;

	const label =
		status === "saving"
			? "Saving…"
			: status === "error"
				? "Try save again"
				: isDirty
					? "Save changes"
					: "Save world";

	return (
		<button
			type="button"
			className={`worldSaveButton ${isDirty ? "worldSaveButtonDirty" : ""}`}
			onClick={() => void saveNow()}
			disabled={status === "saving"}
			title={isDirty ? "Save world changes" : "World changes are saved"}
		>
			<Save size={15} strokeWidth={2.4} aria-hidden="true" />
			<span>{label}</span>
		</button>
	);
}
