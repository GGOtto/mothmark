import {produce} from "immer";
import {createInitialGameState} from "@/engine/states/createInitialState";
import {resolveTurn} from "@/engine/player/resolveTurn";
import {addItemBehaviorDraft} from "@/features/items/itemBehaviors";
import type {GameState} from "@/schemas/states/gameStateSchemas";
import {ItemSchema, type ItemBehavior, type StandardItemAction} from "@/schemas/world/itemSchema";
import {RoomSchema} from "@/schemas/world/roomSchema";
import {RELATION_PREPOSITIONS, type Command} from "@/schemas/world/commandSchemas";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {compareIds, idValue, toID} from "@/utils/idUtils";
import {
	equipCommand,
	readCommand,
	senseCommand,
	searchCommand,
	eatCommand,
	drinkCommand,
	switchCommand,
	lightItemCommand,
	makeSoundCommand,
	moveItemCommand,
	climbItemCommand,
	restOnItemCommand,
	enterItemCommand,
	rideItemCommand,
	untieItemCommand,
	breakItemCommand,
	cutItemCommand,
	liquidContainerCommand,
	cleanItemCommand,
	repairItemCommand,
	eraseItemCommand,
	throwItemCommand,
	throwItemAtCommand,
	presentItemCommand,
	tieItemCommand,
	cutItemWithToolCommand,
	repairItemWithToolCommand,
	fillFromCommand,
	pourIntoCommand,
	writeOnItemCommand,
	rawInitialCommands,
} from "./initialCommands";

const roomId = toID("room", "workshop");

const behaviorItems = {
	equippable: "cloak",
	readable: "scroll",
	sensory: "statue",
	searchable: "desk",
	edible: "apple",
	drinkable: "water",
	switchable: "machine",
	lightable: "torch",
	"sound-making": "bell",
	movable: "crate",
	climbable: "ladder",
	restable: "bed",
	enterable: "boat",
	rideable: "horse",
	binding: "rope",
	breakable: "vase",
	cuttable: "cloth",
	"liquid-container": "bottle",
	cleanable: "mirror",
	repairable: "clock",
	writable: "wall",
	throwable: "ball",
	presentable: "gift",
} as const satisfies Record<
	Exclude<
		ItemBehavior["type"],
		"takeable" | "container" | "surface" | "openable" | "lockable" | "door" | "usable"
	>,
	string
>;

function standardItem(type: keyof typeof behaviorItems, inventory = false) {
	return produce(createDefaultFieldObject(ItemSchema), (draft) => {
		const name = behaviorItems[type];
		draft.id = toID("item", name);
		draft.name = name;
		draft.presentation.listedInRoom = true;
		draft.initialState.location = inventory ? {type: "inventory"} : {type: "room", roomId};
		addItemBehaviorDraft(draft, type);
		for (const behavior of draft.behaviors) {
			if (!("actions" in behavior)) continue;
			for (const settings of behavior.actions) {
				settings.message = `${settings.action} worked.`;
				settings.blockedMessage = `${settings.action} blocked.`;
			}
		}
	});
}

function plainItem(name: string, inventory = false, behaviorType?: keyof typeof behaviorItems) {
	return produce(createDefaultFieldObject(ItemSchema), (draft) => {
		draft.id = toID("item", name);
		draft.name = name;
		draft.presentation.listedInRoom = true;
		draft.initialState.location = inventory ? {type: "inventory"} : {type: "room", roomId};
		if (behaviorType) addItemBehaviorDraft(draft, behaviorType);
	});
}

const world: World = produce(createDefaultFieldObject(WorldSchema), (draft) => {
	draft.startRoomId = roomId;
	draft.rooms = [
		produce(createDefaultFieldObject(RoomSchema), (room) => {
			room.id = roomId;
			room.name = "Workshop";
			room.description = "A room full of ordinary things to try.";
		}),
	];
	draft.items = [
		...Object.keys(behaviorItems).map((type) =>
			standardItem(
				type as keyof typeof behaviorItems,
				type === "equippable" || type === "binding" || type === "throwable" || type === "presentable",
			),
		),
		plainItem("post"),
		plainItem("knife", true),
		plainItem("well"),
		plainItem("cup", false, "liquid-container"),
	];
	draft.commands = rawInitialCommands;
});

function lastText(game: GameState) {
	return game.messages.at(-1)?.text;
}

function itemState(game: GameState, name: string) {
	return game.itemStates.find((item) => idValue(item.id) === name);
}

