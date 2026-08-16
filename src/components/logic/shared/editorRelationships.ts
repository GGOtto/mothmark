import type {Command, CommandBlock} from "@/schemas/world/commandSchemas";
import type {Item} from "@/schemas/world/itemSchema";
import type {World} from "@/schemas/world/worldSchema";
import type {CommandVariableCatalog} from "@/features/command-variables";
import {buildCommandVariableCatalog} from "@/features/command-variables";
import {ConditionSchema} from "@/schemas/world/conditionSchema";
import {CommandEffectGroupSchema} from "@/schemas/world/commandLogicSchemas";
import {EffectGroupSchema, EffectSchema} from "@/schemas/world/effectSchema";
import {schemaLogicOptions} from "@/components/universal-editor/utils/editorSchemaVariants";
import type {z} from "zod";
import {produce} from "immer";
import {compareIds, idValue, isID} from "@/utils/idUtils";
import type {ID} from "@/utils/idUtils";
import {effectiveItemTags} from "@/features/items/itemBehaviors";
import type {LogicLibraryKind, LogicUsage} from "./logicLibraryUsage";
import {CommandConditionEditorSchema, EventConditionEditorSchema} from "./logicEditorSchemas";

const CONDITION_OPTION_KEYS = new Set(
	schemaLogicOptions(ConditionSchema).map((option) => option.key),
);
const EFFECT_OPTION_KEYS = new Set(schemaLogicOptions(EffectSchema).map((option) => option.key));

function matchesLogicOption(record: Record<string, unknown>, keys: Set<string>) {
	const type = typeof record.type === "string" ? record.type : "";
	if (!type) return false;
	const operation = record.operation ?? record.messageType;
	return keys.has(`${type}:${typeof operation === "string" ? operation : ""}`);
}

function countLogic(value: unknown, kind: LogicLibraryKind, seen = new Set<object>()): number {
	if (!value || typeof value !== "object" || seen.has(value)) return 0;
	seen.add(value);
	if (Array.isArray(value))
		return value.reduce((count, child) => count + countLogic(child, kind, seen), 0);

	const record = value as Record<string, unknown>;
	if (kind === "condition") {
		if (record.type === "group" && Array.isArray(record.conditions)) {
			return record.conditions.reduce(
				(count: number, child: unknown) => count + countLogic(child, kind, seen),
				0,
			);
		}
		if (matchesLogicOption(record, CONDITION_OPTION_KEYS)) {
			return 1;
		}
	} else {
		if (record.type === "group" && Array.isArray(record.effects)) {
			return record.effects.reduce(
				(count: number, child: unknown) => count + countLogic(child, kind, seen),
				0,
			);
		}
		if (matchesLogicOption(record, EFFECT_OPTION_KEYS)) {
			return 1;
		}
	}

	return Object.values(record).reduce(
		(count: number, child: unknown) => count + countLogic(child, kind, seen),
		0,
	);
}

function sourceUsage(
	kind: LogicUsage["kind"],
	id: string,
	label: string,
	detail: string,
): LogicUsage {
	return {key: `${kind}:${id}`, kind, id, label, detail} as LogicUsage;
}

export type LogicSourceSummary = {
	count: number;
	usage: LogicUsage;
};

export type LogicOccurrence = {
	key: string;
	path: Array<string | number>;
	schema: z.ZodTypeAny;
	value: unknown;
	savedId: string | null;
	commandVariableCatalog?: CommandVariableCatalog;
};

function commandCatalogForPath(command: Command, path: Array<string | number>) {
	const fallbackIndex = path.findIndex((segment) => segment === "fallbacks");
	const index = fallbackIndex >= 0 ? path[fallbackIndex + 1] : undefined;
	const failedBlockId = typeof index === "number" ? command.fallbacks[index]?.blockId : undefined;
	return buildCommandVariableCatalog(command, failedBlockId);
}

function usageRoot(world: World, usage: LogicUsage): unknown {
	switch (usage.kind) {
		case "command":
			return world.commands.find((entry) => idValue(entry.id) === usage.id);
		case "event":
			return world.events?.find((entry) => idValue(entry.id) === usage.id);
		case "condition":
			return world.conditions.find((entry) => idValue(entry.identity) === usage.id);
		case "effect":
			return world.effects.find((entry) => idValue(entry.id) === usage.id);
		case "item":
			return world.items.find((entry) => idValue(entry.id) === usage.id);
		case "room":
			return world.rooms.find((entry) => idValue(entry.id) === usage.id);
	}
}

