import {world} from "@/data/worlds/exampleWorld";
import {buildEditorRegistries} from "./buildEditorRegistries";

describe("buildEditorRegistries", () => {
	it("preserves the layer → room → feature hierarchy", () => {
		const registries = buildEditorRegistries(world);

		expect(registries.rooms.find((room) => room.id === "dungeon-entrance")).toMatchObject({
			hierarchy: [{kind: "layer", key: "0", label: "Ground Level"}],
		});
		expect(registries.features.find((feature) => feature.id === "stone-arch")).toMatchObject({
			id: "stone-arch",
			parentId: "dungeon-entrance",
			hierarchy: [
				{kind: "layer", key: "0", label: "Ground Level"},
				{kind: "room", key: "dungeon-entrance", label: "Dungeon Entrance"},
			],
		});
	});
});
