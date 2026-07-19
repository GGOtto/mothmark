import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";
import {docify} from "@/schemas/utils/docify";

export const StateValueSchema = editor.discriminatedUnion(
	z.union([z.string(), z.number(), z.boolean(), z.null()]),
	{
		title: "State Value",
		description: "A simple serializable state value.",
	},
);

export const ObjectStateDefaultsSchema = editor.object(
	{
		open: editor
			.boolean({
				title: "Open",
				description: "Initial open state for an object, door, feature, or container.",
				layout: {
					width: "half",
					order: 1,
				},
			})
			.optional(),

		locked: editor
			.boolean({
				title: "Locked",
				description: "Initial locked state for a connection, door, or room feature.",
				layout: {
					width: "half",
					order: 2,
				},
			})
			.optional(),

		lit: editor
			.boolean({
				title: "Lit",
				description: "Initial lit state for a room feature.",
				layout: {
					width: "half",
					order: 3,
				},
			})
			.optional(),

		broken: editor
			.boolean({
				title: "Broken",
				description: "Initial broken state for a room feature.",
				layout: {
					width: "half",
					order: 4,
				},
			})
			.optional(),

		clean: editor
			.boolean({
				title: "Clean",
				description: "Initial clean state for a room feature.",
				layout: {
					width: "half",
					order: 5,
				},
			})
			.optional(),

		custom: editor.record(StateValueSchema, {
			title: "Custom State",
			description: "Custom object state values, such as freshness, fuel, sealed, sticky, or charged.",
			advanced: true,
			layout: {
				width: "full",
				order: 6,
			},
		}),
	},
	{
		title: "Object State Defaults",
		description: docify(`
            Initial built-in and custom object state.

			These values seed connection and feature state. They can be checked by
			feature-state conditions or changed by feature-state effects.
        `),
	},
);

export const DefaultObjectStateDefaults = {
	custom: {},
} satisfies z.infer<typeof ObjectStateDefaultsSchema>;

export type ObjectStateDefaults = z.infer<typeof ObjectStateDefaultsSchema>;
