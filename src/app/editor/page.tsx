"use client";

import type React from "react";
import {useCallback, useMemo, useState} from "react";
import {ToolBar} from "@/components/studio/ToolBar";
import {LeftSideBar, type EditorTab} from "@/components/studio/LeftSideBar";
import {RightSideBar} from "@/components/studio/RightSideBar";
import {CommandLine} from "@/components/player/CommandLine";
import {Map, type MapTool} from "@/components/map/Map";
import {world as initialWorld} from "@/data/worlds/exampleWorld";
import type {Connection, Room, World} from "@/schemas/worldSchema";
import {compareIds, idValue} from "@/utils/idUtils";
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
	issues: {
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
	story: {
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

	const [editorWorld, setEditorWorld] = useState<World>(initialWorld);

	const [selection, setSelection] = useState<EditorSelection>({
		selectedId: idValue(initialWorld.startRoomId),
		isConnectionSelected: false,
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
				activeTab={activeTab}
				world={editorWorld}
				rooms={rooms}
				setRooms={setRooms}
				connections={connections}
				setConnections={setConnections}
				selection={selection}
				setSelection={setSelection}
				selectedRoom={selectedRoom}
				mapTool={mapTool}
				setMapTool={setMapTool}
				mapZoom={mapZoom}
				setMapZoom={setMapZoom}
				mapRecenterRequest={mapRecenterRequest}
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
	activeTab: EditorTab;
	world: World;
	rooms: Room[];
	setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
	connections: Connection[];
	setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
	selection: EditorSelection;
	setSelection: React.Dispatch<React.SetStateAction<EditorSelection>>;
	selectedRoom: Room | null;
	mapTool: MapTool;
	setMapTool: (tool: MapTool) => void;
	mapZoom: number;
	setMapZoom: (zoom: number) => void;
	mapRecenterRequest: number;
	onMapRecenter: () => void;
};

function EditorMainPanel({
	activeTab,
	world,
	rooms,
	setRooms,
	connections,
	setConnections,
	selection,
	setSelection,
	selectedRoom,
	mapTool,
	setMapTool,
	mapZoom,
	setMapZoom,
	mapRecenterRequest,
	onMapRecenter,
}: EditorMainPanelProps) {
	return (
		<section className="editorMainPanel">
			<EditorToolbar
				activeTab={activeTab}
				mapTool={mapTool}
				setMapTool={setMapTool}
				mapZoom={mapZoom}
				onMapRecenter={onMapRecenter}
			/>

			<div className="editorWorkspaceShell">
				<EditorWorkspace
					activeTab={activeTab}
					rooms={rooms}
					setRooms={setRooms}
					connections={connections}
					setConnections={setConnections}
					selection={selection}
					setSelection={setSelection}
					mapTool={mapTool}
					onZoomChange={setMapZoom}
					recenterRequest={mapRecenterRequest}
				/>
			</div>

			<CommandLine world={world} selectedRoomId={selectedRoom ? idValue(selectedRoom.id) : null} />
		</section>
	);
}

type EditorToolbarProps = {
	activeTab: EditorTab;
	mapTool: MapTool;
	setMapTool: (tool: MapTool) => void;
	mapZoom: number;
	onMapRecenter: () => void;
};

function EditorToolbar({
	activeTab,
	mapTool,
	setMapTool,
	mapZoom,
	onMapRecenter,
}: EditorToolbarProps) {
	if (activeTab === "map") {
		return (
			<ToolBar
				activeTool={mapTool}
				onToolChange={setMapTool}
				zoom={mapZoom}
				onRecenter={onMapRecenter}
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
	activeTab: EditorTab;
	rooms: Room[];
	setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
	connections: Connection[];
	setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
	selection: EditorSelection;
	setSelection: React.Dispatch<React.SetStateAction<EditorSelection>>;
	mapTool: MapTool;
	onZoomChange: (zoom: number) => void;
	recenterRequest: number;
};

function EditorWorkspace({
	activeTab,
	rooms,
	setRooms,
	connections,
	setConnections,
	selection,
	setSelection,
	mapTool,
	onZoomChange,
	recenterRequest,
}: EditorWorkspaceProps) {
	if (activeTab === "map") {
		return (
			<MapWorkspace
				rooms={rooms}
				setRooms={setRooms}
				connections={connections}
				setConnections={setConnections}
				selection={selection}
				setSelection={setSelection}
				mapTool={mapTool}
				onZoomChange={onZoomChange}
				recenterRequest={recenterRequest}
			/>
		);
	}

	return <PlaceholderWorkspace activeTab={activeTab} />;
}

type MapWorkspaceProps = {
	rooms: Room[];
	setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
	connections: Connection[];
	setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
	selection: EditorSelection;
	setSelection: React.Dispatch<React.SetStateAction<EditorSelection>>;
	mapTool: MapTool;
	onZoomChange: (zoom: number) => void;
	recenterRequest: number;
};

function MapWorkspace({
	rooms,
	setRooms,
	connections,
	setConnections,
	selection,
	setSelection,
	mapTool,
	onZoomChange,
	recenterRequest,
}: MapWorkspaceProps) {
	return (
		<Map
			key={recenterRequest}
			tool={mapTool}
			onZoomChange={onZoomChange}
			theme="light"
			rooms={rooms}
			setRooms={setRooms}
			connections={connections}
			setConnections={setConnections}
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
