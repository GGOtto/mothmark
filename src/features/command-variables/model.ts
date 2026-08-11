import type {CommandBlock, Command} from "@/schemas/world/commandSchemas";
import type {
	EditorCommandVariableType,
	EditorControlMetadata,
	EditorPath,
} from "@/types/universalEditorTypes";
import {compareIds, idValue, type ID} from "@/utils/idUtils";

export type CommandVariableProjection = "name" | "description" | "text";

export type CommandVariableValueType = EditorCommandVariableType;

export type CommandVariableReference = {
	blockId: ID<"command-block">;
	projection?: CommandVariableProjection;
};

export type CommandVariableOption = CommandVariableReference & {
	blockType: CommandBlock["type"];
	label: string;
	detail?: string;
	valueType: CommandVariableValueType;
	entityTypes?: Array<"room" | "item">;
};

export type CommandVariableCatalog = {
	options: CommandVariableOption[];
	failedBlockId?: ID<"command-block">;
};

export type CommandVariableEditorContext = CommandVariableCatalog & {
	supportsPath: (path: EditorPath) => boolean;
	getBinding: (path: EditorPath) => CommandVariableReference | undefined;
	setBinding: (
		path: EditorPath,
		reference: CommandVariableReference | undefined,
		fallbackValue: unknown,
	) => void;
};

const SCALAR_TYPES: Record<
	Exclude<CommandBlock["type"], "target" | "phrase" | "relation">,
	CommandVariableValueType
> = {
	number: "number",
	boolean: "boolean",
	direction: "direction",
	choice: "string",
	text: "string",
};

function blockLabel(block: CommandBlock) {
	if ("role" in block && block.role?.trim()) return block.role.trim();
	if (block.type === "phrase") return block.matches[0] ?? "phrase";
	if (block.type === "relation") return block.relation;
	return block.type;
}

function option(
	block: CommandBlock,
	projection: CommandVariableProjection | undefined,
	valueType: CommandVariableValueType,
	detail?: string,
): CommandVariableOption {
	return {
		blockId: block.id,
		blockType: block.type,
		label: blockLabel(block),
		projection,
		valueType,
		detail,
		entityTypes:
			block.type === "target"
				? block.entityTypes.length > 0
					? block.entityTypes
					: ["room", "item"]
				: undefined,
	};
}

function optionsForBlock(block: CommandBlock, failed: boolean): CommandVariableOption[] {
	if (failed) return [option(block, "text", "string", "entered text")];

	if (block.type === "target") {
		return [
			option(block, undefined, "entity", "entity"),
			option(block, "name", "string", "name"),
			option(block, "description", "string", "description"),
			option(block, "text", "string", "entered text"),
		];
	}
	if (block.type === "phrase" || block.type === "relation") {
		return [option(block, "text", "string", "entered text")];
	}
	if (block.type === "direction") {
		return [
			option(block, undefined, "direction", undefined),
			option(block, "name", "string", "direction name"),
			option(block, "text", "string", "entered text"),
		];
	}

	return [
		option(block, undefined, SCALAR_TYPES[block.type], undefined),
		option(block, "text", "string", "entered text"),
	];
}

/** Builds one command-scoped catalog while preserving shared block identity. */
export function buildCommandVariableCatalog(
	command: Command,
	failedBlockId?: ID<"command-block">,
): CommandVariableCatalog {
	const blocks = new Map<string, CommandBlock>();
	for (const pattern of command.patterns) {
		for (const block of pattern.blocks) blocks.set(idValue(block.id), block);
	}

	return {
		failedBlockId,
		options: [...blocks.values()].flatMap((block) =>
			optionsForBlock(block, Boolean(failedBlockId && compareIds(block.id, failedBlockId))),
		),
	};
}

export function acceptedVariableType(
	metadata: EditorControlMetadata,
): CommandVariableValueType | undefined {
	if (metadata.commandVariableType) return metadata.commandVariableType;
	if (metadata.type === "number") return "number";
	if (metadata.type === "toggle") return "boolean";
	if (metadata.type === "direction-picker") return "direction";
	if (metadata.type === "entity-picker" || metadata.type === "room-picker") return "entity";
	if (
		metadata.type === "text" ||
		metadata.type === "input" ||
		metadata.type === "textarea" ||
		metadata.type === "rich-text"
	) {
		return "string";
	}
	return undefined;
}

export function unavailableVariableMessage(valueType: CommandVariableValueType) {
	switch (valueType) {
		case "boolean":
			return "Add a Boolean block to this command to use its value.";
		case "number":
			return "Add a Number block to this command to use its value.";
		case "direction":
			return "Add a Direction block to this command to use its value.";
		case "entity":
			return "Add a Target block to this command to use its value.";
		case "string":
			return "Add a command block to insert its raw text.";
	}
}

export function compatibleVariableOptions(
	catalog: CommandVariableCatalog,
	metadata: EditorControlMetadata,
): CommandVariableOption[] {
	const acceptedType = acceptedVariableType(metadata);
	if (!acceptedType) return [];
	const entityType =
		metadata.entityType ??
		(typeof metadata.features?.entityType === "string" ? metadata.features.entityType : undefined);

	return catalog.options.filter((candidate) => {
		if (candidate.valueType !== acceptedType) return false;
		if (acceptedType !== "entity" || !entityType) return true;
		if (!candidate.entityTypes?.length) return false;
		return candidate.entityTypes.includes(entityType as "room" | "item");
	});
}

export function inlineVariableOptions(catalog: CommandVariableCatalog) {
	return catalog.options.filter((candidate) => candidate.valueType !== "entity");
}

export function referencesEqual(
	left: CommandVariableReference | undefined,
	right: CommandVariableReference | undefined,
) {
	return Boolean(
		left && right && compareIds(left.blockId, right.blockId) && left.projection === right.projection,
	);
}
