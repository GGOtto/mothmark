import "server-only";

import {open, readFile, type FileHandle} from "node:fs/promises";
import {join} from "node:path";
import wordNetDatabase from "wordnet-db";
import {ITEM_ICON_CATALOG} from "@/itemIcons/itemIconCatalog";
import type {
	LexicalAliasCandidate,
	LexicalConceptCandidate,
	LexicalSuggestionRequest,
} from "./lexicalSchemas";
import {lexicalLookupTerms, wordNetLookupTerms} from "./lexicalLookupTerms";
import {normalizeSuggestionText} from "./suggestionText";
import {
	wiktionaryAliasesForTerm,
	WIKTIONARY_ALIAS_LEXICON_VERSION,
} from "./wiktionaryLexicon.server";

type WordNetPointer = {
	pointerSymbol: string;
	pos: string;
	synsetOffset: number;
};

type WordNetRecord = {
	gloss: string;
	lemma: string;
	pos: string;
	ptrs: WordNetPointer[];
	synonyms: string[];
	synsetOffset: number;
};

type ConceptRecord = WordNetRecord & {depth: number};

type WordNetIndexEntry = {offsets: number[]; taggedSenseCount: number};
type WordNetIndex = Map<string, WordNetIndexEntry>;

const NOUN_INDEX_PATH = join(wordNetDatabase.path, "index.noun");
const NOUN_DATA_PATH = join(wordNetDatabase.path, "data.noun");
const indexPromise = loadNounIndex();
const dataFilePromise = open(NOUN_DATA_PATH, "r");
const lookupCache = new Map<string, Promise<WordNetRecord[]>>();
const recordCache = new Map<string, Promise<WordNetRecord>>();
const GENERIC_CONCEPTS = new Set([
	"entity",
	"physical-entity",
	"object",
	"whole",
	"matter",
	"substance",
	"artifact",
	"natural-object",
	"thing",
	"unit",
]);
const BROAD_ALIAS_CONCEPTS = new Set([
	"abstraction",
	"arrangement",
	"artifact",
	"artefact",
	"container",
	"covering",
	"creation",
	"device",
	"equipment",
	"furniture",
	"group",
	"grouping",
	"implement",
	"instrumentality",
	"instrumentation",
	"mechanism",
	"physical-object",
	"representation",
	"structure",
	"system",
	"tool",
	"weapon-system",
]);

function taxonomyAliasTerms(iconCategory?: string): Set<string> | undefined {
	if (!iconCategory || iconCategory === "generic") return undefined;
	const terms = new Set<string>();
	const pending = [iconCategory];
	const seen = new Set<string>();
	while (pending.length) {
		const category = pending.shift()!;
		if (seen.has(category)) continue;
		seen.add(category);
		const definition = ITEM_ICON_CATALOG.find(({id}) => id === category);
		if (!definition) continue;
		for (const value of [definition.id, ...definition.identityTerms, ...definition.categoryTerms]) {
			const normalized = normalizeSuggestionText(value);
			terms.add(normalized);
			for (const key of lookupKeys(normalized)) terms.add(key.replaceAll("_", " "));
		}
		pending.push(...definition.parents);
	}
	return terms;
}

function taxonomyLeafAliasTerms(iconCategory?: string): Set<string> | undefined {
	if (!iconCategory || iconCategory === "generic") return undefined;
	const definition = ITEM_ICON_CATALOG.find(({id}) => id === iconCategory);
	if (!definition) return undefined;
	return new Set(
		[definition.id, ...definition.identityTerms, ...definition.categoryTerms].flatMap((value) => {
			const normalized = normalizeSuggestionText(value);
			return [normalized, ...lookupKeys(normalized).map((key) => key.replaceAll("_", " "))];
		}),
	);
}

function taxonomySemanticAnchorTerms(iconCategory?: string): Set<string> | undefined {
	if (!iconCategory || iconCategory === "generic") return undefined;
	const leaf = ITEM_ICON_CATALOG.find(({id}) => id === iconCategory);
	if (!leaf) return undefined;
	const terms = new Set<string>();
	const add = (value: string) => {
		const normalized = normalizeSuggestionText(value);
		terms.add(normalized);
		for (const key of lookupKeys(normalized)) terms.add(key.replaceAll("_", " "));
	};
	for (const value of leaf.categoryTerms) add(value);
	const pending = [...leaf.parents];
	const seen = new Set<string>();
	while (pending.length) {
		const category = pending.shift()!;
		if (seen.has(category)) continue;
		seen.add(category);
		const definition = ITEM_ICON_CATALOG.find(({id}) => id === category);
		if (!definition) continue;
		for (const value of [definition.id, ...definition.identityTerms, ...definition.categoryTerms]) {
			add(value);
		}
		pending.push(...definition.parents);
	}
	return terms;
}

