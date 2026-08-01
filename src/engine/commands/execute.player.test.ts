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
import {idValue, toID, type ID} from "@/utils/idUtils";
import {resolveTurn} from "../player/resolveTurn";
import {createInitialGameState} from "../states/createInitialState";
import {createPlayerTestScenario} from "../utils/testUtils";

function messageBehavior(id: string, message: string) {
	return {
		...createDefaultFieldObject(CommandConditionBranchSchema),
		id: toID("condition-branch", `${id}-behavior`),
		always: {
			name: `${id} result`,
			id: toID("effect", `${id}-result`),
			type: "group" as const,
			effects: [{type: "message", operation: "show", message}],
			allowMultipleUsesInWorld: true as const,
		},
	};
}

function counterBehavior(id: string, amountBlockId: ID<"command-block">) {
	return {
		...createDefaultFieldObject(CommandConditionBranchSchema),
		id: toID("condition-branch", `${id}-behavior`),
		always: {
			name: `${id} result`,
			id: toID("effect", `${id}-result`),
			type: "group" as const,
			effects: [
				{
					type: "counter",
					operation: "increase",
					counter: "fallback-total",
					commandVariables: [{blockId: amountBlockId, field: "amount"}],
				},
			],
			allowMultipleUsesInWorld: true as const,
		},
	};
}

function phrase(id: string, matches: string[]): CommandBlock {
	return {
		...createDefaultFieldObject(PhraseBlockSchema),
		id: toID("command-block", id),
		matches,
	};
}

function relation(id: string, value: "on" | "with"): CommandBlock {
	return {
		...createDefaultFieldObject(RelationBlockSchema),
		id: toID("command-block", id),
		relation: value,
	};
}

function target(id: string, role: string): CommandBlock {
	return {
		...createDefaultFieldObject(TargetBlockSchema),
		id: toID("command-block", id),
		role,
		entityTypes: ["feature"],
		source: "visible",
	};
}

function direction(id: string): CommandBlock {
	return {
		...createDefaultFieldObject(DirectionBlockSchema),
		id: toID("command-block", id),
		role: "direction",
	};
}

function number(id: string): CommandBlock {
	return {
		...createDefaultFieldObject(NumberBlockSchema),
		id: toID("command-block", id),
		role: "amount",
	};
}

function choice(id: string, matches: string[]): CommandBlock {
	return {
		...createDefaultFieldObject(ChoiceBlockSchema),
		id: toID("command-block", id),
		role: "choice",
		choices: [
			{
				...createDefaultFieldObject(ChoiceOptionSchema),
				value: "accepted",
				label: "Accepted",
				matches,
			},
		],
	};
}

function text(id: string): CommandBlock {
	return {
		...createDefaultFieldObject(TextBlockSchema),
		id: toID("command-block", id),
		role: "text",
		mode: "word",
	};
}

type AuthoredCommandOptions = {
	id: string;
	patterns: CommandBlock[][];
	success?: string;
	fallbacks?: Record<string, string>;
	priority?: number;
	scope?: Command["scope"];
};

function authoredCommand({
	id,
	patterns,
	success = `${id} success`,
	fallbacks = {},
	priority = 0,
	scope = {scope: "global"},
}: AuthoredCommandOptions): Command {
	return CommandSchema.parse({
		...createDefaultFieldObject(CommandSchema),
		id: toID("command", id),
		name: id,
		patterns: patterns.map((blocks) => ({
			...createDefaultFieldObject(PatternSchema),
			blocks,
		})),
		fallbacks: patterns.flat().map((block) => {
			const blockId = idValue(block.id);
			return {
				blockId: block.id,
				behavior: messageBehavior(
					`${id}-${blockId}-fallback`,
					fallbacks[blockId] ?? `${blockId} fallback`,
				),
			};
		}),
		behavior: messageBehavior(`${id}-success`, success),
		priority,
		scope,
	});
}

type PlayOptions = {
	currentRoomId?: "foyer" | "gallery";
	layers?: Array<{layer: number; roomIds: Array<"foyer" | "gallery">}>;
};

