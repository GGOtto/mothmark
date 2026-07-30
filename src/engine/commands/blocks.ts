import type {CommandVariable} from "@/schemas/states/gameStateSchemas";
import type {CommandBlock} from "@/schemas/world/commandSchemas";
import type {ID} from "@/utils/idUtils";
import {compareIds} from "@/utils/idUtils";
import {normalize} from "./normalize";

type CommandVariableOf<TType extends CommandVariable["type"]> = Extract<
	CommandVariable,
	{type: TType}
>;

type TargetBlock = Extract<CommandBlock, {type: "target"}>;
type TargetSource = Exclude<TargetBlock["source"], "any">;

export type TargetMatchCandidate = {
	reference: ID<"room"> | ID<"feature">;
	name: string;
	aliases?: string[];
	tags?: string[];
	sources: TargetSource[];
};

export type MatchBlockContext = {
	targets?: TargetMatchCandidate[];
};

const SMALL_NUMBER_WORDS: Record<string, number> = {
	zero: 0,
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
	nine: 9,
	ten: 10,
	eleven: 11,
	twelve: 12,
	thirteen: 13,
	fourteen: 14,
	fifteen: 15,
	sixteen: 16,
	seventeen: 17,
	eighteen: 18,
	nineteen: 19,
};

const TENS_NUMBER_WORDS: Record<string, number> = {
	twenty: 20,
	thirty: 30,
	forty: 40,
	fifty: 50,
	sixty: 60,
	seventy: 70,
	eighty: 80,
	ninety: 90,
};

const NUMBER_SCALES: Record<string, number> = {
	thousand: 1_000,
	million: 1_000_000,
	billion: 1_000_000_000,
	trillion: 1_000_000_000_000,
};

export function matchPhrase(
	text: string,
	block: CommandBlock,
): CommandVariableOf<"phrase"> | undefined {
	if (block.type !== "phrase") {
		return undefined;
	}
	const normalizedText = normalize(text);
	const matchedPhrase = block.matches.find((match) => normalize(match) === normalizedText);
	return matchedPhrase === undefined
		? undefined
		: {blockId: block.id, type: "phrase", value: matchedPhrase};
}

function parseUnderOneHundred(tokens: string[]): number | undefined {
	if (tokens.length === 1 && tokens[0] in SMALL_NUMBER_WORDS) {
		return SMALL_NUMBER_WORDS[tokens[0]];
	}

	if (tokens.length >= 1 && tokens.length <= 2 && tokens[0] in TENS_NUMBER_WORDS) {
		const units = tokens.length === 2 ? SMALL_NUMBER_WORDS[tokens[1]] : 0;
		if (units !== undefined && units < 10) {
			return TENS_NUMBER_WORDS[tokens[0]] + units;
		}
	}

	return undefined;
}

function parseUnderOneThousand(tokens: string[]): number | undefined {
	const hundredIndex = tokens.indexOf("hundred");
	if (hundredIndex === -1) {
		return parseUnderOneHundred(tokens);
	}

	if (
		hundredIndex !== 1 ||
		!(tokens[0] in SMALL_NUMBER_WORDS) ||
		SMALL_NUMBER_WORDS[tokens[0]] < 1 ||
		SMALL_NUMBER_WORDS[tokens[0]] > 9
	) {
		return undefined;
	}

	let remainder = tokens.slice(2);
	if (remainder[0] === "and") {
		remainder = remainder.slice(1);
	}
	if (remainder.includes("and")) {
		return undefined;
	}

	const remainderValue = remainder.length === 0 ? 0 : parseUnderOneHundred(remainder);
	return remainderValue === undefined
		? undefined
		: SMALL_NUMBER_WORDS[tokens[0]] * 100 + remainderValue;
}

