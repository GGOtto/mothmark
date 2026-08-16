import type {Draft} from "immer";
import {resolveItemIcon} from "@/itemIcons";
import {
	ITEM_ICON_CATALOG,
	type ItemIconCategory,
	type ItemIconCategoryDefinition,
} from "@/itemIcons/itemIconCatalog";
import {
	addItemBehaviorDraft,
	effectiveItemTags,
	ITEM_BEHAVIOR_DEFINITIONS,
	itemBehaviorTypeForTag,
} from "@/features/items/itemBehaviors";
import type {Item, ItemBehavior} from "@/schemas/world/itemSchema";
import type {World} from "@/schemas/world/worldSchema";
import {compareIds, idValue} from "@/utils/idUtils";
import type {LexicalAliasCandidate, LexicalConceptCandidate} from "./lexicalSchemas";
import {normalizeSuggestedTag, normalizeSuggestionText} from "./suggestionText";

export type AliasSuggestion = {
	value: string;
	reason: string;
	confidence: "strong" | "possible";
};

export type TagConnectionKind = "items" | "command" | "condition" | "effect" | "requirement";

export type TagConnection = {
	kind: TagConnectionKind;
	key: string;
	label: string;
};

export type TagSuggestion = {
	tag: string;
	label: string;
	reason: string;
	enables: string;
	connections: TagConnection[];
	change: {type: "tag"} | {type: "behavior"; behavior: ItemBehavior["type"]};
	warning?: string;
};

export type WorldTagGraph = {
	connections: Map<string, TagConnection[]>;
};

const RESERVED_ALIASES = new Set([
	"a",
	"an",
	"the",
	"in",
	"into",
	"on",
	"onto",
	"with",
	"to",
	"from",
	"north",
	"south",
	"east",
	"west",
	"up",
	"down",
	"item",
	"object",
	"thing",
]);

const ICON_DEFINITIONS_BY_CATEGORY = new Map(
	ITEM_ICON_CATALOG.map((definition) => [definition.id, definition] as const),
);

type ItemTaxonomyContext = {
	branchCategories: Set<ItemIconCategory>;
	branchTerms: Set<string>;
	leaf?: ItemIconCategoryDefinition;
};

function itemTaxonomyContext(item: Item): ItemTaxonomyContext {
	const resolution = resolveItemIcon(item);
	if (resolution.category === "generic") {
		return {branchCategories: new Set(), branchTerms: new Set()};
	}
	const branchCategories = new Set<ItemIconCategory>();
	const pending: ItemIconCategory[] = [resolution.category];
	while (pending.length) {
		const category = pending.shift();
		if (!category || branchCategories.has(category)) continue;
		branchCategories.add(category);
		pending.push(...(ICON_DEFINITIONS_BY_CATEGORY.get(category)?.parents ?? []));
	}
	const branchTerms = new Set<string>();
	for (const category of branchCategories) {
		const definition = ICON_DEFINITIONS_BY_CATEGORY.get(category);
		if (!definition) continue;
		branchTerms.add(normalizeSuggestedTag(definition.id));
		for (const term of [...definition.identityTerms, ...definition.categoryTerms]) {
			branchTerms.add(normalizeSuggestedTag(term));
		}
	}
	return {
		branchCategories,
		branchTerms,
		leaf: ICON_DEFINITIONS_BY_CATEGORY.get(resolution.category),
	};
}

function addConnection(graph: WorldTagGraph, tag: string, connection: TagConnection): void {
	const normalized = normalizeSuggestedTag(tag);
	if (!normalized) return;
	const entries = graph.connections.get(normalized) ?? [];
	if (!entries.some((entry) => entry.key === connection.key)) entries.push(connection);
	graph.connections.set(normalized, entries);
}

function visitTagReferences(
	value: unknown,
	owner: TagConnection,
	graph: WorldTagGraph,
	seen = new Set<object>(),
): void {
	if (!value || typeof value !== "object" || seen.has(value)) return;
	seen.add(value);
	if (Array.isArray(value)) {
		value.forEach((entry) => visitTagReferences(entry, owner, graph, seen));
		return;
	}
	const record = value as Record<string, unknown>;
	const entityType = typeof record.type === "string" ? record.type : undefined;
	if (
		typeof record.tag === "string" &&
		(entityType === undefined ||
			entityType === "item" ||
			entityType === "items" ||
			entityType === "tag")
	) {
		addConnection(graph, record.tag, owner);
	}
	Object.values(record).forEach((entry) => visitTagReferences(entry, owner, graph, seen));
}