/** Concrete inline logic and saved references contained by one authored parent. */
export function findLogicOccurrences(
	world: World,
	usage: LogicUsage,
	kind: LogicLibraryKind,
): LogicOccurrence[] {
	const occurrences: LogicOccurrence[] = [];
	const seen = new Set<object>();
	const command =
		usage.kind === "command" ? world.commands.find((entry) => idValue(entry.id) === usage.id) : null;
	const commandVariableCatalog = command ? commandCatalogForPath(command, []) : undefined;

	function visit(value: unknown, path: Array<string | number>) {
		if (!value || typeof value !== "object" || seen.has(value)) return;
		seen.add(value);
		if (Array.isArray(value)) {
			value.forEach((child, index) => visit(child, [...path, index]));
			return;
		}

		const record = value as Record<string, unknown>;
		if (kind === "condition") {
			if (record.type === "group" && Array.isArray(record.conditions)) {
				occurrences.push({
					key: `${usage.key}:${path.join(".") || "root"}`,
					path,
					schema: command ? CommandConditionEditorSchema : EventConditionEditorSchema,
					value,
					savedId: null,
					commandVariableCatalog: command
						? commandCatalogForPath(command, path)
						: commandVariableCatalog,
				});
				return;
			}
			if (matchesLogicOption(record, CONDITION_OPTION_KEYS)) {
				occurrences.push({
					key: `${usage.key}:${path.join(".") || "root"}`,
					path,
					schema: command ? CommandConditionEditorSchema : EventConditionEditorSchema,
					value,
					savedId:
						record.type === "condition-ref" && isID(record.conditionId)
							? idValue(record.conditionId)
							: null,
					commandVariableCatalog: command
						? commandCatalogForPath(command, path)
						: commandVariableCatalog,
				});
				return;
			}
		} else {
			if (record.type === "group" && Array.isArray(record.effects)) {
				occurrences.push({
					key: `${usage.key}:${path.join(".") || "root"}`,
					path,
					schema: command ? CommandEffectGroupSchema : EffectGroupSchema,
					value,
					savedId: null,
					commandVariableCatalog: command
						? commandCatalogForPath(command, path)
						: commandVariableCatalog,
				});
				return;
			}
			if (matchesLogicOption(record, EFFECT_OPTION_KEYS)) {
				occurrences.push({
					key: `${usage.key}:${path.join(".") || "root"}`,
					path,
					schema: EffectSchema,
					value,
					savedId:
						record.type === "effect-ref" && isID(record.effectId) ? idValue(record.effectId) : null,
				});
				return;
			}
		}

		Object.entries(record).forEach(([key, child]) => visit(child, [...path, key]));
	}

	const root = usageRoot(world, usage);
	if (root) visit(root, []);
	return occurrences;
}

export function replaceLogicOccurrence(
	world: World,
	usage: LogicUsage,
	path: Array<string | number>,
	value: unknown,
): World {
	return produce(world, (draft) => {
		const root = usageRoot(draft as World, usage);
		if (!root || typeof root !== "object") return;
		if (path.length === 0) return;
		let parent = root as Record<string | number, unknown>;
		for (const segment of path.slice(0, -1)) {
			const child = parent[segment];
			if (!child || typeof child !== "object") return;
			parent = child as Record<string | number, unknown>;
		}
		parent[path.at(-1)!] = value;
	});
}

/**
 * Returns the authored entities that currently contain condition/effect logic.
 * This is deliberately derived from the live world instead of persisted as a
 * second index, so editor relationship pages cannot drift from their sources.
 */
export function findLogicSources(world: World, kind: LogicLibraryKind): LogicSourceSummary[] {
	const noun = kind === "condition" ? "condition" : "effect";
	const sources: LogicSourceSummary[] = [];
	const add = (usage: LogicUsage, value: unknown) => {
		const count = countLogic(value, kind);
		if (count > 0)
			sources.push({count, usage: {...usage, detail: `${count} ${noun}${count === 1 ? "" : "s"}`}});
	};

	for (const command of world.commands) {
		add(
			sourceUsage("command", idValue(command.id), command.name || "Unnamed command", "Command"),
			command,
		);
	}
	for (const event of world.events ?? []) {
		add(sourceUsage("event", idValue(event.id), event.name || "Unnamed event", "Event"), event);
	}
	for (const item of world.items) {
		add(sourceUsage("item", idValue(item.id), item.name || "Unnamed item", "Item"), item);
	}
	for (const room of world.rooms) {
		add(sourceUsage("room", idValue(room.id), room.name || "Unnamed room", "Room"), room);
	}

	return sources;
}