export const ITEM_LEXICON_VERSION = `wordnet-${wordNetDatabase.version}+${WIKTIONARY_ALIAS_LEXICON_VERSION}`;

function displayLemma(value: string): string {
	return value.replaceAll("_", " ").replace(/\s+/g, " ").trim();
}

function tagLemma(value: string): string {
	return normalizeSuggestionText(displayLemma(value)).replaceAll(" ", "-");
}

async function loadNounIndex(): Promise<WordNetIndex> {
	const content = await readFile(NOUN_INDEX_PATH, "utf8");
	const index: WordNetIndex = new Map();
	for (const line of content.split("\n")) {
		if (!line || /^\s/.test(line)) continue;
		const fields = line.trim().split(/\s+/);
		const synsetCount = Number(fields[2]);
		const pointerCount = Number(fields[3]);
		if (!Number.isInteger(synsetCount) || !Number.isInteger(pointerCount)) continue;
		const offsetStart = 6 + pointerCount;
		const offsets = fields.slice(offsetStart, offsetStart + synsetCount).map(Number);
		const taggedSenseCount = Number(fields[5 + pointerCount]);
		if (offsets.every(Number.isInteger) && Number.isInteger(taggedSenseCount)) {
			index.set(fields[0]!, {offsets, taggedSenseCount});
		}
	}
	return index;
}

async function readDataLine(file: FileHandle, offset: number): Promise<string> {
	const buffer = Buffer.allocUnsafe(8_192);
	const {bytesRead} = await file.read(buffer, 0, buffer.length, offset);
	const newline = buffer.subarray(0, bytesRead).indexOf(10);
	return buffer.toString("utf8", 0, newline >= 0 ? newline : bytesRead);
}

function parseDataRecord(line: string): WordNetRecord {
	const separator = line.indexOf(" | ");
	const fields = line
		.slice(0, separator >= 0 ? separator : undefined)
		.trim()
		.split(/\s+/);
	const synonymCount = Number.parseInt(fields[3]!, 16);
	const synonyms: string[] = [];
	let cursor = 4;
	for (let index = 0; index < synonymCount; index += 1) {
		synonyms.push(fields[cursor]!);
		cursor += 2;
	}
	const pointerCount = Number(fields[cursor]);
	cursor += 1;
	const ptrs: WordNetPointer[] = [];
	for (let index = 0; index < pointerCount; index += 1) {
		ptrs.push({
			pointerSymbol: fields[cursor]!,
			synsetOffset: Number(fields[cursor + 1]),
			pos: fields[cursor + 2]!,
		});
		cursor += 4;
	}
	return {
		gloss: separator >= 0 ? line.slice(separator + 3).trim() : "",
		lemma: synonyms[0] ?? "",
		pos: fields[2]!,
		ptrs,
		synonyms,
		synsetOffset: Number(fields[0]),
	};
}

function lookupKeys(word: string): string[] {
	const key = normalizeSuggestionText(word).replaceAll(" ", "_");
	const keys = new Set([key]);
	if (key.endsWith("ies") && key.length > 3) keys.add(`${key.slice(0, -3)}y`);
	if (key.endsWith("es") && key.length > 2) keys.add(key.slice(0, -2));
	if (key.endsWith("s") && key.length > 1) keys.add(key.slice(0, -1));
	return [...keys];
}

function lookupWord(word: string): Promise<WordNetRecord[]> {
	const key = normalizeSuggestionText(word);
	const cached = lookupCache.get(key);
	if (cached) return cached;
	const request = (async () => {
		const index = await indexPromise;
		const lookupKey = lookupKeys(word).find((candidate) => index.has(candidate));
		if (!lookupKey) return [];
		return Promise.all(
			(index.get(lookupKey)?.offsets ?? []).map((synsetOffset) =>
				getRecord({pointerSymbol: "", pos: "n", synsetOffset}),
			),
		);
	})();
	lookupCache.set(key, request);
	return request;
}

