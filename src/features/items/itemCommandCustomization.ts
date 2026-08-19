import {effectiveItemTags} from "@/features/items/itemBehaviors";
import {CommandSchema, type Command, type CommandBlock} from "@/schemas/world/commandSchemas";
import type {Item} from "@/schemas/world/itemSchema";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds, generateUniqueId, idValue, isID, type ID} from "@/utils/idUtils";

type ItemTargetBlock = Extract<CommandBlock, {type: "target"}>;
type EmbeddedIdType = "command-block" | "condition-branch" | "effect";

function targetCanResolveItem(block: ItemTargetBlock, item: Item): boolean {
	if (block.entityTypes.length > 0 && !block.entityTypes.includes("item")) return false;
	if (
		block.entityIds.length > 0 &&
		!block.entityIds.some((candidate) => compareIds(candidate, item.id))
	) {
		return false;
	}
	const tags = effectiveItemTags(item);
	return block.tagMode === "all"
		? block.tags.every((tag) => tags.has(tag))
		: block.tags.length === 0 || block.tags.some((tag) => tags.has(tag));
}

export function findItemMatchingTargetBlocks(command: Command, item: Item): ItemTargetBlock[] {
	const matches = new Map<string, ItemTargetBlock>();
	for (const pattern of command.patterns) {
		for (const block of pattern.blocks) {
			if (block.type === "target" && targetCanResolveItem(block, item)) {
				matches.set(idValue(block.id), block);
			}
		}
	}
	return [...matches.values()];
}

export function commandExplicitlyTargetsItem(command: Command, item: Item): boolean {
	return command.patterns.some((pattern) =>
		pattern.blocks.some(
			(block) =>
				block.type === "target" && block.entityIds.some((candidate) => compareIds(candidate, item.id)),
		),
	);
}

export function commandIsItemCustomization(command: Command, item: Item): boolean {
	return Boolean(
		command.customization?.type === "item-command-customization" &&
		compareIds(command.customization.itemId, item.id),
	);
}

function cloneValue<T>(value: T): T {
	return typeof structuredClone === "function"
		? structuredClone(value)
		: (JSON.parse(JSON.stringify(value)) as T);
}

function collectIds(world: World, type: EmbeddedIdType): Array<{id: ID}> {
	const ids: Array<{id: ID}> = [];
	const seen = new Set<object>();

	function visit(value: unknown) {
		if (!value || typeof value !== "object" || seen.has(value)) return;
		seen.add(value);
		if (isID(value)) {
			if (value.type === type) ids.push({id: value});
			return;
		}
		if (Array.isArray(value)) {
			value.forEach(visit);
			return;
		}
		Object.values(value).forEach(visit);
	}

	visit(world);
	return ids;
}

function remapEmbeddedIds(
	command: Command,
	world: World,
): {command: Command; commandBlockIds: Map<string, ID<"command-block">>} {
	const next = cloneValue(command);
	const existing = {
		"command-block": collectIds(world, "command-block"),
		"condition-branch": collectIds(world, "condition-branch"),
		effect: collectIds(world, "effect"),
	};
	const mappings = {
		"command-block": new Map<string, ID<"command-block">>(),
		"condition-branch": new Map<string, ID<"condition-branch">>(),
		effect: new Map<string, ID<"effect">>(),
	};

	function allocate<TType extends EmbeddedIdType>(type: TType, oldId: string): ID<TType> {
		const map = mappings[type] as Map<string, ID<TType>>;
		const existingMapping = map.get(oldId);
		if (existingMapping) return existingMapping;
		const nextId = generateUniqueId(type, existing[type]) as ID<TType>;
		existing[type].push({id: nextId});
		map.set(oldId, nextId);
		return nextId;
	}

	function visit(value: unknown, key?: string): unknown {
		if (!value || typeof value !== "object") return value;
		if (isID(value)) {
			if (value.type === "command-block") return allocate("command-block", idValue(value));
			if (key === "id" && value.type === "condition-branch") {
				return allocate("condition-branch", idValue(value));
			}
			if (key === "id" && value.type === "effect") return allocate("effect", idValue(value));
			return value;
		}
		if (Array.isArray(value)) return value.map((child) => visit(child));
		return Object.fromEntries(
			Object.entries(value).map(([childKey, child]) => [childKey, visit(child, childKey)]),
		);
	}

	return {
		command: visit(next) as Command,
		commandBlockIds: mappings["command-block"],
	};
}

export function createItemCommandCustomization(
	world: World,
	item: Item,
	sourceCommand: Command,
	targetBlockId: ID<"command-block">,
): Command {
	const sourceTarget = findItemMatchingTargetBlocks(sourceCommand, item).find((block) =>
		compareIds(block.id, targetBlockId),
	);
	if (!sourceTarget) {
		throw new Error("The selected command target cannot resolve this item.");
	}

	const remapped = remapEmbeddedIds(sourceCommand, world);
	const customized = remapped.command;
	const newCommandId = generateUniqueId("command", world.commands);
	const customizedTargetId = remapped.commandBlockIds.get(idValue(sourceTarget.id));
	if (!customizedTargetId) throw new Error("The customized command target could not be created.");

	for (const pattern of customized.patterns) {
		for (const block of pattern.blocks) {
			if (block.type === "target" && compareIds(block.id, customizedTargetId)) {
				block.entityIds = [item.id];
			}
		}
	}

	customized.id = newCommandId;
	customized.name = `${sourceCommand.name} (Customized for ${item.name})`;
	customized.showInHelp = false;
	customized.customization = {
		type: "item-command-customization",
		sourceCommandId: sourceCommand.id,
		itemId: item.id,
		targetBlockId: customizedTargetId,
	};

	return CommandSchema.parse(customized);
}
