"use client";

import type React from "react";
import {useCallback, useEffect, useMemo, useState} from "react";
import {produce} from "immer";
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
import {Map, type ConnectionDraft, type MapTool} from "@/components/map/Map";
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
import {useWorldAutosaveRegistration} from "@/components/world-autosave/WorldAutosave";
import {
	draftMatchesServer,
	readMainWorldDraft,
} from "@/components/world-autosave/worldDraftStorage";
import {createInitialWorld, world as initialWorld} from "@/data/worlds/initialWorld";
import type {Room, World} from "@/schemas/world/worldSchema";
import type {UpdateWorld, WorldUpdate} from "@/types/worldUpdaterTypes";
import {idValue} from "@/utils/idUtils";
import {getConnectionDraftStatus} from "./utils/editorPageUtils";
import {loadMainWorld} from "./loadMainWorld";
import "./page.scss";

type EditorSelection = {
	selectedId: string | null;
	isConnectionSelected: boolean;
};

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
		title: "World Config",
		description: "Configure project-level world settings.",
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

async function loadEditorWorld(signal: AbortSignal) {
	const draftPromise = readMainWorldDraft().catch((error: unknown) => {
		console.warn("Could not read the local world draft.", error);
		return null;
	});

	try {
		const serverWorld = await loadMainWorld(fetch, signal);
		const draft = await draftPromise;

		if (draft && draftMatchesServer(draft, serverWorld)) {
			return {
				world: draft.world,
				worldId: draft.worldId,
				revision: draft.baseServerRevision,
				restoredFromLocalDraft: true,
			};
		}

		return {...serverWorld, restoredFromLocalDraft: false};
	} catch (error) {
		const draft = await draftPromise;
		if (draft) {
			return {
				world: draft.world,
				worldId: draft.worldId,
				revision: draft.baseServerRevision,
				restoredFromLocalDraft: true,
			};
		}
		throw error;
	}
}

