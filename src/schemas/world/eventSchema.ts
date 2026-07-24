import {z} from "zod";
import {editor} from "../utils/editorSchemaHelpers";
import {ConditionBranchSchema} from "./conditionBranchSchemas";

export const EventSchema = z.object({
	id: editor.id("event"),
	name: editor.string(),

	enabled: editor
		.boolean({
			title: "Enabled",
			description: "Whether the event can currently be evaluated.",
		})
		.default(true),

	branch: ConditionBranchSchema,

	disposable: editor
		.boolean({
			title: "Run Once",
			description: "Remove or disable the event after it successfully runs.",
		})
		.default(false),

	wait: editor
		.number({
			title: "Wait",
			description:
				"Wait this many turns after the last attempt, or the start of the game, before trying the event.",
		})
		.int()
		.nonnegative()
		.default(0),

	priority: editor
		.number({
			title: "Priority",
			description:
				"Determines which eligible events are checked first. Higher-priority events (represented with smaller numbers) run first.",
		})
		.int()
		.default(0),
});

export type Event = z.infer<typeof EventSchema>;
