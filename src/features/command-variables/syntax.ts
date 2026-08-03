import {toID} from "@/utils/idUtils";
import type {CommandVariableProjection, CommandVariableReference} from "./model";

export type VariableTextNode =
	| {type: "text"; value: string}
	| {
			type: "variable";
			reference: CommandVariableReference;
			raw: string;
	  };

const VARIABLE_TOKEN_PATTERN = /\{variable\s+([^\s}]+)(?:\s+(name|description|text))?\}/g;

export function serializeVariableReference(reference: CommandVariableReference) {
	return `{variable ${reference.blockId.id}${reference.projection ? ` ${reference.projection}` : ""}}`;
}

export function parseVariableText(value: string): VariableTextNode[] {
	const nodes: VariableTextNode[] = [];
	let offset = 0;

	for (const match of value.matchAll(VARIABLE_TOKEN_PATTERN)) {
		const index = match.index ?? 0;
		if (index > offset) nodes.push({type: "text", value: value.slice(offset, index)});
		const raw = match[0];
		nodes.push({
			type: "variable",
			raw,
			reference: {
				blockId: toID("command-block", match[1]),
				projection: match[2] as CommandVariableProjection | undefined,
			},
		});
		offset = index + raw.length;
	}

	if (offset < value.length) nodes.push({type: "text", value: value.slice(offset)});
	if (nodes.length === 0 && value.length > 0) nodes.push({type: "text", value});
	return nodes;
}

export function serializeVariableText(nodes: VariableTextNode[]) {
	return nodes
		.map((node) => (node.type === "text" ? node.value : serializeVariableReference(node.reference)))
		.join("");
}

export function variableReferencesInText(value: string) {
	return parseVariableText(value).flatMap((node) =>
		node.type === "variable" ? [node.reference] : [],
	);
}
