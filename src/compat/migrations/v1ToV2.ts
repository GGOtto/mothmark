import {createBlankWorldDocument} from "@/data/worlds/createBlankWorld";

import {defineStorageMigration, unchanged, type WorldMigrationContext} from "./types";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const optionalString = (value: unknown): string | undefined =>
	typeof value === "string" ? value : undefined;

const V2_COMMAND_IDS = new Set([
	"command-1",
	"command-2",
	"take",
	"drop",
	"examine",
	"open",
	"close",
	"lock",
	"unlock",
	"use",
	"use-targeted",
	"put-inside",
	"put-on",
]);

function historicalV2Commands(commands: unknown[]): unknown[] {
	return commands.flatMap((value) => {
		if (!isRecord(value) || !isRecord(value.id) || !V2_COMMAND_IDS.has(String(value.id.id))) {
			return [];
		}
		const command = {...value};
		delete command.showInHelp;
		delete command.helpPattern;
		delete command.helpDescription;
		if (Array.isArray(command.patterns)) {
			command.patterns = command.patterns.map((patternValue) => {
				if (!isRecord(patternValue) || !Array.isArray(patternValue.blocks)) return patternValue;
				return {
					...patternValue,
					blocks: patternValue.blocks.map((blockValue) => {
						if (!isRecord(blockValue) || blockValue.type !== "direction") return blockValue;
						const block = {...blockValue};
						delete block.allowRelative;
						return block;
					}),
				};
			});
		}
		return [command];
	});
}

/**
 * One-time launch reset. This intentionally discards authored world content while retaining the
 * world's title and the standard built-in command documents.
 */
export function resetWorldToBlank(value: unknown, context: WorldMigrationContext): unknown {
	const metadata = isRecord(value) && isRecord(value.metadata) ? value.metadata : {};
	const title = context.name ?? optionalString(metadata.title) ?? "Untitled world";

	const blank = createBlankWorldDocument(title);
	return {...blank, commands: historicalV2Commands(blank.commands)};
}

export const v1ToV2 = defineStorageMigration({
	id: "v1-to-v2-reset-worlds-to-blank",
	fromVersion: 1,
	toVersion: 2,
	world: resetWorldToBlank,
	gameState: unchanged,
	messages: unchanged,
});
