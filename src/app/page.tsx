"use client";

import {useState} from "react";
import {Toolbar} from "@/components/editor/ToolBar";
import {LeftSideBar} from "../components/editor/LeftSideBar";
import {RightSideBar} from "../components/editor/RightSideBar";
import {Map} from "../components/map/Map";
import {world} from "../data/worlds/exampleWorld";
import type {Room} from "../schemas/worldSchema";

export default function EditorPage() {
	const [rooms, setRooms] = useState<Room[]>(world.rooms);
	const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

	const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;

	function updateRoom(updatedRoom: Room) {
		setRooms((rooms) =>
			rooms.map((room) => {
				if (room.id !== updatedRoom.id) return room;

				return updatedRoom;
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
						selectedRoomId={selectedRoomId}
						setSelectedRoomId={setSelectedRoomId}
					/>
				</div>
			</section>

			<RightSideBar selectedRoom={selectedRoom} onRoomChange={updateRoom} />
		</main>
	);
}
