import {fireEvent, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {produce} from "immer";
import {useState} from "react";
import {ThemeProvider} from "@/components/theme/ThemeProvider";
import {PopupProvider} from "@/components/popup/Popup";
import {world as exampleWorld} from "@/data/worlds/exampleWorld";
import {
	NumberBlockSchema,
	PatternSchema,
	PhraseBlockSchema,
	RelationBlockSchema,
	TargetBlockSchema,
} from "@/schemas/world/commandSchemas";
import type {World} from "@/schemas/world/worldSchema";
import type {WorldUpdate} from "@/types/worldUpdaterTypes";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {idValue, toID} from "@/utils/idUtils";
import type {CommandSelection} from "../shared";
import {CommandEditor, CommandToolbar} from "./CommandEditor";
import {CommandBehaviorEditor} from "./CommandBehaviorEditor";
import {CommandInspector} from "./CommandInspector";
import {CommandLibrary, CommandLibraryPreview} from "./CommandLibrary";
import {commandPatternText} from "./CommandSummary";

function CommandHarness({onWorldChange}: {onWorldChange?: (world: World) => void}) {
	const initialCommand = exampleWorld.commands.find((command) => idValue(command.id) === "say")!;
	const [world, setWorld] = useState(exampleWorld);
	const [commandId, setCommandId] = useState(idValue(initialCommand.id));
	const [selection, setSelection] = useState<CommandSelection | null>({kind: "command", commandId});
	const updateWorld = (update: WorldUpdate) => {
		setWorld((current) => {
			const next = typeof update === "function" ? produce(current, update) : update;
			onWorldChange?.(next);
			return next;
		});
	};

	return (
		<CommandEditor
			world={world}
			updateWorld={updateWorld}
			selectedCommandId={commandId}
			onSelectedCommandIdChange={setCommandId}
			selection={selection}
			onSelectionChange={setSelection}
		/>
	);
}

describe("CommandEditor", () => {
	it("clones the preceding pattern with shared block identities and keeps block additions available", async () => {
		const user = userEvent.setup();
		let latestWorld = exampleWorld;
		render(<CommandHarness onWorldChange={(world) => void (latestWorld = world)} />);

		await user.click(screen.getByRole("button", {name: "Add pattern"}));

		expect(screen.getByText("2 of 2")).toBeInTheDocument();
		expect(document.querySelectorAll(".commandPattern")).toHaveLength(1);
		expect(screen.getByText("Pattern")).toBeInTheDocument();
		expect(
			screen.getByText("say <text>", {selector: ".commandPattern__caption span"}),
		).toBeInTheDocument();
		expect(screen.getByRole("button", {name: "Previous pattern"})).toBeEnabled();
		expect(screen.getByRole("button", {name: "Next pattern"})).toBeDisabled();

		fireEvent.keyDown(window, {key: "ArrowLeft"});
		expect(screen.getByText("1 of 2")).toBeInTheDocument();
		await user.click(screen.getByRole("button", {name: "Next pattern"}));
		expect(screen.getByText("2 of 2")).toBeInTheDocument();
		expect(screen.getByRole("button", {name: "Target"})).toBeEnabled();
		expect(screen.getByRole("button", {name: "Phrase"})).toBeEnabled();
		expect(
			screen.getByText("Structure", {selector: ".commandBlockBar__groupLabel"}),
		).toBeInTheDocument();
		expect(
			screen.getByText("Values", {selector: ".commandBlockBar__groupLabel"}),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", {name: "Add pattern"}).closest(".commandActions"),
		).not.toBeNull();

		const say = latestWorld.commands.find((command) => idValue(command.id) === "say")!;
		expect(say.patterns).toHaveLength(2);
		expect(say.patterns[1].blocks.map((block) => block.type)).toEqual(
			say.patterns[0].blocks.map((block) => block.type),
		);
		expect(say.patterns[1].blocks.map((block) => idValue(block.id))).toEqual(
			say.patterns[0].blocks.map((block) => idValue(block.id)),
		);
	});

	it("adds and deletes blocks immediately when there is only one pattern", async () => {
		const user = userEvent.setup();
		let latestWorld = exampleWorld;
		render(
			<PopupProvider>
				<CommandHarness onWorldChange={(world) => void (latestWorld = world)} />
			</PopupProvider>,
		);

		await user.click(screen.getByRole("button", {name: "Target"}));
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", {name: "Remove Phrase block"}));
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

		const say = latestWorld.commands.find((command) => idValue(command.id) === "say")!;
		expect(say.patterns[0].blocks.some((block) => block.type === "target")).toBe(true);
		expect(say.patterns[0].blocks.some((block) => block.type === "phrase")).toBe(false);
	});

	it("allows any pattern to be deleted while more than one remains", async () => {
		const user = userEvent.setup();
		let latestWorld = exampleWorld;
		render(<CommandHarness onWorldChange={(world) => void (latestWorld = world)} />);

		await user.click(screen.getByRole("button", {name: "Add pattern"}));
		fireEvent.keyDown(window, {key: "ArrowLeft"});

		expect(screen.getByRole("button", {name: "Remove pattern 1"})).toBeInTheDocument();
		await user.click(screen.getByRole("button", {name: "Remove pattern 1"}));

		const say = latestWorld.commands.find((command) => idValue(command.id) === "say")!;
		expect(say.patterns).toHaveLength(1);
		expect(screen.queryByRole("button", {name: /Remove pattern/})).not.toBeInTheDocument();
	});

	it("asks whether a structural block should be added to one pattern or all patterns", async () => {
		const user = userEvent.setup();
		let latestWorld = exampleWorld;
		render(
			<PopupProvider>
				<CommandHarness onWorldChange={(world) => void (latestWorld = world)} />
			</PopupProvider>,
		);

		await user.click(screen.getByRole("button", {name: "Add pattern"}));
		await user.click(screen.getByRole("button", {name: "Phrase"}));

		expect(screen.getByRole("button", {name: "Add to this pattern"})).toBeInTheDocument();
		expect(screen.getByRole("button", {name: "Add to all patterns"})).toBeInTheDocument();
		await user.click(screen.getByRole("button", {name: "Add to this pattern"}));

		const say = latestWorld.commands.find((command) => idValue(command.id) === "say")!;
		expect(say.patterns[0].blocks.filter((block) => block.type === "phrase")).toHaveLength(1);
		expect(say.patterns[1].blocks.filter((block) => block.type === "phrase")).toHaveLength(2);
	});

	it("confirms and adds a value block to every pattern", async () => {
		const user = userEvent.setup();
		let latestWorld = exampleWorld;
		render(
			<PopupProvider>
				<CommandHarness onWorldChange={(world) => void (latestWorld = world)} />
			</PopupProvider>,
		);

		await user.click(screen.getByRole("button", {name: "Add pattern"}));
		await user.click(screen.getByRole("button", {name: "Target"}));

		expect(screen.queryByRole("button", {name: "Add to this pattern"})).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", {name: "Add to all patterns"}));

		const say = latestWorld.commands.find((command) => idValue(command.id) === "say")!;
		const targets = say.patterns.map((pattern) =>
			pattern.blocks.find((block) => block.type === "target"),
		);
		expect(targets.every(Boolean)).toBe(true);
		expect(targets.map((block) => (block ? idValue(block.id) : null))).toEqual([
			idValue(targets[0]!.id),
			idValue(targets[0]!.id),
		]);
	});

	it("uses the command library as its only command selector", () => {
		const view = render(<CommandHarness />);

		expect(view.container.querySelector(".commandRail")).not.toBeInTheDocument();
		expect(screen.getByRole("button", {name: /Command behavior/})).toBeInTheDocument();
	});

	it("asks whether a structural block should be removed from one pattern or all patterns", async () => {
		const user = userEvent.setup();
		let latestWorld = exampleWorld;
		render(
			<PopupProvider>
				<CommandHarness onWorldChange={(world) => void (latestWorld = world)} />
			</PopupProvider>,
		);

		await user.click(screen.getByRole("button", {name: "Add pattern"}));
		await user.click(screen.getAllByRole("button", {name: "Remove Phrase block"})[0]);

		expect(screen.getByRole("button", {name: "Delete from this pattern"})).toBeInTheDocument();
		expect(screen.getByRole("button", {name: "Delete from all patterns"})).toBeInTheDocument();
		await user.click(screen.getByRole("button", {name: "Delete from this pattern"}));

		const say = latestWorld.commands.find((command) => idValue(command.id) === "say")!;
		expect(say.patterns[0].blocks.some((block) => block.type === "phrase")).toBe(true);
		expect(say.patterns[1].blocks.some((block) => block.type === "phrase")).toBe(false);
	});

	it("only allows a value block to be removed from all patterns", async () => {
		const user = userEvent.setup();
		let latestWorld = exampleWorld;
		render(
			<PopupProvider>
				<CommandHarness onWorldChange={(world) => void (latestWorld = world)} />
			</PopupProvider>,
		);

		await user.click(screen.getByRole("button", {name: "Add pattern"}));
		await user.click(screen.getAllByRole("button", {name: "Remove Text block"})[0]);

		expect(screen.queryByRole("button", {name: /this pattern/})).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", {name: "Delete from all patterns"}));

		const say = latestWorld.commands.find((command) => idValue(command.id) === "say")!;
		expect(
			say.patterns.every((pattern) => pattern.blocks.every((block) => block.type !== "text")),
		).toBe(true);
	});

	it("never renders internal block IDs", () => {
		render(<CommandHarness />);

		expect(screen.queryByText("say-verb")).not.toBeInTheDocument();
		expect(screen.queryByText("say-message")).not.toBeInTheDocument();
	});
});

describe("command presentation", () => {
	it("summarizes a pattern as one player-facing word per block", () => {
		const command = exampleWorld.commands.find((candidate) => idValue(candidate.id) === "say")!;

		expect(commandPatternText(command.patterns[0])).toBe("say <text>");
	});

	it("uses concrete structural words and concise value placeholders", () => {
		const phrase = {
			...createDefaultFieldObject(PhraseBlockSchema),
			id: toID("command-block", "verb"),
			matches: ["yell", "shout"],
		};
		const relation = {
			...createDefaultFieldObject(RelationBlockSchema),
			id: toID("command-block", "relation"),
			relation: "at" as const,
		};
		const target = {
			...createDefaultFieldObject(TargetBlockSchema),
			id: toID("command-block", "target"),
			role: "target",
		};
		const number = {
			...createDefaultFieldObject(NumberBlockSchema),
			id: toID("command-block", "number"),
			role: "number",
		};
		const yellPattern = {
			...createDefaultFieldObject(PatternSchema),
			blocks: [phrase, relation, target],
		};
		const foodPattern = {
			...createDefaultFieldObject(PatternSchema),
			blocks: [
				{...phrase, matches: ["eat", "devour"]},
				{...target, tags: ["food"]},
			],
		};
		const takePattern = {
			...createDefaultFieldObject(PatternSchema),
			blocks: [{...phrase, matches: ["take"]}, number, target],
		};

		expect(commandPatternText(yellPattern)).toBe("yell at <target>");
		expect(commandPatternText(foodPattern)).toBe("eat food");
		expect(commandPatternText(takePattern)).toBe("take <number> <target>");
	});

	it("shows the command library before editing a command", async () => {
		const user = userEvent.setup();
		const onOpenCommand = jest.fn();
		const onPreviewCommand = jest.fn();
		render(
			<CommandLibrary
				world={exampleWorld}
				updateWorld={jest.fn()}
				onOpenCommand={onOpenCommand}
				onPreviewCommand={onPreviewCommand}
			/>,
		);

		expect(screen.getByRole("heading", {name: "Commands"})).toBeInTheDocument();
		expect(screen.getAllByLabelText("say <text>").length).toBeGreaterThan(0);
		expect(screen.getByRole("button", {name: /Say something/})).toBeInTheDocument();
		fireEvent.mouseEnter(screen.getByRole("button", {name: /Say something/}));
		expect(onPreviewCommand).toHaveBeenCalledWith("say");
		await user.click(screen.getByRole("button", {name: /Say something/}));
		expect(onOpenCommand).toHaveBeenCalledWith("say");
	});

	it("shows unique pattern summaries in a bounded sidebar list", () => {
		const command = exampleWorld.commands.find((candidate) => idValue(candidate.id) === "say")!;
		const shout = exampleWorld.commands.find((candidate) => idValue(candidate.id) === "shout")!;
		const commandWithRepeatedPattern = {
			...command,
			patterns: [command.patterns[0], command.patterns[0], shout.patterns[0]],
		};

		render(<CommandLibraryPreview command={commandWithRepeatedPattern} onOpenCommand={jest.fn()} />);

		const summaries = screen.getByRole("list", {name: "Pattern summaries"});
		expect(summaries).toHaveClass("commandLibraryPreview__patterns");
		expect(screen.getByText("Pattern 1")).toBeInTheDocument();
		expect(screen.queryByText("Pattern 2")).not.toBeInTheDocument();
		expect(screen.getByText("Pattern 3")).toBeInTheDocument();
		expect(screen.getAllByLabelText("say <text>")).toHaveLength(1);
		expect(screen.getByLabelText("shout")).toBeInTheDocument();
	});

	it("opens command scope settings from the toolbar gear", async () => {
		const user = userEvent.setup();
		const command = exampleWorld.commands.find((candidate) => idValue(candidate.id) === "say")!;
		const onOpenSettings = jest.fn();

		render(
			<CommandToolbar
				command={command}
				updateWorld={jest.fn()}
				onBack={jest.fn()}
				onDelete={jest.fn()}
				onOpenSettings={onOpenSettings}
			/>,
		);

		await user.click(screen.getByRole("button", {name: "Global"}));
		expect(onOpenSettings).toHaveBeenCalledTimes(1);
	});
});

describe("CommandInspector", () => {
	it("updates every pattern occurrence of a shared block", () => {
		let latestWorld = produce(exampleWorld, (draft) => {
			const command = draft.commands.find((candidate) => idValue(candidate.id) === "wait-turns")!;
			command.patterns.push({blocks: command.patterns[0].blocks.map((block) => ({...block}))});
		});
		const command = latestWorld.commands.find((candidate) => idValue(candidate.id) === "wait-turns")!;
		const number = command.patterns[0].blocks.find((block) => block.type === "number")!;
		const updateWorld = (update: WorldUpdate) => {
			latestWorld = typeof update === "function" ? produce(latestWorld, update) : update;
		};

		render(
			<ThemeProvider>
				<CommandInspector
					world={latestWorld}
					updateWorld={updateWorld}
					selection={{
						kind: "block",
						commandId: "wait-turns",
						patternIndex: 0,
						blockId: idValue(number.id),
					}}
					onSelectionChange={jest.fn()}
				/>
			</ThemeProvider>,
		);

		fireEvent.change(screen.getByRole("textbox", {name: /Use as/}), {
			target: {value: "amount"},
		});

		const updated = latestWorld.commands.find((candidate) => idValue(candidate.id) === "wait-turns")!;
		expect(
			updated.patterns.map((pattern) => {
				const sharedBlock = pattern.blocks.find((block) => idValue(block.id) === idValue(number.id));
				return sharedBlock && "role" in sharedBlock ? sharedBlock.role : undefined;
			}),
		).toEqual(["amount", "amount"]);
	});

	it("gives target tags a dedicated inspector section", () => {
		const command = exampleWorld.commands.find(
			(candidate) => idValue(candidate.id) === "touch-target",
		)!;
		const target = command.patterns[0].blocks.find((block) => block.type === "target")!;

		render(
			<ThemeProvider>
				<CommandInspector
					world={exampleWorld}
					updateWorld={jest.fn()}
					selection={{
						kind: "block",
						commandId: "touch-target",
						patternIndex: 0,
						blockId: idValue(target.id),
					}}
					onSelectionChange={jest.fn()}
				/>
			</ThemeProvider>,
		);

		expect(screen.getByRole("heading", {name: "Target tags"})).toBeInTheDocument();
		expect(screen.getAllByText("Required tags")).toHaveLength(1);
	});

	it("preserves the inspector scroll position when the selected block updates", () => {
		const scrollTo = jest.spyOn(window, "scrollTo").mockImplementation(() => undefined);
		const command = exampleWorld.commands.find((candidate) => idValue(candidate.id) === "say")!;
		const text = command.patterns[0].blocks[1];
		const selection = {
			kind: "block" as const,
			commandId: "say",
			patternIndex: 0,
			blockId: idValue(text.id),
		};
		const view = render(
			<ThemeProvider>
				<CommandInspector
					world={exampleWorld}
					updateWorld={jest.fn()}
					selection={selection}
					onSelectionChange={jest.fn()}
				/>
			</ThemeProvider>,
		);
		scrollTo.mockClear();
		const updatedWorld = produce(exampleWorld, (draft) => {
			const block = draft.commands.find((candidate) => idValue(candidate.id) === "say")?.patterns[0]
				.blocks[1];
			if (block?.type === "text") block.mode = "phrase";
		});

		view.rerender(
			<ThemeProvider>
				<CommandInspector
					world={updatedWorld}
					updateWorld={jest.fn()}
					selection={selection}
					onSelectionChange={jest.fn()}
				/>
			</ThemeProvider>,
		);

		expect(scrollTo).not.toHaveBeenCalled();
		scrollTo.mockRestore();
	});

	it("only offers fallback behavior for non-structural blocks", () => {
		const command = exampleWorld.commands.find((candidate) => idValue(candidate.id) === "say")!;
		const phrase = command.patterns[0].blocks[0];
		const text = command.patterns[0].blocks[1];
		const updateWorld = jest.fn();
		const view = render(
			<ThemeProvider>
				<CommandInspector
					world={exampleWorld}
					updateWorld={updateWorld}
					selection={{
						kind: "block",
						commandId: "say",
						patternIndex: 0,
						blockId: idValue(phrase.id),
					}}
					onSelectionChange={jest.fn()}
				/>
			</ThemeProvider>,
		);

		expect(screen.queryByText("Fallback behavior")).not.toBeInTheDocument();

		view.rerender(
			<ThemeProvider>
				<CommandInspector
					world={exampleWorld}
					updateWorld={updateWorld}
					selection={{
						kind: "block",
						commandId: "say",
						patternIndex: 0,
						blockId: idValue(text.id),
					}}
					onSelectionChange={jest.fn()}
				/>
			</ThemeProvider>,
		);

		expect(screen.getByText("Fallback behavior")).toBeInTheDocument();
		expect(screen.getByRole("button", {name: "Edit fallback"})).toBeInTheDocument();
		expect(view.container.querySelector(".commandInspector")?.firstElementChild).toHaveClass(
			"commandInspector__fallback",
		);
	});

	it("keeps existing fallback branches out of the sidebar", () => {
		const command = exampleWorld.commands.find((candidate) => idValue(candidate.id) === "say")!;
		const text = command.patterns[0].blocks[1];

		render(
			<ThemeProvider>
				<CommandInspector
					world={exampleWorld}
					updateWorld={jest.fn()}
					selection={{
						kind: "fallback",
						commandId: "say",
						blockId: idValue(text.id),
					}}
					onSelectionChange={jest.fn()}
				/>
			</ThemeProvider>,
		);

		expect(
			screen.getByText("Select a branch condition or effect in the behavior workspace."),
		).toBeInTheDocument();
		expect(screen.queryByText(idValue(text.id))).not.toBeInTheDocument();
	});
});

describe("CommandBehaviorEditor", () => {
	it("hides behavior navigation when the command has no fallback-eligible blocks", () => {
		const command = exampleWorld.commands.find((candidate) => idValue(candidate.id) === "shout")!;

		render(
			<CommandBehaviorEditor
				world={exampleWorld}
				updateWorld={jest.fn()}
				command={command}
				selection={{kind: "behavior", commandId: "shout"}}
				onSelectionChange={jest.fn()}
			/>,
		);

		expect(screen.queryByRole("navigation", {name: "Command behaviors"})).not.toBeInTheDocument();
		expect(screen.getByRole("heading", {name: "Command behavior"})).toBeInTheDocument();
	});

	it("lists command behavior and every eligible block fallback in the behavior workspace", () => {
		const command = exampleWorld.commands.find((candidate) => idValue(candidate.id) === "say")!;

		const view = render(
			<CommandBehaviorEditor
				world={exampleWorld}
				updateWorld={jest.fn()}
				command={command}
				selection={{kind: "behavior", commandId: "say"}}
				onSelectionChange={jest.fn()}
			/>,
		);

		expect(screen.getByRole("navigation", {name: "Command behaviors"})).toBeInTheDocument();
		expect(
			screen.getByRole("button", {name: /Command behavior After a pattern matches/}),
		).toHaveClass("commandBehaviorTarget--active");
		expect(
			screen.getByRole("button", {name: /Command behavior After a pattern matches/}),
		).toHaveAttribute("aria-current", "page");
		expect(screen.getByRole("button", {name: /Text fallback.*Configured/})).toBeInTheDocument();
		expect(view.container.querySelector(".logicBranch")).toBeInTheDocument();
	});

	it("creates an unconfigured fallback when it is opened from the behavior workspace", async () => {
		const user = userEvent.setup();
		let latestWorld = produce(exampleWorld, (draft) => {
			const command = draft.commands.find((candidate) => idValue(candidate.id) === "say")!;
			command.fallbacks = [];
		});
		const command = latestWorld.commands.find((candidate) => idValue(candidate.id) === "say")!;
		const onSelectionChange = jest.fn();
		const updateWorld = (update: WorldUpdate) => {
			latestWorld = typeof update === "function" ? produce(latestWorld, update) : update;
		};

		render(
			<CommandBehaviorEditor
				world={latestWorld}
				updateWorld={updateWorld}
				command={command}
				selection={{kind: "behavior", commandId: "say"}}
				onSelectionChange={onSelectionChange}
			/>,
		);

		await user.click(screen.getByRole("button", {name: /Text fallback.*Add fallback/}));

		expect(
			latestWorld.commands.find((candidate) => idValue(candidate.id) === "say")?.fallbacks,
		).toHaveLength(1);
		expect(onSelectionChange).toHaveBeenCalledWith({
			kind: "fallback",
			commandId: "say",
			blockId: "say-message",
		});
	});

	it("renders a fallback with the shared event branch component", () => {
		const command = exampleWorld.commands.find((candidate) => idValue(candidate.id) === "say")!;
		const text = command.patterns[0].blocks[1];

		const view = render(
			<CommandBehaviorEditor
				world={exampleWorld}
				updateWorld={jest.fn()}
				command={command}
				selection={{kind: "fallback", commandId: "say", blockId: idValue(text.id)}}
				onSelectionChange={jest.fn()}
			/>,
		);

		expect(screen.getByRole("heading", {name: "Text fallback"})).toBeInTheDocument();
		expect(view.container.querySelector(".logicBranch")).toBeInTheDocument();
		expect(screen.queryByText(idValue(text.id))).not.toBeInTheDocument();
	});
});
