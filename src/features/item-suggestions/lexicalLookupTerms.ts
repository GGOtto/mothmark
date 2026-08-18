import type {LexicalSuggestionRequest} from "./lexicalSchemas";
import {normalizeSuggestionText} from "./suggestionText";
import {ITEM_ICON_CATALOG} from "@/itemIcons/itemIconCatalog";

const OBJECT_CONNECTORS = new Set(["from", "in", "inside", "of", "on", "under", "with"]);

function matchesIconCategory(words: readonly string[], iconCategory?: string): boolean {
	if (!iconCategory || iconCategory === "generic") return false;
	const definition = ITEM_ICON_CATALOG.find(({id}) => id === iconCategory);
	if (!definition) return false;
	const phrase = ` ${words.join(" ")} `;
	return definition.identityTerms.some((term) => {
		const normalized = normalizeSuggestionText(term);
		return normalized && phrase.includes(` ${normalized} `);
	});
}

export function trailingObjectPhrases(value: string, iconCategory?: string): string[] {
	const normalized = normalizeSuggestionText(value);
	if (!normalized) return [];
	const words = normalized.split(" ");
	const connectorIndex = words.findIndex((word, index) => index > 0 && OBJECT_CONNECTORS.has(word));
	const prefixWords = connectorIndex > 0 ? words.slice(0, connectorIndex) : words;
	const suffixWords = connectorIndex > 0 ? words.slice(connectorIndex + 1) : [];
	const objectWords =
		suffixWords.length > 0 &&
		matchesIconCategory(suffixWords, iconCategory) &&
		!matchesIconCategory(prefixWords, iconCategory)
			? suffixWords
			: prefixWords;
	const maximumPhraseWords = Math.min(3, objectWords.length);
	const phrases: string[] = [];
	for (let wordCount = maximumPhraseWords; wordCount >= 1; wordCount -= 1) {
		phrases.push(objectWords.slice(-wordCount).join(" "));
	}
	return phrases;
}

export function lexicalLookupTerms(input: LexicalSuggestionRequest): string[] {
	const terms = new Set<string>();
	for (const value of [input.name, ...input.aliases]) {
		const normalized = normalizeSuggestionText(value);
		if (!normalized) continue;
		terms.add(normalized);
		for (const phrase of trailingObjectPhrases(value, input.iconCategory)) terms.add(phrase);
	}
	return [...terms].slice(0, 12);
}

/**
 * Keep WordNet's concept lookup deliberately compact. Expanded phrases are useful
 * for alias sources, but letting every phrase consume this budget can push an
 * author's later aliases out of the tag lookup entirely.
 */
export function wordNetLookupTerms(input: LexicalSuggestionRequest): string[] {
	const terms = new Set<string>();
	for (const value of [input.name, ...input.aliases]) {
		const normalized = normalizeSuggestionText(value);
		if (!normalized) continue;
		terms.add(normalized);
		const objectWord = trailingObjectPhrases(value, input.iconCategory).at(-1);
		if (objectWord) terms.add(objectWord);
	}
	return [...terms].slice(0, 12);
}
