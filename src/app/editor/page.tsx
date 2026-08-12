"use client";

import type React from "react";
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import {produce} from "immer";
import {X} from "lucide-react";
import {usePathname} from "next/navigation";
import {
	ToolBar,
	type ToolBarStatus,
	type UpdateStatus,
	useToolBarStatus,
} from "@/components/studio/ToolBar";
import {LeftSideBar, type EditorTab} from "@/components/studio/LeftSideBar";
import {RightSideBar} from "@/components/studio/RightSideBar";
import {ItemCatalog} from "@/components/studio/ItemCatalog";
import {ItemEditor} from "@/components/studio/editors/ItemEditor";
import {CommandLine} from "@/components/player/CommandLine";
import {PublishingPanel} from "@/components/publication/PublishingPanel";
import {Map, type ConnectionDraft} from "@/components/map/Map";
import {EventEditor, EventInspector, EventToolbar} from "@/components/logic/events";
import {
	CommandEditor,
	CommandInspector,
	CommandLibrary,
	CommandLibraryPreview,
	CommandToolbar,
} from "@/components/logic/commands";
import {
	LogicHome,
	LogicSectionPlaceholder,
	type CommandSelection,
	type LogicSection,
	type LogicSelection,
} from "@/components/logic/shared";
import {useCommandCopyRegistration} from "@/components/header/CommandCopyAction";
import {
	useWorldAutosaveRegistration,
	WorldResetButton,
} from "@/components/world-autosave/WorldAutosave";
import {createInitialWorld, world as initialWorld} from "@/data/worlds/initialWorld";
import type {Room, World} from "@/schemas/world/worldSchema";
import type {UpdateWorld, WorldUpdate} from "@/types/worldUpdaterTypes";
import {idValue} from "@/utils/idUtils";
import {
	buildEditorContextSearch,
	resolveEditorContext,
	type EditorContext,
	type EditorSelection,
} from "./utils/editorContextUrl";
import {getConnectionDraftStatus} from "./utils/editorPageUtils";
import {loadEditorWorld as loadAuthorizedEditorWorld} from "./loadMainWorld";
import "./page.scss";

type EditorUtilityView = "editor" | "play";

const MOBILE_EDITOR_QUERY = "(max-width: 900px)";