function getRecord(pointer: WordNetPointer): Promise<WordNetRecord> {
	const key = `${pointer.pos}:${pointer.synsetOffset}`;
	const cached = recordCache.get(key);
	if (cached) return cached;
	const request = (async () => {
		if (pointer.pos !== "n") throw new Error(`Unsupported WordNet part of speech: ${pointer.pos}`);
		return parseDataRecord(await readDataLine(await dataFilePromise, pointer.synsetOffset));
	})();
	recordCache.set(key, request);
	return request;
}

async function hypernyms(record: WordNetRecord, maximumDepth = 4): Promise<ConceptRecord[]> {
	const concepts: ConceptRecord[] = [];
	const seen = new Set<string>();
	let pending = record.ptrs
		.filter((pointer) => pointer.pointerSymbol === "@")
		.map((pointer) => ({pointer, depth: 1}));
	while (pending.length) {
		const current = pending.shift()!;
		const key = `${current.pointer.pos}:${current.pointer.synsetOffset}`;
		if (seen.has(key) || current.depth > maximumDepth) continue;
		seen.add(key);
		const concept = await getRecord(current.pointer);
		concepts.push({...concept, depth: current.depth});
		pending = [
			...pending,
			...concept.ptrs
				.filter((pointer) => pointer.pointerSymbol === "@")
				.map((pointer) => ({pointer, depth: current.depth + 1})),
		];
	}
	return concepts;
}

function senseScore(
	record: WordNetRecord,
	concepts: ConceptRecord[],
	context: Set<string>,
	sourceTerm: string,
): number {
	const sourceKeys = new Set(lookupKeys(sourceTerm).map(tagLemma));
	const recordScore = record.synonyms.reduce((score, synonym) => {
		const term = tagLemma(synonym);
		return score + (context.has(term) && !sourceKeys.has(term) ? 20 : 0);
	}, 0);
	return concepts.reduce(
		(score, concept) =>
			score +
			concept.synonyms.reduce(
				(conceptScore, synonym) =>
					conceptScore + (context.has(tagLemma(synonym)) ? Math.max(12, 32 - concept.depth * 4) : 0),
				0,
			),
		recordScore,
	);
}

async function selectedSense(term: string, context: Set<string>) {
	const senses = (await lookupWord(term)).filter((record) => record.pos === "n");
	const candidates = await Promise.all(
		senses.map(async (record, index) => {
			const concepts = await hypernyms(record);
			return {record, concepts, index, score: senseScore(record, concepts, context, term)};
		}),
	);
	return candidates.sort(
		(left, right) =>
			right.score - left.score ||
			left.index - right.index ||
			left.record.synsetOffset - right.record.synsetOffset,
	)[0];
}

function selectedSenseMatchesTaxonomy(
	selected: Awaited<ReturnType<typeof selectedSense>>,
	supportedTerms: Set<string> | undefined,
	sourceTerm: string,
): boolean {
	if (!selected || !supportedTerms) return false;
	const sourceKeys = new Set(
		lookupKeys(sourceTerm).map((key) => normalizeSuggestionText(displayLemma(key))),
	);
	return [selected.record, ...selected.concepts].some((record) =>
		record.synonyms.some(
			(synonym) =>
				!sourceKeys.has(normalizeSuggestionText(displayLemma(synonym))) &&
				supportedTerms.has(normalizeSuggestionText(displayLemma(synonym))),
		),
	);
}

function addAlias(
	aliases: Map<string, LexicalAliasCandidate>,
	value: string,
	relation: LexicalAliasCandidate["relation"],
	evidence: string,
) {
	const normalized = normalizeSuggestionText(value);
	if (!normalized || normalized.length < 2) return;
	if (!aliases.has(normalized))
		aliases.set(normalized, {value: displayLemma(value), relation, evidence});
}

function addConcept(
	concepts: Map<string, LexicalConceptCandidate>,
	record: ConceptRecord,
	evidence: string,
) {
	for (const synonym of record.synonyms) {
		const tag = tagLemma(synonym);
		if (!tag || GENERIC_CONCEPTS.has(tag) || tag.split("-").length > 3) continue;
		const existing = concepts.get(tag);
		if (!existing || record.depth < existing.depth) {
			concepts.set(tag, {
				tag,
				label: displayLemma(synonym),
				depth: record.depth,
				evidence,
				synsetId: `${record.pos}:${record.synsetOffset}`,
			});
		}
	}
}

