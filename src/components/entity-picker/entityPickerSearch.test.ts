import {toID} from "@/utils/idUtils";
import type {EntityPickerEntry} from "./entityPickerTypes";
import {normalizeEntitySearchText, searchEntityEntries} from "./entityPickerSearch";

function roomEntry(overrides: Partial<EntityPickerEntry> = {}): EntityPickerEntry {
	return {
		ref: toID("room", "kitchen"),
		entityType: "room",
		label: "Kitchen",
		description: "A narrow room with an old preparation table.",
		aliases: ["cookhouse"],
		tags: ["domestic", "locked"],
		hierarchy: [{kind: "layer", key: "0", label: "Ground"}],
		...overrides,
	};
}

describe("entity picker search", () => {
	it("normalizes punctuation, whitespace, case, and diacritics", () => {
		expect(normalizeEntitySearchText("  Étude.Room_ID  ")).toBe("etude room id");
	});

	it("searches labels, IDs, aliases, tags, descriptions, and hierarchy", () => {
		const entries = [roomEntry()];

		for (const query of ["kitchen", "cookhouse", "locked", "preparation", "ground"]) {
			expect(searchEntityEntries(entries, query)).toHaveLength(1);
		}
	});

	it("requires every query token while allowing them to match different fields", () => {
		const entries = [
			roomEntry(),
			roomEntry({ref: toID("room", "attic"), label: "Attic", aliases: [], tags: ["locked"]}),
		];

		expect(
			searchEntityEntries(entries, "ground locked kitchen").map((match) => match.entry.label),
		).toEqual(["Kitchen"]);
	});

	it("ranks an exact ID above a description match", () => {
		const entries = [
			roomEntry({description: "The archive entrance."}),
			roomEntry({ref: toID("room", "archive"), label: "Records room"}),
		];

		expect(searchEntityEntries(entries, "archive")[0].entry.ref.id).toBe("archive");
	});
});
