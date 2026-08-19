import type {EditorTab} from "@/components/studio/LeftSideBar";
import type {CommandSelection, LogicSection, LogicSelection} from "@/components/logic/shared";
import type {World} from "@/schemas/world/worldSchema";
import {idValue} from "@/utils/idUtils";

export type EditorSelection = {
	selectedId: string | null;
	isConnectionSelected: boolean;
};

export type EditorContext = {
	activeTab: EditorTab;
	selection: EditorSelection;
	logicSection: LogicSection;
	selectedEventId: string | null;
	logicSelection: LogicSelection | null;
	selectedCommandId: string | null;
	commandSelection: CommandSelection | null;
	commandReturnItemId: string | null;
	selectedConditionId: string | null;
	selectedEffectId: string | null;
	selectedItemId: string | null;
};

export type ResolvedEditorContext = {
	context: EditorContext;
	notice: string | null;
};

const TAB_TO_VIEW: Record<EditorTab, string> = {
	map: "map",
	world: "items",
	logic: "logic",
	debug: "issues",
	"world-settings": "world-settings",
	"editor-settings": "settings",
};

const VIEW_TO_TAB = Object.fromEntries(
	Object.entries(TAB_TO_VIEW).map(([tab, view]) => [view, tab]),
) as Record<string, EditorTab>;

const LOGIC_SECTIONS = new Set<LogicSection>([
	"home",
	"events",
	"commands",
	"conditions",
	"effects",
]);

function baseContext(world: World): EditorContext {
	const startRoomId = idValue(world.startRoomId) || null;
	const hasStartRoom = world.rooms.some((room) => idValue(room.id) === startRoomId);

	return {
		activeTab: "map",
		selection: {selectedId: hasStartRoom ? startRoomId : null, isConnectionSelected: false},
		logicSection: "home",
		selectedEventId: null,
		logicSelection: null,
		selectedCommandId: null,
		commandSelection: null,
		commandReturnItemId: null,
		selectedConditionId: null,
		selectedEffectId: null,
		selectedItemId: null,
	};
}

export function resolveEditorContext(world: World, search: string): ResolvedEditorContext {
	const params = new URLSearchParams(search);
	const context = baseContext(world);
	const requestedView = params.get("view") ?? "map";
	const activeTab = VIEW_TO_TAB[requestedView];

	if (!activeTab) {
		return {
			context,
			notice: "That editor view is not available. Showing the map instead.",
		};
	}

	context.activeTab = activeTab;
	if (activeTab === "map") {
		const roomId = params.get("room");
		const connectionId = params.get("connection");
		if (connectionId) {
			if (world.connections.some((connection) => idValue(connection.id) === connectionId)) {
				context.selection = {selectedId: connectionId, isConnectionSelected: true};
				return {context, notice: null};
			}
			context.selection = {selectedId: null, isConnectionSelected: false};
			return {
				context,
				notice: "That connection is no longer available. Showing the map without a selection.",
			};
		}
		if (roomId) {
			if (world.rooms.some((room) => idValue(room.id) === roomId)) {
				context.selection = {selectedId: roomId, isConnectionSelected: false};
				return {context, notice: null};
			}
			context.selection = {selectedId: null, isConnectionSelected: false};
			return {
				context,
				notice: "That room is no longer available. Showing the map without a selection.",
			};
		}
		if (params.has("view")) {
			context.selection = {selectedId: null, isConnectionSelected: false};
		}
		return {context, notice: null};
	}

	context.selection = {selectedId: null, isConnectionSelected: false};
	if (activeTab === "world") {
		const itemId = params.get("item");
		if (!itemId) return {context, notice: null};
		if (world.items.some((item) => idValue(item.id) === itemId)) {
			context.selectedItemId = itemId;
			return {context, notice: null};
		}
		return {
			context,
			notice: "That item is no longer available. Choose another item to continue.",
		};
	}

	if (activeTab !== "logic") return {context, notice: null};

	const requestedSection = params.get("section") ?? "home";
	context.logicSection = LOGIC_SECTIONS.has(requestedSection as LogicSection)
		? (requestedSection as LogicSection)
		: "home";
	if (context.logicSection !== requestedSection) {
		return {
			context,
			notice: "That logic view is not available. Showing the logic library instead.",
		};
	}

	if (context.logicSection === "events") {
		const eventId = params.get("event");
		if (!eventId) return {context, notice: null};
		if ((world.events ?? []).some((event) => idValue(event.id) === eventId)) {
			context.selectedEventId = eventId;
			context.logicSelection = {kind: "event", eventId};
			return {context, notice: null};
		}
		return {
			context,
			notice: "That event is no longer available. Choose another event to continue.",
		};
	}

	if (context.logicSection === "commands") {
		const commandId = params.get("command");
		if (!commandId) return {context, notice: null};
		if (world.commands.some((command) => idValue(command.id) === commandId)) {
			context.selectedCommandId = commandId;
			context.commandSelection = {kind: "command", commandId};
			const returnItemId = params.get("fromItem");
			if (returnItemId && world.items.some((item) => idValue(item.id) === returnItemId)) {
				context.commandReturnItemId = returnItemId;
				return {context, notice: null};
			}
			return {
				context,
				notice: returnItemId ? "The item that opened this command is no longer available." : null,
			};
		}
		return {
			context,
			notice: "That command is no longer available. Showing the command library instead.",
		};
	}

	if (context.logicSection === "conditions") {
		const conditionId = params.get("condition");
		if (!conditionId) return {context, notice: null};
		if (world.conditions.some((condition) => idValue(condition.identity) === conditionId)) {
			context.selectedConditionId = conditionId;
			return {context, notice: null};
		}
		return {
			context,
			notice: "That condition is no longer available. Choose another condition to continue.",
		};
	}

	if (context.logicSection === "effects") {
		const effectId = params.get("effect");
		if (!effectId) return {context, notice: null};
		if (world.effects.some((effect) => idValue(effect.id) === effectId)) {
			context.selectedEffectId = effectId;
			return {context, notice: null};
		}
		return {
			context,
			notice: "That effect is no longer available. Choose another effect to continue.",
		};
	}

	return {context, notice: null};
}

export function buildEditorContextSearch(context: EditorContext): string {
	const params = new URLSearchParams();
	params.set("view", TAB_TO_VIEW[context.activeTab]);

	if (context.activeTab === "map" && context.selection.selectedId) {
		params.set(
			context.selection.isConnectionSelected ? "connection" : "room",
			context.selection.selectedId,
		);
	}
	if (context.activeTab === "world" && context.selectedItemId) {
		params.set("item", context.selectedItemId);
	}
	if (context.activeTab === "logic") {
		params.set("section", context.logicSection);
		if (context.logicSection === "events" && context.selectedEventId) {
			params.set("event", context.selectedEventId);
		}
		if (context.logicSection === "commands" && context.selectedCommandId) {
			params.set("command", context.selectedCommandId);
			if (context.commandReturnItemId) params.set("fromItem", context.commandReturnItemId);
		}
		if (context.logicSection === "conditions" && context.selectedConditionId) {
			params.set("condition", context.selectedConditionId);
		}
		if (context.logicSection === "effects" && context.selectedEffectId) {
			params.set("effect", context.selectedEffectId);
		}
	}

	return `?${params.toString()}`;
}
