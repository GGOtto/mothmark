import {z} from "zod";
import {idValue} from "@/utils/idUtils";
import {editor} from "../utils/editorSchemaHelpers";
import {CommandConditionBranchSchema} from "./commandLogicSchemas";
import {DirectionSchema} from "./roomSchema";

const RoleSchema = editor
	.input({
		title: "Use as",
		description: "Names this matched value for conditions, effects, and messages.",
	})
	.trim()
	.min(1);

const PhraseListSchema = z.array(z.string().trim().min(1)).min(1);

const DEFAULT_TRUE_MATCHES = ["yes", "yep", "yeah", "okay", "ok"];
const DEFAULT_FALSE_MATCHES = ["no", "nope", "nah"];

function normalizeBlockMatch(match: string): string {
	return match.trim().toLowerCase().replace(/\s+/g, " ");
}

export const RelationTypeSchema = z.enum([
	"on",
	"in",
	"from",
	"off",
	"with",
	"to",
	"at",
	"under",
	"over",
	"behind",
	"before",
	"beside",
	"against",
	"through",
	"across",
	"between",
	"about",
	"for",
	"as",
]);

export const TargetEntityTypeSchema = z.enum(["room", "feature"]);

export const TargetReferenceSchema = z.union([
	editor.reference("room", {title: "Room"}),
	editor.reference("feature", {title: "Feature"}),
]);

export const ChoiceOptionSchema = editor.object(
	{
		value: editor
			.input({
				title: "Value",
				description: "The stable value produced when this option matches.",
			})
			.trim()
			.min(1),
		label: editor
			.input({title: "Label", description: "The author-facing name of this option."})
			.trim()
			.min(1),
		matches: editor.stringList(
			{
				title: "Accepted words",
				description: "Words or phrases that select this option.",
			},
			PhraseListSchema,
		),
	},
	{title: "Choice", description: "Maps accepted player wording to a stable value."},
);

export const PhraseBlockSchema = editor.object(
	{
		id: editor.id("command-block"),
		type: z.literal("phrase"),
		matches: editor.stringList(
			{
				title: "Accepted words",
				description: "Words or phrases that can appear at this position.",
			},
			PhraseListSchema,
		),
	},
	{title: "Phrase", description: "Matches one of a fixed set of words or phrases."},
);

export const RelationBlockSchema = editor.object(
	{
		id: editor.id("command-block"),
		type: z.literal("relation"),
		relation: editor.select(RelationTypeSchema, {
			title: "Relationship",
			description: "The normalized relationship this block represents.",
		}),
		aliasMode: editor
			.select(z.enum(["defaults", "extend", "replace"]), {
				title: "Accepted words",
				description: "Use, extend, or replace the engine's standard wording.",
			})
			.default("defaults"),
		aliases: editor.stringList({
			title: "Custom words",
			description: "Additional or replacement wording for this relationship.",
		}),
		role: RoleSchema.optional(),
	},
	{title: "Relation", description: "Matches a relationship such as on, in, with, or to."},
);

export const TargetBlockSchema = editor.object(
	{
		id: editor.id("command-block"),
		type: z.literal("target"),
		role: RoleSchema,
		entityTypes: editor.multiSelect(
			{
				title: "Entity types",
				description: "Leave empty to allow any supported entity type.",
				options: [
					{label: "Room", value: "room"},
					{label: "Feature", value: "feature"},
				],
			},
			z.array(TargetEntityTypeSchema).default([]),
		),
		entityIds: editor.array(TargetReferenceSchema, {
			title: "Specific targets",
			description: "Leave empty to allow any entity satisfying the other restrictions.",
		}),
		tags: editor.tagList("all", {
			title: "Required tags",
			description: "Only entities with matching tags can resolve as this target.",
		}),
		tagMode: editor
			.select(z.enum(["all", "any"]), {
				title: "Tag matching",
				description: "Require every selected tag or at least one selected tag.",
			})
			.default("all"),
		source: editor
			.select(z.enum(["visible", "reachable", "current-room", "known", "any"]), {
				title: "Available from",
				description: "Where the resolver may find a matching target.",
			})
			.default("visible"),
		extraAliases: editor.aliasList({
			title: "Command aliases",
			description: "Extra names accepted only for this command target.",
		}),
	},
	{title: "Target", description: "Resolves player wording to a typed world entity."},
);

