/** @jest-environment node */

jest.mock("server-only", () => ({}));

import {produce} from "immer";
import {resolveItemIcon} from "@/itemIcons";
import {ItemSchema} from "@/schemas/world/itemSchema";
import {WorldSchema} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {buildWorldTagGraph, createAliasSuggestions, createTagSuggestions} from "./itemSuggestions";
import {suggestFromWordNet} from "./wordnetLexicon.server";

async function baseline(name: string) {
	const item = produce(createDefaultFieldObject(ItemSchema), (draft) => {
		draft.id = toID("item", "baseline-item");
		draft.name = name;
	});
	const world = produce(createDefaultFieldObject(WorldSchema), (draft) => {
		draft.items = [item];
	});
	const iconCategory = resolveItemIcon(item).category;
	const lexical = await suggestFromWordNet({
		name,
		aliases: [],
		tags: [],
		iconCategory,
	});
	return {
		iconCategory,
		aliases: createAliasSuggestions(item, world, lexical.aliases).map(({value}) => value),
		tags: createTagSuggestions(item, lexical.concepts, buildWorldTagGraph(world, item.id)).map(
			({tag}) => tag,
		),
	};
}

describe("reviewed item suggestion baseline", () => {
	it.each([
		{
			name: "The battered leather satchel",
			aliases: ["leather satchel", "satchel", "satchels", "bag", "bags", "case", "cases"],
			tags: ["bag", "container"],
		},
		{
			name: "A sealed parchment map of the northern coast",
			aliases: ["parchment map", "map", "maps", "chart", "charts", "plan", "plans"],
			tags: ["map", "takeable"],
		},
		{
			name: "A frayed hemp rope with an iron hook",
			aliases: ["hemp rope", "rope", "ropes", "cord", "cords", "twine"],
			tags: ["rope", "usable", "takeable"],
		},
		{
			name: "The chipped obsidian ritual dagger",
			aliases: ["ritual dagger", "dagger", "daggers", "knife", "knives"],
			tags: ["knife", "weapon", "takeable"],
		},
		{
			name: "Mothglass Boots",
			aliases: ["boots", "boot", "shoes", "shoe"],
			tags: ["footwear", "takeable"],
		},
		{
			name: "Diamond Ring",
			aliases: ["ring", "rings", "band", "bands"],
			tags: ["jewelry", "takeable"],
		},
		{
			name: "Wooden Chest",
			aliases: ["chest", "chests", "box", "boxes"],
			tags: ["chest", "container"],
		},
		{
			name: "Brass Lantern",
			aliases: ["lantern", "lanterns", "lamp", "lamps"],
			tags: ["light", "lamp"],
		},
		{
			name: "Wool Cloak",
			aliases: ["cloak", "cloaks", "cape", "capes"],
			tags: ["cloak", "wearable"],
		},
	] as const)("covers the player vocabulary surface for $name", async (example) => {
		const result = await baseline(example.name);

		expect(result.aliases).toEqual(expect.arrayContaining([...example.aliases]));
		expect(result.tags).toEqual(expect.arrayContaining([...example.tags]));
	});

	it("gives a satchel a generic player reference without neighboring bag types", async () => {
		const result = await baseline("The battered leather satchel");

		expect(result.aliases).toEqual(
			expect.arrayContaining(["leather satchel", "satchel", "bag", "leather bag"]),
		);
		expect(result.aliases).not.toEqual(
			expect.arrayContaining(["backpack", "knapsack", "pouch", "purse", "suitcase"]),
		);
		expect(result.tags).toEqual(expect.arrayContaining(["bag", "container"]));
	});

	it("keeps the object rather than the subject in an of-phrase", async () => {
		const result = await baseline("A sealed parchment map of the northern coast");

		expect(result.aliases).toEqual(
			expect.arrayContaining(["parchment map", "map", "chart", "plan", "parchment chart"]),
		);
		expect(result.aliases).not.toEqual(expect.arrayContaining(["coast", "seacoast"]));
		expect(result.aliases.some((alias) => alias.endsWith("coasts"))).toBe(false);
		expect(result.tags).toContain("map");
	});

	it("keeps the object rather than an attached component in a with-phrase", async () => {
		const result = await baseline("A frayed hemp rope with an iron hook");

		expect(result.aliases).toEqual(
			expect.arrayContaining(["hemp rope", "rope", "cord", "twine", "hemp cord"]),
		);
		expect(result.aliases).not.toEqual(expect.arrayContaining(["hook", "chain", "wire"]));
		expect(result.aliases.some((alias) => alias.endsWith("hooks"))).toBe(false);
		expect(result.tags).toEqual(expect.arrayContaining(["rope", "usable"]));
	});

	it("uses the canonical weapon noun instead of sibling blade types", async () => {
		const result = await baseline("The chipped obsidian ritual dagger");

		expect(result.aliases).toEqual(
			expect.arrayContaining(["ritual dagger", "dagger", "knife", "ritual knife"]),
		);
		expect(result.aliases).not.toEqual(expect.arrayContaining(["dirk", "sword", "cleaver"]));
		expect(result.aliases).not.toContain("weapon system");
		expect(result.tags).toEqual(expect.arrayContaining(["knife", "weapon"]));
	});

	it("recognizes a quantity-of construction through the resolved taxonomy", async () => {
		const result = await baseline("A coil of rope");

		expect(result.aliases).toEqual(expect.arrayContaining(["rope", "cord", "twine"]));
	});

	it("keeps two meanings of bat separated by the complete item phrase", async () => {
		const weapon = await baseline("The cracked wooden baseball bat");
		const sculpture = await baseline("A small stone statue of a bat");

		expect(weapon.iconCategory).toBe("blunt-weapon");
		expect(weapon.aliases).toEqual(expect.arrayContaining(["baseball bat", "bat"]));
		expect(weapon.aliases).not.toContain("lumber");
		expect(weapon.aliases).not.toEqual(
			expect.arrayContaining(["baseball club", "wooden baseball club"]),
		);
		expect(weapon.tags).toContain("blunt-weapon");
		expect(weapon.tags).not.toContain("fauna");
		expect(sculpture.iconCategory).toBe("sculpture");
		expect(sculpture.aliases).toEqual(expect.arrayContaining(["stone statue", "statue", "carving"]));
		expect(sculpture.aliases).not.toContain("bat");
		expect(sculpture.aliases.some((alias) => alias.endsWith("bats"))).toBe(false);
		expect(sculpture.tags).toEqual(expect.arrayContaining(["sculpture", "art"]));
		expect(sculpture.tags).not.toEqual(expect.arrayContaining(["blunt-weapon", "fauna", "weapon"]));
	});
});
