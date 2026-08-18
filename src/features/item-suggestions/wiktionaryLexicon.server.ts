import "server-only";

import generatedLexicon from "./generated/wiktionaryAliases.json";
import type {LexicalAliasCandidate, LexicalSuggestionRequest} from "./lexicalSchemas";
import {lexicalLookupTerms} from "./lexicalLookupTerms";
import {normalizeSuggestionText} from "./suggestionText";

type GeneratedAlias = {
	value: string;
	relation: "synonym" | "reference";
	evidence: string;
	sourceRevision: number;
};

type GeneratedLexicon = {
	version: string;
	entries: Record<string, GeneratedAlias[] | undefined>;
};

const lexicon = generatedLexicon as GeneratedLexicon;

export const WIKTIONARY_ALIAS_LEXICON_VERSION = lexicon.version;

function lookupKeys(value: string): string[] {
	const key = normalizeSuggestionText(value);
	const keys = new Set([key]);
	if (key.endsWith("ies") && key.length > 3) keys.add(`${key.slice(0, -3)}y`);
	if (key.endsWith("es") && key.length > 2) keys.add(key.slice(0, -2));
	if (key.endsWith("s") && key.length > 1) keys.add(key.slice(0, -1));
	return [...keys];
}

export function suggestAliasesFromWiktionary(
	input: LexicalSuggestionRequest,
): LexicalAliasCandidate[] {
	const aliases = new Map<string, LexicalAliasCandidate>();
	for (const source of lexicalLookupTerms(input)) {
		for (const candidate of wiktionaryAliasesForTerm(source)) {
			const normalized = normalizeSuggestionText(candidate.value);
			if (!normalized || aliases.has(normalized)) continue;
			aliases.set(normalized, candidate);
		}
	}
	return [...aliases.values()];
}

export function wiktionaryAliasesForTerm(term: string): LexicalAliasCandidate[] {
	const aliases = new Map<string, LexicalAliasCandidate>();
	for (const key of lookupKeys(term)) {
		for (const candidate of lexicon.entries[key] ?? []) {
			const normalized = normalizeSuggestionText(candidate.value);
			if (!normalized || aliases.has(normalized)) continue;
			aliases.set(normalized, {
				value: candidate.value,
				relation: candidate.relation,
				evidence: candidate.evidence,
			});
		}
	}
	return [...aliases.values()];
}
