import {rawInitialCommands} from "../commands/initialCommands";
import {WorldSchema} from "../../schemas/world/worldSchema";
import {toID} from "../../utils/idUtils";

function fixedItem(
	id: string,
	name: string,
	roomId: string,
	description: string,
	aliases: string[] = [],
) {
	return {
		id: toID("item", id),
		name,
		aliases,
		tags: ["scenery"],
		presentation: {listedInRoom: true, listingText: ""},
		examine: {text: description},
		behaviors: [],
		initialState: {
			location: {type: "room" as const, roomId: toID("room", roomId)},
			open: false,
			locked: false,
			flags: {examined: false},
		},
	};
}

function room(id: string, name: string, x: number, y: number, description: string) {
	return {
		id: toID("room", id),
		name,
		aliases: [],
		tags: ["indoors"],
		metadata: {position: {x, y}},
		description,
	};
}

function connection(
	id: string,
	fromRoomId: string,
	toRoomId: string,
	direction: "up" | "down" | "e",
	returnDirection: "up" | "down" | "w",
) {
	return {
		id: toID("connection", id),
		fromRoomId: toID("room", fromRoomId),
		toRoomId: toID("room", toRoomId),
		direction,
		returnDirection,
		pathway: "two-way" as const,
		metadata: {},
	};
}

const rawWorld = {
	metadata: {
		title: "Corner Shop",
		author: "Mothmark",
		description: "A small example world with four rooms across three map layers.",
		version: "0.1.0",
		layers: [
			{
				name: "Basement",
				layer: -1,
				viewport: {x: 0, y: 0, zoom: 1},
				rooms: [toID("room", "cellar")],
			},
			{
				name: "Main floor",
				layer: 0,
				viewport: {x: 0, y: 0, zoom: 1},
				rooms: [toID("room", "shop-floor"), toID("room", "stockroom")],
			},
			{
				name: "Upstairs",
				layer: 1,
				viewport: {x: 0, y: 0, zoom: 1},
				rooms: [toID("room", "office")],
			},
		],
	},
	startRoomId: toID("room", "shop-floor"),
	deathMessage: "The story ends here.",
	rooms: [
		room("shop-floor", "Shop Floor", 120, 160, "A narrow shop with a counter by the door."),
		room("stockroom", "Stockroom", 360, 160, "Shelves hold boxes waiting to be unpacked."),
		room("office", "Office", 170, 130, "A desk and two chairs fill the small office."),
		room("cellar", "Cellar", 170, 190, "The cellar is cool, bare, and lit by one bulb."),
	],
	items: [
		fixedItem("shop-counter", "Shop Counter", "shop-floor", "A plain wooden sales counter.", [
			"counter",
		]),
		fixedItem("order-book", "Order Book", "office", "A notebook of stock orders.", [
			"book",
			"notebook",
		]),
	],
	connections: [
		connection("shop-office", "shop-floor", "office", "up", "down"),
		connection("shop-stockroom", "shop-floor", "stockroom", "e", "w"),
		connection("shop-cellar", "shop-floor", "cellar", "down", "up"),
	],
	commands: rawInitialCommands,
	conditions: [],
	effects: [],
	events: [],
	initialState: {flags: [], counters: []},
};

export function createInitialWorld() {
	return WorldSchema.parse(rawWorld);
}

export const world = createInitialWorld();
