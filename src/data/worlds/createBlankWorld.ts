import {produce} from "immer";

import type {World} from "@/schemas/world/worldSchema";
import {toID} from "@/utils/idUtils";

import {world as initialWorld} from "./initialWorld";

/** Creates the canonical schema-valid world with no authored content. */
export function createBlankWorldDocument(title = "Untitled world"): World {
	return produce(initialWorld, (draft) => {
		draft.metadata.title = title;
		draft.metadata.author = "";
		draft.metadata.description = "";
		draft.metadata.version = "0.1.0";
		draft.metadata.layers = [];
		draft.startRoomId = toID("room", "room-1");
		draft.rooms = [];
		draft.items = [];
		draft.connections = [];
		draft.conditions = [];
		draft.effects = [];
		draft.events = [];
		draft.initialState = {flags: [], counters: [], texts: []};
	});
}
