import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue, toID} from "@/utils/idUtils";
import {
	BooleanBlockSchema,
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
import {getHigherPriorityCommand} from "./getHigherPriorityCommand";

let nextId = 0;

function uniqueId(prefix: string): string {
	nextId += 1;
	return `${prefix}-${nextId}`;
}

function phrase(matches = ["write"]): CommandBlock {
	return {
		...createDefaultFieldObject(PhraseBlockSchema),
		id: toID("command-block", uniqueId("phrase")),
		matches,
	};
}

function relation(): CommandBlock {
	return {
		...createDefaultFieldObject(RelationBlockSchema),
		id: toID("command-block", uniqueId("relation")),
		relation: "on",
	};
}

function boolean(): CommandBlock {
	return {
		...createDefaultFieldObject(BooleanBlockSchema),
		id: toID("command-block", uniqueId("boolean")),
		role: "answer",
	};
}

function choice(optionCount = 2): CommandBlock {
	return {
		...createDefaultFieldObject(ChoiceBlockSchema),
		id: toID("command-block", uniqueId("choice")),
		role: "choice",
		choices: Array.from({length: optionCount}, (_, index) => ({
			...createDefaultFieldObject(ChoiceOptionSchema),
			value: `value-${index}`,
			label: `Value ${index}`,
			matches: [`option-${index}`],
		})),
	};
}

function direction(allowed: Array<"n" | "s" | "e"> = []): CommandBlock {
	return {
		...createDefaultFieldObject(DirectionBlockSchema),
		id: toID("command-block", uniqueId("direction")),
		role: "direction",
		allowed,
	};
}

function target(overrides: Partial<Extract<CommandBlock, {type: "target"}>> = {}): CommandBlock {
	return {
		...createDefaultFieldObject(TargetBlockSchema),
		id: toID("command-block", uniqueId("target")),
		role: "target",
		source: "any",
		...overrides,
	};
}

function number(overrides: Partial<Extract<CommandBlock, {type: "number"}>> = {}): CommandBlock {
	return {
		...createDefaultFieldObject(NumberBlockSchema),
		id: toID("command-block", uniqueId("number")),
		role: "number",
		...overrides,
	};
}

function text(
	mode: Extract<CommandBlock, {type: "text"}>["mode"] = "rest",
	overrides: Partial<Extract<CommandBlock, {type: "text"}>> = {},
): CommandBlock {
	return {
		...createDefaultFieldObject(TextBlockSchema),
		id: toID("command-block", uniqueId("text")),
		role: "text",
		mode,
		...overrides,
	};
}

type CommandOverrides = Partial<Pick<Command, "priority" | "scope">> & {
	id?: string;
};

function command(blocks: CommandBlock[], overrides: CommandOverrides = {}): Command {
	const id = overrides.id ?? uniqueId("command");
	return CommandSchema.parse({
		...createDefaultFieldObject(CommandSchema),
		id: toID("command", id),
		name: id,
		patterns: [
			{
				...createDefaultFieldObject(PatternSchema),
				blocks,
			},
		],
		fallbacks: blocks
			.filter((block) => block.type !== "phrase" && block.type !== "relation")
			.map((block) => ({
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
		priority: overrides.priority ?? 0,
		scope: overrides.scope ?? {scope: "global"},
	});
}

function expectWinner(expected: Command, other: Command) {
	expect(getHigherPriorityCommand(expected, other)).toBe(expected);
	expect(getHigherPriorityCommand(other, expected)).toBe(expected);
}

beforeEach(() => {
	nextId = 0;
});

describe("getHigherPriorityCommand block types", () => {
	it.each([
		["phrase", () => phrase()],
		["relation", () => relation()],
		["boolean", () => boolean()],
		["choice", () => choice()],
		["direction", () => direction()],
	] as const)("%s closed wording beats arbitrary text", (_name, createBlock) => {
		const closedCommand = command([createBlock()]);
		const textCommand = command([text()]);

		expectWinner(closedCommand, textCommand);
	});

	it("a target beats arbitrary text", () => {
		const targetCommand = command([target()]);
		const textCommand = command([text()]);

		expectWinner(targetCommand, textCommand);
	});

	it("a number beats arbitrary text", () => {
		const numberCommand = command([number()]);
		const textCommand = command([text()]);

		expectWinner(numberCommand, textCommand);
	});

	it("closed wording beats a target", () => {
		const choiceCommand = command([choice()]);
		const targetCommand = command([target({entityIds: [toID("item", "chalkboard")]})]);

		expectWinner(choiceCommand, targetCommand);
	});

	it("a target beats a number", () => {
		const targetCommand = command([target()]);
		const numberCommand = command([number({min: 1, max: 1})]);

		expectWinner(targetCommand, numberCommand);
	});

	it("a number beats quoted text", () => {
		const numberCommand = command([number()]);
		const quotedCommand = command([text("quoted")]);

		expectWinner(numberCommand, quotedCommand);
	});

	it("quoted text beats word text, which beats open text", () => {
		const quotedCommand = command([text("quoted")]);
		const wordCommand = command([text("word")]);
		const openCommand = command([text("rest")]);

		expectWinner(quotedCommand, wordCommand);
		expectWinner(wordCommand, openCommand);
	});

	it("phrase and rest text have equal specificity under the current matcher", () => {
		const phraseTextCommand = command([text("phrase")], {priority: 1});
		const restTextCommand = command([text("rest")], {priority: 0});

		expectWinner(phraseTextCommand, restTextCommand);
	});

	it("compares the strongest differing block rather than block order", () => {
		const targetFirst = command([target(), relation()]);
		const targetSecond = command([relation(), target()]);

		expectWinner(
			targetFirst.id.id < targetSecond.id.id ? targetFirst : targetSecond,
			targetFirst.id.id < targetSecond.id.id ? targetSecond : targetFirst,
		);
	});

	it("prefers additional structured blocks after equal leading specificity", () => {
		const structured = command([phrase(), relation(), target()]);
		const fallback = command([phrase(), text()]);

		expectWinner(structured, fallback);
	});
});

describe("getHigherPriorityCommand closed value specificity", () => {
	it("prefers a choice with fewer semantic values", () => {
		const narrow = command([choice(1)]);
		const broad = command([choice(3)]);

		expectWinner(narrow, broad);
	});

	it("prefers a restricted direction set", () => {
		const northOnly = command([direction(["n"])]);
		const northOrSouth = command([direction(["n", "s"])]);
		const anyDirection = command([direction()]);

		expectWinner(northOnly, northOrSouth);
		expectWinner(northOrSouth, anyDirection);
	});

	it("treats boolean as two semantic values", () => {
		const oneChoice = command([choice(1)]);
		const booleanCommand = command([boolean()]);
		const threeChoices = command([choice(3)]);

		expectWinner(oneChoice, booleanCommand);
		expectWinner(booleanCommand, threeChoices);
	});

	it("does not weaken a phrase when aliases are added", () => {
		const oneAlias = command([phrase(["write"])], {priority: 0});
		const severalAliases = command([phrase(["write", "inscribe", "mark"])], {
			priority: 1,
		});

		expectWinner(severalAliases, oneAlias);
	});
});

describe("getHigherPriorityCommand target specificity", () => {
	it("prefers explicit entity IDs over every other target filter", () => {
		const explicit = command([target({entityIds: [toID("item", "skull")]})]);
		const tagged = command([target({tags: ["cursed"]})]);

		expectWinner(explicit, tagged);
	});

	it("prefers a smaller explicit entity set", () => {
		const skullOnly = command([target({entityIds: [toID("item", "skull")]})]);
		const skullOrIdol = command([
			target({
				entityIds: [toID("item", "skull"), toID("item", "idol")],
			}),
		]);

		expectWinner(skullOnly, skullOrIdol);
	});

	it("prefers tag filters over entity-type filters", () => {
		const tagged = command([target({tags: ["portable"]})]);
		const typed = command([target({entityTypes: ["item"]})]);

		expectWinner(tagged, typed);
	});

	it("prefers requiring more all-mode tags", () => {
		const cursedAndFragile = command([target({tags: ["cursed", "fragile"], tagMode: "all"})]);
		const cursed = command([target({tags: ["cursed"], tagMode: "all"})]);

		expectWinner(cursedAndFragile, cursed);
	});

	it("prefers fewer any-mode tags", () => {
		const cursed = command([target({tags: ["cursed"], tagMode: "any"})]);
		const cursedOrFragile = command([target({tags: ["cursed", "fragile"], tagMode: "any"})]);

		expectWinner(cursed, cursedOrFragile);
	});

	it("prefers all-mode over any-mode when several tags are present", () => {
		const allTags = command([target({tags: ["cursed", "fragile"], tagMode: "all"})]);
		const anyTag = command([target({tags: ["cursed", "fragile"], tagMode: "any"})]);

		expectWinner(allTags, anyTag);
	});

	it("treats one all-mode tag and one any-mode tag as equally specific", () => {
		const allTag = command([target({tags: ["cursed"], tagMode: "all"})], {
			priority: 0,
		});
		const anyTag = command([target({tags: ["fragile"], tagMode: "any"})], {
			priority: 1,
		});

		expectWinner(anyTag, allTag);
	});

	it("prefers a smaller entity-type set", () => {
		const featureOnly = command([target({entityTypes: ["item"]})]);
		const roomOrFeature = command([target({entityTypes: ["room", "item"]})]);

		expectWinner(featureOnly, roomOrFeature);
	});

	it("prefers entity types over a source-only restriction", () => {
		const typed = command([target({entityTypes: ["item"]})]);
		const visible = command([target({source: "visible"})]);

		expectWinner(typed, visible);
	});

	it("prefers a restricted source over an unrestricted target", () => {
		const visible = command([target({source: "visible"})]);
		const unrestricted = command([target({source: "any"})]);

		expectWinner(visible, unrestricted);
	});

	it("uses authored priority for incomparable restricted sources", () => {
		const known = command([target({source: "known"})], {priority: 1});
		const reachable = command([target({source: "reachable"})], {priority: 0});

		expectWinner(known, reachable);
	});

	it("uses additional filters to distinguish otherwise equal targets", () => {
		const constrained = command([target({entityIds: [toID("item", "skull")], tags: ["cursed"]})]);
		const explicitOnly = command([target({entityIds: [toID("item", "skull")]})]);

		expectWinner(constrained, explicitOnly);
	});
});

describe("getHigherPriorityCommand number specificity", () => {
	it("prefers two bounds over one bound and one bound over none", () => {
		const bounded = command([number({min: 1, max: 5})]);
		const minimumOnly = command([number({min: 1})]);
		const unbounded = command([number()]);

		expectWinner(bounded, minimumOnly);
		expectWinner(minimumOnly, unbounded);
	});

	it("prefers a narrower bounded range", () => {
		const narrow = command([number({min: 1, max: 5})]);
		const broad = command([number({min: 1, max: 100})]);

		expectWinner(narrow, broad);
	});

	it("prefers integer when ranges are otherwise equal", () => {
		const integer = command([number({numberType: "integer", min: 1, max: 5})]);
		const decimal = command([number({numberType: "decimal", min: 1, max: 5})]);

		expectWinner(integer, decimal);
	});

	it("prefers a fully bounded decimal over an unbounded integer", () => {
		const boundedDecimal = command([number({numberType: "decimal", min: 1, max: 5})]);
		const unboundedInteger = command([number({numberType: "integer"})]);

		expectWinner(boundedDecimal, unboundedInteger);
	});
});

describe("getHigherPriorityCommand text specificity", () => {
	it("prefers bounded text over unbounded text of the same mode", () => {
		const bounded = command([text("rest", {minLength: 1, maxLength: 20})]);
		const unbounded = command([text("rest")]);

		expectWinner(bounded, unbounded);
	});

	it("prefers two text bounds over one", () => {
		const bounded = command([text("rest", {minLength: 1, maxLength: 20})]);
		const minimumOnly = command([text("rest", {minLength: 1})]);

		expectWinner(bounded, minimumOnly);
	});

	it("prefers a narrower text-length range", () => {
		const narrow = command([text("rest", {minLength: 1, maxLength: 20})]);
		const broad = command([text("rest", {minLength: 1, maxLength: 100})]);

		expectWinner(narrow, broad);
	});
});

describe("getHigherPriorityCommand command tie-breakers", () => {
	it("prefers room scope over layer scope and layer scope over global scope", () => {
		const room = command([target()], {
			scope: {scope: "rooms", roomIds: [toID("room", "gallery")]},
		});
		const layer = command([target()], {
			scope: {scope: "layers", layers: [1]},
		});
		const global = command([target()]);

		expectWinner(room, layer);
		expectWinner(layer, global);
	});

	it("prefers a narrower room scope", () => {
		const oneRoom = command([target()], {
			scope: {scope: "rooms", roomIds: [toID("room", "gallery")]},
		});
		const twoRooms = command([target()], {
			scope: {
				scope: "rooms",
				roomIds: [toID("room", "gallery"), toID("room", "library")],
			},
		});

		expectWinner(oneRoom, twoRooms);
	});

	it("prefers a narrower layer scope", () => {
		const oneLayer = command([target()], {
			scope: {scope: "layers", layers: [1]},
		});
		const twoLayers = command([target()], {
			scope: {scope: "layers", layers: [1, 2]},
		});

		expectWinner(oneLayer, twoLayers);
	});

	it("lets block specificity beat narrower scope", () => {
		const explicitGlobal = command([target({entityIds: [toID("item", "skull")]})]);
		const generalRoom = command([target()], {
			scope: {scope: "rooms", roomIds: [toID("room", "crypt")]},
		});

		expectWinner(explicitGlobal, generalRoom);
	});

	it("uses authored priority after equal blocks and scope", () => {
		const high = command([target()], {priority: 10});
		const low = command([target()], {priority: -10});

		expectWinner(high, low);
	});

	it("does not let authored priority override block specificity", () => {
		const explicit = command([target({entityIds: [toID("item", "skull")]})], {priority: -100});
		const general = command([target()], {priority: 100});

		expectWinner(explicit, general);
	});

	it("uses the lexically smaller command ID as a deterministic final fallback", () => {
		const alpha = command([target()], {id: "alpha"});
		const beta = command([target()], {id: "beta"});

		expectWinner(alpha, beta);
	});

	it("returns the left command when IDs and all priority inputs are identical", () => {
		const left = command([target()], {id: "same"});
		const right = command([target()], {id: "same"});

		expect(getHigherPriorityCommand(left, right)).toBe(left);
		expect(getHigherPriorityCommand(right, left)).toBe(right);
	});
});
