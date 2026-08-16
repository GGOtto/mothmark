import "server-only";

import {open, readFile, type FileHandle} from "node:fs/promises";
import {join} from "node:path";
import wordNetDatabase from "wordnet-db";
import type {
	LexicalAliasCandidate,
	LexicalConceptCandidate,
	LexicalSuggestionRequest,
} from "./lexicalSchemas";
import {normalizeSuggestionText} from "./suggestionText";

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

export const ITEM_LEXICON_VERSION = `wordnet-${wordNetDatabase.version}`;

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
): number {
	const terms = [...record.synonyms, ...concepts.flatMap((concept) => concept.synonyms)].map(
		tagLemma,
	);
	return terms.reduce((score, term) => score + (context.has(term) ? 20 : 0), 0);
}

async function selectedSense(term: string, context: Set<string>) {
	const senses = (await lookupWord(term)).filter((record) => record.pos === "n");
	const candidates = await Promise.all(
		senses.map(async (record, index) => {
			const concepts = await hypernyms(record);
			return {record, concepts, index, score: senseScore(record, concepts, context)};
		}),
	);
	return candidates.sort(
		(left, right) =>
			right.score - left.score ||
			left.index - right.index ||
			left.record.synsetOffset - right.record.synsetOffset,
	)[0];
}

function lookupTerms(input: LexicalSuggestionRequest): string[] {
	const values = [input.name, ...input.aliases];
	const terms = new Set<string>();
	for (const value of values) {
		const normalized = normalizeSuggestionText(value);
		if (!normalized) continue;
		terms.add(normalized);
		const words = normalized.split(" ");
		if (words.length > 1) terms.add(words.at(-1)!);
	}
	return [...terms].slice(0, 12);
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
	const sourceTerms = new Set(lookupTerms(input));
	const context = new Set(
		[...input.tags, ...(input.iconCategory ? [input.iconCategory] : [])].map((value) =>
			tagLemma(value),
		),
	);
	const aliases = new Map<string, LexicalAliasCandidate>();
	const concepts = new Map<string, LexicalConceptCandidate>();

	for (const term of sourceTerms) {
		const selected = await selectedSense(term, context);
		if (!selected) continue;
		for (const synonym of selected.record.synonyms) {
			const synonymKey = normalizeSuggestionText(displayLemma(synonym)).replaceAll(" ", "_");
			if ((index.get(synonymKey)?.taggedSenseCount ?? 0) === 0) continue;
			addAlias(aliases, synonym, "synonym", `A language reference lists it with “${term}”.`);
		}
		for (const concept of selected.concepts) {
			addConcept(concepts, concept, `“${term}” belongs to this language category.`);
		}
	}

	return {
		aliases: [...aliases.values()].slice(0, 24),
		concepts: [...concepts.values()]
			.sort((left, right) => left.depth - right.depth || left.tag.localeCompare(right.tag))
			.slice(0, 32),
		version: ITEM_LEXICON_VERSION,
	};
}