export function buildWorldTagGraph(world: World, excludedItemId?: Item["id"]): WorldTagGraph {
	const graph: WorldTagGraph = {connections: new Map()};
	for (const item of world.items) {
		if (excludedItemId && compareIds(item.id, excludedItemId)) continue;
		for (const tag of effectiveItemTags(item)) {
			addConnection(graph, tag, {
				kind: "items",
				key: `item:${idValue(item.id)}`,
				label: item.name || "Unnamed item",
			});
		}
		visitTagReferences(
			item.behaviors,
			{
				kind: "requirement",
				key: `item-requirement:${idValue(item.id)}`,
				label: `${item.name || "Unnamed item"} behavior`,
			},
			graph,
		);
	}
	for (const command of world.commands) {
		for (const block of command.patterns.flatMap((pattern) => pattern.blocks)) {
			if (
				block.type !== "target" ||
				(block.entityTypes.length > 0 && !block.entityTypes.includes("item"))
			) {
				continue;
			}
			for (const tag of block.tags) {
				addConnection(graph, tag, {
					kind: "command",
					key: `command:${idValue(command.id)}:${idValue(block.id)}`,
					label: command.name || "Unnamed command",
				});
			}
		}
		visitTagReferences(
			command,
			{
				kind: "condition",
				key: `command-logic:${idValue(command.id)}`,
				label: `${command.name || "Unnamed command"} logic`,
			},
			graph,
		);
	}
	for (const condition of world.conditions) {
		visitTagReferences(
			condition,
			{
				kind: "condition",
				key: `condition:${idValue(condition.identity)}`,
				label: condition.name || "Unnamed condition",
			},
			graph,
		);
	}
	for (const effect of world.effects) {
		visitTagReferences(
			effect,
			{
				kind: "effect",
				key: `effect:${idValue(effect.id)}`,
				label: effect.name || "Unnamed effect",
			},
			graph,
		);
	}
	for (const event of world.events ?? []) {
		visitTagReferences(
			event,
			{
				kind: "condition",
				key: `event:${idValue(event.id)}`,
				label: event.name || "Unnamed event",
			},
			graph,
		);
	}
	return graph;
}

export function buildAliasCollisionIndex(world: World, currentItem: Item): Map<string, Item[]> {
	const index = new Map<string, Item[]>();
	for (const item of world.items) {
		if (compareIds(item.id, currentItem.id)) continue;
		for (const phrase of [item.name, ...item.aliases]) {
			const normalized = normalizeSuggestionText(phrase);
			if (!normalized) continue;
			const keys = new Set([normalized]);
			const words = normalized.split(" ");
			if (words.length > 1) keys.add(words.at(-1)!);
			for (const key of keys) {
				const matches = index.get(key) ?? [];
				if (!matches.some((match) => compareIds(match.id, item.id))) matches.push(item);
				index.set(key, matches);
			}
		}
	}
	return index;
}

function phraseCandidates(item: Item): LexicalAliasCandidate[] {
	const candidates: LexicalAliasCandidate[] = [];
	for (const source of [item.name, ...item.aliases]) {
		const normalized = normalizeSuggestionText(source);
		if (!normalized) continue;
		if (normalized !== source.trim().toLowerCase()) {
			candidates.push({value: normalized, relation: "phrase", evidence: `Simplifies “${source}”.`});
		}
		const words = normalized.split(" ");
		if (words.length > 1) {
			const maximumPhraseWords = Math.min(3, words.length - 1);
			for (let wordCount = maximumPhraseWords; wordCount >= 1; wordCount -= 1) {
				const value = words.slice(-wordCount).join(" ");
				candidates.push({
					value,
					relation: "phrase",
					evidence:
						wordCount === 1
							? `Uses the head word from “${source}”.`
							: `Uses the trailing object phrase from “${source}”.`,
				});
			}
		}
	}
	return candidates;
}