export const NumberBlockSchema = editor.object(
	{
		id: editor.id("command-block"),
		type: z.literal("number"),
		role: RoleSchema,
		numberType: editor
			.select(z.enum(["integer", "decimal"]), {
				title: "Number type",
			})
			.default("integer"),
		min: editor.number({title: "Minimum"}).optional(),
		max: editor.number({title: "Maximum"}).optional(),
		allowWords: editor
			.boolean({
				title: "Allow written numbers",
				description: "Accept wording such as three as well as the digit 3.",
			})
			.default(true),
	},
	{title: "Number", description: "Parses a numeric value from the player's command."},
);

export const BooleanBlockSchema = editor.object(
	{
		id: editor.id("command-block"),
		type: z.literal("boolean"),
		role: RoleSchema,
		trueMatches: editor.stringList(
			{
				title: "True wording",
				description: "Words or phrases that resolve to true.",
			},
			PhraseListSchema.default(DEFAULT_TRUE_MATCHES),
		),
		falseMatches: editor.stringList(
			{
				title: "False wording",
				description: "Words or phrases that resolve to false.",
			},
			PhraseListSchema.default(DEFAULT_FALSE_MATCHES),
		),
	},
	{title: "Boolean", description: "Parses player wording into true or false."},
);

export const DirectionBlockSchema = editor.object(
	{
		id: editor.id("command-block"),
		type: z.literal("direction"),
		role: RoleSchema,
		allowed: editor.array(DirectionSchema, {
			title: "Allowed directions",
			description: "Leave empty to accept every direction.",
		}),
	},
	{title: "Direction", description: "Resolves direction names and abbreviations."},
);

export const ChoiceBlockSchema = editor.object(
	{
		id: editor.id("command-block"),
		type: z.literal("choice"),
		role: RoleSchema,
		choices: editor
			.array(ChoiceOptionSchema, {
				title: "Choices",
				description: "The values and accepted wording available at this position.",
			})
			.refine((choices) => choices.length > 0, "Add at least one choice."),
	},
	{title: "Choice", description: "Resolves authored wording to one of several stable values."},
);

export const TextBlockSchema = editor.object(
	{
		id: editor.id("command-block"),
		type: z.literal("text"),
		role: RoleSchema,
		mode: editor
			.select(z.enum(["word", "phrase", "rest", "quoted"]), {
				title: "Text mode",
				description: "Controls how much player text this block consumes.",
			})
			.default("phrase"),
		minLength: editor.nonNegativeInteger({title: "Minimum length"}).optional(),
		maxLength: editor.positiveInteger({title: "Maximum length"}).optional(),
	},
	{title: "Text", description: "Captures arbitrary words supplied by the player."},
);

const BlockValueSchema = z
	.discriminatedUnion("type", [
		PhraseBlockSchema,
		RelationBlockSchema,
		TargetBlockSchema,
		NumberBlockSchema,
		BooleanBlockSchema,
		DirectionBlockSchema,
		ChoiceBlockSchema,
		TextBlockSchema,
	])
	.superRefine((block, ctx) => {
		if (block.type === "relation" && block.aliasMode === "replace" && !block.aliases.length) {
			ctx.addIssue({
				code: "custom",
				message: "Replacement relationship wording needs at least one accepted phrase.",
				path: ["aliases"],
			});
		}

		if (block.type === "number" && block.min !== undefined && block.max !== undefined) {
			if (block.min > block.max) {
				ctx.addIssue({
					code: "custom",
					message: "Minimum cannot be greater than maximum.",
					path: ["min"],
				});
			}
		}

		if (block.type === "boolean") {
			const trueMatches = new Set(block.trueMatches.map(normalizeBlockMatch));
			block.falseMatches.forEach((match, index) => {
				if (trueMatches.has(normalizeBlockMatch(match))) {
					ctx.addIssue({
						code: "custom",
						message: "True and false wording cannot overlap.",
						path: ["falseMatches", index],
					});
				}
			});
		}

		if (
			block.type === "text" &&
			block.minLength !== undefined &&
			block.maxLength !== undefined &&
			block.minLength > block.maxLength
		) {
			ctx.addIssue({
				code: "custom",
				message: "Minimum length cannot be greater than maximum length.",
				path: ["minLength"],
			});
		}

		if (block.type === "choice") {
			const values = new Set<string>();
			const matches = new Set<string>();

			block.choices.forEach((choice, choiceIndex) => {
				const normalizedValue = normalizeBlockMatch(choice.value);
				if (values.has(normalizedValue)) {
					ctx.addIssue({
						code: "custom",
						message: "Choice values must be unique.",
						path: ["choices", choiceIndex, "value"],
					});
				}
				values.add(normalizedValue);

				choice.matches.forEach((match, matchIndex) => {
					const normalizedMatch = normalizeBlockMatch(match);
					if (matches.has(normalizedMatch)) {
						ctx.addIssue({
							code: "custom",
							message: "Accepted choice wording must be unique.",
							path: ["choices", choiceIndex, "matches", matchIndex],
						});
					}
					matches.add(normalizedMatch);
				});
			});
		}
	});

