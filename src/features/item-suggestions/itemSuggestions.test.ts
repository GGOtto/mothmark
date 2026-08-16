import {produce} from "immer";
import {createInitialWorld} from "@/data/worlds/initialWorld";
import {ItemSchema, type Item} from "@/schemas/world/itemSchema";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {
	applyAliasSuggestionDraft,
	applyTagSuggestionDraft,
	buildAliasCollisionIndex,
	buildWorldTagGraph,
	createAliasSuggestions,
	createTagSuggestions,
	emptyAliasSuggestionMessage,
	type AliasSuggestion,
} from "./itemSuggestions";
import type {LexicalConceptCandidate} from "./lexicalSchemas";

function item(id: string, name: string, aliases: string[] = [], tags: string[] = []): Item {
	return produce(createDefaultFieldObject(ItemSchema), (draft) => {
		draft.id = toID("item", id);
		draft.name = name;
		draft.aliases = aliases;
		draft.tags = tags;
	});
}

function world(items: Item[]): World {
	return produce(createDefaultFieldObject(WorldSchema), (draft) => {
		draft.items = items;
	});
}

function concept(tag: string, depth = 1): LexicalConceptCandidate {
	return {
		tag,
		label: tag.replaceAll("-", " "),
		depth,
		evidence: "WordNet category.",
		synsetId: `n:${tag}`,
	};
}

