import {render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ConditionSchema} from "@/schemas/world/conditionSchema";
import {EffectSchema} from "@/schemas/world/effectSchema";
import {CommandConditionSchema} from "@/schemas/world/commandLogicSchemas";
import {LogicPicker} from "./LogicPicker";
import {schemaLogicOptions} from "./utils/editorSchemaVariants";

describe("LogicPicker", () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

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

	it("organizes schema choices by affected domain and keeps saved choices separate", () => {
		const savedOption = {
			key: "effect-ref:ring-bell",
			type: "effect-ref",
			title: "Ring the bell",
			description: "Show a warning and start the bell event.",
			category: "Reusable",
			keywords: ["saved"],
			situations: [],
			requires: [],
			fields: [],
			defaultValue: {type: "effect-ref", effectId: {type: "effect", id: "ring-bell"}},
			searchText: "ring the bell saved warning",
		};
		render(
			<LogicPicker
				kind="effect"
				schema={EffectSchema}
				additionalOptions={[savedOption]}
				hiddenTypes={["effect-ref"]}
				onChoose={jest.fn()}
				onCancel={jest.fn()}
			/>,
		);

		const categories = screen.getByRole("navigation", {name: "effect categories"});
		expect(within(categories).getByRole("button", {name: /Item \d+/})).toBeVisible();
		expect(within(categories).getByRole("button", {name: /Messaging \d+/})).toBeVisible();
		expect(within(categories).getByRole("button", {name: /Time\/randomness \d+/})).toBeVisible();
		expect(within(categories).getByRole("button", {name: "Saved 1"})).toBeVisible();
		expect(
			within(categories).queryByRole("button", {name: /Item collection/}),
		).not.toBeInTheDocument();
		expect(within(categories).queryByRole("button", {name: /Reusable/})).not.toBeInTheDocument();
	});

	it("opens on recent choices and records the chosen operation", async () => {
		const user = userEvent.setup();
		const options = schemaLogicOptions(ConditionSchema);
		const recent = options.find((option) => option.key === "item:is-carried");
		expect(recent).toBeDefined();
		window.localStorage.setItem(
			"mothmark.logic-picker.recent.condition",
			JSON.stringify(["item:is-carried"]),
		);
		const onChoose = jest.fn();
		render(
			<LogicPicker
				kind="condition"
				schema={ConditionSchema}
				hiddenTypes={["condition-ref", "group"]}
				onChoose={onChoose}
				onCancel={jest.fn()}
			/>,
		);

		const recentCategory = await screen.findByRole("button", {name: "Recent 1"});
		expect(recentCategory).toHaveAttribute("aria-pressed", "true");
		expect(screen.getAllByRole("option")).toHaveLength(1);
		await user.click(screen.getByRole("button", {name: "Use condition"}));

		expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({key: "item:is-carried"}));
		expect(
			JSON.parse(window.localStorage.getItem("mothmark.logic-picker.recent.condition") ?? "[]"),
		).toEqual(["item:is-carried"]);
	});

	it("moves from search through results with the keyboard and chooses with Enter", async () => {
		const user = userEvent.setup();
		const onChoose = jest.fn();
		render(
			<LogicPicker
				kind="condition"
				schema={ConditionSchema}
				hiddenTypes={["condition-ref", "group"]}
				onChoose={onChoose}
				onCancel={jest.fn()}
			/>,
		);

		const results = screen.getAllByRole("option");
		const expectedTitle = results[1]?.querySelector("strong")?.textContent;
		const search = screen.getByRole("searchbox", {name: "Search conditions"});
		await user.click(search);
		await user.keyboard("{ArrowDown}");
		expect(results[0]).toHaveFocus();
		await user.keyboard("{ArrowDown}{Enter}");

		expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({title: expectedTitle}));
	});

	it("previews what the schema-derived choice will create", () => {
		render(
			<LogicPicker
				kind="condition"
				schema={ConditionSchema}
				hiddenTypes={["condition-ref", "group"]}
				onChoose={jest.fn()}
				onCancel={jest.fn()}
			/>,
		);

		const preview = document.querySelector(".logicPicker__creationPreview");
		expect(preview).not.toBeNull();
		expect(within(preview as HTMLElement).getByRole("heading", {name: "Creates"})).toBeVisible();
		expect(within(preview as HTMLElement).getByText(/\[[^\]]+\]/)).toBeVisible();
	});
});
