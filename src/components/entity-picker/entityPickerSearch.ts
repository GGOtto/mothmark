import type {
	EntityPickerEntry,
	EntityPickerMatch,
	EntityPickerMatchField,
} from "./entityPickerTypes";

const SCORE = {
	exactId: 1000,
	exactLabel: 950,
	exactAlias: 900,
	labelPrefix: 750,
	aliasPrefix: 700,
	idPrefix: 650,
	exactTag: 550,
	labelContains: 400,
	aliasContains: 375,
	hierarchyContains: 325,
	summaryContains: 250,
	descriptionContains: 100,
} as const;

export function normalizeEntitySearchText(value: string) {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLocaleLowerCase()
		.replace(/[_./-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function wordStartsWith(value: string, token: string) {
	return value.split(" ").some((word) => word.startsWith(token));
}

function scoreToken(entry: EntityPickerEntry, token: string) {
	const id = normalizeEntitySearchText(entry.ref.id);
	const label = normalizeEntitySearchText(entry.label);
	const aliases = entry.aliases.map(normalizeEntitySearchText);
	const tags = entry.tags.map(normalizeEntitySearchText);
	const summary = normalizeEntitySearchText(entry.summary ?? "");
	const description = normalizeEntitySearchText(entry.description ?? "");
	const hierarchy = normalizeEntitySearchText(
		entry.hierarchy.map((segment) => segment.label).join(" "),
	);

	const candidates: Array<[number, EntityPickerMatchField]> = [];
	if (id === token) candidates.push([SCORE.exactId, "id"]);
	if (label === token) candidates.push([SCORE.exactLabel, "label"]);
	if (aliases.includes(token)) candidates.push([SCORE.exactAlias, "alias"]);
	if (wordStartsWith(label, token)) candidates.push([SCORE.labelPrefix, "label"]);
	if (aliases.some((alias) => wordStartsWith(alias, token)))
		candidates.push([SCORE.aliasPrefix, "alias"]);
	if (id.startsWith(token)) candidates.push([SCORE.idPrefix, "id"]);
	if (tags.includes(token)) candidates.push([SCORE.exactTag, "tag"]);
	if (label.includes(token)) candidates.push([SCORE.labelContains, "label"]);
	if (aliases.some((alias) => alias.includes(token)))
		candidates.push([SCORE.aliasContains, "alias"]);
	if (hierarchy.includes(token)) candidates.push([SCORE.hierarchyContains, "hierarchy"]);
	if (summary.includes(token)) candidates.push([SCORE.summaryContains, "summary"]);
	if (description.includes(token)) candidates.push([SCORE.descriptionContains, "description"]);

	return candidates.sort((left, right) => right[0] - left[0])[0];
}

export function searchEntityEntries(
	entries: EntityPickerEntry[],
	query: string,
	limit = 100,
): EntityPickerMatch[] {
	const normalizedQuery = normalizeEntitySearchText(query);
	if (!normalizedQuery) {
		return entries.slice(0, limit).map((entry) => ({entry, score: 0, matchedFields: []}));
	}

	const tokens = normalizedQuery.split(" ").filter(Boolean);
	return entries
		.map((entry) => {
			const tokenMatches = tokens.map((token) => scoreToken(entry, token));
			if (tokenMatches.some((match) => !match)) return undefined;
			const matches = tokenMatches.filter((match): match is [number, EntityPickerMatchField] =>
				Boolean(match),
			);
			return {
				entry,
				score: matches.reduce((total, [score]) => total + score, 0),
				matchedFields: [...new Set(matches.map(([, field]) => field))],
			};
		})
		.filter((match): match is EntityPickerMatch => Boolean(match))
		.sort(
			(left, right) =>
				right.score - left.score ||
				left.entry.label.localeCompare(right.entry.label, undefined, {sensitivity: "base"}) ||
				left.entry.ref.id.localeCompare(right.entry.ref.id),
		)
		.slice(0, limit);
}
