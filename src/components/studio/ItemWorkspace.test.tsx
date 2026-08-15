import {render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {produce} from "immer";
import {useState, type ComponentProps} from "react";
import {createInitialWorld} from "@/data/worlds/initialWorld";
import {SurfaceBehaviorSchema} from "@/schemas/world/itemSchema";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue} from "@/utils/idUtils";
import {ItemWorkspace} from "./ItemWorkspace";

type TestItemWorkspaceProps = Omit<
	ComponentProps<typeof ItemWorkspace>,
	"activeTab" | "onActiveTabChange"
>;

function TestItemWorkspace(props: TestItemWorkspaceProps) {
	const [activeTab, setActiveTab] =
		useState<ComponentProps<typeof ItemWorkspace>["activeTab"]>("details");
	return <ItemWorkspace {...props} activeTab={activeTab} onActiveTabChange={setActiveTab} />;
}

beforeAll(() => {
	Object.defineProperty(window, "scrollTo", {configurable: true, value: jest.fn()});
});

describe("ItemWorkspace", () => {
	it("renders the schema-backed item document and returns to the selector", async () => {
		const user = userEvent.setup();
		const world = createInitialWorld();
		const item = world.items[0]!;
		const onBack = jest.fn();

		const {container} = render(
			<TestItemWorkspace
				item={item}
				world={world}
				updateWorld={jest.fn()}
				onBack={onBack}
				onItemIdChange={jest.fn()}
				onItemDeleted={jest.fn()}
				onOpenCommand={jest.fn()}
				onOpenLogicLibrary={jest.fn()}
				onOpenPlay={jest.fn()}
			/>,
		);

		expect(screen.getByRole("heading", {name: "Shop Counter", level: 1})).toBeVisible();
		expect(screen.getByRole("heading", {name: "Identity"})).toBeVisible();
		expect(screen.getByRole("heading", {name: "Player-facing text"})).toBeVisible();
		expect(screen.queryByRole("heading", {name: "Behaviors"})).not.toBeInTheDocument();
		expect(screen.getByRole("tab", {name: "Details"})).toHaveAttribute("aria-selected", "true");
		expect(screen.getByRole("tab", {name: "Behavior"})).toBeVisible();
		expect(screen.getByRole("tab", {name: "Placement"})).toBeVisible();
		expect(screen.getByRole("tab", {name: "Commands"})).toBeVisible();
		expect(screen.queryByText("Choose icon")).not.toBeInTheDocument();
		expect(screen.getByRole("textbox", {name: "Name"})).toHaveValue("Shop Counter");
		expect(screen.getByRole("button", {name: "Delete"})).toBeVisible();
		expect(screen.queryByRole("button", {name: "More item actions"})).not.toBeInTheDocument();
		expect(container.querySelector(".universalEditor")).not.toBeInTheDocument();
		expect(container.querySelector(".itemWorkspaceMark svg")).toHaveAttribute("width", "32");
		expect(container.querySelector(".itemWorkspaceMark svg")).toHaveAttribute(
			"data-icon-category",
			"table",
		);

		screen.getByRole("tab", {name: "Details"}).focus();
		await user.keyboard("{ArrowRight}");
		expect(screen.getByRole("tab", {name: "Behavior"})).toHaveFocus();
		expect(screen.getByRole("tab", {name: "Behavior"})).toHaveAttribute("aria-selected", "true");
		expect(screen.getByRole("heading", {name: "Capabilities"})).toBeVisible();
		expect(screen.getByRole("heading", {name: "Flags"})).toBeVisible();
		expect(screen.queryByRole("heading", {name: "Identity"})).not.toBeInTheDocument();
		await user.click(screen.getByRole("tab", {name: "Placement"}));
		expect(screen.getByRole("heading", {name: "Starting position"})).toBeVisible();
		expect(screen.queryByRole("heading", {name: "Flags"})).not.toBeInTheDocument();
		await user.click(screen.getByRole("tab", {name: "Commands"}));
		expect(screen.getByRole("heading", {name: "Commands"})).toBeVisible();

		await user.click(screen.getByRole("button", {name: "Back to items"}));
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it("keeps contents copy and flags in Behaviors while Placement stays focused", async () => {
		const user = userEvent.setup();
		const world = produce(createInitialWorld(), (draft) => {
			const item = draft.items[0]!;
			const surface = createDefaultFieldObject(SurfaceBehaviorSchema);
			surface.contentsListingText = "On the counter:";
			item.behaviors = [surface];
			item.initialState.flags.searched = false;
		});

		render(
			<TestItemWorkspace
				item={world.items[0]!}
				world={world}
				updateWorld={jest.fn()}
				onBack={jest.fn()}
				onItemIdChange={jest.fn()}
				onItemDeleted={jest.fn()}
				onOpenCommand={jest.fn()}
				onOpenLogicLibrary={jest.fn()}
				onOpenPlay={jest.fn()}
			/>,
		);

		await user.click(screen.getByRole("tab", {name: "Behavior"}));
		expect(screen.getByRole("textbox", {name: "Contents lead-in"})).toHaveValue("On the counter:");
		expect(screen.getByRole("heading", {name: "Flags"})).toBeVisible();
		expect(screen.getByDisplayValue("searched")).toBeVisible();

		await user.click(screen.getByRole("tab", {name: "Placement"}));
		expect(screen.getByRole("heading", {name: "Starting position"})).toBeVisible();
		expect(screen.queryByRole("textbox", {name: "Contents lead-in"})).not.toBeInTheDocument();
		expect(screen.queryByRole("heading", {name: "Flags"})).not.toBeInTheDocument();
	});

	it("lists commands that can target or directly reference the item and opens them", async () => {
		const user = userEvent.setup();
		const sourceWorld = createInitialWorld();
		const item = sourceWorld.items[0]!;
		const world = produce(sourceWorld, (draft) => {
			const command = draft.commands.find((candidate) =>
				candidate.patterns.some((pattern) => pattern.blocks.some((block) => block.type === "target")),
			)!;
			const target = command.patterns
				.flatMap((pattern) => pattern.blocks)
				.find((block) => block.type === "target");
			if (target?.type === "target") target.entityIds = [item.id];
		});
		const attachedCommand = world.commands.find((command) =>
			command.patterns.some((pattern) =>
				pattern.blocks.some(
					(block) =>
						block.type === "target" &&
						block.entityIds.some((entityId) => idValue(entityId) === idValue(item.id)),
				),
			),
		)!;
		const onOpenCommand = jest.fn();

		render(
			<TestItemWorkspace
				item={world.items[0]!}
				world={world}
				updateWorld={jest.fn()}
				onBack={jest.fn()}
				onItemIdChange={jest.fn()}
				onItemDeleted={jest.fn()}
				onOpenCommand={onOpenCommand}
				onOpenLogicLibrary={jest.fn()}
				onOpenPlay={jest.fn()}
			/>,
		);

		await user.click(screen.getByRole("tab", {name: "Commands"}));
		const commandRow = screen.getByText(attachedCommand.name).closest("li");
		expect(commandRow).not.toBeNull();
		await user.click(within(commandRow as HTMLElement).getByRole("button", {name: "Open command"}));
		expect(onOpenCommand).toHaveBeenCalledWith(idValue(attachedCommand.id));
	});

	it("opens Play locally and sends advanced logic to the focused workspace", async () => {
		const user = userEvent.setup();
		const world = createInitialWorld();
		const onOpenLogicLibrary = jest.fn();
		const onOpenPlay = jest.fn();

		render(
			<TestItemWorkspace
				item={world.items[0]!}
				world={world}
				updateWorld={jest.fn()}
				onBack={jest.fn()}
				onItemIdChange={jest.fn()}
				onItemDeleted={jest.fn()}
				onOpenCommand={jest.fn()}
				onOpenLogicLibrary={onOpenLogicLibrary}
				onOpenPlay={onOpenPlay}
			/>,
		);

		await user.click(screen.getByRole("button", {name: "Play"}));
		expect(onOpenPlay).toHaveBeenCalledTimes(1);

		await user.click(screen.getByText("Conditional text and outcomes"));
		const afterExamineRow = screen.getByText("After examine").closest(".itemAdvancedRow");
		expect(afterExamineRow).not.toBeNull();
		await user.click(within(afterExamineRow as HTMLElement).getByRole("button", {name: "Add"}));
		expect(onOpenLogicLibrary).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "effect",
				returnSection: "items",
				returnLabel: "Shop Counter · After examine",
				draftEditor: expect.any(Object),
			}),
		);
	});
});
