"use client";

import {ChevronDown, RotateCcw} from "lucide-react";
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

import "./WorldAutosave.scss";

const SAVE_DEBOUNCE_MS = 3_000;
const SAVE_MAX_WAIT_MS = 30_000;
const SAVE_PROBLEM_VISIBLE_MS = 10_000;
const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000] as const;

type SaveStatus = "idle" | "saving" | "saved" | "error";

type SaveTarget = {
	world: World;
	worldId: string | null;
	worldName: string;
	revision: number | null;
	onPersisted: (worldId: string, revision: number) => void;
	onReset: () => void;
};

type SavedWorld = {
	id: string;
	revision: number;
};

export type WorldSyncTransport = {
	persist: (target: Pick<SaveTarget, "revision" | "world" | "worldId">) => Promise<SavedWorld>;
};

export type ConfirmedWorldRevision = SavedWorld;

export type WorldSaveConfirmation =
	({ok: true} & ConfirmedWorldRevision) | {ok: false; message: string};

type WorldAutosaveContextValue = {
	allowNextUnload: () => void;
	clearTarget: () => void;
	registerTarget: (target: SaveTarget) => void;
	updateTarget: (target: SaveTarget) => void;
	target: SaveTarget | null;
	isDirty: boolean;
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
				? "The server returned an invalid save response. Your changes have not been saved."
				: "Save failed because the server returned an invalid response.",
			response.ok || response.status >= 500,
		);
	}

	if (!response.ok) {
		const sessionMessage =
			response.status === 401
				? "Your session expired. Sign in again, then retry saving."
				: response.status === 403
					? "Your session can no longer save this world. Sign in again, then save your changes."
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
			"The server returned an incomplete save response. Your changes have not been saved.",
			true,
		);
	}

	return {id: body.data.id, revision: body.data.revision};
};

const httpWorldSyncTransport: WorldSyncTransport = {
	persist: async (target) => {
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
				"Connection lost. Mothmark will keep trying while this editor is open.",
				true,
			);
		}

		return readSavedWorld(response);
	},
};