export const BlockSchema = editor.discriminatedUnion(BlockValueSchema, {
	title: "Command block",
	description: "One ordered part of a player command pattern.",
});

function blockRole(block: z.infer<typeof BlockSchema>): string | undefined {
	return "role" in block ? block.role : undefined;
}

export const PatternSchema = editor
	.object(
		{
			blocks: editor
				.array(BlockSchema, {
					title: "Blocks",
					description: "Arrange the parts in the same order the player types them.",
				})
				.refine((blocks) => blocks.length > 0, "Add at least one command block."),
		},
		{
			title: "Pattern",
			description: "One accepted arrangement of phrases and matched values.",
		},
	)
	.superRefine((pattern, ctx) => {
		const roles = new Set<string>();
		const blockIds = new Set<string>();

		pattern.blocks.forEach((block, index) => {
			const blockId = idValue(block.id);
			if (blockIds.has(blockId)) {
				ctx.addIssue({
					code: "custom",
					message: "Each command block needs a unique ID.",
					path: ["blocks", index, "id"],
				});
			}
			blockIds.add(blockId);

			const role = blockRole(block);
			if (role) {
				const normalizedRole = role.trim().toLowerCase();
				if (roles.has(normalizedRole)) {
					ctx.addIssue({
						code: "custom",
						message: "Each matched value in a pattern needs a unique role.",
						path: ["blocks", index, "role"],
					});
				}
				roles.add(normalizedRole);
			}

			if (block.type === "text" && block.mode === "rest" && index !== pattern.blocks.length - 1) {
				ctx.addIssue({
					code: "custom",
					message: "A rest-of-input text block must be the final block.",
					path: ["blocks", index, "mode"],
				});
			}
		});
	});

const ScopeValueSchema = z
	.discriminatedUnion("scope", [
		z.object({
			scope: z.literal("global"),
		}),
		z.object({
			scope: z.literal("layers"),
			layers: editor
				.array(editor.integer({title: "Layer"}), {
					title: "Layers",
					description: "The numbered map layers where this command can be used.",
				})
				.refine((layers) => layers.length > 0, "Select at least one layer."),
		}),
		z.object({
			scope: z.literal("rooms"),
			roomIds: editor
				.array(editor.reference("room", {title: "Room"}), {
					title: "Rooms",
					description: "The rooms where this command can be used.",
				})
				.refine((roomIds) => roomIds.length > 0, "Select at least one room."),
		}),
	])
	.superRefine((scope, ctx) => {
		if (scope.scope !== "layers") return;

		const seenLayers = new Set<number>();
		scope.layers.forEach((layer, index) => {
			if (seenLayers.has(layer)) {
				ctx.addIssue({
					code: "custom",
					message: "Each layer can only be selected once.",
					path: ["layers", index],
				});
			}
			seenLayers.add(layer);
		});
	});

export const ScopeSchema = editor.discriminatedUnion(
	ScopeValueSchema,
	{
		title: "Scope",
		description: "The parts of the map where this command can be used.",
	},
	{scope: "global"},
);

export const CommandFallbackSchema = editor.object(
	{
		blockId: editor.id("command-block"),
		behavior: CommandConditionBranchSchema,
	},
	{
		title: "Block fallback",
		description: "Behavior to run when this command block only partially matches.",
	},
);

