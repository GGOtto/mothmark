import {z} from "zod";
import {editor} from "./editorSchemaHelpers";
import {ConditionalTextSchema} from "./conditionSchema";

export const DescriptionSchema = editor.conditionalText(
	z.object({
		default: editor
			.richText({
				placeholder: "Describe what the player sees...",
				layout: {
					width: "full",
					order: 1,
				},
				title: "Description",
				description: "A default description with optional conditional variants.",
			})
			.default(""),

		variants: editor.array(ConditionalTextSchema, {
			title: "Description Variants",
			description: "Description variants that can replace the description if conditions are met.",
			appearance: {
				chrome: "collapse",
				defaultCollapsed: true,
			},
			summary: {
				enabled: true,
				mode: "deterministic",
				emptySummary: "No conditional variants",
			},
			emptyState: {
				emptyTitle: "No variants",
				emptyDescription: "Add conditional descriptions for alternate world states.",
				emptyActionLabel: "Add variant",
			},
			duplicate: {
				duplicateBehavior: "exact",
			},
			features: {
				addLabel: "Add variant",
				getItemTitle: "Variant {text}",
				getItemSummary: "{when}",
				defaultCollapsedItems: true,
				collapsibleItems: true,
			},
			layout: {
				width: "full",
				order: 2,
			},
		}),
	}),
);

export type Description = z.infer<typeof DescriptionSchema>;
