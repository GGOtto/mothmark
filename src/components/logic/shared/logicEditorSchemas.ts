import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {ConditionSchema, SavedConditionSchema} from "@/schemas/world/conditionSchema";
import {CommandConditionSchema} from "@/schemas/world/commandLogicSchemas";

export const EventConditionEditorSchema = editor.conditionControl(ConditionSchema, {
	title: "Condition",
	features: {navigateChildEditors: false, reuseWorldConditions: false},
});

export const CommandConditionEditorSchema = editor.conditionControl(CommandConditionSchema, {
	title: "Condition",
	features: {navigateChildEditors: false, reuseWorldConditions: false},
});

export const SavedConditionEditorSchema = SavedConditionSchema.extend({
	condition: editor.conditionControl(ConditionSchema, {
		title: "Conditions",
		features: {
			allowGroups: true,
			allowNestedGroups: true,
			navigateChildEditors: false,
			reuseWorldConditions: false,
			rootGroup: true,
		},
	}),
});
