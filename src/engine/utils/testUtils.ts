import {produce} from "immer";
import type {GameState} from "@/schemas/states/gameStateSchemas";
import {EffectGroupSchema} from "@/schemas/world/effectSchema";
import type {Effect, EffectGroup} from "@/schemas/world/effectSchema";
import {EventSchema, type Event} from "@/schemas/world/eventSchema";
import {
	ConnectionSchema,
	RoomFeatureSchema,
	RoomSchema,
	type Connection,
	type Room,
	type RoomFeature,
} from "@/schemas/world/roomSchema";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {createInitialGameState} from "../states/createInitialState";
import {moveCommand} from "@/data/commands/move";

export type PlayerTestScenarioName = "navigation" | "conditional-travel" | "turn-event";

export type PlayerTestScenario = {
	world: World;
	game: GameState;
};

function createRoom(
	id: string,
	name: string,
	description: string,
	options: {
		shortDescription?: string;
		features?: RoomFeature[];
		x?: number;
		y?: number;
	} = {},
): Room {
	return produce(createDefaultFieldObject(RoomSchema), (draft) => {
		draft.id = toID("room", id);
		draft.name = name;
		draft.description = description;
		draft.shortDescription = options.shortDescription ?? "";
		draft.features = options.features ?? [];
		draft.metadata.position = {x: options.x ?? 0, y: options.y ?? 0};
	});
}

export function createPlayerTestFeature(
	id: string,
	name: string,
	description: string,
	aliases: string[] = [],
): RoomFeature {
	return produce(createDefaultFieldObject(RoomFeatureSchema), (draft) => {
		draft.id = toID("feature", id);
		draft.name = name;
		draft.description = description;
		draft.aliases = aliases;
		draft.listedInRoom = true;
	});
}

export function createPlayerTestEffectGroup(id: string, effects: Effect[]): EffectGroup {
	return produce(createDefaultFieldObject(EffectGroupSchema), (draft) => {
		draft.id = toID("effect", id);
		draft.name = id;
		draft.effects = effects;
	});
}

export function createPlayerTestEvent(
	id: string,
	effects: Effect[],
	recipe?: (draft: import("immer").Draft<Event>) => void,
): Event {
	return produce(createDefaultFieldObject(EventSchema), (draft) => {
		draft.id = toID("event", id);
		draft.name = id;
		draft.branch.id = toID("condition-branch", `${id}-branch`);
		draft.branch.always = createPlayerTestEffectGroup(`${id}-effects`, effects);
		recipe?.(draft);
	});
}

function createConnection(
	id: string,
	fromRoomId: string,
	toRoomId: string,
	direction: Connection["direction"],
	returnDirection: Connection["returnDirection"],
): Connection {
	return produce(createDefaultFieldObject(ConnectionSchema), (draft) => {
		draft.id = toID("connection", id);
		draft.fromRoomId = toID("room", fromRoomId);
		draft.toRoomId = toID("room", toRoomId);
		draft.direction = direction;
		draft.returnDirection = returnDirection;
		draft.pathway = "two-way";
	});
}

function createWorld(
	title: string,
	startRoomId: string,
	rooms: Room[],
	connections: Connection[] = [],
): World {
	return produce(createDefaultFieldObject(WorldSchema), (draft) => {
		draft.metadata.title = title;
		draft.startRoomId = toID("room", startRoomId);
		draft.deathMessage = "You have died.";
		draft.rooms = rooms;
		draft.connections = connections;
		draft.commands = [moveCommand];
	});
}

function createNavigationWorld(): World {
	const bell = createPlayerTestFeature(
		"brass-bell",
		"Brass Bell",
		"A small brass bell hangs beside the doorway.",
		["bell"],
	);
	const foyer = createRoom(
		"foyer",
		"Test Foyer",
		"A plain foyer provides a dependable starting point.",
		{
			shortDescription: "You are back in the test foyer.",
			features: [bell],
			x: 0,
		},
	);
	const gallery = createRoom(
		"gallery",
		"Test Gallery",
		"A narrow gallery gives movement tests somewhere to go.",
		{
			shortDescription: "You are back in the test gallery.",
			x: 240,
		},
	);

	return createWorld(
		"Navigation player tests",
		"foyer",
		[foyer, gallery],
		[createConnection("foyer-gallery", "foyer", "gallery", "e", "w")],
	);
}

function createConditionalTravelWorld(): World {
	const courtyard = createRoom(
		"courtyard",
		"Test Courtyard",
		"A closed tower gate stands to the north.",
	);
	const tower = produce(
		createRoom("tower", "Test Tower", "The tower overlooks the courtyard.", {
			y: -240,
		}),
		(draft) => {
			draft.flags.active = false;
		},
	);
	const gate = createConnection("courtyard-tower", "courtyard", "tower", "n", "s");

	return createWorld("Conditional travel player tests", "courtyard", [courtyard, tower], [gate]);
}

function createTurnEventWorld(): World {
	const observatory = createRoom(
		"observatory",
		"Test Observatory",
		"A clockwork instrument waits for the next turn.",
	);
	const chimeEvent = createPlayerTestEvent(
		"clock-chime",
		[
			{
				type: "message",
				operation: "show",
				message: "The clockwork instrument chimes.",
			},
		],
		(draft) => {
			draft.disposable = true;
		},
	);

	return produce(createWorld("Turn event player tests", "observatory", [observatory]), (draft) => {
		draft.events = [chimeEvent];
	});
}

/**
 * Creates a fresh maintained world and matching initial game state for player-path tests.
 * Keep this scenario list small; specialized outliers should define narrowly scoped local data.
 */
export function createPlayerTestScenario(name: PlayerTestScenarioName): PlayerTestScenario {
	const world = (() => {
		switch (name) {
			case "navigation":
				return createNavigationWorld();
			case "conditional-travel":
				return createConditionalTravelWorld();
			case "turn-event":
				return createTurnEventWorld();
		}
	})();

	return {
		world,
		game: createInitialGameState(world, world.startRoomId),
	};
}
