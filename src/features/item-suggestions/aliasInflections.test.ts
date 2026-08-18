import {aliasInflections, aliasSingularForm} from "./aliasInflections";

describe("alias inflections", () => {
	it.each([
		["satchel", ["satchels"]],
		["maps", ["map"]],
		["knife", ["knives"]],
		["atlas", ["atlases"]],
		["axes", ["axe"]],
		["dice", ["die"]],
		["shelf", ["shelves"]],
		["shoes", ["shoe"]],
		["wooden chest", ["wooden chests"]],
	] as const)("adds the other useful noun form for %s", (value, expected) => {
		expect(aliasInflections(value)).toEqual(expected);
	});

	it.each(["twine", "equipment", "fishing gear"])("does not invent a count form for %s", (value) => {
		expect(aliasInflections(value)).toEqual([]);
	});

	it.each([
		["boots", "boot"],
		["atlas", "atlas"],
		["apparatus", "apparatus"],
		["shelves", "shelf"],
	] as const)("derives a safe singular seed for %s", (value, expected) => {
		expect(aliasSingularForm(value)).toBe(expected);
	});
});
