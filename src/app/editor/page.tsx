"use client";

import type React from "react";
import {useMemo, useState} from "react";
import {ToolBar} from "@/components/editor/ToolBar";
import {LeftSideBar, type EditorTab} from "@/components/editor/LeftSideBar";
import {RightSideBar} from "@/components/editor/RightSideBar";
import {CommandLine} from "@/components/player/CommandLine";
import {Map} from "@/components/map/Map";
import {world} from "@/data/worlds/exampleWorld";
import type {Connection, Room} from "@/schemas/worldSchema";
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

export default function EditorPage() {
	const [activeTab, setActiveTab] = useState<EditorTab>("map");

	const [rooms, setRooms] = useState<Room[]>(world.rooms);
	const [connections, setConnections] = useState<Connection[]>(world.connections);

	const [selection, setSelection] = useState<EditorSelection>({
		selectedId: null,
		isConnectionSelected: false,
	});

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

	return (
		<main className="editorPage">
			<LeftSideBar activeTab={activeTab} onTabChange={setActiveTab} />

			<EditorMainPanel
				activeTab={activeTab}
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
			/>
		</main>
	);
}

type EditorMainPanelProps = {
	activeTab: EditorTab;
	rooms: Room[];
	setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
	connections: Connection[];
	setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
	selection: EditorSelection;
	setSelection: React.Dispatch<React.SetStateAction<EditorSelection>>;
};

function EditorMainPanel({
	activeTab,
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

			<CommandLine />
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
};

function EditorInspector({
	activeTab,
	selectedRoom,
	selectedConnection,
	onRoomChange,
	onConnectionChange,
}: EditorInspectorProps) {
	if (activeTab === "map") {
		return (
			<RightSideBar
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
