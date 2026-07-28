import {CommandBlock} from "@/schemas/world/commandSchemas";
import {normalize} from "./normalize";

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

export function matchPhrase(text: string, block: CommandBlock): boolean {
	if (block.type !== "phrase") {
		return false;
	}
	const normalizedText = normalize(text);
	return block.matches.some((match) => normalize(match) === normalizedText);
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

export function matchNumber(text: string, block: CommandBlock): boolean {
	if (block.type !== "number") {
		return false;
	}

	const normalizedText = normalize(text).trim();
	const numericPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
	const numericValue = numericPattern.test(normalizedText)
		? Number(normalizedText)
		: block.allowWords
			? parseWrittenNumber(normalizedText)
			: undefined;

	return (
		numericValue !== undefined &&
		Number.isFinite(numericValue) &&
		(block.numberType === "decimal" || Number.isInteger(numericValue)) &&
		(block.min === undefined || numericValue >= block.min) &&
		(block.max === undefined || numericValue <= block.max)
	);
}

export function matchChoice(text: string, block: CommandBlock): boolean {
	return false;
}

export function matchDirection(text: string, block: CommandBlock): boolean {
	return false;
}

export function matchRelation(text: string, block: CommandBlock): boolean {
	return false;
}

export function matchTarget(text: string, block: CommandBlock): boolean {
	return false;
}

export function matchText(text: string, block: CommandBlock): boolean {
	return false;
}

export function matchBlock(text: string, block: CommandBlock): boolean {
	switch (block.type) {
		case "phrase":
			return matchPhrase(text, block);
		case "number":
			return matchNumber(text, block);
		case "choice":
			return matchChoice(text, block);
		case "direction":
			return matchDirection(text, block);
		case "relation":
			return matchRelation(text, block);
		case "target":
			return matchTarget(text, block);
		case "text":
			return matchText(text, block);
		default:
			return false;
	}
}
