import {WorldSchema} from "../../schemas/worldSchema";

const rawWorld = {
	startRoomId: "room-1",
	rooms: [
		{
			id: "room-1",
			name: "Room 1",
			position: {
				x: 100,
				y: 100,
			},
			description: {
				default: "This room does nothing.",
				variants: [],
			},
			features: [
				{
					id: "nothing",
					name: "Nothing",
					aliases: ["void"],
					description: {
						default: "The nothing in this room is literally nothing.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
			],
		},
		{
			id: "room-2",
			name: "Room 2",
			position: {
				x: 400,
				y: 160,
			},
			description: {
				default: "This room does nothing also.",
				variants: [],
			},
			features: [
				{
					id: "nothing",
					name: "Nothing",
					aliases: ["void"],
					description: {
						default: "The nothing in this room is literally nothing.",
						variants: [],
					},
					listedInRoom: false,
					activeWhen: [],
				},
			],
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
	],
};

export const world = WorldSchema.parse(rawWorld);