function play(commands: Command[], input: string, options: PlayOptions = {}) {
	const scenario = createPlayerTestScenario("navigation");
	const world = produce(scenario.world, (draft) => {
		draft.commands = commands;
		if (options.layers) {
			draft.metadata.layers = options.layers.map(({layer, roomIds}) => ({
				...createDefaultFieldObject(LayerSchema),
				name: `Layer ${layer}`,
				layer,
				rooms: roomIds.map((roomId) => toID("room", roomId)),
			}));
		}
	});
	const game = createInitialGameState(world, toID("room", options.currentRoomId ?? "foyer"));
	return resolveTurn(world, game, input);
}

function expectLastMessage(
	commands: Command[],
	input: string,
	type: "system" | "error",
	text: string,
	options: PlayOptions = {},
) {
	const nextGame = play(commands, input, options);
	expect(nextGame.messages.at(-1)).toMatchObject({type, text});
	expect(nextGame.variables.command).toEqual([]);
	return nextGame;
}

describe("command matching and fallbacks through the player path", () => {
	it("executes a fully matched single-block direction command", () => {
		const command = authoredCommand({
			id: "direction-only",
			patterns: [[direction("direction-only-value")]],
			success: "You move north.",
		});

		expectLastMessage([command], "north", "system", "You move north.");
	});

	it("does not let a partial-only direction pattern claim unrelated input", () => {
		const command = authoredCommand({
			id: "direction-only",
			patterns: [[direction("direction-only-value")]],
			fallbacks: {"direction-only-value": "You can't go that way."},
		});

		expectLastMessage([command], "hello", "error", "I don't know what that means.");
	});

	it("does not let a partial-only target pattern reveal an unresolved target", () => {
		const command = authoredCommand({
			id: "target-only",
			patterns: [[target("target-only-value", "target")]],
			fallbacks: {"target-only-value": "You can't see that."},
		});

		expectLastMessage([command], "skull", "error", "I don't know what that means.");
		expectLastMessage([command], "bell", "system", "target-only success");
	});

	it("runs a target fallback after a phrase anchors the partial command", () => {
		const command = authoredCommand({
			id: "take",
			patterns: [[phrase("take-verb", ["take"]), target("take-target", "target")]],
			fallbacks: {"take-target": "You can't see that."},
		});

		expectLastMessage([command], "take skull", "system", "You can't see that.");
	});

	it("runs a direction fallback after a phrase anchors the partial command", () => {
		const command = authoredCommand({
			id: "go",
			patterns: [[phrase("go-verb", ["go"]), direction("go-direction")]],
			fallbacks: {"go-direction": "You can't go that way."},
		});

		expectLastMessage([command], "go hello", "system", "You can't go that way.");
	});

	it("eliminates a pattern when a structural phrase fails even if a value block is partial", () => {
		const command = authoredCommand({
			id: "take",
			patterns: [[phrase("take-verb", ["take"]), target("take-target", "target")]],
			fallbacks: {"take-target": "You can't see that."},
		});

		expectLastMessage([command], "drop skull", "error", "I don't know what that means.");
	});

	it("eliminates a pattern when a relation fails after earlier blocks match", () => {
		const command = authoredCommand({
			id: "put-on",
			patterns: [
				[
					phrase("put-verb", ["put"]),
					target("put-object", "object"),
					relation("put-relation", "on"),
					target("put-destination", "destination"),
				],
			],
			fallbacks: {"put-destination": "There is no destination."},
		});

		expectLastMessage([command], "put bell with skull", "error", "I don't know what that means.");
	});

	it("pins the first partial block when several blocks are partial", () => {
		const command = authoredCommand({
			id: "use-with",
			patterns: [
				[
					phrase("use-verb", ["use"]),
					target("use-object", "object"),
					relation("use-relation", "with"),
					target("use-tool", "tool"),
				],
			],
			fallbacks: {
				"use-object": "You can't find the object.",
				"use-tool": "You can't find the tool.",
			},
		});

		expectLastMessage([command], "use skull with ghost", "system", "You can't find the object.");
	});

	it("pins a later partial block when every earlier value resolves", () => {
		const command = authoredCommand({
			id: "use-with",
			patterns: [
				[
					phrase("use-verb", ["use"]),
					target("use-object", "object"),
					relation("use-relation", "with"),
					target("use-tool", "tool"),
				],
			],
			fallbacks: {
				"use-object": "You can't find the object.",
				"use-tool": "You can't find the tool.",
			},
		});

		expectLastMessage([command], "use bell with ghost", "system", "You can't find the tool.");
	});

	it("uses a full alternative pattern instead of an earlier partial alternative", () => {
		const command = authoredCommand({
			id: "touch",
			patterns: [
				[phrase("touch-target-verb", ["touch"]), target("touch-target", "target")],
				[phrase("touch-text-verb", ["touch"]), text("touch-text")],
			],
			success: "The full alternative wins.",
			fallbacks: {"touch-target": "The target alternative was partial."},
		});

		expectLastMessage([command], "touch carefully", "system", "The full alternative wins.");
	});

	it("uses any full command match instead of a higher-priority partial command", () => {
		const partial = authoredCommand({
			id: "touch-target",
			patterns: [[phrase("partial-touch-verb", ["touch"]), target("partial-target", "target")]],
			fallbacks: {"partial-target": "The partial command won."},
			priority: 100,
		});
		const full = authoredCommand({
			id: "touch-text",
			patterns: [[phrase("full-touch-verb", ["touch"]), text("full-touch-text")]],
			success: "The full command won.",
			priority: 0,
		});

		expectLastMessage([partial, full], "touch carefully", "system", "The full command won.");
	});

	it("uses command priority to choose between otherwise competing partial matches", () => {
		const lower = authoredCommand({
			id: "lower-priority-use",
			patterns: [[phrase("lower-use-verb", ["use"]), target("lower-use-target", "target")]],
			fallbacks: {"lower-use-target": "The lower-priority fallback ran."},
			priority: 1,
		});
		const higher = authoredCommand({
			id: "higher-priority-use",
			patterns: [[phrase("higher-use-verb", ["use"]), target("higher-use-target", "target")]],
			fallbacks: {"higher-use-target": "The higher-priority fallback ran."},
			priority: 10,
		});

		expectLastMessage([lower, higher], "use skull", "system", "The higher-priority fallback ran.");
	});

	it("keeps matched variables available to fallback effects and clears them afterward", () => {
		const repeat = phrase("repeat-verb", ["repeat"]);
		const amount = number("repeat-amount");
		const method = choice("repeat-method", ["carefully"]);
		const command = authoredCommand({
			id: "repeat",
			patterns: [[repeat, amount, method]],
		});
		command.fallbacks = command.fallbacks.map((fallback) =>
			idValue(fallback.blockId) === "repeat-method"
				? {...fallback, behavior: counterBehavior("repeat-method-fallback", amount.id)}
				: fallback,
		);

		const nextGame = play([CommandSchema.parse(command)], "repeat 3 wildly");

		expect(nextGame.variables.counters).toContainEqual({"fallback-total": 3});
		expect(nextGame.variables.command).toEqual([]);
	});

	it("rejects a multi-block pattern when every value block is only partial", () => {
		const command = authoredCommand({
			id: "unanchored-values",
			patterns: [[direction("unanchored-direction"), choice("unanchored-choice", ["carefully"])]],
			fallbacks: {
				"unanchored-direction": "Direction fallback.",
				"unanchored-choice": "Choice fallback.",
			},
		});

		expectLastMessage([command], "hello wildly", "error", "I don't know what that means.");
	});
});