export function WorldAutosaveProvider({
	children,
	transport = httpWorldSyncTransport,
}: {
	children: ReactNode;
	transport?: WorldSyncTransport;
}) {
	const [target, setTarget] = useState<SaveTarget | null>(null);
	const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
	const [status, setStatus] = useState<SaveStatus>("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const targetRef = useRef<SaveTarget | null>(null);
	const savedSnapshotRef = useRef<string | null>(null);
	const inFlightRef = useRef<Promise<void> | null>(null);
	const queuedSaveRef = useRef(false);
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const problemIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const errorMessageRef = useRef<string | null>(null);
	const retryAttemptRef = useRef(0);
	const firstFailureAtRef = useRef<number | null>(null);
	const allowNextUnloadRef = useRef(false);
	const generationRef = useRef(0);
	const saveRef = useRef<() => Promise<void>>(async () => {});
	const scheduleRef = useRef<() => void>(() => {});

	const currentSnapshot = useMemo(() => (target ? serializeWorld(target.world) : null), [target]);
	const isDirty = currentSnapshot !== null && currentSnapshot !== savedSnapshot;

	const clearScheduledSaves = useCallback(() => {
		if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
		if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
		if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
		if (problemIndicatorTimerRef.current) clearTimeout(problemIndicatorTimerRef.current);

		debounceTimerRef.current = null;
		maxWaitTimerRef.current = null;
		retryTimerRef.current = null;
		problemIndicatorTimerRef.current = null;
	}, []);

	const clearRequestIndicators = useCallback(() => {
		if (problemIndicatorTimerRef.current) clearTimeout(problemIndicatorTimerRef.current);
		problemIndicatorTimerRef.current = null;
	}, []);

	const revealProblemAfterDelay = useCallback(() => {
		if (problemIndicatorTimerRef.current || firstFailureAtRef.current === null) return;
		const elapsed = Date.now() - firstFailureAtRef.current;
		problemIndicatorTimerRef.current = setTimeout(
			() => {
				problemIndicatorTimerRef.current = null;
				if (firstFailureAtRef.current === null) return;
				setStatus("error");
			},
			Math.max(0, SAVE_PROBLEM_VISIBLE_MS - elapsed),
		);
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

		const request = (async () => {
			let succeeded = false;

			try {
				const savedWorld = await transport.persist(targetAtSaveStart);
				if (generationRef.current !== generationAtSaveStart) return;

				succeeded = true;
				retryAttemptRef.current = 0;
				firstFailureAtRef.current = null;
				clearRequestIndicators();
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
				setStatus("saved");
				errorMessageRef.current = null;
				setErrorMessage(null);
				targetAtSaveStart.onPersisted(savedWorld.id, savedWorld.revision);
			} catch (error) {
				if (generationRef.current !== generationAtSaveStart) return;

				if (error instanceof WorldSaveError) {
					console.warn("Could not autosave the world", error.message);
				} else {
					console.error("Could not autosave the world", error);
				}
				const message =
					error instanceof Error ? error.message : "Save failed. Your changes have not been saved.";
				errorMessageRef.current = message;
				setErrorMessage(message);
				if (error instanceof WorldSaveError && !error.retryable) {
					clearRequestIndicators();
					setStatus("error");
					return;
				}

				if (firstFailureAtRef.current === null) firstFailureAtRef.current = Date.now();
				revealProblemAfterDelay();

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
				}
			}
		})();

		inFlightRef.current = request;
		await request;
	}, [clearRequestIndicators, revealProblemAfterDelay, transport]);

	useEffect(() => {
		saveRef.current = saveNow;
	}, [saveNow]);

	const scheduleAutosave = useCallback(() => {
		const currentTarget = targetRef.current;
		if (!currentTarget || serializeWorld(currentTarget.world) === savedSnapshotRef.current) return;

		if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
		retryTimerRef.current = null;

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
			firstFailureAtRef.current = null;
			targetRef.current = nextTarget;
			const snapshot = serializeWorld(nextTarget.world);
			savedSnapshotRef.current = snapshot;
			setTarget(nextTarget);
			setSavedSnapshot(snapshot);
			setStatus("saved");
			errorMessageRef.current = null;
			setErrorMessage(null);
		},
		[clearScheduledSaves],
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
		scheduleRef.current();
	}, []);

	const clearTarget = useCallback(() => {
		generationRef.current += 1;
		clearScheduledSaves();
		queuedSaveRef.current = false;
		retryAttemptRef.current = 0;
		firstFailureAtRef.current = null;
		targetRef.current = null;
		savedSnapshotRef.current = null;
		setTarget(null);
		setSavedSnapshot(null);
		setStatus("idle");
		errorMessageRef.current = null;
		setErrorMessage(null);
	}, [clearScheduledSaves]);

	const confirmCurrentRevision = useCallback(async (): Promise<WorldSaveConfirmation> => {
		await saveRef.current();

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
			message: errorMessageRef.current ?? "This revision has not reached the server yet.",
		};
	}, []);

	const resetWorld = useCallback(() => {
		targetRef.current?.onReset();
	}, []);

	const allowNextUnload = useCallback(() => {
		allowNextUnloadRef.current = true;
	}, []);

	const prepareForNavigation = useCallback(async () => {
		const currentTarget = targetRef.current;
		if (!currentTarget) return true;
		if (serializeWorld(currentTarget.world) === savedSnapshotRef.current) return true;
		return globalThis.confirm(
			"This world has changes that have not been saved. Leave and discard those changes?",
		);
	}, []);

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
				if (!ready) return;
				allowNextUnload();
				window.location.assign(destination.href);
			});
		};

		document.addEventListener("click", saveBeforeInternalNavigation, true);
		return () => document.removeEventListener("click", saveBeforeInternalNavigation, true);
	}, [allowNextUnload, prepareForNavigation]);

	useEffect(() => clearScheduledSaves, [clearScheduledSaves]);

	useEffect(() => {
		if (!isDirty) return;

		const warnAboutUnsavedChanges = (event: BeforeUnloadEvent) => {
			if (allowNextUnloadRef.current) {
				allowNextUnloadRef.current = false;
				return;
			}
			event.preventDefault();
			event.returnValue = "";
		};

		window.addEventListener("beforeunload", warnAboutUnsavedChanges);
		return () => window.removeEventListener("beforeunload", warnAboutUnsavedChanges);
	}, [isDirty]);

	useEffect(() => {
		const saveWhenOnline = () => void saveRef.current();
		window.addEventListener("online", saveWhenOnline);
		return () => {
			window.removeEventListener("online", saveWhenOnline);
		};
	}, []);

	useEffect(() => {
		const saveWithKeyboard = (event: KeyboardEvent) => {
			if (!targetRef.current || event.altKey || (!event.metaKey && !event.ctrlKey)) return;
			if (event.key.toLowerCase() !== "s") return;
			event.preventDefault();
			void saveRef.current();
		};
		window.addEventListener("keydown", saveWithKeyboard);
		return () => window.removeEventListener("keydown", saveWithKeyboard);
	}, []);

	const value = useMemo<WorldAutosaveContextValue>(
		() => ({
			allowNextUnload,
			clearTarget,
			registerTarget,
			updateTarget,
			target,
			isDirty,
			status,
			errorMessage,
			saveNow,
			confirmCurrentRevision,
			prepareForNavigation,
			resetWorld,
		}),
		[
			allowNextUnload,
			clearTarget,
			confirmCurrentRevision,
			errorMessage,
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
	worldName,
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
			worldName,
			revision,
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
		revision,
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
	const {errorMessage, isDirty, status, target} = useWorldAutosave();
	if (!target) return null;
	const visibleStatus = status === "error" ? "error" : isDirty ? "saving" : "saved";

	return (
		<span className="worldAutosaveIndicatorSlot" role="status" aria-live="polite">
			<span
				className={`worldAutosaveIndicator worldAutosaveIndicator--${visibleStatus}`}
				title={visibleStatus === "error" ? (errorMessage ?? undefined) : undefined}
			>
				<span className="worldAutosaveIndicatorDot" aria-hidden="true" />
				{visibleStatus === "saving"
					? "Saving…"
					: visibleStatus === "saved"
						? "Saved"
						: "Changes not saved"}
			</span>
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
	const {allowNextUnload, prepareForNavigation, target} = useWorldAutosave();
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
			setNavigationError("Unsaved changes were kept in this editor.");
			return;
		}
		allowNextUnload();
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

export function WorldSaveButton() {
	const {saveNow, status, target} = useWorldAutosave();

	if (!target || status !== "error") return null;

	return (
		<button
			type="button"
			className="worldSaveButton"
			onClick={() => void saveNow()}
			title="Retry saving this world"
		>
			Retry
		</button>
	);
}