function containsItemReference(value: unknown, item: Item, seen = new Set<object>()): boolean {
	if (!value || typeof value !== "object" || seen.has(value)) return false;
	seen.add(value);
	if (isID(value)) return value.type === "item" && compareIds(value, item.id);
	if (Array.isArray(value)) return value.some((child) => containsItemReference(child, item, seen));
	return Object.values(value).some((child) => containsItemReference(child, item, seen));
}

function itemTargetTags(item: Item): Set<string> {
	return effectiveItemTags(item);
}

function targetCanResolveItem(block: Extract<CommandBlock, {type: "target"}>, item: Item): boolean {
	if (block.entityTypes.length > 0 && !block.entityTypes.includes("item")) return false;
	if (
		block.entityIds.length > 0 &&
		!block.entityIds.some((candidate) => compareIds(candidate, item.id))
	) {
		return false;
	}
	const tags = itemTargetTags(item);
	return block.tagMode === "all"
		? block.tags.every((tag) => tags.has(tag))
		: block.tags.length === 0 || block.tags.some((tag) => tags.has(tag));
}

function matchingTargetBlocks(command: Command, item: Item) {
	const matches = new Map<string, Extract<CommandBlock, {type: "target"}>>();
	for (const pattern of command.patterns) {
		for (const block of pattern.blocks) {
			if (block.type === "target" && targetCanResolveItem(block, item)) {
				matches.set(idValue(block.id), block);
			}
		}
	}
	return [...matches.values()];
}

function collectionLogicCanMatchItem(
	value: unknown,
	item: Item,
	seen = new Set<object>(),
): boolean {
	if (!value || typeof value !== "object" || seen.has(value)) return false;
	seen.add(value);
	if (Array.isArray(value))
		return value.some((child) => collectionLogicCanMatchItem(child, item, seen));
	const record = value as Record<string, unknown>;
	if (record.type === "items" && typeof record.operation === "string") {
		if (isID(record.templateItemId) && compareIds(record.templateItemId, item.id)) return true;
		const tag = typeof record.tag === "string" ? record.tag.trim() : "";
		if (!tag || itemTargetTags(item).has(tag)) return true;
	}
	return Object.values(record).some((child) => collectionLogicCanMatchItem(child, item, seen));
}

function referencedLogicCanAffectItem(
	world: World,
	value: unknown,
	item: Item,
	seenObjects = new Set<object>(),
	seenReferences = new Set<string>(),
): boolean {
	if (!value || typeof value !== "object" || seenObjects.has(value)) return false;
	seenObjects.add(value);
	if (isID(value)) return value.type === "item" && compareIds(value, item.id);
	if (Array.isArray(value)) {
		return value.some((child) =>
			referencedLogicCanAffectItem(world, child, item, seenObjects, seenReferences),
		);
	}

	const record = value as Record<string, unknown>;
	if (record.type === "items" && typeof record.operation === "string") {
		if (isID(record.templateItemId) && compareIds(record.templateItemId, item.id)) return true;
		const tag = typeof record.tag === "string" ? record.tag.trim() : "";
		if (!tag || itemTargetTags(item).has(tag)) return true;
	}

	if (record.type === "condition-ref" && isID(record.conditionId)) {
		const referenceId = idValue(record.conditionId);
		const key = `condition:${referenceId}`;
		if (!seenReferences.has(key)) {
			seenReferences.add(key);
			const condition = world.conditions.find(
				(candidate) => idValue(candidate.identity) === referenceId,
			);
			if (
				condition &&
				referencedLogicCanAffectItem(world, condition.condition, item, seenObjects, seenReferences)
			) {
				return true;
			}
		}
	}

	if (record.type === "effect-ref" && isID(record.effectId)) {
		const referenceId = idValue(record.effectId);
		const key = `effect:${referenceId}`;
		if (!seenReferences.has(key)) {
			seenReferences.add(key);
			const effect = world.effects.find((candidate) => idValue(candidate.id) === referenceId);
			if (effect && referencedLogicCanAffectItem(world, effect, item, seenObjects, seenReferences)) {
				return true;
			}
		}
	}

	return Object.values(record).some((child) =>
		referencedLogicCanAffectItem(world, child, item, seenObjects, seenReferences),
	);
}