describe("command scope through the player path", () => {
	it("runs a global command from any current room", () => {
		const command = authoredCommand({
			id: "global-whisper",
			patterns: [[phrase("global-whisper-verb", ["whisper"])]],
			success: "The whisper carries.",
		});

		expectLastMessage([command], "whisper", "system", "The whisper carries.", {
			currentRoomId: "foyer",
		});
		expectLastMessage([command], "whisper", "system", "The whisper carries.", {
			currentRoomId: "gallery",
		});
	});

	it("runs a room-scoped command from an included room", () => {
		const command = authoredCommand({
			id: "foyer-whisper",
			patterns: [[phrase("foyer-whisper-verb", ["whisper"])]],
			success: "The foyer answers.",
			scope: {scope: "rooms", roomIds: [toID("room", "foyer")]},
		});

		expectLastMessage([command], "whisper", "system", "The foyer answers.", {
			currentRoomId: "foyer",
		});
	});

	it("treats an exact room-scoped command as nonexistent outside its rooms", () => {
		const command = authoredCommand({
			id: "foyer-whisper",
			patterns: [[phrase("foyer-whisper-verb", ["whisper"])]],
			success: "The foyer answers.",
			scope: {scope: "rooms", roomIds: [toID("room", "foyer")]},
		});

		expectLastMessage([command], "whisper", "error", "I don't know what that means.", {
			currentRoomId: "gallery",
		});
	});

	it("does not run a partial fallback for an out-of-scope room command", () => {
		const command = authoredCommand({
			id: "foyer-take",
			patterns: [[phrase("foyer-take-verb", ["take"]), target("foyer-take-target", "target")]],
			fallbacks: {"foyer-take-target": "You can't see that."},
			scope: {scope: "rooms", roomIds: [toID("room", "foyer")]},
		});

		expectLastMessage([command], "take skull", "error", "I don't know what that means.", {
			currentRoomId: "gallery",
		});
	});

	it("supports room scopes containing several rooms", () => {
		const command = authoredCommand({
			id: "shared-whisper",
			patterns: [[phrase("shared-whisper-verb", ["whisper"])]],
			success: "Both rooms answer.",
			scope: {
				scope: "rooms",
				roomIds: [toID("room", "foyer"), toID("room", "gallery")],
			},
		});

		expectLastMessage([command], "whisper", "system", "Both rooms answer.", {
			currentRoomId: "foyer",
		});
		expectLastMessage([command], "whisper", "system", "Both rooms answer.", {
			currentRoomId: "gallery",
		});
	});

	it("removes an out-of-scope room command before command priority is considered", () => {
		const roomCommand = authoredCommand({
			id: "foyer-listen",
			patterns: [[phrase("foyer-listen-verb", ["listen"])]],
			success: "The room-scoped command ran.",
			priority: 100,
			scope: {scope: "rooms", roomIds: [toID("room", "foyer")]},
		});
		const globalCommand = authoredCommand({
			id: "global-listen",
			patterns: [[phrase("global-listen-verb", ["listen"])]],
			success: "The global command ran.",
			priority: 0,
		});

		expectLastMessage([roomCommand, globalCommand], "listen", "system", "The global command ran.", {
			currentRoomId: "gallery",
		});
	});

	it("runs a layer-scoped command from a room assigned to an included layer", () => {
		const command = authoredCommand({
			id: "lower-chant",
			patterns: [[phrase("lower-chant-verb", ["chant"])]],
			success: "The lower layer resonates.",
			scope: {scope: "layers", layers: [-1]},
		});
		const layers = [
			{layer: 1, roomIds: ["foyer" as const]},
			{layer: -1, roomIds: ["gallery" as const]},
		];

		expectLastMessage([command], "chant", "system", "The lower layer resonates.", {
			currentRoomId: "gallery",
			layers,
		});
	});

	it("treats a layer-scoped command as nonexistent on another layer", () => {
		const command = authoredCommand({
			id: "lower-chant",
			patterns: [[phrase("lower-chant-verb", ["chant"])]],
			success: "The lower layer resonates.",
			scope: {scope: "layers", layers: [-1]},
		});
		const layers = [
			{layer: 1, roomIds: ["foyer" as const]},
			{layer: -1, roomIds: ["gallery" as const]},
		];

		expectLastMessage([command], "chant", "error", "I don't know what that means.", {
			currentRoomId: "foyer",
			layers,
		});
	});

	it("treats a layer-scoped command as nonexistent when the room has no layer", () => {
		const command = authoredCommand({
			id: "lower-chant",
			patterns: [[phrase("lower-chant-verb", ["chant"])]],
			success: "The lower layer resonates.",
			scope: {scope: "layers", layers: [-1]},
		});

		expectLastMessage([command], "chant", "error", "I don't know what that means.", {
			currentRoomId: "gallery",
		});
	});
});
