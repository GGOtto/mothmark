import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ConditionSchema} from "@/schemas/world/conditionSchema";
import {EffectSchema} from "@/schemas/world/effectSchema";
import {CommandConditionSchema} from "@/schemas/world/commandLogicSchemas";
import {LogicPicker} from "./LogicPicker";
import {schemaLogicOptions} from "./utils/editorSchemaVariants";

describe("LogicPicker", () => {
	it("finds effects by author intent rather than internal slugs", async () => {
		const user = userEvent.setup();
		const onChoose = jest.fn();
		render(
			<LogicPicker
				kind="effect"
				schema={EffectSchema}
				hiddenTypes={["effect-ref"]}
				onChoose={onChoose}
				onCancel={jest.fn()}
			/>,
		);

		await user.type(screen.getByRole("searchbox", {name: "Search effects"}), "bury");
		expect(screen.getByRole("option", {name: /Place an item inside another/})).toBeVisible();
		expect(screen.getByRole("option", {name: /Have the player put an item inside/})).toBeVisible();
		expect(screen.queryByText("place-inside")).not.toBeInTheDocument();

		await user.click(screen.getByRole("option", {name: /Place an item inside another/}));
		await user.click(screen.getByRole("button", {name: "Use effect"}));
		expect(onChoose).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "item",
				operation: "place-inside",
				defaultValue: expect.objectContaining({type: "item", operation: "place-inside"}),
			}),
		);
	});

	it("finds room conditions using scenario language", async () => {
		const user = userEvent.setup();
		render(
			<LogicPicker
				kind="condition"
				schema={ConditionSchema}
				hiddenTypes={["condition-ref", "group"]}
				onChoose={jest.fn()}
				onCancel={jest.fn()}
			/>,
		);

		await user.type(screen.getByRole("searchbox", {name: "Search conditions"}), "outside");
		expect(screen.getByRole("option", {name: /The current room has a tag/})).toBeVisible();
		expect(
			screen.getByText(/Only allow digging when the current room has the outside tag/),
		).toBeVisible();
	});

	it("finds effects from hidden situation phrases without displaying those phrases", async () => {
		const user = userEvent.setup();
		render(
			<LogicPicker
				kind="effect"
				schema={EffectSchema}
				hiddenTypes={["effect-ref"]}
				onChoose={jest.fn()}
				onCancel={jest.fn()}
			/>,
		);

		await user.type(screen.getByRole("searchbox", {name: "Search effects"}), "set a trap");
		expect(screen.getByRole("option", {name: /Set a world flag/})).toBeVisible();
		expect(screen.getByRole("option", {name: /Set an item flag/})).toBeVisible();
		expect(screen.queryByText("set a trap", {exact: true})).not.toBeInTheDocument();
	});

	it("finds conditions from natural-language situation phrases", async () => {
		const user = userEvent.setup();
		render(
			<LogicPicker
				kind="condition"
				schema={ConditionSchema}
				hiddenTypes={["condition-ref", "group"]}
				onChoose={jest.fn()}
				onCancel={jest.fn()}
			/>,
		);

		await user.type(screen.getByRole("searchbox", {name: "Search conditions"}), "trap armed");
		expect(screen.getByRole("option", {name: /A world flag has a value/})).toBeVisible();
		expect(screen.getByRole("option", {name: /An item flag has a value/})).toBeVisible();
	});

	it("provides complete discovery copy for every concrete schema operation", () => {
		for (const option of [
			...schemaLogicOptions(EffectSchema),
			...schemaLogicOptions(ConditionSchema),
		].filter((candidate) => !candidate.type.endsWith("-ref"))) {
			expect(option.title).toBeTruthy();
			expect(option.description).toBeTruthy();
			expect(option.keywords.length).toBeGreaterThan(0);
			expect(option.situations.length).toBeGreaterThanOrEqual(3);
			expect(option.situations.every((situation) => situation.includes(" "))).toBe(true);
			expect(option.searchText).toContain(option.title.toLocaleLowerCase());
			for (const situation of option.situations) {
				expect(option.searchText).toContain(situation.toLocaleLowerCase());
			}
		}
	});

	it("covers varied author situations across every logic domain", () => {
		const cases = [
			[EffectSchema, "set a trap", "world:set-flag"],
			[EffectSchema, "award points", "world:increase-counter"],
			[EffectSchema, "remember the player's name", "world:set-text"],
			[EffectSchema, "make an object appear here", "item:move-to-current-room"],
			[EffectSchema, "bury treasure in a hole", "item:place-inside"],
			[EffectSchema, "place an offering on an altar", "item:place-on"],
			[EffectSchema, "uncover a hidden clue", "item:reveal"],
			[EffectSchema, "slam a door shut", "item:set-closed"],
			[EffectSchema, "spill a bag onto the floor", "item:empty-into-room"],
			[EffectSchema, "activate a device", "player:use"],
			[EffectSchema, "pause commands during a cutscene", "player:freeze"],
			[EffectSchema, "show that the ground has been disturbed", "room:set-description"],
			[EffectSchema, "start a lockdown", "navigation:lock-all-exits"],
			[EffectSchema, "open a secret route", "navigation:unlock-exit"],
			[ConditionSchema, "player gave the correct password", "world:text-is"],
			[ConditionSchema, "timer expires", "world:counter-compare"],
			[ConditionSchema, "player has the key", "item:is-carried"],
			[ConditionSchema, "treasure is buried in a hole", "item:is-inside"],
			[ConditionSchema, "container holds any weapon", "item:contains-tag"],
			[ConditionSchema, "testing the correct key", "item:can-be-unlocked-by"],
			[ConditionSchema, "only allow digging while outside", "room:current-has-tag"],
			[ConditionSchema, "ground here was disturbed", "room:flag-is"],
			[ConditionSchema, "player is away from the cellar", "player:is-not-in-room"],
			[ConditionSchema, "player can escape north", "navigation:exit-is-open"],
		] as const;

		for (const [schema, query, expectedKey] of cases) {
			const terms = query.toLocaleLowerCase().split(/\s+/);
			const match = schemaLogicOptions(schema).find(
				(option) =>
					option.key === expectedKey && terms.every((term) => option.searchText.includes(term)),
			);
			expect(match).toBeDefined();
		}
	});

	it("uses the contextual command schema for command-only choices", () => {
		const options = schemaLogicOptions(CommandConditionSchema);
		expect(options).toEqual(
			expect.arrayContaining([
				expect.objectContaining({type: "comparison", title: "Compare two numbers"}),
				expect.objectContaining({type: "world", operation: "flag-is"}),
			]),
		);
		expect(schemaLogicOptions(ConditionSchema).some((option) => option.type === "comparison")).toBe(
			false,
		);
	});
});
