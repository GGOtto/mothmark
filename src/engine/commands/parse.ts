const OPTIONAL_LEADING_ARTICLES = new Set(["a", "an", "the"]);

export type ParsedConnector = {
	connector: string;
	left: string;
	right: string;
};

export type ParsedCommand = {
	input: string;
	matchedAlias: string;
	targetText: string;
	connector?: ParsedConnector;
};

export type NamedThing = {
	name: string;
	aliases?: string[];
};

export function normalizeInput(input: string): string {
	return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function stripLeadingArticle(input: string): string {
	const words = normalizeInput(input).split(" ");

	if (words.length <= 1) return words.join(" ");

	const [firstWord, ...remainingWords] = words;
	return OPTIONAL_LEADING_ARTICLES.has(firstWord) ? remainingWords.join(" ") : words.join(" ");
}

export function getPhraseMatchKeys(input: string): string[] {
	const normalizedInput = normalizeInput(input);
	return Array.from(new Set([normalizedInput, stripLeadingArticle(normalizedInput)]));
}

export function phraseMatches(left: string, right: string): boolean {
	const rightKeys = getPhraseMatchKeys(right);
	return getPhraseMatchKeys(left).some((leftKey) => rightKeys.includes(leftKey));
}

export function namedThingMatchesText(thing: NamedThing, targetText: string): boolean {
	return [thing.name, ...(thing.aliases ?? [])].some((name) => phraseMatches(name, targetText));
}

function startsWithPhrase(input: string, phrase: string): boolean {
	return input === phrase || input.startsWith(`${phrase} `);
}

function unwrapQuotedPhrase(input: string): string {
	const trimmedInput = input.trim();
	const isDoubleQuoted = trimmedInput.startsWith('"') && trimmedInput.endsWith('"');
	const isSingleQuoted = trimmedInput.startsWith("'") && trimmedInput.endsWith("'");

	if (trimmedInput.length >= 2 && (isDoubleQuoted || isSingleQuoted)) {
		return trimmedInput.slice(1, -1).trim();
	}

	return trimmedInput;
}

function normalizeTargetText(input: string): string {
	return unwrapQuotedPhrase(normalizeInput(input));
}

export function formatTargetWithArticle(targetText: string): string {
	const normalizedTargetText = normalizeTargetText(targetText);
	const firstWord = normalizedTargetText.split(" ")[0];

	return OPTIONAL_LEADING_ARTICLES.has(firstWord)
		? normalizedTargetText
		: `the ${normalizedTargetText}`;
}

export function parseInputWithAlias(input: string, alias: string): ParsedCommand | null {
	const normalizedInput = normalizeInput(input);
	const normalizedAlias = normalizeInput(alias);

	if (!startsWithPhrase(normalizedInput, normalizedAlias)) return null;

	return {
		input: normalizedInput,
		matchedAlias: normalizedAlias,
		targetText: normalizeTargetText(normalizedInput.slice(normalizedAlias.length)),
	};
}

function splitTargetByConnector(targetText: string, connector: string): ParsedConnector | null {
	const normalizedTargetText = normalizeTargetText(targetText);
	const normalizedConnector = normalizeInput(connector);
	const connectorWithSpaces = ` ${normalizedConnector} `;
	const connectorIndex = normalizedTargetText.indexOf(connectorWithSpaces);

	if (connectorIndex === -1) return null;

	const left = normalizeTargetText(normalizedTargetText.slice(0, connectorIndex));
	const right = normalizeTargetText(
		normalizedTargetText.slice(connectorIndex + connectorWithSpaces.length),
	);

	return left && right ? {connector: normalizedConnector, left, right} : null;
}

export function parseCommandConnectors(
	parsed: ParsedCommand,
	connectors: string[] | undefined,
): ParsedCommand {
	if (!connectors?.length || !parsed.targetText) return parsed;

	const sortedConnectors = [...connectors].sort(
		(a, b) => normalizeInput(b).length - normalizeInput(a).length,
	);

	for (const connector of sortedConnectors) {
		const parsedConnector = splitTargetByConnector(parsed.targetText, connector);
		if (parsedConnector) return {...parsed, connector: parsedConnector};
	}

	return parsed;
}
