import {createHash} from "node:crypto";
import {mkdir, writeFile} from "node:fs/promises";
import {dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {ITEM_ICON_CATALOG, type ItemIconCategory} from "../src/itemIcons/itemIconCatalog";
import {aliasSingularForm} from "../src/features/item-suggestions/aliasInflections";
import {normalizeSuggestionText} from "../src/features/item-suggestions/suggestionText";
import {WIKTIONARY_API_URL, WIKTIONARY_LICENSE} from "./itemLexiconSources";

export type WiktionaryRelation = {
	value: string;
	relation: "synonym" | "reference";
};

type WiktionaryPage = {
	requestedTerm: string;
	revisionId: number;
	content: string;
};

type GeneratedAlias = WiktionaryRelation & {
	evidence: string;
	sourceRevision: number;
};

type GeneratedItemLexicon = {
	version: string;
	language: "en";
	license: typeof WIKTIONARY_LICENSE;
	source: {
		apiUrl: string;
		compilerVersion: number;
		pageRevisions: Record<string, number>;
	};
	entries: Record<string, GeneratedAlias[]>;
};

const OUTPUT_PATH = fileURLToPath(
	new URL("../src/features/item-suggestions/generated/wiktionaryAliases.json", import.meta.url),
);
const ITEM_LEXICON_COMPILER_VERSION = 5;

const PARTS_OF_SPEECH = new Set([
	"adjective",
	"adverb",
	"article",
	"conjunction",
	"determiner",
	"interjection",
	"noun",
	"numeral",
	"particle",
	"preposition",
	"pronoun",
	"proper noun",
	"verb",
]);

const UNSAFE_SENSE_MARKERS = [
	"archaic",
	"dated",
	"derogatory",
	"dialectal",
	"ethnic slur",
	"historical",
	"obsolete",
	"offensive",
	"rare",
	"slang",
	"vulgar",
];

function singularForms(value: string): string[] {
	const terms = new Set([value]);
	const singular = aliasSingularForm(value);
	if (singular) terms.add(singular);
	return [...terms];
}

function cleanCandidate(value: string): string {
	return normalizeSuggestionText(
		value
			.replaceAll(/<!--.*?-->/g, "")
			.replaceAll(/\{\{[^{}]*\}\}/g, "")
			.replaceAll(
				/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g,
				(_match, target: string, display?: string) => display || target,
			)
			.replaceAll("_", " "),
	);
}

function isUnsafeSense(line: string): boolean {
	const normalized = line.toLowerCase();
	return UNSAFE_SENSE_MARKERS.some(
		(marker) => normalized.includes(`|${marker}|`) || normalized.includes(`|${marker}}}`),
	);
}

function templateCandidates(line: string): string[] {
	const values: string[] = [];
	for (const match of line.matchAll(/\{\{([^{}]+)\}\}/g)) {
		const fields = match[1]!.split("|").map((field) => field.trim());
		const template = fields.shift()?.toLowerCase().replaceAll("_", " ");
		if (!template) continue;
		const isSynonym = ["syn", "synonyms", "syn of", "synonym of"].includes(template);
		const isAlternative = [
			"alt form",
			"alt form of",
			"alt sp",
			"alternative form of",
			"alternative spelling of",
		].includes(template);
		if (!isSynonym && !isAlternative) continue;
		for (const field of fields) {
			if (!field || field === "en" || field.includes("=")) continue;
			const candidate = cleanCandidate(field);
			if (candidate) values.push(candidate);
		}
	}
	return values;
}

function definitionLinks(line: string): string[] {
	const values: string[] = [];
	const genusClause = line.split(
		/\b(?:as opposed to|for example|includes?|including|such as|especially|e\.g\.|etc\.)\b/i,
	)[0]!;
	for (const match of genusClause.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g)) {
		const target = match[1]!.trim();
		if (!target || target.includes(":")) continue;
		const candidate = cleanCandidate(match[2] || target);
		if (candidate) values.push(candidate);
	}
	return values;
}

function englishSection(content: string): string {
	const start = content.search(/^==English==\s*$/m);
	if (start < 0) return "";
	const rest = content.slice(start + "==English==".length);
	const end = rest.search(/^==[^=].*==\s*$/m);
	return end < 0 ? rest : rest.slice(0, end);
}