function referencedDefinitionsCanAffectItem(
	world: World,
	value: unknown,
	item: Item,
	seen = new Set<object>(),
): boolean {
	if (!value || typeof value !== "object" || seen.has(value)) return false;
	seen.add(value);
	if (Array.isArray(value)) {
		return value.some((child) => referencedDefinitionsCanAffectItem(world, child, item, seen));
	}
	const record = value as Record<string, unknown>;
	if (record.type === "condition-ref" && isID(record.conditionId)) {
		const referenceId = idValue(record.conditionId);
		const condition = world.conditions.find(
			(candidate) => idValue(candidate.identity) === referenceId,
		);
		if (condition && referencedLogicCanAffectItem(world, condition.condition, item)) return true;
	}
	if (record.type === "effect-ref" && isID(record.effectId)) {
		const referenceId = idValue(record.effectId);
		const effect = world.effects.find((candidate) => idValue(candidate.id) === referenceId);
		if (effect && referencedLogicCanAffectItem(world, effect, item)) return true;
	}
	return Object.values(record).some((child) =>
		referencedDefinitionsCanAffectItem(world, child, item, seen),
	);
}

export type ItemCommandRelationship = {
	command: Command;
	reasons: string[];
};

/** Every authored command that can currently name, select, query, or mutate an item. */
export function findItemCommandRelationships(world: World, item: Item): ItemCommandRelationship[] {
	return world.commands.flatMap((command) => {
		const reasons = new Set<string>();
		if (containsItemReference(command, item)) reasons.add("References this item directly");
		const targets = matchingTargetBlocks(command, item);
		if (targets.length > 0) {
			const tagLabels = [...new Set(targets.flatMap((target) => target.tags))];
			reasons.add(
				tagLabels.length > 0
					? `Can target this item through ${tagLabels.join(", ")}`
					: "Can target this item",
			);
		}
		if (collectionLogicCanMatchItem(command, item))
			reasons.add("Can query or affect this item dynamically");
		if (referencedDefinitionsCanAffectItem(world, command, item))
			reasons.add("A saved condition or effect can use or affect this item");
		return reasons.size > 0 ? [{command, reasons: [...reasons]}] : [];
	});
}

export type EntityReferenceUsage = {
	key: string;
	label: string;
	detail: string;
};

function containsTypedReference(value: unknown, reference: ID, seen = new Set<object>()): boolean {
	if (!value || typeof value !== "object" || seen.has(value)) return false;
	seen.add(value);
	if (isID(value)) return compareIds(value, reference);
	if (Array.isArray(value))
		return value.some((child) => containsTypedReference(child, reference, seen));
	return Object.values(value).some((child) => containsTypedReference(child, reference, seen));
}

/** Top-level authored records that would be changed or removed with an entity. */
export function findEntityReferenceUsages(world: World, reference: ID): EntityReferenceUsage[] {
	const usages: EntityReferenceUsage[] = [];
	const addCollection = (
		kind: string,
		detail: string,
		entries: ReadonlyArray<{id?: unknown; identity?: unknown; name?: string}>,
	) => {
		for (const entry of entries) {
			const entryId = isID(entry.id) ? entry.id : isID(entry.identity) ? entry.identity : null;
			if (entryId && compareIds(entryId, reference)) continue;
			if (!containsTypedReference(entry, reference)) continue;
			const id = entryId ? idValue(entryId) : `${kind}-${usages.length + 1}`;
			usages.push({
				key: `${kind}:${id}`,
				label: entry.name || `Unnamed ${kind}`,
				detail,
			});
		}
	};

	if (reference.type === "room" && compareIds(world.startRoomId, reference)) {
		usages.push({key: "world:start-room", label: "Starting room", detail: "World setting"});
	}
	addCollection("room", "Room", world.rooms);
	addCollection("connection", "Connection", world.connections);
	addCollection("item", "Item", world.items);
	addCollection("command", "Command", world.commands);
	addCollection("condition", "Reusable condition", world.conditions);
	addCollection("effect", "Reusable effect", world.effects);
	addCollection("event", "Event", world.events ?? []);
	return usages;
}
