import {ITEM_ICON_CATEGORIES} from "./itemIconCatalog";
import {ITEM_ICON_LIBRARY, OFFICIAL_ITEM_ICON_NAMES} from "./itemIconLibrary";

describe("item icon library", () => {
	it("provides one official Hugeicons mark for every catalog category", () => {
		expect(Object.keys(ITEM_ICON_LIBRARY)).toEqual(ITEM_ICON_CATEGORIES);
		expect(Object.keys(ITEM_ICON_LIBRARY)).toHaveLength(100);

		for (const category of ITEM_ICON_CATEGORIES) {
			const entry = ITEM_ICON_LIBRARY[category];
			expect(entry.icon).toBeDefined();
			expect(entry.iconName).toMatch(/Icon$/);
			expect(OFFICIAL_ITEM_ICON_NAMES[category]).toBe(entry.iconName);
		}
	});

	it("does not reuse an official mark for multiple categories", () => {
		const names = Object.values(OFFICIAL_ITEM_ICON_NAMES);
		expect(new Set(names).size).toBe(100);
	});
});
