import {CommandBlock} from "@/schemas/world/commandSchemas";
import {normalize} from "./normalize";

export function matchPhrase(text: string, block: CommandBlock): boolean {
	if (block.type !== "phrase") {
		return false;
	}
	const normalizedText = normalize(text);
	return block.matches.some((match) => normalize(match) === normalizedText);
}

export function matchBlock(text: string, block: CommandBlock): boolean {
	switch (block.type) {
		case "phrase":
			return matchPhrase(text, block);
		default:
			return false;
	}
}
