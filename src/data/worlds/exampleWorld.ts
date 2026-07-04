import {WorldSchema} from "../../schemas/worldSchema";

const rawWorld = {
	rooms: [
		{
			id: "room-1",
			name: "Room 1",
			position: {x: 180, y: 160},
		},
		{
			id: "room-2",
			name: "Room 2",
			position: {x: 340, y: 160},
		},
		{
			id: "room-3",
			name: "Room 3",
			position: {x: 460, y: 260},
		},
		{
			id: "room-4",
			name: "Room 4",
			position: {x: 340, y: 60},
		},
		{
			id: "room-5",
			name: "Room 5",
			position: {x: 340, y: 260},
		},
		{
			id: "room-6",
			name: "Room 6",
			position: {x: 460, y: 160},
		},
	],
	connections: [
		{
			id: "connection-1",
			fromRoomId: "room-1",
			toRoomId: "room-2",
			direction: "e",
			returnDirection: "w",
			pathway: "two-way",
		},
		{
			id: "connection-2",
			fromRoomId: "room-2",
			toRoomId: "room-3",
			controlPoints: [{x: 500, y: 220}],
			direction: "s",
			returnDirection: "n",
			pathway: "two-way",
		},
		{
			id: "connection-3",
			fromRoomId: "room-1",
			toRoomId: "room-4",
			direction: "ne",
			returnDirection: "sw",
			pathway: "two-way",
		},
		{
			id: "connection-4",
			fromRoomId: "room-2",
			toRoomId: "room-4",
			direction: "n",
			returnDirection: "s",
			pathway: "two-way",
		},
		{
			id: "connection-5",
			fromRoomId: "room-1",
			toRoomId: "room-5",
			direction: "s",
			returnDirection: "nw",
			pathway: "two-way",
		},
		{
			id: "connection-6",
			fromRoomId: "room-5",
			toRoomId: "room-3",
			direction: "se",
			returnDirection: "sw",
			pathway: "two-way",
		},
		{
			id: "connection-7",
			fromRoomId: "room-4",
			toRoomId: "room-6",
			direction: "e",
			returnDirection: "n",
			pathway: "two-way",
		},
		{
			id: "connection-8",
			fromRoomId: "room-4",
			toRoomId: "room-6",
			direction: "se",
			returnDirection: "nw",
		},
	],
};

export const world = WorldSchema.parse(rawWorld);
