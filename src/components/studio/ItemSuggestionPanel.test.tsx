import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {produce, type Draft} from "immer";
import {useState} from "react";
import {ItemSchema, type Item} from "@/schemas/world/itemSchema";
import {WorldSchema, type World} from "@/schemas/world/worldSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {ItemSuggestionList, useItemSuggestions} from "./ItemSuggestionPanel";

function createWorld(name = "Apple"): World {
	const apple = produce(createDefaultFieldObject(ItemSchema), (draft) => {
		draft.id = toID("item", "apple");
		draft.name = name;
	});
	return produce(createDefaultFieldObject(WorldSchema), (draft) => {
		draft.items = [apple];
	});
}

function Harness({initialName = "Apple"}: {initialName?: string}) {
	const [world, setWorld] = useState(() => createWorld(initialName));
	const item = world.items[0]!;
	const suggestions = useItemSuggestions(item, world);
	function onUpdate(recipe: (draft: Draft<Item>) => void) {
		setWorld((current) =>
			produce(current, (draft) => {
				recipe(draft.items[0]!);
			}),
		);
	}
	return (
		<>
			<label>
				Item name
				<input
					value={item.name}
					onChange={(event) => onUpdate((draft) => void (draft.name = event.target.value))}
				/>
			</label>
			<button type="button" onClick={() => onUpdate((draft) => void draft.aliases.push("orchard"))}>
				Add authored alias
			</button>
			<button type="button" onClick={() => onUpdate((draft) => void draft.tags.push("food"))}>
				Add authored tag
			</button>
			<ItemSuggestionList mode="aliases" onUpdate={onUpdate} suggestions={suggestions} />
			<ItemSuggestionList mode="tags" onUpdate={onUpdate} suggestions={suggestions} />
			<output aria-label="Accepted aliases">{item.aliases.join(", ")}</output>
			<output aria-label="Enabled behaviors">
				{item.behaviors.map((behavior) => behavior.type).join(", ")}
			</output>
			<output aria-label="Automatic icon">{suggestions.iconCategory}</output>
		</>
	);
}

describe("ItemSuggestionPanel", () => {
	beforeEach(() => {
		document.cookie = "mothmark_editor_csrf=csrf-token; Path=/";
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: jest.fn(async (_url: string, init?: RequestInit) => {
				const request = JSON.parse(String(init?.body)) as {name: string};
				const isHammer = request.name === "Hammer";
				const isSatchel = request.name === "The battered leather satchel";
				const isFood = request.name === "Toast" || request.name === "Sardines";
				const body = {
					data: {
						aliases: [
							{
								value: isHammer ? "mallet" : isSatchel ? "bag" : "orchard apple",
								relation: "synonym",
								evidence: "Common player wording.",
							},
						],
						concepts: [
							{
								tag: isHammer ? "tool" : isSatchel ? "container" : isFood ? "food" : "fruit",
								label: isHammer ? "tool" : isSatchel ? "container" : isFood ? "food" : "fruit",
								depth: 1,
								evidence: "Language category.",
								synsetId: "n:1",
							},
						],
						version: "test",
					},
				};
				return {
					ok: true,
					status: 200,
					text: jest.fn().mockResolvedValue(JSON.stringify(body)),
				} as unknown as Response;
			}),
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
		Reflect.deleteProperty(globalThis, "fetch");
		document.cookie = "mothmark_editor_csrf=; Max-Age=0; Path=/";
	});

	it("keeps alias and capability suggestions pending until the author accepts each one", async () => {
		const user = userEvent.setup();
		render(<Harness />);

		const alias = await screen.findByText("orchard apple");
		expect(screen.getByLabelText("Accepted aliases")).toHaveTextContent("");
		await user.click(
			within(alias.closest("li")!).getByRole("button", {name: "Add alias orchard apple"}),
		);
		expect(screen.getByLabelText("Accepted aliases")).toHaveTextContent("orchard apple");

		const takeable = await screen.findByText("#takeable");
		const row = takeable.closest("li")!;
		expect(within(row).getByText(/take, carry, place, and drop/i)).toBeVisible();
		expect(within(row).getByText(/real capability/i)).toBeVisible();
		expect(screen.getByLabelText("Enabled behaviors")).toHaveTextContent("");
		await user.click(within(row).getByRole("button", {name: "Enable takeable"}));
		expect(screen.getByLabelText("Enabled behaviors")).toHaveTextContent("takeable");

		await waitFor(() => expect(global.fetch).toHaveBeenCalled());
		expect(jest.mocked(global.fetch).mock.calls[0]?.[1]).toMatchObject({
			method: "POST",
			headers: expect.objectContaining({"x-csrf-token": "csrf-token"}),
		});
	});

	it.each(["Toast", "Sardines"])(
		"uses the inferred food classification for the %s icon without authoring the tag",
		async (name) => {
			render(<Harness initialName={name} />);

			expect(screen.getByRole("button", {name: "Add authored tag"})).toBeVisible();
			await waitFor(() => expect(screen.getByLabelText("Automatic icon")).toHaveTextContent("food"));
		},
	);

	it("refreshes suggestions after name, alias, tag, and behavior changes", async () => {
		const user = userEvent.setup();
		render(<Harness />);

		await screen.findByText("orchard apple");
		const name = screen.getByRole("textbox", {name: "Item name"});
		await user.clear(name);
		await user.type(name, "Hammer");
		await screen.findByText("mallet");
		expect(screen.queryByText("orchard apple")).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", {name: "Add authored alias"}));
		await user.click(screen.getByRole("button", {name: "Add authored tag"}));
		const usable = await screen.findByText("#usable");
		await user.click(within(usable.closest("li")!).getByRole("button", {name: "Enable usable"}));

		await waitFor(() => {
			const calls = jest.mocked(global.fetch).mock.calls;
			const lastRequest = JSON.parse(String(calls.at(-1)?.[1]?.body)) as {
				aliases: string[];
				tags: string[];
			};
			expect(lastRequest.aliases).toContain("orchard");
			expect(lastRequest.tags).toEqual(expect.arrayContaining(["food", "usable"]));
		});
	});

	it("explains an empty alias result instead of reporting an unexplained failure", async () => {
		jest.mocked(global.fetch).mockResolvedValueOnce({
			ok: true,
			status: 200,
			text: jest
				.fn()
				.mockResolvedValue(JSON.stringify({data: {aliases: [], concepts: [], version: "test"}})),
		} as unknown as Response);
		render(<Harness initialName="Equipment" />);

		expect(
			await screen.findByText("The current name already covers the safe player wording found."),
		).toBeVisible();
	});

	it("shows one capability row when taxonomy and language both identify a behavior tag", async () => {
		const user = userEvent.setup();
		render(<Harness />);

		const name = screen.getByRole("textbox", {name: "Item name"});
		await user.clear(name);
		await user.type(name, "The battered leather satchel");
		await screen.findByText("bag");

		const containerRows = screen.getAllByText("#container");
		expect(containerRows).toHaveLength(1);
		expect(within(containerRows[0]!.closest("li")!).getByText("Capability")).toBeVisible();
	});
});