function prepareAction(game: GameState, action: StandardItemAction, itemName: string): GameState {
	return produce(game, (draft) => {
		const item = draft.itemStates.find((candidate) => idValue(candidate.id) === itemName);
		if (!item) return;
		if (action === "remove" || action === "unequip") {
			draft.player.equippedItemIds ??= [];
			draft.player.equippedItemIds.push(item.id);
		}
		if (action === "switch-off" || action === "deactivate") item.flags["behavior.on"] = true;
		if (action === "extinguish") item.flags["behavior.lit"] = true;
		if (action === "get-down") draft.player.itemInteraction = {type: "climbing", itemId: item.id};
		if (action === "stand") draft.player.itemInteraction = {type: "sitting", itemId: item.id};
		if (action === "exit") draft.player.itemInteraction = {type: "inside", itemId: item.id};
		if (action === "dismount") draft.player.itemInteraction = {type: "riding", itemId: item.id};
		if (action === "untie") item.boundToItemId = toID("item", "post");
		if (action === "repair" || action === "fix" || action === "mend") {
			item.flags["behavior.broken"] = true;
		}
		if (action === "pour" || action === "empty-liquid") {
			item.behaviorAmounts ??= {};
			item.behaviorAmounts.liquid = 1;
		}
		if (action === "erase") item.writtenText = "temporary mark";
	});
}

const simpleCommands = [
	equipCommand,
	readCommand,
	senseCommand,
	searchCommand,
	eatCommand,
	drinkCommand,
	switchCommand,
	lightItemCommand,
	makeSoundCommand,
	moveItemCommand,
	climbItemCommand,
	restOnItemCommand,
	enterItemCommand,
	rideItemCommand,
	untieItemCommand,
	breakItemCommand,
	cutItemCommand,
	liquidContainerCommand,
	cleanItemCommand,
	repairItemCommand,
	eraseItemCommand,
	throwItemCommand,
];

type SyntaxCase = {
	action: StandardItemAction;
	input: string;
	itemName: string;
};

const syntaxCases: SyntaxCase[] = simpleCommands.flatMap((command) => {
	const blocks = command.patterns[0]!.blocks;
	const choice = blocks.find((block) => block.type === "choice");
	const target = blocks.find((block) => block.type === "target");
	if (!choice || !target) return [];
	const behavior = target.tags[0] as keyof typeof behaviorItems;
	const itemName = behaviorItems[behavior];
	if (!itemName) return [];
	return choice.choices.flatMap((option) =>
		option.matches.map((match) => ({
			action: option.value as StandardItemAction,
			input: `${match} ${itemName}`,
			itemName,
		})),
	);
});

function relationMatches(command: Command, patternIndex = 0): string[] {
	const relation = command.patterns[patternIndex]!.blocks.find((block) => block.type === "relation");
	if (!relation) return [];
	const defaults = RELATION_PREPOSITIONS[relation.relation];
	return [
		...new Set(
			relation.aliasMode === "replace"
				? relation.aliases
				: relation.aliasMode === "extend"
					? [...defaults, ...relation.aliases]
					: defaults,
		),
	];
}

function actionMatches(command: Command): Array<readonly [string, StandardItemAction]> {
	const choice = command.patterns[0]!.blocks.find((block) => block.type === "choice");
	return choice?.type === "choice"
		? choice.choices.flatMap((option) =>
				option.matches.map((match) => [match, option.value as StandardItemAction] as const),
			)
		: [];
}

const targetedVerbCases: SyntaxCase[] = [
	...actionMatches(tieItemCommand).map(([verb, action]) => ({
		action,
		input: `${verb} rope to post`,
		itemName: "rope",
	})),
	...actionMatches(cutItemWithToolCommand).map(([verb, action]) => ({
		action,
		input: `${verb} cloth with knife`,
		itemName: "cloth",
	})),
	...actionMatches(repairItemWithToolCommand).map(([verb, action]) => ({
		action,
		input: `${verb} clock with knife`,
		itemName: "clock",
	})),
	...actionMatches(fillFromCommand).map(([verb, action]) => ({
		action,
		input: `${verb} bottle from well`,
		itemName: "bottle",
	})),
	...actionMatches(pourIntoCommand).map(([verb, action]) => ({
		action,
		input: `${verb} bottle into cup`,
		itemName: "bottle",
	})),
	...actionMatches(writeOnItemCommand).map(([verb, action]) => ({
		action,
		input: `${verb} test words on wall`,
		itemName: "wall",
	})),
];

