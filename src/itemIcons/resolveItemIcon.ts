import {
	ITEM_ICON_CATALOG,
	NON_VISUAL_ITEM_TAGS,
	type ItemIconCategory,
	type ItemIconCategoryDefinition,
	type ItemIconTermKind,
} from "./itemIconCatalog";

export type ItemIconInput = {
	name?: string | null;
	aliases?: readonly string[] | null;
	tags?: readonly string[] | null;
	iconCategory?: string | null;
};

export type ItemIconEvidenceSource = "name" | "aliases" | "tags";

export type ItemIconEvidence = {
	source: ItemIconEvidenceSource;
	value: string;
	term: string;
	termKind: ItemIconTermKind;
	matchedCategory: ItemIconCategory;
	relationship: "direct" | "ancestor";
};

export type ItemIconCandidate = {
	category: ItemIconCategory;
	supportingFields: readonly ItemIconEvidenceSource[];
	evidence: readonly ItemIconEvidence[];
};

export type ItemIconResolutionWarning = {
	code: "invalid-override" | "multiple-overrides";
	value: string;
};

export type ItemIconResolution = {
	category: ItemIconCategory;
	reason: "manual-override" | "corroborated-match" | "single-field-match" | "fallback";
	evidence: readonly ItemIconEvidence[];
	alternatives: readonly ItemIconCandidate[];
	warnings: readonly ItemIconResolutionWarning[];
};

type SourceGroup = {
	source: ItemIconEvidenceSource;
	values: readonly string[];
};

type RankedCandidate = ItemIconCandidate & {
	catalogIndex: number;
	directFieldCount: number;
	evidenceStrength: number;
	longestTermLength: number;
	strongestSource: number;
};

const definitionsByCategory = new Map(
	ITEM_ICON_CATALOG.map((definition) => [definition.id, definition] as const),
);
const categorySet = new Set<ItemIconCategory>(ITEM_ICON_CATALOG.map((definition) => definition.id));

export function normalizeItemIconTerm(value: string): string {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLocaleLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.replace(/\s+/g, " ");
}

function includesWholeTerm(value: string, term: string): boolean {
	const normalizedValue = normalizeItemIconTerm(value);
	const normalizedTerm = normalizeItemIconTerm(term);
	return normalizedTerm.length > 0 && ` ${normalizedValue} `.includes(` ${normalizedTerm} `);
}

function normalizeCategory(value: string): string {
	return normalizeItemIconTerm(value).replaceAll(" ", "-");
}

function asCategory(value: string): ItemIconCategory | undefined {
	const normalized = normalizeCategory(value) as ItemIconCategory;
	return categorySet.has(normalized) ? normalized : undefined;
}

function categoryAncestors(category: ItemIconCategory): readonly ItemIconCategory[] {
	const visited = new Set<ItemIconCategory>();
	const pending = [...(definitionsByCategory.get(category)?.parents ?? [])];
	while (pending.length > 0) {
		const parent = pending.shift();
		if (!parent || visited.has(parent)) continue;
		visited.add(parent);
		pending.push(...(definitionsByCategory.get(parent)?.parents ?? []));
	}
	return [...visited];
}

function isAncestorOf(ancestor: ItemIconCategory, category: ItemIconCategory): boolean {
	return categoryAncestors(category).includes(ancestor);
}

function evidenceRank(evidence: ItemIconEvidence): readonly number[] {
	const termKindRank =
		evidence.termKind === "identity" ? 2 : evidence.termKind === "category" ? 1 : 0;
	return [
		evidence.relationship === "direct" ? 1 : 0,
		termKindRank,
		normalizeItemIconTerm(evidence.term).split(" ").length,
		normalizeItemIconTerm(evidence.term).length,
	];
}

function compareNumberTuples(left: readonly number[], right: readonly number[]): number {
	for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0);
		if (difference !== 0) return difference;
	}
	return 0;
}

function matchingEvidence(
	candidate: ItemIconCategory,
	definitions: readonly ItemIconCategoryDefinition[],
	group: SourceGroup,
): ItemIconEvidence | undefined {
	let best: ItemIconEvidence | undefined;
	for (const definition of definitions) {
		for (const [termKind, terms] of [
			["identity", definition.identityTerms],
			["category", definition.categoryTerms],
			["descriptor", definition.descriptorTerms ?? []],
		] as const) {
			for (const term of terms) {
				for (const value of group.values) {
					if (!includesWholeTerm(value, term)) continue;
					const evidence: ItemIconEvidence = {
						source: group.source,
						value,
						term,
						termKind,
						matchedCategory: definition.id,
						relationship: definition.id === candidate ? "direct" : "ancestor",
					};
					if (!best || compareNumberTuples(evidenceRank(evidence), evidenceRank(best)) > 0) {
						best = evidence;
					}
				}
			}
		}
	}
	return best;
}