describe("item suggestion policy", () => {
	it("suggests ordinary trailing object phrases without flooding the list", () => {
		const clock = item("clock", "The old grandfather clock");
		const collection = world([clock]);

		expect(createAliasSuggestions(clock, collection, []).map(({value}) => value)).toEqual([
			"grandfather clock",
			"clock",
		]);

		const ornateClock = item("ornate-clock", "The ornate old wooden grandfather clock");
		expect(
			createAliasSuggestions(ornateClock, world([ornateClock]), []).map(({value}) => value),
		).toEqual(["wooden grandfather clock", "grandfather clock", "clock"]);

		const watermelon = item("striped-watermelon", "The enormous striped watermelon");
		expect(
			createAliasSuggestions(watermelon, world([watermelon]), []).map(({value}) => value),
		).toEqual(["striped watermelon", "watermelon", "melon"]);
	});

	it("grounds the screenshot examples in the matched taxonomy branch", () => {
		const brassKey = item("brass-key", "The brass key");
		const ironKey = item("iron-key", "Iron key", ["key"]);
		const keyWorld = world([brassKey, ironKey]);
		const keyCollisions = buildAliasCollisionIndex(keyWorld, brassKey);
		expect(createAliasSuggestions(brassKey, keyWorld, [], keyCollisions)).toEqual([]);
		expect(emptyAliasSuggestionMessage(brassKey, [], keyCollisions)).toContain(
			"could also refer to Iron key",
		);
		const keyTags = createTagSuggestions(
			brassKey,
			[concept("device")],
			buildWorldTagGraph(keyWorld, brassKey.id),
		).map((suggestion) => suggestion.tag);
		expect(keyTags).toEqual(expect.arrayContaining(["takeable", "key"]));
		expect(keyTags).not.toContain("usable");
		expect(keyTags).not.toContain("device");

		const watermelon = item("watermelon", "Watermelon");
		const watermelonWorld = world([watermelon]);
		expect(createAliasSuggestions(watermelon, watermelonWorld, []).map(({value}) => value)).toContain(
			"melon",
		);
		const watermelonTags = createTagSuggestions(
			watermelon,
			[concept("vine"), concept("fruit"), concept("food", 2)],
			buildWorldTagGraph(watermelonWorld, watermelon.id),
		).map((suggestion) => suggestion.tag);
		expect(watermelonTags).toEqual(expect.arrayContaining(["takeable", "fruit", "food", "produce"]));
		expect(watermelonTags).not.toContain("vine");

		const boots = item("boots", "Mothglass Boots");
		const bootsWorld = world([boots]);
		expect(createAliasSuggestions(boots, bootsWorld, []).map(({value}) => value)).toEqual(["boots"]);
		expect(
			createTagSuggestions(boots, [concept("footwear")], buildWorldTagGraph(bootsWorld, boots.id)).map(
				(suggestion) => suggestion.tag,
			),
		).toEqual(expect.arrayContaining(["takeable", "footwear"]));

		const ring = item("ring", "Diamond Ring");
		const ringWorld = world([ring]);
		const ringTags = createTagSuggestions(
			ring,
			[
				{...concept("jewellery"), synsetId: "n:jewelry"},
				{...concept("jewelry"), synsetId: "n:jewelry"},
			],
			buildWorldTagGraph(ringWorld, ring.id),
		).map((suggestion) => suggestion.tag);
		expect(ringTags).toEqual(expect.arrayContaining(["takeable", "jewelry"]));
		expect(ringTags).not.toContain("jewellery");
	});

	it("filters aliases that collide with similar item names anywhere in the world", () => {
		const apple = item("apple", "Red Apple", ["red fruit"]);
		const otherApple = item("green-apple", "Green Apple", ["fruit"]);
		const nestedApple = produce(item("wax-apple", "Wax Apple", ["fake apple"]), (draft) => {
			draft.initialState.location = {type: "item", itemId: otherApple.id, placement: "inside"};
		});
		const unplacedApple = item("lost-apple", "Lost Apple", ["orchard apple"]);
		const collection = world([apple, otherApple, nestedApple, unplacedApple]);

		expect(buildAliasCollisionIndex(collection, apple).get("fruit")).toEqual([otherApple]);
		expect(
			createAliasSuggestions(apple, collection, [
				{value: "fruit", relation: "broader", evidence: "Broader term."},
				{value: "orchard apple", relation: "synonym", evidence: "Related wording."},
				{value: "eating apple", relation: "synonym", evidence: "Common player wording."},
			]).map((suggestion) => suggestion.value),
		).toEqual(["eating apple"]);
	});

	it("keeps collision checks stable for accented and non-Latin authored aliases", () => {
		const current = item("sword", "Sword");
		const existing = item("other-sword", "Épée", ["剣"]);
		const suggestions = createAliasSuggestions(current, world([current, existing]), [
			{value: "epee", relation: "synonym", evidence: "Synonym."},
			{value: "剣", relation: "synonym", evidence: "Translation."},
		]);

		expect(suggestions).toEqual([]);
	});

	it("indexes large collections once without depending on placement", () => {
		const current = item("current", "Apple");
		const items = Array.from({length: 2_000}, (_, index) =>
			item(`item-${index}`, `Collection object ${index}`, [`object ${index}`]),
		);
		const index = buildAliasCollisionIndex(world([current, ...items]), current);

		expect(index.size).toBeGreaterThanOrEqual(4_000);
		expect(index.get("collection object 1999")?.[0]?.name).toBe("Collection object 1999");
	});

	it("only suggests supported taxonomy, world connections, and real capabilities", () => {
		const apple = item("apple", "Apple");
		const connected = item("ration", "Travel ration", [], ["food"]);
		const graph = buildWorldTagGraph(world([apple, connected]));
		const suggestions = createTagSuggestions(
			apple,
			[concept("fruit"), concept("food", 2), concept("takeable", 3), concept("abstraction")],
			graph,
		);

		expect(suggestions.map((suggestion) => suggestion.tag)).toEqual(
			expect.arrayContaining(["takeable", "fruit", "food"]),
		);
		expect(suggestions.slice(0, 3).map((suggestion) => suggestion.tag)).toEqual([
			"food",
			"takeable",
			"fruit",
		]);
		expect(suggestions.map((suggestion) => suggestion.tag)).not.toContain("abstraction");
		expect(suggestions.find((suggestion) => suggestion.tag === "food")).toMatchObject({
			enables: "Connects to 1 other item.",
		});
		expect(suggestions.find((suggestion) => suggestion.tag === "takeable")).toMatchObject({
			change: {type: "behavior", behavior: "takeable"},
			warning: expect.stringContaining("real capability"),
		});
	});

	it("represents a canonical behavior tag with one capability suggestion", () => {
		const satchel = item("satchel", "The battered leather satchel");
		expect(createAliasSuggestions(satchel, world([satchel]), []).map(({value}) => value)).toEqual([
			"leather satchel",
			"satchel",
		]);
		const suggestions = createTagSuggestions(
			satchel,
			[concept("container")],
			buildWorldTagGraph(world([satchel])),
		);

		expect(suggestions.filter((suggestion) => suggestion.tag === "container")).toEqual([
			expect.objectContaining({change: {type: "behavior", behavior: "container"}}),
		]);
		expect(new Set(suggestions.map((suggestion) => suggestion.tag)).size).toBe(suggestions.length);
	});

	it("reports command tag connections, including targets that allow every entity type", () => {
		const connectedWorld = produce(createInitialWorld(), (draft) => {
			const target = draft.commands
				.flatMap((command) => command.patterns)
				.flatMap((pattern) => pattern.blocks)
				.find((block) => block.type === "target");
			if (!target || target.type !== "target") throw new Error("Expected a target block");
			target.entityTypes = [];
			target.tags = ["food"];
		});
		const foodConnections = buildWorldTagGraph(connectedWorld).connections.get("food") ?? [];

		expect(foodConnections).toEqual(
			expect.arrayContaining([expect.objectContaining({kind: "command"})]),
		);
	});

	it("does not mutate an item until an accepted suggestion is applied", () => {
		const apple = item("apple", "Apple");
		const alias: AliasSuggestion = {
			value: "pome",
			reason: "WordNet synonym.",
			confidence: "strong",
		};
		const takeable = createTagSuggestions(
			apple,
			[concept("fruit")],
			buildWorldTagGraph(world([apple])),
		).find((suggestion) => suggestion.tag === "takeable")!;

		expect(apple.aliases).toEqual([]);
		expect(apple.behaviors).toEqual([]);
		const accepted = produce(apple, (draft) => {
			applyAliasSuggestionDraft(draft, alias);
			applyTagSuggestionDraft(draft, takeable);
		});
		expect(accepted.aliases).toEqual(["pome"]);
		expect(accepted.behaviors.map((behavior) => behavior.type)).toEqual(["takeable"]);
	});
});