const targetedRelationCases: SyntaxCase[] = [
	...relationMatches(tieItemCommand).map((relation) => ({
		action: "tie" as const,
		input: `tie rope ${relation} post`,
		itemName: "rope",
	})),
	...relationMatches(tieItemCommand, 1).map((relation) => ({
		action: "tie" as const,
		input: `tie post ${relation} rope`,
		itemName: "rope",
	})),
	...relationMatches(cutItemWithToolCommand).map((relation) => ({
		action: "cut" as const,
		input: `cut cloth ${relation} knife`,
		itemName: "cloth",
	})),
	...relationMatches(repairItemWithToolCommand).map((relation) => ({
		action: "repair" as const,
		input: `repair clock ${relation} knife`,
		itemName: "clock",
	})),
	...relationMatches(fillFromCommand).map((relation) => ({
		action: "fill" as const,
		input: `fill bottle ${relation} well`,
		itemName: "bottle",
	})),
	...relationMatches(pourIntoCommand).map((relation) => ({
		action: "pour" as const,
		input: `pour bottle ${relation} cup`,
		itemName: "bottle",
	})),
	...relationMatches(writeOnItemCommand).flatMap((relation) => [
		{action: "write" as const, input: `write test words ${relation} wall`, itemName: "wall"},
		{action: "write" as const, input: `write ${relation} wall test words`, itemName: "wall"},
	]),
	...relationMatches(throwItemAtCommand).map((relation) => ({
		action: "throw" as const,
		input: `throw ball ${relation} post`,
		itemName: "ball",
	})),
	...relationMatches(presentItemCommand).map((relation) => ({
		action: "give" as const,
		input: `give gift ${relation} post`,
		itemName: "gift",
	})),
];

