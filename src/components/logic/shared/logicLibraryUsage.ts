import type {World} from "@/schemas/world/worldSchema";
import {idValue, isID} from "@/utils/idUtils";

export type LogicLibraryKind = "condition" | "effect";

export type LogicUsage =
	| {key: string; kind: "command"; id: string; label: string; detail: string}
	| {key: string; kind: "event"; id: string; label: string; detail: string}
	| {key: string; kind: "condition"; id: string; label: string; detail: string}
	| {key: string; kind: "effect"; id: string; label: string; detail: string}
	| {key: string; kind: "item"; id: string; label: string; detail: string}
	| {key: string; kind: "room"; id: string; label: string; detail: string};

function containsReference(value: unknown, kind: LogicLibraryKind, id: string) {
	const seen = new Set<object>();

	function visit(candidate: unknown): boolean {
		if (!candidate || typeof candidate !== "object" || seen.has(candidate)) return false;
		seen.add(candidate);
		if (Array.isArray(candidate)) return candidate.some(visit);

		const record = candidate as Record<string, unknown>;
		const referenceType = kind === "condition" ? "condition-ref" : "effect-ref";
		const referenceField = kind === "condition" ? "conditionId" : "effectId";
		if (
			record.type === referenceType &&
			isID(record[referenceField]) &&
			idValue(record[referenceField]) === id
		) {
			return true;
		}
		return Object.values(record).some(visit);
	}

	return visit(value);
}

function addUsage(
	usages: LogicUsage[],
	kind: LogicUsage["kind"],
	id: string,
	label: string,
	detail: string,
) {
	usages.push({key: `${kind}:${id}`, kind, id, label, detail} as LogicUsage);
}

export function findLogicUsages(world: World, kind: LogicLibraryKind, id: string): LogicUsage[] {
	const usages: LogicUsage[] = [];

	for (const command of world.commands) {
		if (containsReference(command, kind, id)) {
			addUsage(usages, "command", idValue(command.id), command.name || "Unnamed command", "Command");
		}
	}
	for (const event of world.events ?? []) {
		if (containsReference(event, kind, id)) {
			addUsage(usages, "event", idValue(event.id), event.name || "Unnamed event", "Event");
		}
	}
	for (const condition of world.conditions) {
		const conditionId = idValue(condition.identity);
		if (conditionId !== id && containsReference(condition.condition, kind, id)) {
			addUsage(
				usages,
				"condition",
				conditionId,
				condition.name || "Unnamed condition",
				"Reusable condition",
			);
		}
	}
	for (const effect of world.effects) {
		const effectId = idValue(effect.id);
		if (effectId !== id && containsReference(effect, kind, id)) {
			addUsage(usages, "effect", effectId, effect.name || "Unnamed effect", "Reusable effect");
		}
	}
	for (const item of world.items) {
		if (containsReference(item, kind, id)) {
			addUsage(usages, "item", idValue(item.id), item.name || "Unnamed item", "Item");
		}
	}
	for (const room of world.rooms) {
		if (containsReference(room, kind, id)) {
			addUsage(usages, "room", idValue(room.id), room.name || "Unnamed room", "Room");
		}
	}

	return usages;
}