function parseWrittenInteger(tokens: string[]): number | undefined {
	if (tokens.length === 0) {
		return undefined;
	}

	let total = 0;
	let previousScale = Number.POSITIVE_INFINITY;
	let groupStart = 0;

	for (let index = 0; index <= tokens.length; index += 1) {
		const scale = NUMBER_SCALES[tokens[index]];
		if (scale === undefined && index < tokens.length) {
			continue;
		}

		const group =
			index === tokens.length && groupStart === index
				? 0
				: parseUnderOneThousand(tokens.slice(groupStart, index));
		if (group === undefined || (index < tokens.length && (group === 0 || scale >= previousScale))) {
			return undefined;
		}

		if (index === tokens.length) {
			return total + group;
		}

		total += group * scale;
		previousScale = scale;
		groupStart = index + 1;
	}

	return undefined;
}

function parseWrittenNumber(text: string): number | undefined {
	const tokens = text.toLowerCase().replaceAll("-", " ").trim().split(/\s+/);
	let sign = 1;

	if (tokens[0] === "negative" || tokens[0] === "minus") {
		sign = -1;
		tokens.shift();
	} else if (tokens[0] === "positive" || tokens[0] === "plus") {
		tokens.shift();
	}

	const pointIndex = tokens.indexOf("point");
	if (pointIndex === -1) {
		const integer = parseWrittenInteger(tokens);
		return integer === undefined ? undefined : sign * integer;
	}

	if (pointIndex === 0 || pointIndex !== tokens.lastIndexOf("point")) {
		return undefined;
	}

	const integer = parseWrittenInteger(tokens.slice(0, pointIndex));
	const decimalTokens = tokens.slice(pointIndex + 1);
	if (
		integer === undefined ||
		decimalTokens.length === 0 ||
		decimalTokens.some((token) => !(token in SMALL_NUMBER_WORDS) || SMALL_NUMBER_WORDS[token] > 9)
	) {
		return undefined;
	}

	const decimal = Number(`0.${decimalTokens.map((token) => SMALL_NUMBER_WORDS[token]).join("")}`);
	return sign * (integer + decimal);
}

export function matchNumber(
	text: string,
	block: CommandBlock,
): CommandVariableOf<"number"> | undefined {
	if (block.type !== "number") {
		return undefined;
	}

	const normalizedText = normalize(text).trim();
	const numericPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
	const numericValue = numericPattern.test(normalizedText)
		? Number(normalizedText)
		: block.allowWords
			? parseWrittenNumber(normalizedText)
			: undefined;

	if (
		numericValue === undefined ||
		!Number.isFinite(numericValue) ||
		(block.numberType !== "decimal" && !Number.isInteger(numericValue)) ||
		(block.min !== undefined && numericValue < block.min) ||
		(block.max !== undefined && numericValue > block.max)
	) {
		return undefined;
	}

	return {blockId: block.id, type: "number", value: numericValue};
}

export function matchBoolean(
	text: string,
	block: CommandBlock,
): CommandVariableOf<"boolean"> | undefined {
	if (block.type !== "boolean") return undefined;

	const normalizedText = normalize(text);
	if (block.trueMatches.some((match) => normalize(match) === normalizedText)) {
		return {blockId: block.id, type: "boolean", value: true};
	}
	if (block.falseMatches.some((match) => normalize(match) === normalizedText)) {
		return {blockId: block.id, type: "boolean", value: false};
	}
	return undefined;
}

export function matchChoice(
	text: string,
	block: CommandBlock,
): CommandVariableOf<"choice"> | undefined {
	if (block.type !== "choice") return undefined;

	const normalizedText = normalize(text);
	const choice = block.choices.find((option) =>
		option.matches.some((match) => normalize(match) === normalizedText),
	);
	return choice ? {blockId: block.id, type: "choice", value: choice.value} : undefined;
}

const DIRECTION_ALIASES: Record<string, CommandVariableOf<"direction">["value"]> = {
	n: "n",
	north: "n",
	ne: "ne",
	northeast: "ne",
	e: "e",
	east: "e",
	se: "se",
	southeast: "se",
	s: "s",
	south: "s",
	sw: "sw",
	southwest: "sw",
	w: "w",
	west: "w",
	nw: "nw",
	northwest: "nw",
	up: "up",
	u: "up",
	down: "down",
	d: "down",
	in: "in",
	enter: "in",
	out: "out",
	exit: "out",
};