describe("standard item behaviors through resolveTurn", () => {
	it.each(syntaxCases)("accepts $input", ({action, input, itemName}) => {
		const initial = prepareAction(createInitialGameState(world, roomId), action, itemName);
		const next = resolveTurn(world, initial, input);
		expect(lastText(next)).toBe(`${action} worked.`);
		const behaviorType = world.items
			.find((item) => item.name === itemName)
			?.behaviors.find(
				(behavior) =>
					"actions" in behavior && behavior.actions.some((settings) => settings.action === action),
			)?.type;
		expect(itemState(next, itemName)?.flags[`behavior.${behaviorType}.${action}`]).toBe(true);
	});

	it.each([...targetedVerbCases, ...targetedRelationCases])(
		"accepts targeted syntax: $input",
		({action, input, itemName}) => {
			const initial = prepareAction(createInitialGameState(world, roomId), action, itemName);
			const next = resolveTurn(world, initial, input);
			expect(lastText(next)).toBe(`${action} worked.`);
		},
	);

	it.each(
		throwItemAtCommand.patterns[0]!.blocks.find((block) => block.type === "choice")!.choices[0]!
			.matches,
	)("accepts %s ball at post", (verb) => {
		const next = resolveTurn(world, createInitialGameState(world, roomId), `${verb} ball at post`);
		expect(lastText(next)).toBe("throw worked.");
		expect(itemState(next, "ball")?.lastActionTargetItemId).toEqual(toID("item", "post"));
	});

	const presentAction = presentItemCommand.patterns[0]!.blocks.find(
		(block) => block.type === "choice",
	)!;
	it.each(
		presentAction.type === "choice"
			? presentAction.choices.flatMap((option) =>
					option.matches.map((verb) => [verb, option.value] as const),
				)
			: [],
	)("accepts %s gift to post", (verb, action) => {
		const next = resolveTurn(world, createInitialGameState(world, roomId), `${verb} gift to post`);
		expect(lastText(next)).toBe(`${action} worked.`);
		expect(itemState(next, "gift")?.lastActionTargetItemId).toEqual(toID("item", "post"));
	});

	it("wears and removes an item while preserving carried state", () => {
		let game = resolveTurn(world, createInitialGameState(world, roomId), "put on cloak");
		expect(game.player.equippedItemIds?.some((id) => compareIds(id, toID("item", "cloak")))).toBe(
			true,
		);
		game = resolveTurn(world, game, "take off cloak");
		expect(game.player.equippedItemIds).toEqual([]);
		expect(itemState(game, "cloak")?.location).toEqual({type: "inventory"});
	});

	it("tracks opposite switch and light states", () => {
		let game = resolveTurn(world, createInitialGameState(world, roomId), "turn on machine");
		expect(itemState(game, "machine")?.flags["behavior.on"]).toBe(true);
		game = resolveTurn(world, game, "turn off machine");
		expect(itemState(game, "machine")?.flags["behavior.on"]).toBe(false);
		game = resolveTurn(world, game, "light torch");
		expect(itemState(game, "torch")?.flags["behavior.lit"]).toBe(true);
		game = resolveTurn(world, game, "blow out torch");
		expect(itemState(game, "torch")?.flags["behavior.lit"]).toBe(false);
	});

	it("handles targeted binding, cutting, repair, and liquid commands", () => {
		let game = resolveTurn(world, createInitialGameState(world, roomId), "tie rope to post");
		expect(itemState(game, "rope")?.boundToItemId).toEqual(toID("item", "post"));
		game = resolveTurn(world, game, "untie rope");
		expect(itemState(game, "rope")?.boundToItemId).toBeUndefined();

		game = resolveTurn(world, game, "cut cloth with knife");
		expect(itemState(game, "cloth")?.flags["behavior.cut"]).toBe(true);
		game = resolveTurn(world, game, "repair clock with knife");
		expect(itemState(game, "clock")?.flags["behavior.broken"]).toBe(false);
		game = resolveTurn(world, game, "fill bottle from well");
		expect(itemState(game, "bottle")?.behaviorAmounts?.liquid).toBe(1);
		game = resolveTurn(world, game, "pour bottle into cup");
		expect(itemState(game, "bottle")?.behaviorAmounts?.liquid).toBe(0);
		expect(itemState(game, "cup")?.behaviorAmounts?.liquid).toBe(1);
	});

	it("reports state-specific blocked messages through the player command path", () => {
		let game = createInitialGameState(world, roomId);
		game = resolveTurn(world, game, "pour bottle");
		expect(lastText(game)).toBe("pour blocked.");
		game = resolveTurn(world, createInitialGameState(world, roomId), "wipe off wall");
		expect(lastText(game)).toBe("erase blocked.");
		const intact = produce(createInitialGameState(world, roomId), (draft) => {
			itemState(draft, "clock")!.flags["behavior.broken"] = false;
		});
		game = resolveTurn(world, intact, "repair clock");
		expect(lastText(game)).toBe("It doesn't need repairing.");
		const clean = produce(createInitialGameState(world, roomId), (draft) => {
			itemState(draft, "mirror")!.flags["behavior.dirty"] = false;
		});
		game = resolveTurn(world, clean, "clean mirror");
		expect(lastText(game)).toBe("clean blocked.");
	});

	it("uses authored starting state for equipment, controls, liquids, damage, and writing", () => {
		const configured = produce(world, (draft) => {
			const cloak = draft.items.find((item) => item.name === "cloak")!;
			const equippable = cloak.behaviors.find((behavior) => behavior.type === "equippable")!;
			equippable.startsEquipped = true;
			const machine = draft.items.find((item) => item.name === "machine")!;
			machine.behaviors.find((behavior) => behavior.type === "switchable")!.startsOn = true;
			const torch = draft.items.find((item) => item.name === "torch")!;
			torch.behaviors.find((behavior) => behavior.type === "lightable")!.startsLit = true;
			const bottle = draft.items.find((item) => item.name === "bottle")!;
			const liquid = bottle.behaviors.find((behavior) => behavior.type === "liquid-container")!;
			liquid.capacity = 3;
			liquid.startingAmount = 2;
			const vase = draft.items.find((item) => item.name === "vase")!;
			vase.behaviors.find((behavior) => behavior.type === "breakable")!.startsBroken = true;
			const wall = draft.items.find((item) => item.name === "wall")!;
			wall.behaviors.find((behavior) => behavior.type === "writable")!.startingText = "Beware.";
		});
		const game = createInitialGameState(configured, roomId);
		expect(game.player.equippedItemIds).toContainEqual(toID("item", "cloak"));
		expect(itemState(game, "machine")?.flags["behavior.on"]).toBe(true);
		expect(itemState(game, "torch")?.flags["behavior.lit"]).toBe(true);
		expect(itemState(game, "bottle")?.behaviorAmounts?.liquid).toBe(2);
		expect(itemState(game, "vase")?.flags["behavior.broken"]).toBe(true);
		expect(itemState(game, "wall")?.writtenText).toBe("Beware.");
	});

	it("captures and erases player-authored writing", () => {
		let game = resolveTurn(
			world,
			createInitialGameState(world, roomId),
			"write remember the bell on wall",
		);
		expect(itemState(game, "wall")?.writtenText).toBe("remember the bell");
		game = resolveTurn(world, game, "wipe off wall");
		expect(itemState(game, "wall")?.writtenText).toBeUndefined();
	});

	it("consumes full eat and drink actions but not bite and sip actions", () => {
		let game = resolveTurn(world, createInitialGameState(world, roomId), "eat apple");
		expect(itemState(game, "apple")?.location).toEqual({type: "destroyed"});
		game = resolveTurn(world, createInitialGameState(world, roomId), "sip water");
		expect(itemState(game, "water")?.location).toEqual({type: "room", roomId});
	});
});
