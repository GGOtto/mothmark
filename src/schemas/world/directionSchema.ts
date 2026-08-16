import {z} from "zod";
import {docify} from "@/schemas/utils/docify";
import {editor} from "../utils/editorSchemaHelpers";

export const DIRECTIONS = [
	"n",
	"ne",
	"e",
	"se",
	"s",
	"sw",
	"w",
	"nw",
	"up",
	"down",
	"in",
	"out",
] as const;

export const COMPASS_DIRECTIONS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;

export const COMPASS_DIRECTION_OPTIONS = [
	{label: "North", value: "n"},
	{label: "Northeast", value: "ne"},
	{label: "East", value: "e"},
	{label: "Southeast", value: "se"},
	{label: "South", value: "s"},
	{label: "Southwest", value: "sw"},
	{label: "West", value: "w"},
	{label: "Northwest", value: "nw"},
] as const;

export const DIRECTION_OPTIONS = [
	...COMPASS_DIRECTION_OPTIONS,
	{label: "Up", value: "up"},
	{label: "Down", value: "down"},
	{label: "In", value: "in"},
	{label: "Out", value: "out"},
] as const;

export const CompassDirectionSchema = editor.direction(z.enum(COMPASS_DIRECTIONS), {
	title: "Direction",
	commandVariableType: "direction",
	description: "A compass direction used for player orientation.",
	options: [...COMPASS_DIRECTION_OPTIONS],
});

export const DIRECTION_NAMES: Record<(typeof DIRECTIONS)[number], string> = {
	n: "north",
	ne: "northeast",
	e: "east",
	se: "southeast",
	s: "south",
	sw: "southwest",
	w: "west",
	nw: "northwest",
	up: "up",
	down: "down",
	in: "in",
	out: "out",
};

export const DirectionSchema = editor.direction(z.enum(DIRECTIONS), {
	title: "Direction",
	commandVariableType: "direction",
	description: docify(`
            A direction used for room exits and return exits.

            Compass directions are useful for map-style worlds.
            Vertical and contextual directions support movement like up, down, in, and out.
        `),
	options: [...DIRECTION_OPTIONS],
});

export type Direction = z.infer<typeof DirectionSchema>;
export type CompassDirection = z.infer<typeof CompassDirectionSchema>;
