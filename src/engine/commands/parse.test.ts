import {produce} from "immer";
import {
	ChoiceBlockSchema,
	ChoiceOptionSchema,
	CommandSchema,
	DirectionBlockSchema,
	NumberBlockSchema,
	PatternSchema,
	PhraseBlockSchema,
	RelationBlockSchema,
	TargetBlockSchema,
	TextBlockSchema,
	type Command,
	type CommandBlock,
} from "@/schemas/world/commandSchemas";
import {CommandConditionBranchSchema} from "@/schemas/world/commandLogicSchemas";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue, toID} from "@/utils/idUtils";
import {createPlayerTestScenario} from "../utils/testUtils";
import {findMatchingCommands} from "./parse";

function phrase(id: string, matches: string[]): CommandBlock {
	return {
		...createDefaultFieldObject(PhraseBlockSchema),
		id: toID("command-block", id),
		matches,
	};
}

function target(id: string, role: string): CommandBlock {
	return {
		...createDefaultFieldObject(TargetBlockSchema),
		id: toID("command-block", id),
		role,
		entityTypes: ["feature"],
		entityIds: [toID("feature", "brass-bell")],
		source: "visible",
	};
}

function relation(id: string, value: "as" | "to"): CommandBlock {
	return {
		...createDefaultFieldObject(RelationBlockSchema),
		id: toID("command-block", id),
		relation: value,
	};
}

function choice(id: string, role: string): CommandBlock {
	return {
		...createDefaultFieldObject(ChoiceBlockSchema),
		id: toID("command-block", id),
		role,
		choices: [
			{
				...createDefaultFieldObject(ChoiceOptionSchema),
				value: "carefully",
				label: "Carefully",
				matches: ["carefully", "with care"],
			},
			{
				...createDefaultFieldObject(ChoiceOptionSchema),
				value: "boldly",
				label: "Boldly",
				matches: ["boldly", "without hesitation"],
			},
		],
	};
}

function number(id: string, role: string): CommandBlock {
	return {
		...createDefaultFieldObject(NumberBlockSchema),
		id: toID("command-block", id),
		role,
		min: 1,
		max: 5,
	};
}

function command(id: string, patterns: CommandBlock[][]): Command {
	return CommandSchema.parse({
		...createDefaultFieldObject(CommandSchema),
		id: toID("command", id),
		name: id,
		patterns: patterns.map((blocks) => ({
			...createDefaultFieldObject(PatternSchema),
			blocks,
		})),
		behavior: {
			...createDefaultFieldObject(CommandConditionBranchSchema),
			id: toID("condition-branch", `${id}-behavior`),
		},
	});
}

function commandIds(text: string, commands: Command[]) {
	const {world, game} = createPlayerTestScenario("navigation");
	const worldWithCommands = produce(world, (draft) => {
		draft.commands = commands;
	});

	return findMatchingCommands(text, worldWithCommands, game).map((match) => idValue(match.id));
}

const ringBellCommand = command("ring-bell", [
	[
		phrase("ring-verb", ["ring", "sound"]),
		target("ring-target", "bell"),
		number("ring-count", "count"),
		phrase("ring-unit", ["time", "times"]),
		choice("ring-method", "method"),
	],
	[
		choice("ring-method-first", "method"),
		phrase("ring-verb-second", ["ring", "sound"]),
		target("ring-target-second", "bell"),
		number("ring-count-second", "count"),
		phrase("ring-unit-second", ["time", "times"]),
	],
]);

const labelBellCommand = command("label-bell", [
	[
		phrase("label-verb", ["label", "name"]),
		target("label-target", "bell"),
		relation("label-relation", "as"),
		{
			...createDefaultFieldObject(TextBlockSchema),
			id: toID("command-block", "label-text"),
			role: "label",
			mode: "quoted",
		},
	],
]);

const alignBellCommand = command("align-bell", [
	[
		phrase("align-verb", ["align", "point"]),
		target("align-target", "bell"),
		relation("align-relation", "to"),
		{
			...createDefaultFieldObject(DirectionBlockSchema),
			id: toID("command-block", "align-direction"),
			role: "direction",
			allowed: ["n", "s"],
		},
		choice("align-method", "method"),
	],
]);

const complexCommands = [ringBellCommand, labelBellCommand, alignBellCommand];

const sayCommand = command("say", [
	[
		phrase("say-verb", ["say", "speak"]),
		{
			...createDefaultFieldObject(TextBlockSchema),
			id: toID("command-block", "say-message"),
			role: "message",
			mode: "rest",
		},
	],
]);

const simpleRingCommand = command("simple-ring", [
	[phrase("simple-ring-verb", ["ring"]), target("simple-ring-target", "bell")],
]);

describe("findMatchingCommands", () => {
	it.each([
		{
			text: "ring brass bell three times carefully",
			expected: "ring-bell",
		},
		{
			text: 'label brass bell as "warning chime"',
			expected: "label-bell",
		},
		{
			text: "align brass bell to north boldly",
			expected: "align-bell",
		},
	])("matches every block in the complex command `$text`", ({text, expected}) => {
		expect(commandIds(text, complexCommands)).toEqual([expected]);
	});

	it("matches an alternative pattern for the same complex command", () => {
		expect(commandIds("with care ring bell three times", complexCommands)).toEqual(["ring-bell"]);
	});

	it("rejects a command when only some of its blocks match", () => {
		expect(commandIds("sing brass bell three times carefully", complexCommands)).toEqual([]);
	});

	it("does not match a rest-text command just because its final block accepts input", () => {
		expect(commandIds("ring bell", [sayCommand, simpleRingCommand])).toEqual(["simple-ring"]);
	});
});
