import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {PopupProvider} from "@/components/popup/Popup";
import {toID} from "@/utils/idUtils";
import {EntityPicker} from "./EntityPicker";
import type {EntityPickerEntry} from "./entityPickerTypes";

const ENTRIES: EntityPickerEntry[] = [
	{
		ref: toID("room", "kitchen"),
		entityType: "room",
		label: "Kitchen",
		description: "A practical room with a long table.",
		aliases: ["cookhouse"],
		tags: ["domestic"],
		hierarchy: [{kind: "layer", key: "0", label: "Ground"}],
	},
	{
		ref: toID("room", "observatory"),
		entityType: "room",
		label: "Observatory",
		aliases: ["star room"],
		tags: ["tower"],
		hierarchy: [{kind: "layer", key: "1", label: "Upper floor"}],
	},
	{
		ref: toID("effect", "open-gate"),
		entityType: "effect",
		label: "Open the eastern gate",
		description: "Unlock the exit and show a message.",
		aliases: [],
		tags: [],
		hierarchy: [{kind: "category", key: "saved", label: "Saved effects"}],
	},
];

describe("EntityPicker", () => {
	it("uses a searchable popover for one entity type and chooses immediately", async () => {
		const user = userEvent.setup();
		const onChange = jest.fn();
		render(
			<PopupProvider>
				<EntityPicker
					entries={ENTRIES.filter((entry) => entry.entityType === "room")}
					entityTypes={["room"]}
					onChange={onChange}
					title="Choose a room"
				/>
			</PopupProvider>,
		);

		await user.click(screen.getByRole("button", {name: "Choose a room"}));
		expect(screen.getAllByText("Ground")).not.toHaveLength(0);
		expect(screen.getAllByText("Upper floor")).not.toHaveLength(0);

		await user.type(screen.getByRole("searchbox", {name: "Search entities"}), "star room");
		expect(screen.getByRole("option", {name: /Observatory/})).toBeInTheDocument();
		await user.click(screen.getByRole("option", {name: /Observatory/}));

		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({ref: toID("room", "observatory")}),
		);
		expect(screen.queryByRole("listbox", {name: "Entities"})).not.toBeInTheDocument();
	});

	it("uses the popup browser for multiple entity types and chooses a clicked row", async () => {
		const user = userEvent.setup();
		const onChange = jest.fn();
		render(
			<PopupProvider>
				<EntityPicker
					entries={ENTRIES}
					entityTypes={["room", "effect"]}
					onChange={onChange}
					title="Choose an entity"
				/>
			</PopupProvider>,
		);

		await user.click(screen.getByRole("button", {name: "Choose an entity"}));
		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByRole("navigation", {name: "Entity types"})).toBeInTheDocument();

		await user.click(screen.getByRole("option", {name: /Open the eastern gate/}));
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({ref: toID("effect", "open-gate")}),
		);
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("keeps the closed selector to a single line without a description", () => {
		render(
			<PopupProvider>
				<EntityPicker
					value={toID("room", "kitchen")}
					entries={ENTRIES}
					entityTypes={["room"]}
					onChange={jest.fn()}
					showPreview
				/>
			</PopupProvider>,
		);

		const trigger = screen.getByRole("button", {name: "Choose room"});
		expect(trigger).toHaveTextContent("Kitchen");
		expect(trigger).not.toHaveTextContent("Room");
		expect(screen.queryByText("A practical room with a long table.")).not.toBeInTheDocument();
	});

	it("keeps the popup candidate aligned with the visible search results", async () => {
		const user = userEvent.setup();
		const onChange = jest.fn();
		render(
			<PopupProvider>
				<EntityPicker
					value={toID("room", "kitchen")}
					entries={ENTRIES}
					entityTypes={["room", "effect"]}
					onChange={onChange}
					title="Choose an entity"
				/>
			</PopupProvider>,
		);

		await user.click(screen.getByRole("button", {name: "Choose an entity"}));
		await user.type(screen.getByRole("searchbox", {name: "Search entities"}), "tower");

		expect(screen.getByRole("complementary")).toHaveTextContent("Observatory");
		await user.click(screen.getByRole("button", {name: "Choose"}));
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({ref: toID("room", "observatory")}),
		);
	});

	it("previews a hovered popup row without changing the selected row", async () => {
		const user = userEvent.setup();
		render(
			<PopupProvider>
				<EntityPicker
					value={toID("room", "kitchen")}
					entries={ENTRIES}
					entityTypes={["room", "effect"]}
					onChange={jest.fn()}
					title="Choose an entity"
				/>
			</PopupProvider>,
		);

		await user.click(screen.getByRole("button", {name: "Choose an entity"}));
		const kitchen = screen.getByRole("option", {name: /Kitchen/});
		const observatory = screen.getByRole("option", {name: /Observatory/});

		await user.hover(observatory);

		expect(kitchen).toHaveAttribute("aria-selected", "true");
		expect(observatory).toHaveAttribute("aria-selected", "false");
		expect(screen.getByRole("complementary")).toHaveTextContent("Observatory");
	});
});
