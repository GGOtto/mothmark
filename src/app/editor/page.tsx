"use client";

import type React from "react";
import {useCallback, useMemo, useState} from "react";
import {ToolBar} from "@/components/editor/ToolBar";
import {LeftSideBar, type EditorTab} from "@/components/editor/LeftSideBar";
import {RightSideBar} from "@/components/editor/right-side-bar/RightSideBar";
import {CommandLine} from "@/components/player/CommandLine";
import {Map} from "@/components/map/Map";
import {world as initialWorld} from "@/data/worlds/exampleWorld";
import type {Connection, Room, World} from "@/schemas/worldSchema";
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
		title: "World Settings",
		description: "Configure project-level world settings.",
	},
	"editor-settings": {
		title: "Settings",
		description: "Configure editor preferences.",
	},
};

function applyStateAction<T>(action: React.SetStateAction<T>, currentValue: T): T {
	return typeof action === "function" ? (action as (value: T) => T)(currentValue) : action;
}

export default function EditorPage() {
	const [activeTab, setActiveTab] = useState<EditorTab>("map");

	const [editorWorld, setEditorWorld] = useState<World>(initialWorld);

	const [selection, setSelection] = useState<EditorSelection>({
		selectedId: null,
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

		return rooms.find((room) => room.id === selection.selectedId) ?? null;
	}, [rooms, selection]);

	const selectedConnection = useMemo(() => {
		if (!selection.isConnectionSelected) return null;

		return connections.find((connection) => connection.id === selection.selectedId) ?? null;
	}, [connections, selection]);

	function updateRoom(updatedRoom: Room) {
		setRooms((currentRooms) =>
			currentRooms.map((room) => (room.id === updatedRoom.id ? updatedRoom : room)),
		);
	}

	function updateConnection(updatedConnection: Connection) {
		setConnections((currentConnections) =>
			currentConnections.map((connection) =>
				connection.id === updatedConnection.id ? updatedConnection : connection,
			),
		);
	}

	function deleteConnection(connectionToDelete: Connection) {
		setConnections((currentConnections) =>
			currentConnections.filter((connection) => connection.id !== connectionToDelete.id),
		);

		setSelection((currentSelection) => {
			if (
				currentSelection.isConnectionSelected &&
				currentSelection.selectedId === connectionToDelete.id
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
			/>

			<EditorInspector
				activeTab={activeTab}
				selectedRoom={selectedRoom}
				selectedConnection={selectedConnection}
				onRoomChange={updateRoom}
				onConnectionChange={updateConnection}
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
}: EditorMainPanelProps) {
	return (
		<section className="editorMainPanel">
			<EditorToolbar activeTab={activeTab} />

			<div className="editorWorkspaceShell">
				<EditorWorkspace
					activeTab={activeTab}
					rooms={rooms}
					setRooms={setRooms}
					connections={connections}
					setConnections={setConnections}
					selection={selection}
					setSelection={setSelection}
				/>
			</div>

			<CommandLine world={world} />
		</section>
	);
}

type EditorToolbarProps = {
	activeTab: EditorTab;
};

function EditorToolbar({activeTab}: EditorToolbarProps) {
	if (activeTab === "map") {
		return <ToolBar />;
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
};

function EditorWorkspace({
	activeTab,
	rooms,
	setRooms,
	connections,
	setConnections,
	selection,
	setSelection,
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
};

function MapWorkspace({
	rooms,
	setRooms,
	connections,
	setConnections,
	selection,
	setSelection,
}: MapWorkspaceProps) {
	return (
		<Map
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
	selectedRoom: Room | null;
	selectedConnection: Connection | null;
	onRoomChange: (room: Room) => void;
	onConnectionChange: (connection: Connection) => void;
	deleteConnection: (connection: Connection) => void;
};

function EditorInspector({
	activeTab,
	selectedRoom,
	selectedConnection,
	onRoomChange,
	onConnectionChange,
	deleteConnection,
}: EditorInspectorProps) {
	if (activeTab === "map") {
		return (
			<RightSideBar
				selectedRoom={selectedRoom}
				selectedConnection={selectedConnection}
				onRoomChange={onRoomChange}
				onConnectionChange={onConnectionChange}
				deleteConnection={deleteConnection}
			/>
		);
	}

	const metadata = getEditorTabMetadata(activeTab);

	return (
		<RightSideBar
			selectedRoom={null}
			selectedConnection={null}
			onRoomChange={onRoomChange}
			onConnectionChange={onConnectionChange}
			deleteConnection={deleteConnection}
			title={metadata.title}
			description={metadata.description}
		/>
	);
}

function getEditorTabMetadata(tab: EditorTab) {
	return EDITOR_TAB_METADATA[tab];
}