function subscribeToMobileEditorLayout(onStoreChange: () => void) {
	if (typeof window.matchMedia !== "function") return () => undefined;
	const mediaQuery = window.matchMedia(MOBILE_EDITOR_QUERY);
	mediaQuery.addEventListener("change", onStoreChange);
	return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getMobileEditorLayoutSnapshot() {
	return typeof window.matchMedia === "function" && window.matchMedia(MOBILE_EDITOR_QUERY).matches;
}

function getServerMobileEditorLayoutSnapshot() {
	return false;
}

type EditorTabMetadata = {
	title: string;
	description: string;
};

const EDITOR_TAB_METADATA: Record<EditorTab, EditorTabMetadata> = {
	map: {
		title: "Map",
		description: "Build rooms and connections visually.",
	},
	world: {
		title: "Items",
		description: "Edit scenery, portable objects, containers, surfaces, and doors.",
	},
	logic: {
		title: "Logic",
		description: "Edit commands, triggers, states, flags, and conditions.",
	},
	debug: {
		title: "Issues",
		description: "Review validation errors and broken world logic.",
	},
	"world-settings": {
		title: "World settings",
		description: "Configure world-level settings.",
	},
	"editor-settings": {
		title: "Settings",
		description: "Configure editor preferences.",
	},
	npcs: {
		title: "Story",
		description: "Examine the text connection to world entities.",
	},
};

async function loadEditorWorld(signal: AbortSignal, requestedWorldId?: string) {
	return loadAuthorizedEditorWorld(fetch, signal, requestedWorldId);
}

export default function EditorPage() {
	const pathname = usePathname();
	const [requestedWorldId] = useState(() => {
		const locator =
			pathname.match(/^\/worlds\/([^/]+)$/)?.[1] ?? pathname.match(/^\/editor\/([^/]+)$/)?.[1];
		return locator === "undefined" ? undefined : locator;
	});
	const [activeTab, setActiveTab] = useState<EditorTab>("map");
	const [isAddingRoom, setIsAddingRoom] = useState(false);
	const [mapZoom, setMapZoom] = useState(1);
	const [mapRecenterRequest, setMapRecenterRequest] = useState(0);
	const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>({state: "idle"});
	const [logicSection, setLogicSection] = useState<LogicSection>("home");
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
	const [logicSelection, setLogicSelection] = useState<LogicSelection | null>(null);
	const [selectedCommandId, setSelectedCommandId] = useState<string | null>(null);
	const [commandSelection, setCommandSelection] = useState<CommandSelection | null>(null);
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
	const [editorSlug, setEditorSlug] = useState<string | null>(null);
	const [editorContextReady, setEditorContextReady] = useState(false);
	const [editorContextNotice, setEditorContextNotice] = useState<string | null>(null);
	const [inspectorNavigationVersion, setInspectorNavigationVersion] = useState(0);
	const editorUtilityContentRef = useRef<HTMLDivElement | null>(null);
	const historyModeRef = useRef<"push" | "replace">("replace");
	const mobileEditorLayout = useSyncExternalStore(
		subscribeToMobileEditorLayout,
		getMobileEditorLayoutSnapshot,
		getServerMobileEditorLayoutSnapshot,
	);
	const [utilityViewOverride, setUtilityView] = useState<EditorUtilityView | null>(null);
	const utilityView = utilityViewOverride ?? (mobileEditorLayout ? "play" : "editor");
	const [utilityCollapsedOverride, setUtilityCollapsed] = useState<boolean | null>(null);
	const utilityCollapsed = utilityCollapsedOverride ?? mobileEditorLayout;
	const [desktopUtilityWidth, setDesktopUtilityWidth] = useState(380);
	const [mobileUtilityHeight, setMobileUtilityHeight] = useState(280);
	const utilityResizeRef = useRef<{
		pointerId: number;
		startPosition: number;
		startSize: number;
	} | null>(null);

	const [editorWorld, setEditorWorld] = useState<World>(initialWorld);
	const [persistedWorldId, setPersistedWorldId] = useState<string | null>(null);
	const [worldName, setWorldName] = useState("");
	const [persistedWorldRevision, setPersistedWorldRevision] = useState<number | null>(null);
	const [worldIsLoaded, setWorldIsLoaded] = useState(false);

	const [selection, setSelection] = useState<EditorSelection>({
		selectedId: null,
		isConnectionSelected: false,
	});

	const updateWorld = useCallback<UpdateWorld>((update: WorldUpdate) => {
		setEditorWorld((world) => (typeof update === "function" ? produce(world, update) : update));
	}, []);

	const applyEditorContext = useCallback((context: EditorContext, notice: string | null) => {
		setActiveTab(context.activeTab);
		setSelection(context.selection);
		setLogicSection(context.logicSection);
		setSelectedEventId(context.selectedEventId);
		setLogicSelection(context.logicSelection);
		setSelectedCommandId(context.selectedCommandId);
		setCommandSelection(context.commandSelection);
		setSelectedItemId(context.selectedItemId);
		setEditorContextNotice(notice);
	}, []);

	const beginEditorNavigation = useCallback(() => {
		historyModeRef.current = "push";
		setEditorContextNotice(null);
		setInspectorNavigationVersion((version) => version + 1);
	}, []);

	const replaceEditorContext = useCallback(() => {
		historyModeRef.current = "replace";
	}, []);

	useEffect(() => {
		const abortController = new AbortController();

		loadEditorWorld(abortController.signal, requestedWorldId)
			.then((loaded) => {
				const {editorSlug, world, worldId, worldName: loadedName, revision} = loaded;
				updateWorld(world);
				setPersistedWorldId(worldId);
				setWorldName(loadedName);
				setPersistedWorldRevision(revision);
				const resolvedContext = resolveEditorContext(world, window.location.search);
				applyEditorContext(resolvedContext.context, resolvedContext.notice);
				setConnectionDraft({state: "idle"});
				setEditorSlug(editorSlug);
				setWorldIsLoaded(true);
				setEditorContextReady(true);
				window.history.replaceState(
					null,
					"",
					`/worlds/${editorSlug}${buildEditorContextSearch(resolvedContext.context)}`,
				);
			})
			.catch((error: unknown) => {
				if ((error as {name?: string}).name === "AbortError") return;

				console.warn("Could not load the private editor world.", error);
			});

		return () => abortController.abort();
	}, [applyEditorContext, requestedWorldId, updateWorld]);

	const editorContext = useMemo<EditorContext>(
		() => ({
			activeTab,
			selection,
			logicSection,
			selectedEventId,
			logicSelection,
			selectedCommandId,
			commandSelection,
			selectedItemId,
		}),
		[
			activeTab,
			commandSelection,
			logicSection,
			logicSelection,
			selectedCommandId,
			selectedEventId,
			selectedItemId,
			selection,
		],
	);

	useEffect(() => {
		if (!editorContextReady || !editorSlug) return;
		const nextUrl = `/worlds/${editorSlug}${buildEditorContextSearch(editorContext)}`;
		const currentUrl = `${window.location.pathname}${window.location.search}`;
		const mode = historyModeRef.current;
		historyModeRef.current = "replace";
		if (currentUrl === nextUrl) return;
		window.history[mode === "push" ? "pushState" : "replaceState"](null, "", nextUrl);
	}, [editorContext, editorContextReady, editorSlug]);

	useEffect(() => {
		if (!editorContextReady || !editorSlug) return;
		const handlePopState = () => {
			const resolved = resolveEditorContext(editorWorld, window.location.search);
			historyModeRef.current = "replace";
			applyEditorContext(resolved.context, resolved.notice);
			setInspectorNavigationVersion((version) => version + 1);
			const canonicalUrl = `/worlds/${editorSlug}${buildEditorContextSearch(resolved.context)}`;
			if (`${window.location.pathname}${window.location.search}` !== canonicalUrl) {
				window.history.replaceState(null, "", canonicalUrl);
			}
		};
		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, [applyEditorContext, editorContextReady, editorSlug, editorWorld]);

	useEffect(() => {
		const scroller = editorUtilityContentRef.current?.querySelector<HTMLElement>(".rightSideBar");
		if (scroller) scroller.scrollTop = 0;
	}, [inspectorNavigationVersion]);

	const handleWorldPersisted = useCallback((worldId: string, revision: number) => {
		setPersistedWorldId(worldId);
		setPersistedWorldRevision(revision);
	}, []);

	const handleResetWorld = useCallback(() => {
		const nextWorld = createInitialWorld();
		updateWorld(nextWorld);
		setSelection({selectedId: idValue(nextWorld.startRoomId), isConnectionSelected: false});
		setConnectionDraft({state: "idle"});
		setSelectedEventId(null);
		setLogicSelection(null);
		setSelectedCommandId(null);
		setCommandSelection(null);
		setSelectedItemId(idValue(nextWorld.items[0]?.id) || null);
		setMapZoom(1);
		setMapRecenterRequest((request) => request + 1);
	}, [updateWorld]);

	const handleTabChange = useCallback(
		(tab: EditorTab) => {
			beginEditorNavigation();
			setIsAddingRoom(false);
			setActiveTab(tab);
			setUtilityView("editor");
			setUtilityCollapsed(mobileEditorLayout);
			if (tab !== "logic") return;

			setLogicSection("home");
			setSelectedEventId(null);
			setLogicSelection(null);
			setSelectedCommandId(null);
			setCommandSelection(null);
		},
		[beginEditorNavigation, mobileEditorLayout],
	);

	const activateUtilityView = useCallback((view: EditorUtilityView) => {
		setUtilityView(view);
		setUtilityCollapsed(false);
	}, []);

	function clampUtilitySize(size: number): number {
		if (mobileEditorLayout) {
			return Math.round(Math.max(140, Math.min(window.innerHeight * 0.72, size)));
		}
		return Math.round(Math.max(310, Math.min(Math.min(640, window.innerWidth - 320), size)));
	}

	function resizeUtility(size: number): void {
		const nextSize = clampUtilitySize(size);
		if (mobileEditorLayout) setMobileUtilityHeight(nextSize);
		else setDesktopUtilityWidth(nextSize);
	}

	function handleUtilityResizeStart(event: React.PointerEvent<HTMLDivElement>): void {
		if (utilityCollapsed) return;
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		utilityResizeRef.current = {
			pointerId: event.pointerId,
			startPosition: mobileEditorLayout ? event.clientY : event.clientX,
			startSize: mobileEditorLayout ? mobileUtilityHeight : desktopUtilityWidth,
		};
	}

	function handleUtilityResizeMove(event: React.PointerEvent<HTMLDivElement>): void {
		const resize = utilityResizeRef.current;
		if (!resize || resize.pointerId !== event.pointerId) return;
		const position = mobileEditorLayout ? event.clientY : event.clientX;
		resizeUtility(resize.startSize + resize.startPosition - position);
	}

	function handleUtilityResizeEnd(event: React.PointerEvent<HTMLDivElement>): void {
		if (utilityResizeRef.current?.pointerId !== event.pointerId) return;
		utilityResizeRef.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	}

	function handleUtilityResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
		const increment = 24;
		const currentSize = mobileEditorLayout ? mobileUtilityHeight : desktopUtilityWidth;
		const delta = mobileEditorLayout
			? event.key === "ArrowUp"
				? increment
				: event.key === "ArrowDown"
					? -increment
					: 0
			: event.key === "ArrowLeft"
				? increment
				: event.key === "ArrowRight"
					? -increment
					: 0;
		if (!delta) return;
		event.preventDefault();
		resizeUtility(currentSize + delta);
	}

	useWorldAutosaveRegistration({
		ready: worldIsLoaded,
		world: editorWorld,
		worldId: persistedWorldId,
		worldName,
		revision: persistedWorldRevision,
		onPersisted: handleWorldPersisted,
		onReset: handleResetWorld,
	});

	const rooms = editorWorld.rooms;
	const connections = editorWorld.connections;

	const selectedRoom = useMemo(() => {
		if (selection.isConnectionSelected) return null;

		return rooms.find((room) => idValue(room.id) === selection.selectedId) ?? null;
	}, [rooms, selection]);

	const selectedConnection = useMemo(() => {
		if (!selection.isConnectionSelected) return null;

		return connections.find((connection) => idValue(connection.id) === selection.selectedId) ?? null;
	}, [connections, selection]);
	const selectedItem = useMemo(
		() => editorWorld.items.find((item) => idValue(item.id) === selectedItemId) ?? null,
		[editorWorld.items, selectedItemId],
	);
	const selectedCommand = useMemo(
		() => editorWorld.commands.find((command) => idValue(command.id) === selectedCommandId) ?? null,
		[editorWorld.commands, selectedCommandId],
	);
	useCommandCopyRegistration(
		activeTab === "logic" && logicSection === "commands" ? selectedCommand : null,
	);

	return (
		<main className="editorPage">
			<LeftSideBar activeTab={activeTab} onTabChange={handleTabChange} />

			<div className="editorPageBody">
				<EditorMainPanel
					isLoading={!worldIsLoaded}
					activeTab={activeTab}
					world={editorWorld}
					rooms={rooms}
					updateWorld={updateWorld}
					selection={selection}
					setSelection={(nextSelection) => {
						beginEditorNavigation();
						setSelection(nextSelection);
					}}
					isAddingRoom={isAddingRoom}
					onAddingRoomChange={setIsAddingRoom}
					mapZoom={mapZoom}
					setMapZoom={setMapZoom}
					mapRecenterRequest={mapRecenterRequest}
					connectionDraft={connectionDraft}
					setConnectionDraft={setConnectionDraft}
					logicSection={logicSection}
					setLogicSection={(section) => {
						beginEditorNavigation();
						setLogicSection(section);
					}}
					selectedEventId={selectedEventId}
					setSelectedEventId={(eventId) => {
						beginEditorNavigation();
						setSelectedEventId(eventId);
					}}
					logicSelection={logicSelection}
					setLogicSelection={setLogicSelection}
					selectedCommandId={selectedCommandId}
					setSelectedCommandId={(commandId) => {
						beginEditorNavigation();
						setSelectedCommandId(commandId);
					}}
					commandSelection={commandSelection}
					setCommandSelection={setCommandSelection}
					selectedItemId={selectedItemId}
					setSelectedItemId={(itemId) => {
						beginEditorNavigation();
						setSelectedItemId(itemId);
					}}
					editorContextNotice={editorContextNotice}
					onDismissEditorContextNotice={() => setEditorContextNotice(null)}
					onEditorContextRecovery={(message) => {
						replaceEditorContext();
						setEditorContextNotice(message);
					}}
					persistedWorldId={persistedWorldId}
					persistedWorldRevision={persistedWorldRevision}
					worldName={worldName}
					onMapRecenter={() => {
						setMapZoom(1);
						setMapRecenterRequest((request) => request + 1);
					}}
				/>

				<aside
					className={`editorUtilityPanel editorUtilityPanel--${utilityView} ${utilityCollapsed ? "editorUtilityPanel--collapsed" : ""}`}
					aria-label="Editor utility panel"
					style={
						{
							"--editor-utility-height": `${mobileUtilityHeight}px`,
							"--editor-utility-width": `${desktopUtilityWidth}px`,
						} as React.CSSProperties
					}
				>
					{!utilityCollapsed ? (
						<div
							className="editorUtilityResizeHandle"
							role="separator"
							aria-label="Resize editor utility panel"
							aria-orientation={mobileEditorLayout ? "horizontal" : "vertical"}
							aria-valuemin={mobileEditorLayout ? 140 : 310}
							aria-valuemax={mobileEditorLayout ? Math.round(window.innerHeight * 0.72) : 640}
							aria-valuenow={mobileEditorLayout ? mobileUtilityHeight : desktopUtilityWidth}
							tabIndex={0}
							onKeyDown={handleUtilityResizeKeyDown}
							onPointerDown={handleUtilityResizeStart}
							onPointerMove={handleUtilityResizeMove}
							onPointerUp={handleUtilityResizeEnd}
							onPointerCancel={handleUtilityResizeEnd}
						/>
					) : null}
					<div className="editorUtilityTabBar">
						<div className="editorUtilityTabs" role="tablist" aria-label="Editor utility view">
							<button
								type="button"
								role="tab"
								id="editor-utility-editor-tab"
								aria-controls="editor-utility-editor-panel"
								aria-selected={utilityView === "editor"}
								aria-expanded={utilityView === "editor" && !utilityCollapsed}
								onClick={() => activateUtilityView("editor")}
							>
								Editor
							</button>
							<button
								type="button"
								role="tab"
								id="editor-utility-play-tab"
								aria-controls="editor-utility-play-panel"
								aria-selected={utilityView === "play"}
								aria-expanded={utilityView === "play" && !utilityCollapsed}
								onClick={() => activateUtilityView("play")}
							>
								Play
							</button>
						</div>
						{!utilityCollapsed ? (
							<button
								type="button"
								className="editorUtilityCollapse"
								aria-label="Collapse editor utility panel"
								onClick={() => setUtilityCollapsed(true)}
							>
								<X size={15} aria-hidden="true" />
							</button>
						) : null}
					</div>

					<div
						ref={editorUtilityContentRef}
						className="editorUtilityContent"
						role="tabpanel"
						id="editor-utility-editor-panel"
						aria-labelledby="editor-utility-editor-tab"
						hidden={utilityCollapsed || utilityView !== "editor"}
					>
						<EditorInspector
							activeTab={activeTab}
							world={editorWorld}
							selectedRoom={selectedRoom}
							selectedConnection={selectedConnection}
							updateWorld={updateWorld}
							onSelectedIdChange={(selectedId) => {
								replaceEditorContext();
								setSelection((current) => ({...current, selectedId}));
							}}
							onOpenItem={(itemId) => {
								beginEditorNavigation();
								setSelectedItemId(itemId);
								setActiveTab("world");
							}}
							logicSection={logicSection}
							logicSelection={logicSelection}
							selectedCommandId={selectedCommandId}
							setSelectedCommandId={(commandId) => {
								beginEditorNavigation();
								setSelectedCommandId(commandId);
							}}
							commandSelection={commandSelection}
							setCommandSelection={setCommandSelection}
							selectedItem={selectedItem}
							setSelectedItemId={(itemId) => {
								replaceEditorContext();
								setSelectedItemId(itemId);
							}}
							onSelectionDeleted={(entity) => {
								replaceEditorContext();
								if (entity === "room") {
									setSelection({selectedId: null, isConnectionSelected: false});
									setEditorContextNotice("The room was deleted. Showing the map without a selection.");
								}
								if (entity === "connection") {
									setSelection({selectedId: null, isConnectionSelected: false});
									setEditorContextNotice("The connection was deleted. Showing the map without a selection.");
								}
								if (entity === "item") {
									setSelectedItemId(null);
									setEditorContextNotice("The item was deleted. Choose another item to continue.");
								}
							}}
						/>
					</div>

					<div
						className="editorUtilityContent editorUtilityPlay"
						role="tabpanel"
						id="editor-utility-play-panel"
						aria-labelledby="editor-utility-play-tab"
						hidden={utilityCollapsed || utilityView !== "play"}
					>
						<CommandLine contained isLoading={!worldIsLoaded} world={editorWorld} />
					</div>
				</aside>
			</div>
		</main>
	);
}

type EditorMainPanelProps = {
	isLoading: boolean;
	activeTab: EditorTab;
	world: World;
	rooms: Room[];
	updateWorld: UpdateWorld;
	selection: EditorSelection;
	setSelection: React.Dispatch<React.SetStateAction<EditorSelection>>;
	isAddingRoom: boolean;
	onAddingRoomChange: (isAddingRoom: boolean) => void;
	mapZoom: number;
	setMapZoom: (zoom: number) => void;
	mapRecenterRequest: number;
	onMapRecenter: () => void;
	connectionDraft: ConnectionDraft;
	setConnectionDraft: React.Dispatch<React.SetStateAction<ConnectionDraft>>;
	logicSection: LogicSection;
	setLogicSection: (section: LogicSection) => void;
	selectedEventId: string | null;
	setSelectedEventId: (eventId: string | null) => void;
	logicSelection: LogicSelection | null;
	setLogicSelection: (selection: LogicSelection | null) => void;
	selectedCommandId: string | null;
	setSelectedCommandId: (commandId: string | null) => void;
	commandSelection: CommandSelection | null;
	setCommandSelection: (selection: CommandSelection | null) => void;
	selectedItemId: string | null;
	setSelectedItemId: (itemId: string | null) => void;
	editorContextNotice: string | null;
	onDismissEditorContextNotice: () => void;
	onEditorContextRecovery: (message: string) => void;
	persistedWorldId: string | null;
	persistedWorldRevision: number | null;
	worldName: string;
};

function EditorMainPanel({
	isLoading,
	activeTab,
	world,
	rooms,
	updateWorld,
	selection,
	setSelection,
	isAddingRoom,
	onAddingRoomChange,
	mapZoom,
	setMapZoom,
	mapRecenterRequest,
	onMapRecenter,
	connectionDraft,
	setConnectionDraft,
	logicSection,
	setLogicSection,
	selectedEventId,
	setSelectedEventId,
	logicSelection,
	setLogicSelection,
	selectedCommandId,
	setSelectedCommandId,
	commandSelection,
	setCommandSelection,
	selectedItemId,
	setSelectedItemId,
	editorContextNotice,
	onDismissEditorContextNotice,
	onEditorContextRecovery,
	persistedWorldId,
	persistedWorldRevision,
	worldName,
}: EditorMainPanelProps) {
	const {hoverStatus, noticeStatus, updateStatus} = useToolBarStatus();

	return (
		<section className="editorMainPanel">
			<div className="editorMapArea">
				<EditorToolbar
					activeTab={activeTab}
					rooms={isLoading ? [] : rooms}
					isAddingRoom={isAddingRoom}
					onAddingRoomChange={onAddingRoomChange}
					mapZoom={mapZoom}
					onMapRecenter={onMapRecenter}
					connectionDraft={connectionDraft}
					hoverStatus={hoverStatus}
					noticeStatus={noticeStatus}
					world={world}
					updateWorld={updateWorld}
					logicSection={logicSection}
					selectedEventId={selectedEventId}
					selectedCommandId={selectedCommandId}
					onLogicBack={() => {
						setLogicSection("home");
						setLogicSelection(null);
						setCommandSelection(null);
					}}
					onCommandBack={() => {
						if (selectedCommandId) {
							setSelectedCommandId(null);
							setCommandSelection(null);
						} else {
							setLogicSection("home");
						}
					}}
					onCommandSettings={() => {
						if (selectedCommandId) {
							setCommandSelection({kind: "command", commandId: selectedCommandId});
						}
					}}
					onDeleteEvent={() => {
						if (!selectedEventId) return;
						const events = world.events ?? [];
						const index = events.findIndex((event) => idValue(event.id) === selectedEventId);
						const nextEvent = events[index + 1] ?? events[index - 1] ?? null;
						updateWorld((draft) => {
							const target = draft.events?.findIndex((event) => idValue(event.id) === selectedEventId);
							if (target != null && target >= 0) draft.events?.splice(target, 1);
						});
						setSelectedEventId(nextEvent ? idValue(nextEvent.id) : null);
						setLogicSelection(nextEvent ? {kind: "event", eventId: idValue(nextEvent.id)} : null);
						onEditorContextRecovery(
							"The event was deleted. " +
								(nextEvent ? "The next available event is open." : "Choose another event to continue."),
						);
					}}
					onDeleteCommand={() => {
						if (!selectedCommandId) return;
						const index = world.commands.findIndex(
							(command) => idValue(command.id) === selectedCommandId,
						);
						const nextCommand = world.commands[index + 1] ?? world.commands[index - 1] ?? null;
						updateWorld((draft) => {
							const target = draft.commands.findIndex(
								(command) => idValue(command.id) === selectedCommandId,
							);
							if (target >= 0) draft.commands.splice(target, 1);
						});
						setSelectedCommandId(nextCommand ? idValue(nextCommand.id) : null);
						setCommandSelection(
							nextCommand ? {kind: "command", commandId: idValue(nextCommand.id)} : null,
						);
						onEditorContextRecovery(
							"The command was deleted. " +
								(nextCommand
									? "The next available command is open."
									: "Showing the command library instead."),
						);
					}}
				/>
				{editorContextNotice ? (
					<div className="editorContextNotice" role="status">
						<span>{editorContextNotice}</span>
						<button
							type="button"
							aria-label="Dismiss editor notice"
							onClick={onDismissEditorContextNotice}
						>
							<X size={15} aria-hidden="true" />
						</button>
					</div>
				) : null}

				<div className="editorWorkspaceShell">
					<EditorWorkspace
						isLoading={isLoading}
						activeTab={activeTab}
						world={world}
						updateWorld={updateWorld}
						selection={selection}
						setSelection={setSelection}
						isAddingRoom={isAddingRoom}
						onAddingRoomChange={onAddingRoomChange}
						onZoomChange={setMapZoom}
						recenterRequest={mapRecenterRequest}
						connectionDraft={connectionDraft}
						setConnectionDraft={setConnectionDraft}
						updateStatus={updateStatus}
						logicSection={logicSection}
						setLogicSection={setLogicSection}
						selectedEventId={selectedEventId}
						setSelectedEventId={setSelectedEventId}
						logicSelection={logicSelection}
						setLogicSelection={setLogicSelection}
						selectedCommandId={selectedCommandId}
						setSelectedCommandId={setSelectedCommandId}
						commandSelection={commandSelection}
						setCommandSelection={setCommandSelection}
						selectedItemId={selectedItemId}
						setSelectedItemId={setSelectedItemId}
						persistedWorldId={persistedWorldId}
						persistedWorldRevision={persistedWorldRevision}
						worldName={worldName}
					/>
				</div>
			</div>
		</section>
	);
}

type EditorToolbarProps = {
	activeTab: EditorTab;
	rooms: Room[];
	isAddingRoom: boolean;
	onAddingRoomChange: (isAddingRoom: boolean) => void;
	mapZoom: number;
	onMapRecenter: () => void;
	connectionDraft: ConnectionDraft;
	hoverStatus: ToolBarStatus | null;
	noticeStatus: ToolBarStatus | null;
	world: World;
	updateWorld: UpdateWorld;
	logicSection: LogicSection;
	selectedEventId: string | null;
	selectedCommandId: string | null;
	onLogicBack: () => void;
	onCommandBack: () => void;
	onCommandSettings: () => void;
	onDeleteEvent: () => void;
	onDeleteCommand: () => void;
};

function EditorToolbar({
	activeTab,
	rooms,
	isAddingRoom,
	onAddingRoomChange,
	mapZoom,
	onMapRecenter,
	connectionDraft,
	hoverStatus,
	noticeStatus,
	world,
	updateWorld,
	logicSection,
	selectedEventId,
	selectedCommandId,
	onLogicBack,
	onCommandBack,
	onCommandSettings,
	onDeleteEvent,
	onDeleteCommand,
}: EditorToolbarProps) {
	if (activeTab === "map") {
		return (
			<ToolBar
				isAddingRoom={isAddingRoom}
				onAddingRoomChange={onAddingRoomChange}
				addRoomDisabled={connectionDraft.state === "choosing-return"}
				zoom={mapZoom}
				onRecenter={onMapRecenter}
				status={getConnectionDraftStatus(
					connectionDraft,
					rooms,
					hoverStatus,
					noticeStatus,
					isAddingRoom,
				)}
			/>
		);
	}

	if (activeTab === "logic" && logicSection === "events") {
		const event =
			(world.events ?? []).find((candidate) => idValue(candidate.id) === selectedEventId) ??
			(world.events ?? [])[0] ??
			null;
		return (
			<EventToolbar
				event={event}
				updateWorld={updateWorld}
				onBack={onLogicBack}
				onDelete={onDeleteEvent}
			/>
		);
	}
	if (activeTab === "logic" && logicSection === "commands") {
		const command =
			world.commands.find((candidate) => idValue(candidate.id) === selectedCommandId) ?? null;
		return (
			<CommandToolbar
				command={command}
				updateWorld={updateWorld}
				onBack={onCommandBack}
				onDelete={onDeleteCommand}
				onOpenSettings={onCommandSettings}
			/>
		);
	}

	const metadata = getEditorTabMetadata(activeTab);

	return (
		<div className="editorToolbar">
			<div>
				<p className="editorToolbarTitle">{metadata.title}</p>
				<p className="editorToolbarDescription">{metadata.description}</p>
			</div>
		</div>
	);
}

type EditorWorkspaceProps = {
	isLoading: boolean;
	activeTab: EditorTab;
	world: World;
	updateWorld: UpdateWorld;
	selection: EditorSelection;
	setSelection: React.Dispatch<React.SetStateAction<EditorSelection>>;
	isAddingRoom: boolean;
	onAddingRoomChange: (isAddingRoom: boolean) => void;
	onZoomChange: (zoom: number) => void;
	recenterRequest: number;
	connectionDraft: ConnectionDraft;
	setConnectionDraft: React.Dispatch<React.SetStateAction<ConnectionDraft>>;
	updateStatus: UpdateStatus;
	logicSection: LogicSection;
	setLogicSection: (section: LogicSection) => void;
	selectedEventId: string | null;
	setSelectedEventId: (eventId: string | null) => void;
	logicSelection: LogicSelection | null;
	setLogicSelection: (selection: LogicSelection | null) => void;
	selectedCommandId: string | null;
	setSelectedCommandId: (commandId: string | null) => void;
	commandSelection: CommandSelection | null;
	setCommandSelection: (selection: CommandSelection | null) => void;
	selectedItemId: string | null;
	setSelectedItemId: (itemId: string | null) => void;
	persistedWorldId: string | null;
	persistedWorldRevision: number | null;
	worldName: string;
};

function EditorWorkspace({
	isLoading,
	activeTab,
	world,
	updateWorld,
	selection,
	setSelection,
	isAddingRoom,
	onAddingRoomChange,
	onZoomChange,
	recenterRequest,
	connectionDraft,
	setConnectionDraft,
	updateStatus,
	logicSection,
	setLogicSection,
	selectedEventId,
	setSelectedEventId,
	logicSelection,
	setLogicSelection,
	selectedCommandId,
	setSelectedCommandId,
	commandSelection,
	setCommandSelection,
	selectedItemId,
	setSelectedItemId,
	persistedWorldId,
	persistedWorldRevision,
	worldName,
}: EditorWorkspaceProps) {
	if (activeTab === "map") {
		return (
			<MapWorkspace
				isLoading={isLoading}
				world={world}
				updateWorld={updateWorld}
				selection={selection}
				setSelection={setSelection}
				isAddingRoom={isAddingRoom}
				onAddingRoomChange={onAddingRoomChange}
				onZoomChange={onZoomChange}
				recenterRequest={recenterRequest}
				connectionDraft={connectionDraft}
				setConnectionDraft={setConnectionDraft}
				updateStatus={updateStatus}
			/>
		);
	}

	if (activeTab === "logic") {
		if (logicSection === "home") {
			return (
				<LogicHome
					onOpen={(section) => {
						setLogicSection(section);
						if (section === "events") {
							const event = (world.events ?? [])[0];
							const eventId = event ? idValue(event.id) : null;
							setSelectedEventId(eventId);
							setLogicSelection(eventId ? {kind: "event", eventId} : null);
						}
						if (section === "commands") {
							setSelectedCommandId(null);
							setCommandSelection(null);
						}
					}}
				/>
			);
		}
		if (logicSection === "events") {
			return (
				<EventEditor
					world={world}
					updateWorld={updateWorld}
					selectedEventId={selectedEventId}
					onSelectedEventIdChange={setSelectedEventId}
					selection={logicSelection}
					onSelectionChange={setLogicSelection}
				/>
			);
		}
		if (logicSection === "commands") {
			if (!selectedCommandId) {
				return (
					<CommandLibrary
						world={world}
						updateWorld={updateWorld}
						onPreviewCommand={(commandId) => setCommandSelection({kind: "command", commandId})}
						onOpenCommand={(commandId) => {
							setSelectedCommandId(commandId);
							setCommandSelection({kind: "command", commandId});
						}}
					/>
				);
			}
			return (
				<CommandEditor
					world={world}
					updateWorld={updateWorld}
					selectedCommandId={selectedCommandId}
					onSelectedCommandIdChange={setSelectedCommandId}
					selection={commandSelection}
					onSelectionChange={setCommandSelection}
				/>
			);
		}
		const title = {
			conditions: "Build Complex Conditions",
			effects: "Build Complex Effects",
		}[logicSection];
		return <LogicSectionPlaceholder title={title} onBack={() => setLogicSection("home")} />;
	}

	if (activeTab === "world") {
		return (
			<ItemCatalog
				world={world}
				updateWorld={updateWorld}
				selectedItemId={selectedItemId}
				onSelectItem={setSelectedItemId}
			/>
		);
	}

	return (
		<PlaceholderWorkspace
			activeTab={activeTab}
			worldId={persistedWorldId}
			worldName={worldName}
			revision={persistedWorldRevision}
		/>
	);
}

type MapWorkspaceProps = {
	isLoading: boolean;
	world: World;
	updateWorld: UpdateWorld;
	selection: EditorSelection;
	setSelection: React.Dispatch<React.SetStateAction<EditorSelection>>;
	isAddingRoom: boolean;
	onAddingRoomChange: (isAddingRoom: boolean) => void;
	onZoomChange: (zoom: number) => void;
	recenterRequest: number;
	connectionDraft: ConnectionDraft;
	setConnectionDraft: React.Dispatch<React.SetStateAction<ConnectionDraft>>;
	updateStatus: UpdateStatus;
};

function MapWorkspace({
	isLoading,
	world,
	updateWorld,
	selection,
	setSelection,
	isAddingRoom,
	onAddingRoomChange,
	onZoomChange,
	recenterRequest,
	connectionDraft,
	setConnectionDraft,
	updateStatus,
}: MapWorkspaceProps) {
	return (
		<Map
			key={isLoading ? "loading" : "loaded"}
			world={world}
			isLoading={isLoading}
			isAddingRoom={isAddingRoom}
			onAddingRoomChange={onAddingRoomChange}
			onZoomChange={onZoomChange}
			updateWorld={updateWorld}
			selectedId={selection.selectedId}
			setSelectedId={(selectedId) =>
				setSelection((currentSelection) => ({
					...currentSelection,
					selectedId:
						typeof selectedId === "function" ? selectedId(currentSelection.selectedId) : selectedId,
				}))
			}
			isConnectionSelected={selection.isConnectionSelected}
			setIsConnectionSelected={(isConnectionSelected) =>
				setSelection((currentSelection) => ({
					...currentSelection,
					isConnectionSelected:
						typeof isConnectionSelected === "function"
							? isConnectionSelected(currentSelection.isConnectionSelected)
							: isConnectionSelected,
				}))
			}
			connectionDraft={connectionDraft}
			setConnectionDraft={setConnectionDraft}
			updateStatus={updateStatus}
			recenterRequest={recenterRequest}
		/>
	);
}

type PlaceholderWorkspaceProps = {
	activeTab: EditorTab;
	worldId: string | null;
	worldName: string;
	revision: number | null;
};

function PlaceholderWorkspace({
	activeTab,
	worldId,
	worldName,
	revision,
}: PlaceholderWorkspaceProps) {
	const metadata = getEditorTabMetadata(activeTab);
	const isWorldSettings = activeTab === "world-settings";

	return (
		<div className="placeholderWorkspace">
			<div className="placeholderWorkspaceCard">
				<p className="placeholderWorkspaceTitle">{metadata.title}</p>

				<p className="placeholderWorkspaceDescription">
					{isWorldSettings
						? "Reset replaces every room, item, connection, command, condition, effect, event, and metadata field with the bundled starter world. Your private world identity stays the same."
						: `This area will become the ${metadata.title.toLowerCase()} editor. The sidebars and command line stay pinned while this workspace swaps out.`}
				</p>

				{isWorldSettings ? (
					<>
						<WorldResetButton />
						<PublishingPanel worldId={worldId} worldName={worldName} revision={revision} />
					</>
				) : null}
			</div>
		</div>
	);
}

type EditorInspectorProps = {
	activeTab: EditorTab;
	world: World;
	selectedRoom: Room | null;
	selectedConnection: World["connections"][number] | null;
	updateWorld: UpdateWorld;
	onSelectedIdChange: (selectedId: string) => void;
	onOpenItem: (itemId: string) => void;
	logicSection: LogicSection;
	logicSelection: LogicSelection | null;
	selectedCommandId: string | null;
	setSelectedCommandId: (commandId: string | null) => void;
	commandSelection: CommandSelection | null;
	setCommandSelection: (selection: CommandSelection | null) => void;
	selectedItem: World["items"][number] | null;
	setSelectedItemId: (itemId: string | null) => void;
	onSelectionDeleted: (entity: "room" | "connection" | "item") => void;
};

function EditorInspector({
	activeTab,
	world,
	selectedRoom,
	selectedConnection,
	updateWorld,
	onSelectedIdChange,
	onOpenItem,
	logicSection,
	logicSelection,
	selectedCommandId,
	setSelectedCommandId,
	commandSelection,
	setCommandSelection,
	selectedItem,
	setSelectedItemId,
	onSelectionDeleted,
}: EditorInspectorProps) {
	if (activeTab === "map") {
		return (
			<RightSideBar
				contained
				world={world}
				updateWorld={updateWorld}
				selectedRoom={selectedRoom}
				selectedConnection={selectedConnection}
				onSelectedIdChange={onSelectedIdChange}
				onOpenItem={onOpenItem}
				onSelectionDeleted={() => onSelectionDeleted("room")}
				onConnectionDeleted={() => onSelectionDeleted("connection")}
			/>
		);
	}

	if (activeTab === "logic" && logicSection === "events") {
		return (
			<RightSideBar
				contained
				world={world}
				updateWorld={updateWorld}
				selectedRoom={null}
				selectedConnection={null}
				onSelectedIdChange={onSelectedIdChange}
			>
				<EventInspector world={world} updateWorld={updateWorld} selection={logicSelection} />
			</RightSideBar>
		);
	}
	if (activeTab === "logic" && logicSection === "commands") {
		if (!selectedCommandId) {
			const previewedCommandId =
				commandSelection?.kind === "command" ? commandSelection.commandId : null;
			const previewedCommand =
				world.commands.find((command) => idValue(command.id) === previewedCommandId) ??
				world.commands[0] ??
				null;
			return (
				<RightSideBar
					contained
					world={world}
					updateWorld={updateWorld}
					selectedRoom={null}
					selectedConnection={null}
					onSelectedIdChange={onSelectedIdChange}
				>
					<CommandLibraryPreview
						command={previewedCommand}
						onOpenCommand={(commandId) => {
							setSelectedCommandId(commandId);
							setCommandSelection({kind: "command", commandId});
						}}
					/>
				</RightSideBar>
			);
		}
		if (!commandSelection) {
			return (
				<RightSideBar
					contained
					world={world}
					updateWorld={updateWorld}
					selectedRoom={null}
					selectedConnection={null}
					onSelectedIdChange={onSelectedIdChange}
					title="Commands"
					description="Choose a command to edit its patterns and behavior."
				/>
			);
		}
		return (
			<RightSideBar
				contained
				world={world}
				updateWorld={updateWorld}
				selectedRoom={null}
				selectedConnection={null}
				onSelectedIdChange={onSelectedIdChange}
			>
				<CommandInspector
					world={world}
					updateWorld={updateWorld}
					selection={commandSelection}
					onSelectionChange={setCommandSelection}
				/>
			</RightSideBar>
		);
	}

	if (activeTab === "world") {
		return (
			<RightSideBar
				contained
				world={world}
				updateWorld={updateWorld}
				selectedRoom={null}
				selectedConnection={null}
			>
				{selectedItem ? (
					<ItemEditor
						selectedItem={selectedItem}
						world={world}
						updateWorld={updateWorld}
						onSelectedIdChange={setSelectedItemId}
						onDelete={() => onSelectionDeleted("item")}
					/>
				) : (
					<div className="rightSideBarEmptyPanel">
						<p className="rightSideBarEmptyTitle">Items</p>
						<p className="rightSideBarEmptyDescription">
							Select an item to edit its identity, behavior, and start state.
						</p>
					</div>
				)}
			</RightSideBar>
		);
	}

	const metadata = getEditorTabMetadata(activeTab);

	return (
		<RightSideBar
			contained
			world={world}
			updateWorld={updateWorld}
			selectedRoom={null}
			selectedConnection={null}
			onSelectedIdChange={onSelectedIdChange}
			title={metadata.title}
			description={metadata.description}
		/>
	);
}

function getEditorTabMetadata(tab: EditorTab) {
	return EDITOR_TAB_METADATA[tab];
}