export const CommandSchema = editor
	.object(
		{
			id: editor.id("command", {title: "Command ID"}),
			name: editor
				.input({title: "Name", description: "The author-facing name of this command."})
				.min(1),
			enabled: editor.boolean({title: "Enabled"}).default(true),
			patterns: editor
				.array(PatternSchema, {
					title: "Patterns",
					description: "Alternative command arrangements that run the same behavior.",
				})
				.refine((patterns) => patterns.length > 0, "Add at least one command pattern."),
			scope: ScopeSchema,
			priority: editor.priority({
				title: "Priority",
				description: "An advanced tie-breaker between otherwise equally specific commands.",
			}),
			fallbacks: editor.array(CommandFallbackSchema, {
				title: "Fallbacks",
				description: "One fallback behavior for every block in every command pattern.",
			}),
			behavior: CommandConditionBranchSchema,
		},
		{
			title: "Command",
			description: "Matches player input, checks availability, and runs authored behavior.",
		},
	)
	.superRefine((command, ctx) => {
		const blockIds = new Set<string>();
		const expectedNonStructuralBlockCount = command.patterns[0]?.blocks.filter(
			(block) => block.type !== "phrase" && block.type !== "relation",
		).length;
		command.patterns.forEach((pattern, patternIndex) => {
			const nonStructuralBlockCount = pattern.blocks.filter(
				(block) => block.type !== "phrase" && block.type !== "relation",
			).length;
			if (nonStructuralBlockCount !== expectedNonStructuralBlockCount) {
				ctx.addIssue({
					code: "custom",
					message: "Alternative command patterns must have the same number of non-structural blocks.",
					path: ["patterns", patternIndex, "blocks"],
				});
			}

			pattern.blocks.forEach((block, blockIndex) => {
				const blockId = idValue(block.id);
				if (blockIds.has(blockId)) {
					ctx.addIssue({
						code: "custom",
						message: "Command block IDs must be unique across every pattern.",
						path: ["patterns", patternIndex, "blocks", blockIndex, "id"],
					});
				}
				blockIds.add(blockId);
			});
		});

		const fallbackBlockIds = new Set<string>();
		command.fallbacks.forEach((fallback, fallbackIndex) => {
			const blockId = idValue(fallback.blockId);
			if (!blockIds.has(blockId)) {
				ctx.addIssue({
					code: "custom",
					message: "Fallbacks must target a block in this command.",
					path: ["fallbacks", fallbackIndex, "blockId"],
				});
			}
			if (fallbackBlockIds.has(blockId)) {
				ctx.addIssue({
					code: "custom",
					message: "Each command block can only have one fallback.",
					path: ["fallbacks", fallbackIndex, "blockId"],
				});
			}
			fallbackBlockIds.add(blockId);
		});

		for (const blockId of blockIds) {
			if (!fallbackBlockIds.has(blockId)) {
				ctx.addIssue({
					code: "custom",
					message: "Every command block needs a fallback.",
					path: ["fallbacks"],
				});
			}
		}

		function validateCommandVariableReferences(value: unknown, path: Array<string | number>) {
			if (!value || typeof value !== "object") return;
			if (Array.isArray(value)) {
				value.forEach((child, index) => validateCommandVariableReferences(child, [...path, index]));
				return;
			}

			const record = value as Record<string, unknown>;
			if (Array.isArray(record.commandVariables)) {
				record.commandVariables.forEach((binding, index) => {
					if (!binding || typeof binding !== "object") return;
					const blockId = idValue((binding as {blockId?: unknown}).blockId);
					if (!blockIds.has(blockId)) {
						ctx.addIssue({
							code: "custom",
							message: "Command variable references must target a block in this command.",
							path: [...path, "commandVariables", index, "blockId"],
						});
					}
				});
			}

			Object.entries(record).forEach(([key, child]) => {
				if (key !== "commandVariables") validateCommandVariableReferences(child, [...path, key]);
			});
		}

		validateCommandVariableReferences(command.behavior, ["behavior"]);
		command.fallbacks.forEach((fallback, index) =>
			validateCommandVariableReferences(fallback.behavior, ["fallbacks", index, "behavior"]),
		);
	});

export type CommandBlock = z.infer<typeof BlockSchema>;
export type CommandPattern = z.infer<typeof PatternSchema>;
export type CommandFallback = z.infer<typeof CommandFallbackSchema>;
export type Command = z.infer<typeof CommandSchema>;
