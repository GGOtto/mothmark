import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";
import {ConditionBranchSchema} from "./conditionBranchSchemas";
import {ConditionSchema} from "./conditionSchema";
import {DirectionSchema} from "./roomSchema";

const RoleSchema = editor
	.input({
		title: "Use as",
		description: "Names this matched value for conditions, effects, and messages.",
	})
	.trim()
	.min(1);

const PhraseListSchema = z.array(z.string().trim().min(1)).min(1);

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

export const DirectionBlockSchema = editor.object(
	{
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
				const normalizedValue = choice.value.trim().toLowerCase();
				if (values.has(normalizedValue)) {
					ctx.addIssue({
						code: "custom",
						message: "Choice values must be unique.",
						path: ["choices", choiceIndex, "value"],
					});
				}
				values.add(normalizedValue);

				choice.matches.forEach((match, matchIndex) => {
					const normalizedMatch = match.trim().toLowerCase().replace(/\s+/g, " ");
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

		pattern.blocks.forEach((block, index) => {
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

export const CommandSchema = editor.object(
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
		availableWhen: editor.conditionControl(ConditionSchema, {
			title: "Available when",
			description: "The command participates in matching only when these conditions pass.",
		}),
		priority: editor.priority({
			title: "Priority",
			description: "An advanced tie-breaker between otherwise equally specific commands.",
		}),
		behavior: ConditionBranchSchema,
	},
	{
		title: "Command",
		description: "Matches player input, checks availability, and runs authored behavior.",
	},
);

export type CommandBlock = z.infer<typeof BlockSchema>;
export type CommandPattern = z.infer<typeof PatternSchema>;
export type Command = z.infer<typeof CommandSchema>;
