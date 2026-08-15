import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";
import {ConditionBranchSchema} from "./conditionBranchSchemas";

export const EventSchema = editor.object(
	{
		id: editor.id("event", {title: "Event ID", hidden: true}),
		name: editor.input({title: "Name", description: "The author-facing name of this event."}),

		enabled: editor
			.boolean({
				title: "Enabled",
				description: "Whether the event can currently be evaluated.",
			})
			.default(true),

		branch: editor.hidden(ConditionBranchSchema, {title: "Branches"}),

		disposable: editor
			.boolean({
				title: "Run once",
				description: "Remove or disable the event after it successfully runs.",
			})
			.default(false),

		wait: editor
			.number({
				title: "Wait (turns)",
				description:
					"Wait this many turns after the last attempt, or the start of the game, before trying the event.",
			})
			.int()
			.nonnegative()
			.default(0),

		lastSuccess: editor.hidden(z.number().int().default(0), {
			title: "Last successful turn",
		}),

		priority: editor
			.number({
				title: "Priority",
				description:
					"Determines which eligible events are checked first. Higher-priority events run first.",
			})
			.int()
			.default(0),
	},
	{
		title: "Event settings",
		description: "Control when this event can run. Branch logic stays in the event workspace.",
		features: {layout: "section"},
	},
);

export type Event = z.infer<typeof EventSchema>;