export async function suggestFromWordNet(input: LexicalSuggestionRequest) {
	const index = await indexPromise;
	const wordNetTerms = new Set(wordNetLookupTerms(input));
	const aliasTerms = new Set(lexicalLookupTerms(input));
	const sourceTerms = new Set([...wordNetTerms, ...aliasTerms]);
	const supportedAliasTerms = taxonomyAliasTerms(input.iconCategory);
	const leafAliasTerms = taxonomyLeafAliasTerms(input.iconCategory);
	const semanticAnchorTerms = taxonomySemanticAnchorTerms(input.iconCategory);
	const context = new Set(
		[
			...input.tags,
			...(input.iconCategory ? [input.iconCategory] : []),
			...(supportedAliasTerms ?? []),
		].map((value) => tagLemma(value)),
	);
	const aliases = new Map<string, LexicalAliasCandidate>();
	const concepts = new Map<string, LexicalConceptCandidate>();

	for (const term of sourceTerms) {
		const selected = await selectedSense(term, context);
		if (!selected) continue;
		const matchesTaxonomy = selectedSenseMatchesTaxonomy(selected, supportedAliasTerms, term);
		for (const candidate of aliasTerms.has(term) ? wiktionaryAliasesForTerm(term) : []) {
			if (candidate.relation === "reference") {
				if (!matchesTaxonomy) continue;
				const normalizedCandidate = normalizeSuggestionText(candidate.value);
				if (
					supportedAliasTerms?.has(normalizedCandidate) &&
					!leafAliasTerms?.has(normalizedCandidate)
				) {
					continue;
				}
				if (!leafAliasTerms?.has(normalizedCandidate)) {
					const candidateSense = await selectedSense(candidate.value, context);
					if (!selectedSenseMatchesTaxonomy(candidateSense, semanticAnchorTerms, candidate.value)) {
						continue;
					}
				}
			}
			addAlias(aliases, candidate.value, candidate.relation, candidate.evidence);
		}
		if (!wordNetTerms.has(term)) continue;
		for (const synonym of selected.record.synonyms) {
			const synonymKey = normalizeSuggestionText(displayLemma(synonym)).replaceAll(" ", "_");
			if ((index.get(synonymKey)?.taggedSenseCount ?? 0) === 0) continue;
			if (
				supportedAliasTerms &&
				!matchesTaxonomy &&
				!supportedAliasTerms.has(displayLemma(synonymKey))
			) {
				continue;
			}
			addAlias(aliases, synonym, "synonym", `A language reference lists it with “${term}”.`);
		}
		for (const concept of selected.concepts.filter(({depth}) => depth <= 2)) {
			for (const synonym of concept.synonyms) {
				const value = displayLemma(synonym);
				const normalized = normalizeSuggestionText(value);
				const synonymKey = normalized.replaceAll(" ", "_");
				if (
					(index.get(synonymKey)?.taggedSenseCount ?? 0) === 0 ||
					GENERIC_CONCEPTS.has(tagLemma(value)) ||
					BROAD_ALIAS_CONCEPTS.has(tagLemma(value)) ||
					(supportedAliasTerms?.has(normalized) && !leafAliasTerms?.has(normalized))
				) {
					continue;
				}
				if (!leafAliasTerms?.has(normalized)) {
					const candidateSense = await selectedSense(value, context);
					if (!selectedSenseMatchesTaxonomy(candidateSense, semanticAnchorTerms, value)) {
						continue;
					}
				}
				addAlias(
					aliases,
					value,
					"reference",
					`The selected meaning of “${term}” is a kind of ${value}.`,
				);
			}
		}
		for (const concept of selected.concepts) {
			addConcept(concepts, concept, `“${term}” belongs to this language category.`);
		}
	}

	return {
		aliases: [...aliases.values()],
		concepts: [...concepts.values()]
			.sort((left, right) => left.depth - right.depth || left.tag.localeCompare(right.tag))
			.slice(0, 32),
		version: ITEM_LEXICON_VERSION,
	};
}
