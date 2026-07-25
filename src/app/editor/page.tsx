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
import {CommandLine} from "@/components/player/CommandLine";
import {Map, type ConnectionDraft, type MapTool} from "@/components/map/Map";
import {
	LogicEditor,
	LogicHome,
	LogicSectionPlaceholder,
	LogicToolbar,
	type LogicSection,
	type LogicSelection,
} from "@/components/logic/LogicEditor";
import {LogicInspector} from "@/components/logic/LogicInspector";
import {useWorldAutosaveRegistration} from "@/components/world-autosave/WorldAutosave";
import {world as initialWorld} from "@/data/worlds/exampleWorld";
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
		title: "World",
		description: "Edit rooms, items, NPCs, and world structure.",
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

export default function EditorPage() {
	const [activeTab, setActiveTab] = useState<EditorTab>("map");
	const [mapTool, setMapTool] = useState<MapTool>("edit");
	const [mapZoom, setMapZoom] = useState(1);
	const [mapRecenterRequest, setMapRecenterRequest] = useState(0);
	const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>({state: "idle"});
	const [logicSection, setLogicSection] = useState<LogicSection>("home");
	const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
	const [logicSelection, setLogicSelection] = useState<LogicSelection | null>(null);

	const [editorWorld, setEditorWorld] = useState<World>(initialWorld);
	const [persistedWorldId, setPersistedWorldId] = useState<string | null>(null);
	const [persistedWorldRevision, setPersistedWorldRevision] = useState<number | null>(null);
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

		loadMainWorld(fetch, abortController.signal)
			.then(({world, worldId, revision}) => {
				updateWorld(world);
				setPersistedWorldId(worldId);
				setPersistedWorldRevision(revision);
				setSelection({
					selectedId: idValue(world.startRoomId),
					isConnectionSelected: false,
				});
				setConnectionDraft({state: "idle"});
				setWorldIsLoaded(true);
			})
			.catch((error: unknown) => {
				if ((error as {name?: string}).name !== "AbortError") {
					console.error("Could not load the main world", error);
				}
			});

		return () => abortController.abort();
	}, [updateWorld]);

	const handleWorldPersisted = useCallback((worldId: string, revision: number) => {
		setPersistedWorldId(worldId);
		setPersistedWorldRevision(revision);
	}, []);

	useWorldAutosaveRegistration({
		ready: worldIsLoaded,
		world: editorWorld,
		worldId: persistedWorldId,
		revision: persistedWorldRevision,
		onPersisted: handleWorldPersisted,
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

	return (
		<main className="editorPage">
			<LeftSideBar activeTab={activeTab} onTabChange={setActiveTab} />

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
				logicSection={logicSection}
				logicSelection={logicSelection}
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
					onLogicBack={() => {
						setLogicSection("home");
						setLogicSelection(null);
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
	onLogicBack: () => void;
	onDeleteEvent: () => void;
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
	onLogicBack,
	onDeleteEvent,
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
			<LogicToolbar
				event={event}
				updateWorld={updateWorld}
				onBack={onLogicBack}
				onDelete={onDeleteEvent}
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
						if (section !== "events") return;
						const event = (world.events ?? [])[0];
						const eventId = event ? idValue(event.id) : null;
						setSelectedEventId(eventId);
						setLogicSelection(eventId ? {kind: "event", eventId} : null);
					}}
				/>
			);
		}
		if (logicSection === "events") {
			return (
				<LogicEditor
					world={world}
					updateWorld={updateWorld}
					selectedEventId={selectedEventId}
					onSelectedEventIdChange={setSelectedEventId}
					selection={logicSelection}
					onSelectionChange={setLogicSelection}
				/>
			);
		}
		const title = {
			commands: "Commands",
			conditions: "Build Complex Conditions",
			effects: "Build Complex Effects",
		}[logicSection];
		return <LogicSectionPlaceholder title={title} onBack={() => setLogicSection("home")} />;
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
			theme="light"
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
	logicSection: LogicSection;
	logicSelection: LogicSelection | null;
};

function EditorInspector({
	activeTab,
	world,
	selectedRoom,
	selectedConnection,
	updateWorld,
	onSelectedIdChange,
	logicSection,
	logicSelection,
}: EditorInspectorProps) {
	if (activeTab === "map") {
		return (
			<RightSideBar
				world={world}
				updateWorld={updateWorld}
				selectedRoom={selectedRoom}
				selectedConnection={selectedConnection}
				onSelectedIdChange={onSelectedIdChange}
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
				<LogicInspector world={world} updateWorld={updateWorld} selection={logicSelection} />
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
