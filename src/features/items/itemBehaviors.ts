import type {Draft} from "immer";
import {
	ITEM_BEHAVIOR_SCHEMAS,
	ItemBehaviorSchema,
	type Item,
	type ItemBehavior,
} from "@/schemas/world/itemSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {getEditorMetadata} from "@/utils/editorMetadata";
import type {ID} from "@/utils/idUtils";

type ItemBehaviorDefaults = {
	connectionId?: ID<"connection">;
};

export const ITEM_BEHAVIOR_DEFINITIONS = ITEM_BEHAVIOR_SCHEMAS.map((schema) => {
	const value = createDefaultFieldObject(schema);
	const metadata = getEditorMetadata(schema);
	return {
		type: value.type,
		label: metadata?.title ?? value.type,
		description: metadata?.description ?? "Item capability",
		discoveryTerms: new Set(metadata?.discovery?.keywords ?? []),
		requires: (metadata?.discovery?.requires ?? []).filter((requirement) =>
			ITEM_BEHAVIOR_SCHEMAS.some(
				(candidate) => createDefaultFieldObject(candidate).type === requirement,
			),
		) as ItemBehavior["type"][],
		actions: "actions" in value ? value.actions.map((action) => action.action) : [],
		schema,
	};
});

export function itemBehaviorTypeForTag(value: string): ItemBehavior["type"] | undefined {
	const normalized = value.trim().toLowerCase();
	return ITEM_BEHAVIOR_DEFINITIONS.find((definition) => definition.type === normalized)?.type;
}

export function createItemBehavior(
	type: ItemBehavior["type"],
	defaults: ItemBehaviorDefaults = {},
): ItemBehavior {
	const schema = ITEM_BEHAVIOR_SCHEMAS.find(
		(candidate) => createDefaultFieldObject(candidate).type === type,
	);
	if (!schema) throw new Error(`Unknown item behavior: ${type}`);
	const value = createDefaultFieldObject(schema);
	if (type === "door") {
		if (!defaults.connectionId) throw new Error("Door behavior requires a connection.");
		return ItemBehaviorSchema.parse({...value, connectionId: defaults.connectionId});
	}
	return ItemBehaviorSchema.parse(value);
}

export function addItemBehaviorDraft(
	draft: Draft<Item>,
	type: ItemBehavior["type"],
	defaults: ItemBehaviorDefaults = {},
): boolean {
	draft.tags = draft.tags.filter((tag) => itemBehaviorTypeForTag(tag) !== type);
	if (draft.behaviors.some((behavior) => behavior.type === type)) return true;
	if (type === "door" && !defaults.connectionId) return false;
	const definition = ITEM_BEHAVIOR_DEFINITIONS.find((candidate) => candidate.type === type);
	for (const requirement of definition?.requires ?? [])
		addItemBehaviorDraft(draft, requirement, defaults);
	draft.behaviors.push(createItemBehavior(type, defaults));
	return true;
}

export function removeItemBehaviorDraft(draft: Draft<Item>, type: ItemBehavior["type"]): void {
	draft.behaviors = draft.behaviors.filter((behavior) => behavior.type !== type);
	if (type === "openable") draft.initialState.open = false;
	if (type === "lockable") draft.initialState.locked = false;
}

export function behaviorDependents(
	item: Pick<Item, "behaviors">,
	type: ItemBehavior["type"],
): ItemBehavior["type"][] {
	const activeTypes = new Set(item.behaviors.map((behavior) => behavior.type));
	return ITEM_BEHAVIOR_DEFINITIONS.filter(
		(definition) => activeTypes.has(definition.type) && definition.requires.includes(type),
	).map((definition) => definition.type);
}

export function isDefaultItemBehavior(behavior: ItemBehavior): boolean {
	return (
		JSON.stringify(behavior) ===
		JSON.stringify(
			createItemBehavior(behavior.type, {
				connectionId: behavior.type === "door" ? behavior.connectionId : undefined,
			}),
		)
	);
}

export function replaceItemTagsAndBehaviorsDraft(
	draft: Draft<Item>,
	values: string[],
	defaults: ItemBehaviorDefaults = {},
): void {
	const requestedBehaviors = new Set(
		values
			.map(itemBehaviorTypeForTag)
			.filter((value): value is ItemBehavior["type"] => Boolean(value)),
	);
	for (const type of requestedBehaviors) addItemBehaviorDraft(draft, type, defaults);
	for (const behavior of [...draft.behaviors]) {
		if (
			!requestedBehaviors.has(behavior.type) &&
			behaviorDependents(draft, behavior.type).length === 0
		) {
			removeItemBehaviorDraft(draft, behavior.type);
		}
	}
	draft.tags = values.filter((value) => !itemBehaviorTypeForTag(value));
}

export function effectiveItemTags(item: Pick<Item, "behaviors" | "tags">): Set<string> {
	return new Set([...item.tags, ...item.behaviors.map((behavior) => behavior.type)]);
}
