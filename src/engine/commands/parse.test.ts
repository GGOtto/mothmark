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
import {LayerSchema} from "@/schemas/world/worldSchema";
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

function command(
	id: string,
	patterns: CommandBlock[][],
	scope: Command["scope"] = {scope: "global"},
): Command {
	return CommandSchema.parse({
		...createDefaultFieldObject(CommandSchema),
		id: toID("command", id),
		name: id,
		patterns: patterns.map((blocks) => ({
			...createDefaultFieldObject(PatternSchema),
			blocks,
		})),
		fallbacks: patterns.flat().map((block) => ({
			blockId: block.id,
			behavior: {
				...createDefaultFieldObject(CommandConditionBranchSchema),
				id: toID("condition-branch", `${id}-${idValue(block.id)}-fallback`),
			},
		})),
		behavior: {
			...createDefaultFieldObject(CommandConditionBranchSchema),
			id: toID("condition-branch", `${id}-behavior`),
		},
		scope,
	});
}

function commandIds(text: string, commands: Command[]) {
	const {world, game} = createPlayerTestScenario("navigation");
	const worldWithCommands = produce(world, (draft) => {
		draft.commands = commands;
	});

	return findMatchingCommands(text, worldWithCommands, game).map((match) =>
		idValue(match.command.id),
	);
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

	it("returns a partial match pinned to the first partial block when no block fails", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const worldWithCommands = produce(world, (draft) => {
			draft.commands = [ringBellCommand];
		});

		const [result] = findMatchingCommands("ring skull six times recklessly", worldWithCommands, game);

		expect(result).toMatchObject({
			match: "partial match",
			partialBlockId: toID("command-block", "ring-target"),
		});
		expect(result.variables.map((variable) => idValue(variable.blockId))).toEqual([
			"ring-verb",
			"ring-unit",
		]);
	});

	it("eliminates a pattern as soon as any block fails", () => {
		expect(commandIds("sing skull three times carefully", [ringBellCommand])).toEqual([]);
	});

	it("returns full matches instead of partial matches when either exists", () => {
		const {world, game} = createPlayerTestScenario("navigation");
		const worldWithCommands = produce(world, (draft) => {
			draft.commands = [simpleRingCommand, ringBellCommand];
		});

		const results = findMatchingCommands("ring bell", worldWithCommands, game);

		expect(results).toHaveLength(1);
		expect(results[0]).toMatchObject({
			match: "match",
			command: {id: toID("command", "simple-ring")},
		});
	});

	it("does not accept an entirely partial pattern as a command attempt", () => {
		const directionOnlyCommand = command("direction-only", [
			[
				{
					...createDefaultFieldObject(DirectionBlockSchema),
					id: toID("command-block", "direction-only-value"),
					role: "direction",
				},
			],
		]);

		expect(commandIds("hello", [directionOnlyCommand])).toEqual([]);
		expect(commandIds("north", [directionOnlyCommand])).toEqual(["direction-only"]);
	});

	it("only considers room-scoped commands in one of their authored rooms", () => {
		const roomCommand = command("foyer-only", [[phrase("foyer-only-verb", ["whisper"])]], {
			scope: "rooms",
			roomIds: [toID("room", "foyer")],
		});
		const {world, game} = createPlayerTestScenario("navigation");
		const worldWithCommand = produce(world, (draft) => {
			draft.commands = [roomCommand];
		});
		const galleryGame = produce(game, (draft) => {
			draft.player.currentRoom = toID("room", "gallery");
		});

		expect(findMatchingCommands("whisper", worldWithCommand, game)).toHaveLength(1);
		expect(findMatchingCommands("whisper", worldWithCommand, galleryGame)).toEqual([]);
	});

	it("only considers layer-scoped commands while the current room is on an authored layer", () => {
		const layerCommand = command("lower-layer-only", [[phrase("lower-layer-verb", ["chant"])]], {
			scope: "layers",
			layers: [-1],
		});
		const {world, game} = createPlayerTestScenario("navigation");
		const worldWithCommand = produce(world, (draft) => {
			draft.commands = [layerCommand];
			draft.metadata.layers = [
				{
					...createDefaultFieldObject(LayerSchema),
					name: "Upper",
					layer: 1,
					rooms: [toID("room", "foyer")],
					viewport: {x: 0, y: 0, zoom: 1},
				},
				{
					...createDefaultFieldObject(LayerSchema),
					name: "Lower",
					layer: -1,
					rooms: [toID("room", "gallery")],
					viewport: {x: 0, y: 0, zoom: 1},
				},
			];
		});
		const galleryGame = produce(game, (draft) => {
			draft.player.currentRoom = toID("room", "gallery");
		});

		expect(findMatchingCommands("chant", worldWithCommand, game)).toEqual([]);
		expect(findMatchingCommands("chant", worldWithCommand, galleryGame)).toHaveLength(1);
	});
});
