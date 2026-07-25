import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";
import {ConditionSchema} from "./conditionSchema";
import {EffectGroupSchema} from "./effectSchema";

export const ConditionWithEffectSchema = z.object({
	condition: editor.conditionControl(ConditionSchema),
	effect: EffectGroupSchema,
	delayTurns: editor
		.number({
			title: "Delay",
			description: "Delay the effect for a number of turns.",
		})
		.default(0),
	cancelIfConditionFails: editor
		.boolean({
			title: "Cancel if condition fails?",
			description: "Cancel the following effect if this condition becomes false after the delay.",
		})
		.default(true),
});

export const ConditionBranchSchema = z.object({
	id: editor.id("condition-branch"),
	always: EffectGroupSchema.optional(),
	if: ConditionWithEffectSchema.optional(),
	elifs: editor.array(ConditionWithEffectSchema).optional(),
	else: EffectGroupSchema.optional(),
});

export type ConditionBranch = z.infer<typeof ConditionBranchSchema>;