export default function EditorPage() {
	const [activeTab, setActiveTab] = useState<EditorTab>("map");
	const [mapTool, setMapTool] = useState<MapTool>("edit");
	const [mapZoom, setMapZoom] = useState(1);
	const [mapRecenterRequest, setMapRecenterRequest] = useState(0);
	const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>({state: "idle"});
	const [logicSection, setLogicSection] = useState<LogicSection>("home");
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
	const [logicSelection, setLogicSelection] = useState<LogicSelection | null>(null);
	const [selectedCommandId, setSelectedCommandId] = useState<string | null>(null);
	const [commandSelection, setCommandSelection] = useState<CommandSelection | null>(null);
	const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

	const [editorWorld, setEditorWorld] = useState<World>(initialWorld);
	const [persistedWorldId, setPersistedWorldId] = useState<string | null>(null);
	const [persistedWorldRevision, setPersistedWorldRevision] = useState<number | null>(null);
	const [restoredFromLocalDraft, setRestoredFromLocalDraft] = useState(false);
	const [worldIsLoaded, setWorldIsLoaded] = useState(false);

	const [selection, setSelection] = useState<EditorSelection>({
		selectedId: null,
		isConnectionSelected: false,
	});

	const updateWorld = useCallback<UpdateWorld>((update: WorldUpdate) => {
		setEditorWorld((world) => (typeof update === "function" ? produce(world, update) : update));
	}, []);

	useEffect(() => {
		const abortController = new AbortController();

		loadEditorWorld(abortController.signal)
			.then(({world, worldId, revision, restoredFromLocalDraft: restored}) => {
				updateWorld(world);
				setPersistedWorldId(worldId);
				setPersistedWorldRevision(revision);
				setRestoredFromLocalDraft(restored);
				setSelection({
					selectedId: idValue(world.startRoomId),
					isConnectionSelected: false,
				});
				setConnectionDraft({state: "idle"});
				setWorldIsLoaded(true);
			})
			.catch((error: unknown) => {
				if ((error as {name?: string}).name === "AbortError") return;

				console.warn("Could not load the main world; using the initial world instead.", error);
				const fallbackWorld = createInitialWorld();
				updateWorld(fallbackWorld);
				setPersistedWorldId(null);
				setPersistedWorldRevision(null);
				setRestoredFromLocalDraft(false);
				setSelection({
					selectedId: idValue(fallbackWorld.startRoomId),
					isConnectionSelected: false,
				});
				setConnectionDraft({state: "idle"});
				setWorldIsLoaded(true);
			});

		return () => abortController.abort();
	}, [updateWorld]);

	const handleWorldPersisted = useCallback((worldId: string, revision: number) => {
		setPersistedWorldId(worldId);
		setPersistedWorldRevision(revision);
		setRestoredFromLocalDraft(false);
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

	const handleTabChange = useCallback((tab: EditorTab) => {
		setActiveTab(tab);
		if (tab !== "logic") return;

		setLogicSection("home");
		setSelectedEventId(null);
		setLogicSelection(null);
		setSelectedCommandId(null);
		setCommandSelection(null);
	}, []);

	useWorldAutosaveRegistration({
		ready: worldIsLoaded,
		world: editorWorld,
		worldId: persistedWorldId,
		revision: persistedWorldRevision,
		restoredFromLocalDraft,
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

			<EditorMainPanel
				isLoading={!worldIsLoaded}
				activeTab={activeTab}
				world={editorWorld}
				rooms={rooms}
				updateWorld={updateWorld}
				selection={selection}
				setSelection={setSelection}
				selectedRoom={selectedRoom}
				mapTool={mapTool}
				setMapTool={setMapTool}
				mapZoom={mapZoom}
				setMapZoom={setMapZoom}
				mapRecenterRequest={mapRecenterRequest}
				connectionDraft={connectionDraft}
				setConnectionDraft={setConnectionDraft}
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
				onMapRecenter={() => {
					setMapZoom(1);
					setMapRecenterRequest((request) => request + 1);
				}}
			/>

			<EditorInspector
				activeTab={activeTab}
				world={editorWorld}
				selectedRoom={selectedRoom}
				selectedConnection={selectedConnection}
				updateWorld={updateWorld}
				onSelectedIdChange={(selectedId) => setSelection((current) => ({...current, selectedId}))}
				onOpenItem={(itemId) => {
					setSelectedItemId(itemId);
					setActiveTab("world");
				}}
				logicSection={logicSection}
				logicSelection={logicSelection}
				selectedCommandId={selectedCommandId}
				setSelectedCommandId={setSelectedCommandId}
				commandSelection={commandSelection}
				setCommandSelection={setCommandSelection}
				selectedItem={selectedItem}
				setSelectedItemId={setSelectedItemId}
			/>
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
	selectedRoom: Room | null;
	mapTool: MapTool;
	setMapTool: (tool: MapTool) => void;
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
};

function EditorMainPanel({
	isLoading,
	activeTab,
	world,
	rooms,
	updateWorld,
	selection,
	setSelection,
	selectedRoom,
	mapTool,
	setMapTool,
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
}: EditorMainPanelProps) {
	const {hoverStatus, noticeStatus, updateStatus} = useToolBarStatus();
	const [temporaryMapTool, setTemporaryMapTool] = useState<MapTool | null>(null);

	return (
		<section className="editorMainPanel">
			<div className="editorMapArea">
				<EditorToolbar
					activeTab={activeTab}
					rooms={isLoading ? [] : rooms}
					mapTool={temporaryMapTool ?? mapTool}
					setMapTool={setMapTool}
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
					}}
				/>

				<div className="editorWorkspaceShell">
					<EditorWorkspace
						isLoading={isLoading}
						activeTab={activeTab}
						world={world}
						updateWorld={updateWorld}
						selection={selection}
						setSelection={setSelection}
						mapTool={mapTool}
						setMapTool={setMapTool}
						onTemporaryToolChange={setTemporaryMapTool}
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
					/>
				</div>
			</div>

			<CommandLine
				isLoading={isLoading}
				world={world}
				selectedRoomId={selectedRoom ? idValue(selectedRoom.id) : null}
			/>
		</section>
	);
}

type EditorToolbarProps = {
	activeTab: EditorTab;
	rooms: Room[];
	mapTool: MapTool;
	setMapTool: (tool: MapTool) => void;
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
	mapTool,
	setMapTool,
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
				activeTool={mapTool}
				onToolChange={setMapTool}
				zoom={mapZoom}
				onRecenter={onMapRecenter}
				status={getConnectionDraftStatus(connectionDraft, rooms, hoverStatus, noticeStatus)}
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
	mapTool: MapTool;
	setMapTool: (tool: MapTool) => void;
	onTemporaryToolChange: (tool: MapTool | null) => void;
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
};

function EditorWorkspace({
	isLoading,
	activeTab,
	world,
	updateWorld,
	selection,
	setSelection,
	mapTool,
	setMapTool,
	onTemporaryToolChange,
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
}: EditorWorkspaceProps) {
	if (activeTab === "map") {
		return (
			<MapWorkspace
				isLoading={isLoading}
				world={world}
				updateWorld={updateWorld}
				selection={selection}
				setSelection={setSelection}
				mapTool={mapTool}
				setMapTool={setMapTool}
				onTemporaryToolChange={onTemporaryToolChange}
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

	return <PlaceholderWorkspace activeTab={activeTab} />;
}

type MapWorkspaceProps = {
	isLoading: boolean;
	world: World;
	updateWorld: UpdateWorld;
	selection: EditorSelection;
	setSelection: React.Dispatch<React.SetStateAction<EditorSelection>>;
	mapTool: MapTool;
	setMapTool: (tool: MapTool) => void;
	onTemporaryToolChange: (tool: MapTool | null) => void;
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
	mapTool,
	setMapTool,
	onTemporaryToolChange,
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
			tool={mapTool}
			onToolChange={setMapTool}
			onTemporaryToolChange={onTemporaryToolChange}
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
};

function PlaceholderWorkspace({activeTab}: PlaceholderWorkspaceProps) {
	const metadata = getEditorTabMetadata(activeTab);

	return (
		<div className="placeholderWorkspace">
			<div className="placeholderWorkspaceCard">
				<p className="placeholderWorkspaceTitle">{metadata.title}</p>

				<p className="placeholderWorkspaceDescription">
					This area will become the {metadata.title.toLowerCase()} editor. The sidebars and command line
					stay pinned while this workspace swaps out.
				</p>
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
}: EditorInspectorProps) {
	if (activeTab === "map") {
		return (
			<RightSideBar
				world={world}
				updateWorld={updateWorld}
				selectedRoom={selectedRoom}
				selectedConnection={selectedConnection}
				onSelectedIdChange={onSelectedIdChange}
				onOpenItem={onOpenItem}
			/>
		);
	}

	if (activeTab === "logic" && logicSection === "events") {
		return (
			<RightSideBar
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
