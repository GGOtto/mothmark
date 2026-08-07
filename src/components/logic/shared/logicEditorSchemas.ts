import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {ConditionSchema} from "@/schemas/world/conditionSchema";
import {CommandConditionSchema} from "@/schemas/world/commandLogicSchemas";

export const EventConditionEditorSchema = editor.conditionControl(ConditionSchema, {
	title: "Condition",
	features: {navigateChildEditors: false, reuseWorldConditions: false},
});

export const CommandConditionEditorSchema = editor.conditionControl(CommandConditionSchema, {
	title: "Condition",
	features: {navigateChildEditors: false, reuseWorldConditions: false},
});
