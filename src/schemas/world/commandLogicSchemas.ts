import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";
import {withEditorVariants} from "@/utils/editorMetadata";
import {ComparisonOperatorSchema, ConditionSchema} from "./conditionSchema";
import {EffectSchema} from "./effectSchema";

const PROTECTED_BINDING_FIELDS = new Set([
	"__proto__",
	"prototype",
	"constructor",
	"type",
	"operation",
	"flag-type",
	"commandVariables",
	"conditions",
	"effects",
]);

export const CommandVariableBindingSchema = z.object({
	blockId: editor.id("command-block"),
	projection: z.enum(["name", "description", "text"]).optional(),
	field: z
		.string()
		.trim()
		.min(1)
		.refine((field) => !PROTECTED_BINDING_FIELDS.has(field), {
			message: "Command variables can only replace effect and condition values.",
		}),
});

export const CommandVariableBindingsSchema = z
	.array(CommandVariableBindingSchema)
	.default([])
	.superRefine((bindings, ctx) => {
		const fields = new Set<string>();
		bindings.forEach((binding, index) => {
			if (fields.has(binding.field)) {
				ctx.addIssue({
					code: "custom",
					message: "Only one command variable can replace a field.",
					path: [index, "field"],
				});
			}
			fields.add(binding.field);
		});
	});

export type CommandVariableBinding = z.infer<typeof CommandVariableBindingSchema>;

const commandVariablesField = CommandVariableBindingsSchema.optional();

/**
 * Command logic deliberately uses a generic value template instead of mirroring
 * every canonical condition and effect variant. The canonical schemas remain the
 * single source of truth and validate the object after command values are applied.
 */
export const CommandLogicTemplateSchema = z
	.object({
		type: z.string().trim().min(1),
		operation: z.string().trim().min(1).optional(),
		commandVariables: commandVariablesField,
	})
	.catchall(z.unknown());

export type CommandLogicTemplate = z.infer<typeof CommandLogicTemplateSchema>;

const CommandConditionLeafSchema = withEditorVariants(
	CommandLogicTemplateSchema.refine(
		(condition) => condition.type !== "group" && condition.type !== "comparison",
		{message: "Condition groups and comparisons use their dedicated schemas.", path: ["type"]},
	),
	ConditionSchema,
);

function commandNumberOperand(title: string) {
	return editor.discriminatedUnion(
		z.discriminatedUnion("source", [
			editor.object(
				{
					source: z.literal("literal"),
					value: editor.number({title: "Number"}),
				},
				{title: "Number"},
			),
			editor.object(
				{
					source: z.literal("counter"),
					counter: editor.counterKey({title: "Saved counter"}),
				},
				{title: "Saved counter"},
			),
		]),
		{
			title,
			description: "Use a number, a saved counter, or a number captured by this command.",
			commandVariableType: "number",
			emptyState: {emptyActionLabel: `Add ${title.toLocaleLowerCase()}`},
		},
	);
}

export const CommandComparisonConditionSchema = z.object({
	type: z.literal("comparison"),
	valueType: z.literal("number"),
	operator: ComparisonOperatorSchema,
	left: commandNumberOperand("Left value").optional(),
	right: commandNumberOperand("Right value").optional(),
	commandVariables: commandVariablesField,
});

export type CommandComparisonCondition = z.infer<typeof CommandComparisonConditionSchema>;
export type CommandConditionGroup = {
	type: "group";
	operation: "all" | "any" | "none";
	conditions: CommandCondition[];
	commandVariables?: CommandVariableBinding[];
};

export type CommandCondition =
	z.infer<typeof CommandConditionLeafSchema> | CommandComparisonCondition | CommandConditionGroup;

export const CommandConditionSchema: z.ZodType<CommandCondition> = z.lazy(() =>
	z.union([
		CommandComparisonConditionSchema,
		z.object({
			type: z.literal("group"),
			operation: z.enum(["all", "any", "none"]),
			conditions: z.array(CommandConditionSchema),
			commandVariables: commandVariablesField,
		}),
		CommandConditionLeafSchema,
	]),
);

export const CommandEffectSchema = withEditorVariants(
	CommandLogicTemplateSchema.refine(
		(effect) => effect.type !== "group" && effect.type !== "conditional",
		{message: "Command effects must be individual effects or effect references.", path: ["type"]},
	),
	EffectSchema,
);

export type CommandEffect = z.infer<typeof CommandEffectSchema>;

export const CommandEffectGroupSchema = editor.effectControl(
	z.object({
		name: editor.input({title: "Group name"}),
		id: editor.id("effect", {title: "Group ID", hidden: true}),
		type: z.literal("group"),
		effects: editor.effects(CommandEffectSchema, {
			title: "Effects",
			description: "Effects that may receive values from matched command blocks.",
		}),
		allowMultipleUsesInWorld: editor.hidden(z.literal(true).default(true), {
			title: "Stored in world effects",
		}),
	}),
	{
		title: "Command effect group",
		description: "Configure effects that run after command variables are resolved.",
	},
);

export type CommandEffectGroup = z.infer<typeof CommandEffectGroupSchema>;

export const CommandConditionWithEffectSchema = z.object({
	condition: editor.conditionControl(CommandConditionSchema),
	effect: CommandEffectGroupSchema,
	delayTurns: editor.number({title: "Delay"}).default(0),
	cancelIfConditionFails: editor.boolean({title: "Cancel if condition fails?"}).default(true),
});

export const CommandConditionBranchSchema = z.object({
	id: editor.id("condition-branch"),
	always: CommandEffectGroupSchema.optional(),
	if: CommandConditionWithEffectSchema.optional(),
	elifs: editor.array(CommandConditionWithEffectSchema).optional(),
	else: CommandEffectGroupSchema.optional(),
});

export type CommandConditionWithEffect = z.infer<typeof CommandConditionWithEffectSchema>;
export type CommandConditionBranch = z.infer<typeof CommandConditionBranchSchema>;