export function extractWiktionaryNounRelations(content: string): WiktionaryRelation[] {
	const relations = new Map<string, WiktionaryRelation>();
	let nounSection = false;
	let currentSenseUnsafe = false;

	for (const line of englishSection(content).split("\n")) {
		const heading = line.match(/^(={3,5})\s*([^=]+?)\s*\1\s*$/);
		if (heading) {
			const title = heading[2]!.trim().toLowerCase();
			if (PARTS_OF_SPEECH.has(title)) nounSection = title === "noun";
			continue;
		}
		if (!nounSection) continue;

		if (/^#(?![:*])/.test(line)) currentSenseUnsafe = isUnsafeSense(line);
		if (currentSenseUnsafe) continue;

		for (const value of templateCandidates(line)) {
			if (!relations.has(value)) relations.set(value, {value, relation: "synonym"});
		}
		if (/^#\s/.test(line)) {
			for (const value of definitionLinks(line)) {
				if (!relations.has(value)) relations.set(value, {value, relation: "reference"});
			}
		}
	}

	return [...relations.values()];
}

type TaxonomyIndex = {
	categoriesByTerm: Map<string, Set<ItemIconCategory>>;
	seedTerms: string[];
};

export function buildTaxonomyIndex(): TaxonomyIndex {
	const categoriesByTerm = new Map<string, Set<ItemIconCategory>>();
	for (const definition of ITEM_ICON_CATALOG) {
		for (const source of [definition.id.replaceAll("-", " "), ...definition.identityTerms]) {
			const normalized = normalizeSuggestionText(source);
			if (!normalized || normalized.split(" ").length > 3) continue;
			for (const term of singularForms(normalized)) {
				const categories = categoriesByTerm.get(term) ?? new Set<ItemIconCategory>();
				categories.add(definition.id);
				categoriesByTerm.set(term, categories);
			}
		}
	}
	return {categoriesByTerm, seedTerms: [...categoriesByTerm.keys()].sort()};
}

function sharesTaxonomyCategory(
	left: string,
	right: string,
	categoriesByTerm: Map<string, Set<ItemIconCategory>>,
): boolean {
	const leftCategories = categoriesByTerm.get(left);
	const rightCategories = categoriesByTerm.get(right);
	if (!leftCategories || !rightCategories) return false;
	return [...leftCategories].some((category) => rightCategories.has(category));
}

function hasCanonicalTaxonomyEndpoint(
	left: string,
	right: string,
	categoriesByTerm: Map<string, Set<ItemIconCategory>>,
): boolean {
	const leftCategories = categoriesByTerm.get(left);
	const rightCategories = categoriesByTerm.get(right);
	if (!leftCategories || !rightCategories) return false;
	return [...leftCategories].some(
		(category) => rightCategories.has(category) && (left === category || right === category),
	);
}

type WiktionaryApiPage = {
	title: string;
	missing?: boolean;
	revisions?: Array<{
		revid: number;
		slots: {main: {content: string}};
	}>;
};

type WiktionaryApiResponse = {
	query?: {
		normalized?: Array<{from: string; to: string}>;
		redirects?: Array<{from: string; to: string}>;
		pages?: WiktionaryApiPage[];
	};
};

function resolvedTitleMap(
	terms: readonly string[],
	response: WiktionaryApiResponse,
): Map<string, string[]> {
	const next = new Map<string, string>();
	for (const mapping of response.query?.normalized ?? []) next.set(mapping.from, mapping.to);
	for (const mapping of response.query?.redirects ?? []) next.set(mapping.from, mapping.to);
	const resolve = (value: string) => {
		let current = value;
		const seen = new Set<string>();
		while (next.has(current) && !seen.has(current)) {
			seen.add(current);
			current = next.get(current)!;
		}
		return current;
	};
	const requestedByTitle = new Map<string, string[]>();
	for (const term of terms) {
		const title = resolve(term);
		const requested = requestedByTitle.get(title) ?? [];
		requested.push(term);
		requestedByTitle.set(title, requested);
	}
	return requestedByTitle;
}

export async function fetchWiktionaryPages(
	terms: readonly string[],
	fetcher: typeof fetch = fetch,
): Promise<WiktionaryPage[]> {
	const pages: WiktionaryPage[] = [];
	for (let start = 0; start < terms.length; start += 25) {
		const batch = terms.slice(start, start + 25);
		const url = new URL(WIKTIONARY_API_URL);
		url.search = new URLSearchParams({
			action: "query",
			format: "json",
			formatversion: "2",
			prop: "revisions",
			redirects: "1",
			rvprop: "ids|content",
			rvslots: "main",
			titles: batch.join("|"),
		}).toString();
		const response = await fetcher(url, {
			headers: {"User-Agent": "Mothmark item lexicon builder (https://mothmark.app)"},
		});
		if (!response.ok) throw new Error(`Wiktionary request failed with ${response.status}.`);
		const data = (await response.json()) as WiktionaryApiResponse;
		const requestedByTitle = resolvedTitleMap(batch, data);
		for (const page of data.query?.pages ?? []) {
			const revision = page.revisions?.[0];
			if (page.missing || !revision) continue;
			for (const requestedTerm of requestedByTitle.get(page.title) ?? []) {
				pages.push({
					requestedTerm,
					revisionId: revision.revid,
					content: revision.slots.main.content,
				});
			}
		}
	}
	return pages;
}

export function compileItemLexicon(pages: readonly WiktionaryPage[]): GeneratedItemLexicon {
	const {categoriesByTerm} = buildTaxonomyIndex();
	const entries: Record<string, GeneratedAlias[]> = {};
	const pageRevisions: Record<string, number> = {};
	const digest = createHash("sha256");
	digest.update(`compiler:${ITEM_LEXICON_COMPILER_VERSION}\n`);

	for (const page of [...pages].sort((left, right) =>
		left.requestedTerm.localeCompare(right.requestedTerm),
	)) {
		const source = normalizeSuggestionText(page.requestedTerm);
		pageRevisions[source] = page.revisionId;
		digest.update(
			`${source}\0${page.revisionId}\0${createHash("sha256").update(page.content).digest("hex")}\n`,
		);
		const accepted = new Map<string, GeneratedAlias>();
		for (const relation of extractWiktionaryNounRelations(page.content)) {
			const value = normalizeSuggestionText(relation.value);
			if (
				!value ||
				value === source ||
				value.split(" ").length > 3 ||
				!sharesTaxonomyCategory(source, value, categoriesByTerm) ||
				(relation.relation === "synonym" &&
					!hasCanonicalTaxonomyEndpoint(source, value, categoriesByTerm))
			) {
				continue;
			}
			const candidate: GeneratedAlias = {
				value,
				relation: relation.relation,
				evidence:
					relation.relation === "synonym"
						? `An English dictionary lists it as another name for “${source}”.`
						: `An English dictionary defines “${source}” using this player word.`,
				sourceRevision: page.revisionId,
			};
			const existing = accepted.get(value);
			if (!existing || candidate.relation === "synonym") accepted.set(value, candidate);
		}
		if (accepted.size) {
			entries[source] = [...accepted.values()].sort(
				(left, right) =>
					Number(left.relation === "reference") - Number(right.relation === "reference") ||
					left.value.localeCompare(right.value),
			);
		}
	}

	return {
		version: `enwiktionary-${digest.digest("hex").slice(0, 16)}`,
		language: "en",
		license: WIKTIONARY_LICENSE,
		source: {
			apiUrl: WIKTIONARY_API_URL,
			compilerVersion: ITEM_LEXICON_COMPILER_VERSION,
			pageRevisions,
		},
		entries,
	};
}

export async function buildItemLexicon(): Promise<GeneratedItemLexicon> {
	const {seedTerms} = buildTaxonomyIndex();
	const lexicon = compileItemLexicon(await fetchWiktionaryPages(seedTerms));
	await mkdir(dirname(OUTPUT_PATH), {recursive: true});
	await writeFile(OUTPUT_PATH, `${JSON.stringify(lexicon, null, "\t")}\n`, "utf8");
	return lexicon;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	void buildItemLexicon()
		.then((lexicon) => {
			console.log(
				`Built ${lexicon.version}: ${Object.keys(lexicon.entries).length} terms from ${Object.keys(lexicon.source.pageRevisions).length} pinned pages.`,
			);
		})
		.catch((error: unknown) => {
			console.error(error);
			process.exitCode = 1;
		});
}