function taxonomyAliasCandidates(item: Item): LexicalAliasCandidate[] {
	const context = itemTaxonomyContext(item);
	if (!context.leaf) return [];
	const resolution = resolveItemIcon(item);
	if (
		resolution.reason !== "manual-override" &&
		!resolution.evidence.some(
			(evidence) => evidence.source === "name" || evidence.source === "aliases",
		)
	) {
		return [];
	}
	const sources = [item.name, ...item.aliases];
	const candidates: LexicalAliasCandidate[] = [];
	for (const source of sources) {
		const normalizedSource = normalizeSuggestionText(source);
		if (!normalizedSource) continue;
		const objectWord = normalizedSource.split(" ").at(-1)!;
		for (const term of context.leaf.identityTerms) {
			const normalizedTerm = normalizeSuggestionText(term);
			if (
				normalizedTerm.length >= 4 &&
				objectWord !== normalizedTerm &&
				objectWord.endsWith(normalizedTerm)
			) {
				candidates.push({
					value: term,
					relation: "phrase",
					evidence: `Uses the recognizable object word from “${source}”.`,
				});
			}
		}
	}
	return candidates;
}

function allAliasCandidates(
	item: Item,
	lexical: readonly LexicalAliasCandidate[],
): LexicalAliasCandidate[] {
	return [...phraseCandidates(item), ...taxonomyAliasCandidates(item), ...lexical];
}

export function createAliasSuggestions(
	item: Item,
	world: World,
	lexical: readonly LexicalAliasCandidate[],
	collisionIndex = buildAliasCollisionIndex(world, item),
): AliasSuggestion[] {
	const existing = new Set([item.name, ...item.aliases].map(normalizeSuggestionText));
	const suggestions = new Map<string, AliasSuggestion>();
	for (const candidate of allAliasCandidates(item, lexical)) {
		if (candidate.relation === "broader") continue;
		const normalized = normalizeSuggestionText(candidate.value);
		if (
			!normalized ||
			existing.has(normalized) ||
			collisionIndex.has(normalized) ||
			RESERVED_ALIASES.has(normalized)
		) {
			continue;
		}
		if (!suggestions.has(normalized)) {
			suggestions.set(normalized, {
				value: candidate.value.replaceAll("_", " "),
				reason: candidate.evidence,
				confidence: "strong",
			});
		}
	}
	return [...suggestions.values()].slice(0, 5);
}

export function emptyAliasSuggestionMessage(
	item: Item,
	lexical: readonly LexicalAliasCandidate[],
	collisionIndex: Map<string, Item[]>,
): string {
	for (const candidate of allAliasCandidates(item, lexical)) {
		const normalized = normalizeSuggestionText(candidate.value);
		const collisions = collisionIndex.get(normalized);
		if (!collisions?.length) continue;
		const labels = collisions
			.slice(0, 2)
			.map((collision) => collision.name || "an unnamed item")
			.join(" and ");
		return `“${candidate.value.replaceAll("_", " ")}” was left out because it could also refer to ${labels}.`;
	}
	return "The current name already covers the safe player wording found.";
}

function connectionExplanation(connections: TagConnection[]): string {
	const commands = connections.filter((connection) => connection.kind === "command");
	const items = connections.filter((connection) => connection.kind === "items");
	const logic = connections.filter(
		(connection) => connection.kind === "condition" || connection.kind === "effect",
	);
	const requirements = connections.filter((connection) => connection.kind === "requirement");
	const parts: string[] = [];
	if (commands.length)
		parts.push(`${commands.length} ${commands.length === 1 ? "command" : "commands"}`);
	if (logic.length)
		parts.push(`${logic.length} logic ${logic.length === 1 ? "connection" : "connections"}`);
	if (requirements.length) {
		parts.push(
			`${requirements.length} behavior ${requirements.length === 1 ? "requirement" : "requirements"}`,
		);
	}
	if (items.length) parts.push(`${items.length} other ${items.length === 1 ? "item" : "items"}`);
	return parts.length
		? `Connects to ${parts.join(", ")}.`
		: "Creates a reusable classification for commands and logic.";
}

