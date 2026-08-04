import {z} from "zod";
import {docify} from "@/schemas/utils/docify";
import {editor} from "../utils/editorSchemaHelpers";

export const DirectionSchema = editor.select(
	z.enum(["n", "ne", "e", "se", "s", "sw", "w", "nw", "up", "down", "in", "out"]),
	{
		title: "Direction",
		description: docify(`
            A direction used for room exits and return exits.

            Compass directions are useful for map-style worlds.
            Vertical and contextual directions support movement like up, down, in, and out.
        `),
		options: [
			{label: "North", value: "n"},
			{label: "Northeast", value: "ne"},
			{label: "East", value: "e"},
			{label: "Southeast", value: "se"},
			{label: "South", value: "s"},
			{label: "Southwest", value: "sw"},
			{label: "West", value: "w"},
			{label: "Northwest", value: "nw"},
			{label: "Up", value: "up"},
			{label: "Down", value: "down"},
			{label: "In", value: "in"},
			{label: "Out", value: "out"},
		],
	},
);

export type Direction = z.infer<typeof DirectionSchema>;