function sourceGroups(item: ItemIconInput): readonly SourceGroup[] {
	const tags = (item.tags ?? []).filter(
		(tag) => !/^\s*icon\s*:/i.test(tag) && !NON_VISUAL_ITEM_TAGS.has(normalizeItemIconTerm(tag)),
	);
	return [
		{source: "name", values: item.name ? [item.name] : []},
		{source: "aliases", values: item.aliases ?? []},
		{source: "tags", values: tags},
	];
}

function createCandidates(item: ItemIconInput): RankedCandidate[] {
	const groups = sourceGroups(item);
	const candidates: RankedCandidate[] = [];

	ITEM_ICON_CATALOG.forEach((definition, catalogIndex) => {
		if (definition.id === "generic") return;
		const hasDirectEvidence = groups.some((group) =>
			matchingEvidence(definition.id, [{...definition, descriptorTerms: []}], group),
		);
		if (!hasDirectEvidence) return;

		const lineage = [
			definition,
			...categoryAncestors(definition.id)
				.map((category) => definitionsByCategory.get(category))
				.filter((entry): entry is ItemIconCategoryDefinition => Boolean(entry)),
		];
		const evidence = groups
			.map((group) => matchingEvidence(definition.id, lineage, group))
			.filter((entry): entry is ItemIconEvidence => Boolean(entry));
		const directFieldCount = evidence.filter((entry) => entry.relationship === "direct").length;
		const evidenceStrength = evidence.reduce((total, entry) => {
			const termStrength = entry.termKind === "identity" ? 3 : entry.termKind === "category" ? 2 : 1;
			return total + (entry.relationship === "direct" ? 4 : 0) + termStrength;
		}, 0);
		const longestTermLength = Math.max(
			...evidence.map((entry) => normalizeItemIconTerm(entry.term).split(" ").length),
		);
		const strongestSource = Math.max(
			...evidence.map((entry) => (entry.source === "name" ? 3 : entry.source === "aliases" ? 2 : 1)),
		);

		candidates.push({
			category: definition.id,
			supportingFields: evidence.map((entry) => entry.source),
			evidence,
			catalogIndex,
			directFieldCount,
			evidenceStrength,
			longestTermLength,
			strongestSource,
		});
	});

	return candidates.sort((left, right) => {
		const evidenceDifference =
			right.supportingFields.length - left.supportingFields.length ||
			right.longestTermLength - left.longestTermLength ||
			right.evidenceStrength - left.evidenceStrength ||
			right.strongestSource - left.strongestSource ||
			right.directFieldCount - left.directFieldCount;
		if (evidenceDifference !== 0) return evidenceDifference;
		if (isAncestorOf(left.category, right.category)) return 1;
		if (isAncestorOf(right.category, left.category)) return -1;
		return left.catalogIndex - right.catalogIndex;
	});
}

function resolveOverride(item: ItemIconInput): {
	category?: ItemIconCategory;
	warnings: ItemIconResolutionWarning[];
} {
	const warnings: ItemIconResolutionWarning[] = [];
	const requestedOverrides: string[] = [];
	if (item.iconCategory?.trim()) requestedOverrides.push(item.iconCategory.trim());
	for (const tag of item.tags ?? []) {
		if (/^\s*icon\s*:/i.test(tag)) {
			requestedOverrides.push(tag.replace(/^\s*icon\s*:/i, "").trim());
		}
	}

	const validOverrides: {category: ItemIconCategory; value: string}[] = [];
	for (const value of requestedOverrides) {
		const category = asCategory(value);
		if (category) validOverrides.push({category, value});
		else warnings.push({code: "invalid-override", value});
	}
	const distinctOverrides = [...new Set(validOverrides.map((entry) => entry.category))];
	if (distinctOverrides.length > 1) {
		warnings.push({code: "multiple-overrides", value: distinctOverrides.join(", ")});
	}

	return {category: validOverrides[0]?.category, warnings};
}

export function resolveItemIcon(item: ItemIconInput): ItemIconResolution {
	const override = resolveOverride(item);
	if (override.category) {
		return {
			category: override.category,
			reason: "manual-override",
			evidence: [],
			alternatives: [],
			warnings: override.warnings,
		};
	}

	const candidates = createCandidates(item);
	const winner = candidates[0];
	if (!winner) {
		return {
			category: "generic",
			reason: "fallback",
			evidence: [],
			alternatives: [],
			warnings: override.warnings,
		};
	}

	return {
		category: winner.category,
		reason: winner.supportingFields.length > 1 ? "corroborated-match" : "single-field-match",
		evidence: winner.evidence,
		alternatives: candidates.slice(1).map(({category, evidence, supportingFields}) => ({
			category,
			evidence,
			supportingFields,
		})),
		warnings: override.warnings,
	};
}
