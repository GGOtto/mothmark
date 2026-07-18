"use client";

import {Save} from "lucide-react";
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

import type {World} from "@/schemas/worldSchema";

import "./WorldAutosave.scss";

const SAVE_DEBOUNCE_MS = 2_000;
const SAVE_MAX_WAIT_MS = 15_000;
const INDICATOR_MIN_VISIBLE_MS = 2_000;
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000] as const;

type SaveStatus = "idle" | "saving" | "saved" | "error";

type SaveTarget = {
	world: World;
	worldId: string | null;
	revision: number | null;
	onPersisted: (worldId: string, revision: number) => void;
};

type SavedWorld = {
	id: string;
	revision: number;
};

type WorldAutosaveContextValue = {
	clearTarget: () => void;
	registerTarget: (target: SaveTarget) => void;
	updateTarget: (target: SaveTarget) => void;
	target: SaveTarget | null;
	isDirty: boolean;
	indicatorVisible: boolean;
	status: SaveStatus;
	saveNow: () => Promise<void>;
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
	const body = (await response.json()) as {
		data?: {id?: unknown; revision?: unknown};
		error?: {message?: unknown; issues?: unknown};
	};

	if (!response.ok) {
		const baseMessage = typeof body.error?.message === "string" ? body.error.message : "Save failed.";
		const issueDetails = Array.isArray(body.error?.issues)
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

	if (typeof body.data?.id !== "string" || typeof body.data.revision !== "number") {
		throw new Error("The save response did not include a world ID and revision.");
	}

	return {id: body.data.id, revision: body.data.revision};
};

const persistWorld = async (target: SaveTarget): Promise<SavedWorld> => {
	const isExistingWorld = target.worldId !== null;
	const response = await fetch(isExistingWorld ? `/api/world/${target.worldId}` : "/api/world", {
		method: isExistingWorld ? "PUT" : "POST",
		headers: {"content-type": "application/json"},
		body: JSON.stringify(
			isExistingWorld
				? {world: target.world, expectedRevision: target.revision ?? undefined}
				: {
						name: target.world.metadata.title || "Main World",
						slug: "main",
						world: target.world,
						schemaVersion: 1,
					},
		),
	});

	return readSavedWorld(response);
};

export function WorldAutosaveProvider({children}: {children: ReactNode}) {
	const [target, setTarget] = useState<SaveTarget | null>(null);
	const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
	const [status, setStatus] = useState<SaveStatus>("idle");
	const [indicatorVisible, setIndicatorVisible] = useState(false);

	const targetRef = useRef<SaveTarget | null>(null);
	const savedSnapshotRef = useRef<string | null>(null);
	const inFlightRef = useRef<Promise<void> | null>(null);
	const queuedSaveRef = useRef(false);
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const indicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const indicatorVisibleSinceRef = useRef<number | null>(null);
	const retryAttemptRef = useRef(0);
	const generationRef = useRef(0);
	const saveRef = useRef<() => Promise<void>>(async () => {});
	const scheduleRef = useRef<() => void>(() => {});

	const currentSnapshot = useMemo(() => (target ? serializeWorld(target.world) : null), [target]);
	const isDirty = currentSnapshot !== null && currentSnapshot !== savedSnapshot;

	const clearScheduledSaves = useCallback(() => {
		if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
		if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
		if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
		if (indicatorTimerRef.current) clearTimeout(indicatorTimerRef.current);

		debounceTimerRef.current = null;
		maxWaitTimerRef.current = null;
		retryTimerRef.current = null;
		indicatorTimerRef.current = null;
	}, []);

	const showIndicator = useCallback(() => {
		if (indicatorTimerRef.current) clearTimeout(indicatorTimerRef.current);
		indicatorTimerRef.current = null;
		if (indicatorVisibleSinceRef.current === null) {
			indicatorVisibleSinceRef.current = Date.now();
		}
		setIndicatorVisible(true);
	}, []);

	const hideIndicatorAfterMinimum = useCallback(() => {
		const visibleSince = indicatorVisibleSinceRef.current;
		if (visibleSince === null) return;

		const remaining = Math.max(INDICATOR_MIN_VISIBLE_MS - (Date.now() - visibleSince), 0);
		const hideIndicator = () => {
			indicatorTimerRef.current = null;
			indicatorVisibleSinceRef.current = null;
			setIndicatorVisible(false);
		};

		if (remaining === 0) {
			hideIndicator();
			return;
		}

		indicatorTimerRef.current = setTimeout(hideIndicator, remaining);
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

		const snapshotAtSaveStart = serializeWorld(targetAtSaveStart.world);
		if (snapshotAtSaveStart === savedSnapshotRef.current) return;

		if (inFlightRef.current) {
			queuedSaveRef.current = true;
			await inFlightRef.current;
			return;
		}

		const generationAtSaveStart = generationRef.current;
		setStatus("saving");
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
				setStatus("saved");
				targetAtSaveStart.onPersisted(savedWorld.id, savedWorld.revision);
			} catch (error) {
				if (generationRef.current !== generationAtSaveStart) return;

				if (error instanceof WorldSaveError && !error.retryable) {
					console.warn("Could not autosave the world", error.message);
				} else {
					console.error("Could not autosave the world", error);
				}
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
				} else {
					hideIndicatorAfterMinimum();
				}
			}
		})();

		inFlightRef.current = request;
		await request;
	}, [hideIndicatorAfterMinimum, showIndicator]);

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
			savedSnapshotRef.current = snapshot;
			setTarget(nextTarget);
			setSavedSnapshot(snapshot);
			setStatus("idle");
			indicatorVisibleSinceRef.current = null;
			setIndicatorVisible(false);
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
		setStatus((currentStatus) => (currentStatus === "error" ? "idle" : currentStatus));
		scheduleRef.current();
	}, []);

	const clearTarget = useCallback(() => {
		generationRef.current += 1;
		clearScheduledSaves();
		queuedSaveRef.current = false;
		retryAttemptRef.current = 0;
		targetRef.current = null;
		savedSnapshotRef.current = null;
		setTarget(null);
		setSavedSnapshot(null);
		setStatus("idle");
		indicatorVisibleSinceRef.current = null;
		setIndicatorVisible(false);
	}, [clearScheduledSaves]);

	useEffect(() => clearScheduledSaves, [clearScheduledSaves]);

	useEffect(() => {
		if (!isDirty) return;

		const warnAboutUnsavedChanges = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};

		window.addEventListener("beforeunload", warnAboutUnsavedChanges);
		return () => window.removeEventListener("beforeunload", warnAboutUnsavedChanges);
	}, [isDirty]);

	const value = useMemo<WorldAutosaveContextValue>(
		() => ({
			clearTarget,
			registerTarget,
			updateTarget,
			target,
			isDirty,
			indicatorVisible,
			status,
			saveNow,
		}),
		[clearTarget, indicatorVisible, isDirty, registerTarget, saveNow, status, target, updateTarget],
	);

	return <WorldAutosaveContext.Provider value={value}>{children}</WorldAutosaveContext.Provider>;
}

const useWorldAutosave = (): WorldAutosaveContextValue => {
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
	onPersisted,
}: SaveTarget & {ready: boolean}) {
	const {clearTarget, registerTarget, updateTarget} = useWorldAutosave();
	const registered = useRef(false);

	useEffect(() => {
		if (!ready) return;

		const target = {world, worldId, revision, onPersisted};

		if (!registered.current) {
			registerTarget(target);
			registered.current = true;
		} else {
			updateTarget(target);
		}
	}, [onPersisted, ready, registerTarget, revision, updateTarget, world, worldId]);

	useEffect(
		() => () => {
			registered.current = false;
			clearTarget();
		},
		[clearTarget],
	);
}

export function WorldAutosaveIndicator() {
	const {indicatorVisible} = useWorldAutosave();

	return (
		<span className="worldAutosaveIndicatorSlot" role="status" aria-live="polite">
			{indicatorVisible ? (
				<span className="worldAutosaveIndicator">
					<span className="worldAutosaveIndicatorDot" aria-hidden="true" />
					Saving...
				</span>
			) : null}
		</span>
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