export function createTagSuggestions(
	item: Item,
	lexical: readonly LexicalConceptCandidate[],
	graph: WorldTagGraph,
): TagSuggestion[] {
	const taxonomy = itemTaxonomyContext(item);
	const effectiveTags = effectiveItemTags(item);
	const normalizedExisting = new Set([...effectiveTags].map(normalizeSuggestedTag));
	const conceptsBySynset = new Map<string, LexicalConceptCandidate>();
	for (const concept of lexical) {
		const existing = conceptsBySynset.get(concept.synsetId);
		const conceptPreferred = taxonomy.branchCategories.has(concept.tag as ItemIconCategory);
		const existingPreferred = existing
			? taxonomy.branchCategories.has(existing.tag as ItemIconCategory)
			: false;
		if (!existing || (conceptPreferred && !existingPreferred)) {
			conceptsBySynset.set(concept.synsetId, concept);
		}
	}
	const conceptsByTag = new Map(
		[...conceptsBySynset.values()].map((concept) => [concept.tag, concept] as const),
	);
	if (taxonomy.leaf && !conceptsByTag.has(taxonomy.leaf.id)) {
		conceptsByTag.set(taxonomy.leaf.id, {
			tag: taxonomy.leaf.id,
			label: taxonomy.leaf.id.replaceAll("-", " "),
			depth: 3,
			evidence: `The maintained item taxonomy classifies this as ${taxonomy.leaf.id.replaceAll("-", " ")}.`,
			synsetId: `taxonomy:${taxonomy.leaf.id}`,
		});
	}
	const groundedConcepts = [...conceptsByTag.values()].filter(
		(concept) =>
			taxonomy.branchTerms.has(concept.tag) || (graph.connections.get(concept.tag)?.length ?? 0) > 0,
	);
	const behaviorSignals = new Set<string>();
	for (const source of [item.name, ...item.aliases]) {
		const normalized = normalizeSuggestionText(source);
		if (!normalized) continue;
		behaviorSignals.add(normalizeSuggestedTag(normalized));
		for (const word of normalized.split(" ")) behaviorSignals.add(normalizeSuggestedTag(word));
	}
	for (const category of taxonomy.branchCategories)
		behaviorSignals.add(normalizeSuggestedTag(category));
	for (const concept of groundedConcepts) behaviorSignals.add(concept.tag);
	const suggestions: Array<TagSuggestion & {score: number}> = [];

	for (const concept of groundedConcepts) {
		if (normalizedExisting.has(concept.tag) || itemBehaviorTypeForTag(concept.tag)) continue;
		const connections = graph.connections.get(concept.tag) ?? [];
		suggestions.push({
			tag: concept.tag,
			label: concept.label,
			reason: concept.evidence,
			enables: connectionExplanation(connections),
			connections,
			change: {type: "tag"},
			score:
				connections.length * 300 + (taxonomy.branchTerms.has(concept.tag) ? 100 : 0) - concept.depth,
		});
	}

	for (const definition of ITEM_BEHAVIOR_DEFINITIONS) {
		const behavior = definition.type;
		if (item.behaviors.some((entry) => entry.type === behavior)) continue;
		const evidence = [...behaviorSignals].find((signal) => definition.discoveryTerms.has(signal));
		if (!evidence) continue;
		const connections = graph.connections.get(behavior) ?? [];
		suggestions.push({
			tag: behavior,
			label: behavior,
			reason: `Its name or supported taxonomy identifies it as ${evidence.replaceAll("-", " ")}.`,
			enables: `${definition.description} ${connectionExplanation(connections)}`,
			connections,
			change: {type: "behavior", behavior},
			warning:
				"This adds a real capability with schema defaults, which you can configure in Behavior.",
			score: 200 + connections.length * 300,
		});
	}

	return suggestions
		.sort((left, right) => right.score - left.score || left.tag.localeCompare(right.tag))
		.slice(0, 5)
		.map((suggestion): TagSuggestion => ({
			tag: suggestion.tag,
			label: suggestion.label,
			reason: suggestion.reason,
			enables: suggestion.enables,
			connections: suggestion.connections,
			change: suggestion.change,
			...(suggestion.warning ? {warning: suggestion.warning} : {}),
		}));
}

export function applyAliasSuggestionDraft(draft: Draft<Item>, suggestion: AliasSuggestion): void {
	const normalized = normalizeSuggestionText(suggestion.value);
	if (!draft.aliases.some((alias) => normalizeSuggestionText(alias) === normalized)) {
		draft.aliases.push(suggestion.value);
	}
}

export function applyTagSuggestionDraft(draft: Draft<Item>, suggestion: TagSuggestion): void {
	if (suggestion.change.type === "behavior") {
		addItemBehaviorDraft(draft, suggestion.change.behavior);
		return;
	}
	const normalized = normalizeSuggestedTag(suggestion.tag);
	if (!draft.tags.some((tag) => normalizeSuggestedTag(tag) === normalized))
		draft.tags.push(suggestion.tag);
}
