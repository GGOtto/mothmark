import {z} from "zod";
import {editor} from "./editorSchemaHelpers";
import {ConditionalTextSchema} from "./conditionSchema";

export const DescriptionSchema = editor.conditionalText(
	z.object({
		default: editor
			.richText({
				title: "Default Description",
				description: "The description that will be displayed if no other conditions are met.",
				placeholder: "Describe what the player sees...",
				layout: {
					width: "full",
					order: 1,
				},
			})
			.default(""),

		variants: editor.array(ConditionalTextSchema, {
			title: "Description Variants",
			description: "Description variants that can replace the description if conditions are met.",
			emptyState: {
				emptyTitle: "No variants",
				emptyDescription: "Add conditional descriptions for alternate world states.",
				emptyActionLabel: "Add variant",
			},
			duplicate: {
				duplicateBehavior: "exact",
			},
			layout: {
				width: "full",
				order: 2,
			},
		}),
	}),
	{
		title: "Description",
		description: "A default description with optional conditional variants.",
	},
);

export type Description = z.infer<typeof DescriptionSchema>;
