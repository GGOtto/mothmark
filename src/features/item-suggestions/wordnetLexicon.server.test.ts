/** @jest-environment node */

jest.mock("server-only", () => ({}));

import {produce} from "immer";
import {resolveItemIcon} from "@/itemIcons";
import {ItemSchema, type Item} from "@/schemas/world/itemSchema";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {buildWorldTagGraph, createAliasSuggestions, createTagSuggestions} from "./itemSuggestions";
import {suggestFromWordNet} from "./wordnetLexicon.server";

function exampleItem(id: string, name: string): Item {
	return produce(createDefaultFieldObject(ItemSchema), (draft) => {
		draft.id = toID("item", id);
		draft.name = name;
	});
}

describe("WordNet item suggestions", () => {
	it("deterministically finds aliases and semantic categories for an apple", async () => {
		const request = {name: "Apple", aliases: [], tags: [], iconCategory: "produce"};
		const first = await suggestFromWordNet(request);
		const second = await suggestFromWordNet(request);

		expect(second).toEqual(first);
		expect(first.aliases.every((candidate) => candidate.relation !== "broader")).toBe(true);
		expect(first.aliases.map((candidate) => candidate.value)).not.toContain("edible fruit");
		expect(first.concepts.map((candidate) => candidate.tag)).toEqual(
			expect.arrayContaining(["edible-fruit", "produce", "food"]),
		);
	});

	it("uses existing author context to disambiguate a noun", async () => {
		const result = await suggestFromWordNet({
			name: "Bat",
			aliases: [],
			tags: ["animal"],
			iconCategory: "mammal",
		});

		expect(result.concepts.map((candidate) => candidate.tag)).toContain("mammal");
	});

	it.each([
		["Oak table", "table", "furniture", "array"],
		["Wooden chest", "chest", "container", "body-part"],
	] as const)(
		"uses the maintained taxonomy to choose the object sense for %s",
		async (name, iconCategory, expectedTag, rejectedTag) => {
			const result = await suggestFromWordNet({name, aliases: [], tags: [], iconCategory});

			expect(result.concepts.map(({tag}) => tag)).toContain(expectedTag);
			expect(result.concepts.map(({tag}) => tag)).not.toContain(rejectedTag);
		},
	);

	it("keeps useful same-sense WordNet aliases after taxonomy disambiguation", async () => {
		const result = await suggestFromWordNet({
			name: "Diamond Ring",
			aliases: [],
			tags: [],
			iconCategory: "jewelry",
		});

		expect(result.aliases.map(({value}) => value)).toEqual(expect.arrayContaining(["ring", "band"]));
	});

	it("fills a sparse WordNet entry from the pinned dictionary snapshot", async () => {
		const result = await suggestFromWordNet({
			name: "The battered leather satchel",
			aliases: [],
			tags: [],
			iconCategory: "bag",
		});

		expect(result.aliases).toEqual(
			expect.arrayContaining([expect.objectContaining({value: "bag", relation: "reference"})]),
		);
		expect(result.aliases.map(({value}) => value)).not.toEqual(
			expect.arrayContaining(["backpack", "knapsack", "purse"]),
		);
	});

	it.each([
		{
			name: "The brass key",
			aliases: [],
			tags: ["key", "takeable"],
			rejectedTags: ["device", "usable"],
		},
		{
			name: "Watermelon",
			aliases: ["melon"],
			tags: ["fruit", "food", "produce", "takeable"],
			rejectedTags: ["vine"],
		},
		{
			name: "Mothglass Boots",
			aliases: ["boots", "boot"],
			tags: ["footwear", "takeable"],
			rejectedTags: [],
		},
		{
			name: "Diamond Ring",
			aliases: ["ring"],
			tags: ["jewelry", "takeable"],
			rejectedTags: ["jewellery"],
		},
	] as const)("keeps $name suggestions useful end to end", async (example) => {
		const item = exampleItem(example.name.toLowerCase().replaceAll(" ", "-"), example.name);
		const world = produce(createDefaultFieldObject(WorldSchema), (draft) => {
			draft.items = [item];
		});
		const lexical = await suggestFromWordNet({
			name: item.name,
			aliases: item.aliases,
			tags: item.tags,
			iconCategory: resolveItemIcon(item).category,
		});
		const aliases = createAliasSuggestions(item, world, lexical.aliases).map(({value}) => value);
		const tags = createTagSuggestions(item, lexical.concepts, buildWorldTagGraph(world, item.id)).map(
			({tag}) => tag,
		);

		expect(aliases).toEqual(expect.arrayContaining([...example.aliases]));
		expect(tags).toEqual(expect.arrayContaining([...example.tags]));
		for (const rejectedTag of example.rejectedTags) expect(tags).not.toContain(rejectedTag);
	});
});