export function matchDirection(
	text: string,
	block: CommandBlock,
): CommandVariableOf<"direction"> | undefined {
	if (block.type !== "direction") return undefined;

	const direction = DIRECTION_ALIASES[normalize(text)];
	if (!direction || (block.allowed.length > 0 && !block.allowed.includes(direction))) {
		return undefined;
	}
	return {blockId: block.id, type: "direction", value: direction};
}

export function matchRelation(
	text: string,
	block: CommandBlock,
): CommandVariableOf<"relation"> | undefined {
	if (block.type !== "relation") return undefined;

	const defaultMatches = block.aliasMode === "replace" ? [] : [block.relation];
	const customMatches = block.aliasMode === "defaults" ? [] : block.aliases;
	const matches = [...defaultMatches, ...customMatches];
	if (!matches.some((match) => normalize(match) === normalize(text))) return undefined;

	return {blockId: block.id, type: "relation", value: block.relation};
}

function targetMatchesFilters(candidate: TargetMatchCandidate, block: TargetBlock): boolean {
	if (block.entityTypes.length > 0 && !block.entityTypes.includes(candidate.reference.type)) {
		return false;
	}
	if (
		block.entityIds.length > 0 &&
		!block.entityIds.some((entityId) => compareIds(entityId, candidate.reference))
	) {
		return false;
	}
	if (block.source !== "any" && !candidate.sources.includes(block.source)) return false;

	const candidateTags = new Set(candidate.tags ?? []);
	return block.tagMode === "all"
		? block.tags.every((tag) => candidateTags.has(tag))
		: block.tags.length === 0 || block.tags.some((tag) => candidateTags.has(tag));
}

export function matchTarget(
	text: string,
	block: CommandBlock,
	context: MatchBlockContext = {},
): CommandVariableOf<"target"> | undefined {
	if (block.type !== "target") return undefined;

	const eligible = (context.targets ?? []).filter((candidate) =>
		targetMatchesFilters(candidate, block),
	);
	const normalizedText = normalize(text);
	const directMatches = eligible.filter((candidate) =>
		[candidate.name, ...(candidate.aliases ?? [])].some((name) => normalize(name) === normalizedText),
	);
	const matches =
		directMatches.length > 0
			? directMatches
			: eligible.length === 1 &&
				  block.extraAliases.some((alias) => normalize(alias) === normalizedText)
				? eligible
				: [];

	return matches.length === 1
		? {blockId: block.id, type: "target", value: matches[0].reference}
		: undefined;
}

function resolvedText(text: string, mode: Extract<CommandBlock, {type: "text"}>["mode"]): string {
	const trimmed = text.trim();
	if (mode !== "quoted") return trimmed;
	if (trimmed.length < 2) return "";

	const quote = trimmed[0];
	return (quote === '"' || quote === "'") && trimmed.at(-1) === quote
		? trimmed.slice(1, -1).trim()
		: "";
}

export function matchText(
	text: string,
	block: CommandBlock,
): CommandVariableOf<"text"> | undefined {
	if (block.type !== "text") return undefined;

	const value = resolvedText(text, block.mode);
	if (!value || (block.mode === "word" && /\s/.test(value))) return undefined;
	if (block.minLength !== undefined && value.length < block.minLength) return undefined;
	if (block.maxLength !== undefined && value.length > block.maxLength) return undefined;

	return {blockId: block.id, type: "text", value};
}

export function matchBlock(
	text: string,
	block: CommandBlock,
	context: MatchBlockContext = {},
): CommandVariable | undefined {
	switch (block.type) {
		case "phrase":
			return matchPhrase(text, block);
		case "number":
			return matchNumber(text, block);
		case "boolean":
			return matchBoolean(text, block);
		case "choice":
			return matchChoice(text, block);
		case "direction":
			return matchDirection(text, block);
		case "relation":
			return matchRelation(text, block);
		case "target":
			return matchTarget(text, block, context);
		case "text":
			return matchText(text, block);
		default:
			return undefined;
	}
}
