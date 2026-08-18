import {normalizeSuggestionText} from "./suggestionText";

const INVARIANT_NOUNS = new Set([
	"advice",
	"aircraft",
	"baggage",
	"clothing",
	"clothes",
	"equipment",
	"fish",
	"food",
	"footwear",
	"furniture",
	"gear",
	"information",
	"jewelry",
	"luggage",
	"mail",
	"money",
	"produce",
	"sheep",
	"steel",
	"tackle",
	"twine",
]);

const IRREGULAR_PLURALS = new Map<string, string>([
	["atlas", "atlases"],
	["axe", "axes"],
	["child", "children"],
	["die", "dice"],
	["foot", "feet"],
	["goose", "geese"],
	["knife", "knives"],
	["leaf", "leaves"],
	["man", "men"],
	["mouse", "mice"],
	["person", "people"],
	["shelf", "shelves"],
	["tooth", "teeth"],
	["woman", "women"],
]);

const IRREGULAR_SINGULARS = new Map(
	[...IRREGULAR_PLURALS].map(([singular, plural]) => [plural, singular]),
);

function singularize(word: string): string {
	const irregular = IRREGULAR_SINGULARS.get(word);
	if (irregular) return irregular;
	if (IRREGULAR_PLURALS.has(word)) return word;
	if (INVARIANT_NOUNS.has(word)) return word;
	if (/[^aeiou]ies$/.test(word)) return `${word.slice(0, -3)}y`;
	if (/(ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2);
	if (word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
	return word;
}

function pluralize(word: string): string {
	const irregular = IRREGULAR_PLURALS.get(word);
	if (irregular) return irregular;
	if (INVARIANT_NOUNS.has(word)) return word;
	if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
	if (/(ch|sh|ss|x|z)$/.test(word)) return `${word}es`;
	return `${word}s`;
}

export function aliasSingularForm(value: string): string {
	const normalized = normalizeSuggestionText(value);
	if (!normalized) return "";
	const words = normalized.split(" ");
	const sourceHead = words.at(-1)!;
	if (!/^[a-z]+$/.test(sourceHead)) return normalized;
	return [...words.slice(0, -1), singularize(sourceHead)].join(" ");
}

export function aliasInflections(value: string): string[] {
	const normalized = normalizeSuggestionText(value);
	if (!normalized) return [];
	const words = normalized.split(" ");
	const sourceHead = words.at(-1)!;
	if (!/^[a-z]+$/.test(sourceHead)) return [];
	const singularHead = aliasSingularForm(normalized).split(" ").at(-1)!;
	const pluralHead = pluralize(singularHead);
	const prefix = words.slice(0, -1);
	const forms = new Set<string>();
	for (const head of [singularHead, pluralHead]) {
		if (head === sourceHead) continue;
		forms.add([...prefix, head].join(" "));
	}
	return [...forms];
}
