import {world} from "@/data/worlds/initialWorld";
import {buildEditorRegistries} from "./buildEditorRegistries";

describe("buildEditorRegistries", () => {
	it("preserves the layer → room → feature hierarchy", () => {
		const registries = buildEditorRegistries(world);

		const entrance = registries.rooms.find((room) => room.id === "dungeon-entrance");
		expect(entrance).toMatchObject({
			hierarchy: [{kind: "layer", key: "0", label: "Ground Level"}],
			facts: expect.arrayContaining([{label: "Layer", value: "Ground Level"}]),
			relations: expect.arrayContaining([
				expect.objectContaining({label: "Connections"}),
				expect.objectContaining({
					label: "Features",
					items: expect.arrayContaining([
						expect.objectContaining({id: "stone-arch", label: "Stone Arch"}),
					]),
				}),
			]),
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
