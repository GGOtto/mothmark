import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";
import {ConditionSchema} from "./conditionSchema";
import {EffectGroupSchema} from "./effectSchema";

export const ConditionWithEffectSchema = z.object({
	condition: editor.conditionControl(ConditionSchema),
	effect: EffectGroupSchema,
});

export const ConditionBranchSchema = z.object({
	id: editor.id("condition-branch"),
	perform: EffectGroupSchema.optional(),
	if: ConditionWithEffectSchema.optional(),
	elifs: editor.array(ConditionWithEffectSchema).optional(),
	else: EffectGroupSchema.optional(),
});
