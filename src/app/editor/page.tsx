"use client";

import type React from "react";
import {useCallback, useEffect, useMemo, useState} from "react";
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
import {useWorldAutosaveRegistration} from "@/components/world-autosave/WorldAutosave";
import {world as initialWorld} from "@/data/worlds/exampleWorld";
import type {Connection, Layer, Room, World} from "@/schemas/world/worldSchema";
import {compareIds, idValue} from "@/utils/idUtils";
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

function applyStateAction<T>(action: React.SetStateAction<T>, currentValue: T): T {
	return typeof action === "function" ? (action as (value: T) => T)(currentValue) : action;
}

export default function EditorPage() {
	const [activeTab, setActiveTab] = useState<EditorTab>("map");
	const [mapTool, setMapTool] = useState<MapTool>("edit");
	const [mapZoom, setMapZoom] = useState(1);
	const [mapRecenterRequest, setMapRecenterRequest] = useState(0);
	const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>({state: "idle"});

	const [editorWorld, setEditorWorld] = useState<World>(initialWorld);
	const [persistedWorldId, setPersistedWorldId] = useState<string | null>(null);
	const [persistedWorldRevision, setPersistedWorldRevision] = useState<number | null>(null);
	const [worldIsLoaded, setWorldIsLoaded] = useState(false);

	const [selection, setSelection] = useState<EditorSelection>({
		selectedId: null,
		isConnectionSelected: false,
	});

	useEffect(() => {
		const abortController = new AbortController();

		loadMainWorld(fetch, abortController.signal)
			.then(({world, worldId, revision}) => {
				setEditorWorld(world);
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
	}, []);

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

	const setRooms = useCallback<React.Dispatch<React.SetStateAction<Room[]>>>((roomsAction) => {
		setEditorWorld((currentWorld) => ({
			...currentWorld,
			rooms: applyStateAction(roomsAction, currentWorld.rooms),
		}));
	}, []);

	const setConnections = useCallback<React.Dispatch<React.SetStateAction<Connection[]>>>(
		(connectionsAction) => {
			setEditorWorld((currentWorld) => ({
				...currentWorld,
				connections: applyStateAction(connectionsAction, currentWorld.connections),
			}));
		},
		[],
	);

	const setLayers = useCallback<React.Dispatch<React.SetStateAction<Layer[]>>>((layersAction) => {
		setEditorWorld((currentWorld) => ({
			...currentWorld,
			metadata: {
				...currentWorld.metadata,
				layers: applyStateAction(layersAction, currentWorld.metadata.layers),
			},
		}));
	}, []);

	const selectedRoom = useMemo(() => {
		if (selection.isConnectionSelected) return null;

		return rooms.find((room) => idValue(room.id) === selection.selectedId) ?? null;
	}, [rooms, selection]);

	const selectedConnection = useMemo(() => {
		if (!selection.isConnectionSelected) return null;

		return connections.find((connection) => idValue(connection.id) === selection.selectedId) ?? null;
	}, [connections, selection]);

	function updateRoom(updatedRoom: Room) {
		const selectedRoomId = selection.isConnectionSelected ? null : selection.selectedId;

		setRooms((currentRooms) =>
			currentRooms.map((room) =>
				idValue(room.id) === (selectedRoomId ?? idValue(updatedRoom.id)) ? updatedRoom : room,
			),
		);

		if (selectedRoomId && selectedRoomId !== idValue(updatedRoom.id)) {
			setSelection({
				selectedId: idValue(updatedRoom.id),
				isConnectionSelected: false,
			});
		}
	}

	function updateConnection(updatedConnection: Connection) {
		setConnections((currentConnections) =>
			currentConnections.map((connection) =>
				compareIds(connection.id, updatedConnection.id) ? updatedConnection : connection,
			),
		);
	}

	function deleteConnection(connectionToDelete: Connection) {
		setConnections((currentConnections) =>
			currentConnections.filter((connection) => !compareIds(connection.id, connectionToDelete.id)),
		);

		setSelection((currentSelection) => {
			if (
				currentSelection.isConnectionSelected &&
				currentSelection.selectedId === idValue(connectionToDelete.id)
			) {
				return {
					selectedId: null,
					isConnectionSelected: false,
				};
			}

			return currentSelection;
		});
	}

	return (
		<main className="editorPage">
			<LeftSideBar activeTab={activeTab} onTabChange={setActiveTab} />

			<EditorMainPanel
				isLoading={!worldIsLoaded}
				activeTab={activeTab}
				world={editorWorld}
				rooms={rooms}
				setRooms={setRooms}
				connections={connections}
				setConnections={setConnections}
				setLayers={setLayers}
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
				onMapRecenter={() => {
					setMapZoom(1);
					setMapRecenterRequest((request) => request + 1);
				}}
			/>

			<EditorInspector
				activeTab={activeTab}
				world={editorWorld}
				rooms={rooms}
				selectedRoom={selectedRoom}
				selectedConnection={selectedConnection}
				onRoomChange={updateRoom}
				onConnectionChange={updateConnection}
				onWorldChange={setEditorWorld}
				deleteConnection={deleteConnection}
			/>
		</main>
	);
}

type EditorMainPanelProps = {
	isLoading: boolean;
	activeTab: EditorTab;
	world: World;
	rooms: Room[];
	setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
	connections: Connection[];
	setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
	setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
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
};

function EditorMainPanel({
	isLoading,
	activeTab,
	world,
	rooms,
	setRooms,
	setConnections,
	setLayers,
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
				/>

				<div className="editorWorkspaceShell">
					<EditorWorkspace
						isLoading={isLoading}
						activeTab={activeTab}
						world={world}
						setRooms={setRooms}
						setConnections={setConnections}
						setLayers={setLayers}
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
	setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
	setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
	setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
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

function EditorWorkspace({
	isLoading,
	activeTab,
	world,
	setRooms,
	setConnections,
	setLayers,
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
}: EditorWorkspaceProps) {
	if (activeTab === "map") {
		return (
			<MapWorkspace
				isLoading={isLoading}
				world={world}
				setRooms={setRooms}
				setConnections={setConnections}
				setLayers={setLayers}
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

	return <PlaceholderWorkspace activeTab={activeTab} />;
}

type MapWorkspaceProps = {
	isLoading: boolean;
	world: World;
	setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
	setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
	setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
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
	setRooms,
	setConnections,
	setLayers,
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
			setRooms={setRooms}
			setConnections={setConnections}
			setLayers={setLayers}
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
	rooms: Room[];
	selectedRoom: Room | null;
	selectedConnection: Connection | null;
	onRoomChange: (room: Room) => void;
	onConnectionChange: (connection: Connection) => void;
	onWorldChange: (world: World) => void;
	deleteConnection: (connection: Connection) => void;
};

function EditorInspector({
	activeTab,
	world,
	rooms,
	selectedRoom,
	selectedConnection,
	onRoomChange,
	onConnectionChange,
	onWorldChange,
	deleteConnection,
}: EditorInspectorProps) {
	if (activeTab === "map") {
		return (
			<RightSideBar
				world={world}
				onWorldChange={onWorldChange}
				rooms={rooms}
				selectedRoom={selectedRoom}
				selectedConnection={selectedConnection}
				onRoomChange={onRoomChange}
				onConnectionChange={onConnectionChange}
			/>
		);
	}

	const metadata = getEditorTabMetadata(activeTab);

	return (
		<RightSideBar
			world={world}
			onWorldChange={onWorldChange}
			rooms={rooms}
			selectedRoom={null}
			selectedConnection={null}
			onRoomChange={onRoomChange}
			onConnectionChange={onConnectionChange}
			title={metadata.title}
			description={metadata.description}
		/>
	);
}

function getEditorTabMetadata(tab: EditorTab) {
	return EDITOR_TAB_METADATA[tab];
}
