import {world} from "@/data/worlds/initialWorld";
import {produce} from "immer";
import {buildEditorRegistries} from "./buildEditorRegistries";

describe("buildEditorRegistries", () => {
	it("preserves the layer → room → item hierarchy", () => {
		const registries = buildEditorRegistries(world);

		const entrance = registries.rooms.find((room) => room.id === "shop-floor");
		expect(entrance).toMatchObject({
			hierarchy: [{kind: "layer", key: "0", label: "Main floor"}],
			facts: expect.arrayContaining([{label: "Layer", value: "Main floor"}]),
			relations: expect.arrayContaining([
				expect.objectContaining({label: "Connections"}),
				expect.objectContaining({
					label: "Items",
					items: expect.arrayContaining([
						expect.objectContaining({id: "shop-counter", label: "Shop Counter"}),
					]),
				}),
			]),
		});
		expect(registries.items.find((item) => item.id === "shop-counter")).toMatchObject({
			id: "shop-counter",
			parentId: "shop-floor",
			hierarchy: [
				{kind: "layer", key: "0", label: "Main floor"},
				{kind: "room", key: "shop-floor", label: "Shop Floor"},
			],
		});
	});

	it("builds saved flag, counter, and text options from the world's initial state", () => {
		const worldWithVariables = produce(world, (draft) => {
			draft.initialState.flags = [{flag: "ready", value: true}];
			draft.initialState.counters = [{counter: "score", value: 3}];
			draft.initialState.texts = [{text: "answer", value: "moth"}];
		});

		expect(buildEditorRegistries(worldWithVariables)).toMatchObject({
			flags: [expect.objectContaining({key: "ready"})],
			counters: [expect.objectContaining({key: "score"})],
			texts: [expect.objectContaining({key: "answer"})],
		});
	});
});
