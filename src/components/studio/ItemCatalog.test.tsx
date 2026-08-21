import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {produce} from "immer";

import {createInitialWorld} from "@/data/worlds/initialWorld";
import {ItemSchema} from "@/schemas/world/itemSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";

import {ItemCatalog} from "./ItemCatalog";

describe("ItemCatalog", () => {
	beforeEach(() => {
		window.localStorage.clear();
		document.cookie = "mothmark_editor_csrf=csrf-token";
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 204,
			text: async () => "",
		} as Response);
	});

	it("switches among compact views and saves the choice", async () => {
		const user = userEvent.setup();
		const {container} = render(
			<ItemCatalog
				world={createInitialWorld()}
				worldId={null}
				updateWorld={jest.fn()}
				selectedItemId={null}
				onSelectItem={jest.fn()}
			/>,
		);

		await user.click(screen.getByRole("button", {name: "Marks"}));

		expect(container.querySelector(".itemCatalogResults")).toHaveAttribute("data-view", "marks");
		expect(screen.getByRole("button", {name: "Marks"})).toHaveAttribute("aria-pressed", "true");
		expect(JSON.parse(window.localStorage.getItem("mothmark-editor-item-library") ?? "{}")).toEqual({
			itemListView: "marks",
			itemListSort: "updated-desc",
		});
		await waitFor(() =>
			expect(global.fetch).toHaveBeenCalledWith(
				"/api/editor/preferences",
				expect.objectContaining({method: "PATCH"}),
			),
		);
	});

	it("searches aliases and exposes tags with accessible labels", async () => {
		const user = userEvent.setup();
		render(
			<ItemCatalog
				world={createInitialWorld()}
				worldId={null}
				updateWorld={jest.fn()}
				selectedItemId={null}
				onSelectItem={jest.fn()}
			/>,
		);

		const orderBookTags = screen.getByRole("list", {name: "Tags for Order Book"});
		expect(within(orderBookTags).getByText("#scenery")).toBeVisible();
		await user.type(screen.getByRole("searchbox", {name: "Search items"}), "notebook");
		expect(screen.getByText("1 of 2 objects")).toBeVisible();
		expect(screen.getByRole("button", {name: /Order Book/})).toBeVisible();
		expect(screen.queryByRole("button", {name: /Shop Counter/})).not.toBeInTheDocument();
	});

	it("uses corroborated library icons for catalog items", () => {
		const {container} = render(
			<ItemCatalog
				world={createInitialWorld()}
				worldId={null}
				updateWorld={jest.fn()}
				selectedItemId={null}
				onSelectItem={jest.fn()}
			/>,
		);

		expect(container.querySelector('[data-icon-category="table"]')).toHaveAttribute(
			"data-icon-name",
			"DiningTableIcon",
		);
		expect(container.querySelector('[data-icon-category="book"]')).toHaveAttribute(
			"data-icon-name",
			"Book02Icon",
		);
	});

	it("uses batched inferred tags for generic catalog items", async () => {
		jest.mocked(global.fetch).mockResolvedValueOnce({
			ok: true,
			status: 200,
			text: async () => JSON.stringify({data: {categories: ["food", "book"]}}),
		} as Response);
		const world = produce(createInitialWorld(), (draft) => {
			draft.items[0]!.name = "Sardines";
			draft.items[0]!.aliases = [];
			draft.items[0]!.tags = [];
		});
		render(
			<ItemCatalog
				world={world}
				worldId={null}
				updateWorld={jest.fn()}
				selectedItemId={null}
				onSelectItem={jest.fn()}
			/>,
		);

		const sardines = screen.getByRole("button", {name: /Sardines/});
		await waitFor(() => expect(sardines.querySelector('[data-icon-category="food"]')).not.toBeNull());
		expect(screen.queryByRole("list", {name: "Tags for Sardines"})).not.toBeInTheDocument();
	});

	it("labels and filters nested and unplaced items while preserving the generic fallback", async () => {
		const user = userEvent.setup();
		const world = produce(createInitialWorld(), (draft) => {
			const nested = createDefaultFieldObject(ItemSchema);
			nested.id = toID("item", "wax-apple");
			nested.name = "Wax Apple";
			nested.initialState.location = {
				type: "item",
				itemId: draft.items[0]!.id,
				placement: "inside",
			};
			const unplaced = createDefaultFieldObject(ItemSchema);
			unplaced.id = toID("item", "cerulean-whatsit");
			unplaced.name = "Cerulean whatsit";
			unplaced.initialState.location = {type: "hidden"};
			draft.items.push(nested, unplaced);
		});

		render(
			<ItemCatalog
				world={world}
				worldId={null}
				updateWorld={jest.fn()}
				selectedItemId={null}
				onSelectItem={jest.fn()}
			/>,
		);

		expect(screen.getByText("Inside Shop Counter")).toBeVisible();
		const unplacedButton = screen.getByRole("button", {
			name: /Cerulean whatsit\. Unplaced\./,
		});
		expect(unplacedButton.querySelector('[data-icon-category="generic"]')).not.toBeNull();

		await user.selectOptions(screen.getByRole("combobox", {name: "Starting place"}), "nested");
		expect(screen.getByText("Wax Apple")).toBeVisible();
		expect(screen.queryByText("Cerulean whatsit")).not.toBeInTheDocument();
		await user.selectOptions(screen.getByRole("combobox", {name: "Starting place"}), "unplaced");
		expect(screen.getByText("Cerulean whatsit")).toBeVisible();
		expect(screen.queryByText("Wax Apple")).not.toBeInTheDocument();
	});
});
