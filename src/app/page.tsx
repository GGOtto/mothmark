"use client";

import {useState} from "react";
import {Toolbar} from "@/components/editor/ToolBar";
import {LeftSideBar} from "../components/editor/LeftSideBar";
import {RightSideBar} from "../components/editor/RightSideBar";
import {Map} from "../components/map/Map";
import {world} from "../data/worlds/exampleWorld";
import type {Room, Connection} from "../schemas/worldSchema";

export default function EditorPage() {
	const [rooms, setRooms] = useState<Room[]>(world.rooms);
	const [connections, setConnections] = useState<Connection[]>(world.connections);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [isConnectionSelected, setIsConnectionSelected] = useState<boolean>(false);

	const selectedRoom = !isConnectionSelected
		? (rooms.find((room) => room.id === selectedId) ?? null)
		: null;

	const selectedConnection = isConnectionSelected
		? (connections.find((connection) => connection.id === selectedId) ?? null)
		: null;

	function updateRoom(updatedRoom: Room) {
		setRooms((rooms) =>
			rooms.map((room) => {
				if (room.id !== updatedRoom.id) return room;
				return updatedRoom;
			}),
		);
	}

	function updateConnection(updatedConnection: Connection) {
		setConnections((connections) =>
			connections.map((connection) => {
				if (connection.id !== updatedConnection.id) return connection;
				return updatedConnection;
			}),
		);
	}

	return (
		<main className="flex min-h-0 w-full flex-1 overflow-hidden">
			<LeftSideBar />

			<section className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<Toolbar />

				<div className="min-h-0 flex-1 overflow-hidden">
					<Map
						rooms={rooms}
						setRooms={setRooms}
						connections={connections}
						setConnections={setConnections}
						selectedId={selectedId}
						setSelectedId={setSelectedId}
						isConnectionSelected={isConnectionSelected}
						setIsConnectionSelected={setIsConnectionSelected}
					/>
				</div>
			</section>

			<RightSideBar
				selectedRoom={selectedRoom}
				selectedConnection={selectedConnection}
				onRoomChange={updateRoom}
				onConnectionChange={updateConnection}
			/>
		</main>
	);
}
