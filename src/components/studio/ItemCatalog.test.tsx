import {render, screen, waitFor, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {createInitialWorld} from "@/data/worlds/initialWorld";

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
});
