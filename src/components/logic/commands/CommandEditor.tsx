"use client";

import {
	ArrowLeft,
	CheckSquare,
	ChevronLeft,
	ChevronRight,
	Compass,
	Crosshair,
	GripVertical,
	Hash,
	Link2,
	ListChecks,
	Plus,
	Quote,
	Settings,
	TextCursorInput,
	Trash2,
	Workflow,
	type LucideIcon,
} from "lucide-react";
import {type CSSProperties, useEffect, useRef, useState} from "react";
import {entityColorFor} from "@/components/entity-picker/entityPickerColors";
import {useOptionalPopup} from "@/components/popup/Popup";
import {PopupTemplate} from "@/components/popup/template/PopupTemplate";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {generateUniqueId, idValue, toID} from "@/utils/idUtils";
import {
	BooleanBlockSchema,
	ChoiceBlockSchema,
	COMMAND_BLOCK_SCHEMAS,
	DirectionBlockSchema,
	NumberBlockSchema,
	PhraseBlockSchema,
	RelationBlockSchema,
	TargetBlockSchema,
	TextBlockSchema,
	type Command,
	type CommandBlock,
} from "@/schemas/world/commandSchemas";
import type {CommandConditionBranch} from "@/schemas/world/commandLogicSchemas";
import type {World} from "@/schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {getEditorMetadata} from "@/utils/editorMetadata";
import type {CommandSelection, OpenLogicLibraryRequest} from "../shared";
import {CommandBehaviorEditor} from "./CommandBehaviorEditor";
import {commandBlockWord, commandPatternText} from "./CommandSummary";
import "./CommandEditor.scss";

type BlockType = CommandBlock["type"];

type BlockDefinition = {
	type: BlockType;
	label: string;
	description: string;
	icon: LucideIcon;
	structural: boolean;
};

const COMMAND_BLOCK_ICONS: Record<BlockType, LucideIcon> = {
	phrase: Quote,
	relation: Link2,
	target: Crosshair,
	number: Hash,
	direction: Compass,
	boolean: CheckSquare,
	choice: ListChecks,
	text: TextCursorInput,
};

export const COMMAND_BLOCKS: BlockDefinition[] = COMMAND_BLOCK_SCHEMAS.map((schema) => {
	const value = createDefaultFieldObject(schema);
	const metadata = getEditorMetadata(schema);
	const commandBlock = metadata?.features?.commandBlock as {structural?: boolean} | undefined;
	return {
		type: value.type,
		label: metadata?.title ?? value.type,
		description: metadata?.description ?? "Command value",
		icon: COMMAND_BLOCK_ICONS[value.type],
		structural: commandBlock?.structural ?? false,
	};
});

export function isStructuralBlock(block: Pick<CommandBlock, "type">) {
	return blockDefinition(block.type).structural;
}

export function blockDefinition(type: BlockType) {
	return COMMAND_BLOCKS.find((definition) => definition.type === type)!;
}

function allCommandBlocks(command: Command) {
	return command.patterns.flatMap((pattern) => pattern.blocks);
}

function uniqueRole(command: Command, base: string) {
	const usedRoles = new Set(
		allCommandBlocks(command).flatMap((block) => ("role" in block ? [block.role] : [])),
	);
	let role = base;
	let suffix = 2;
	while (usedRoles.has(role)) role = `${base}${suffix++}`;
	return role;
}

function createBlock(type: BlockType, command: Command): CommandBlock {
	const id = generateUniqueId("command-block", allCommandBlocks(command));

	switch (type) {
		case "phrase":
			return {...createDefaultFieldObject(PhraseBlockSchema), id, matches: ["verb"]};
		case "relation":
			return {...createDefaultFieldObject(RelationBlockSchema), id, relation: "on"};
		case "target":
			return {...createDefaultFieldObject(TargetBlockSchema), id, role: uniqueRole(command, "target")};
		case "number":
			return {...createDefaultFieldObject(NumberBlockSchema), id, role: uniqueRole(command, "number")};
		case "boolean":
			return {
				...createDefaultFieldObject(BooleanBlockSchema),
				id,
				role: uniqueRole(command, "choice"),
			};
		case "direction":
			return {
				...createDefaultFieldObject(DirectionBlockSchema),
				id,
				role: uniqueRole(command, "direction"),
			};
		case "choice":
			return {
				...createDefaultFieldObject(ChoiceBlockSchema),
				id,
				role: uniqueRole(command, "choice"),
				choices: [{value: "option", label: "Option", matches: ["option"]}],
			};
		case "text":
			return {...createDefaultFieldObject(TextBlockSchema), id, role: uniqueRole(command, "text")};
	}
}

function commandBehavior(id: string, message: string): CommandConditionBranch {
	return {
		id: toID("condition-branch", `${id}-branch`),
		always: {
			id: toID("effect", `${id}-effect`),
			name: "Response",
			type: "group",
			effects: [{type: "message", operation: "show", message}],
			allowMultipleUsesInWorld: true,
		},
	};
}

export function createCommand(world: World): Command {
	const id = generateUniqueId("command", world.commands);
	const phraseId = generateUniqueId("command-block", []);
	return {
		id,
		name: "New command",
		enabled: true,
		showInHelp: false,
		helpPattern: "",
		helpDescription: "",
		patterns: [{blocks: [{id: phraseId, type: "phrase", matches: ["verb"]}]}],
		scope: {scope: "global"},
		priority: 0,
		fallbacks: [],
		behavior: commandBehavior(idValue(id), "The command succeeds."),
	};
}

function cloneValue<T>(value: T): T {
	return typeof structuredClone === "function"
		? structuredClone(value)
		: (JSON.parse(JSON.stringify(value)) as T);
}

function behaviorSummary(behavior: CommandConditionBranch) {
	const branches = [behavior.always, behavior.if, ...(behavior.elifs ?? []), behavior.else].filter(
		Boolean,
	);
	return branches.length === 1 ? "1 branch configured" : `${branches.length} branches configured`;
}

type CommandEditorProps = {
	world: World;
	updateWorld: UpdateWorld;
	selectedCommandId: string | null;
	onSelectedCommandIdChange: (commandId: string) => void;
	selection: CommandSelection | null;
	onSelectionChange: (selection: CommandSelection | null) => void;
	onOpenLogicLibrary?: (request: OpenLogicLibraryRequest) => void;
	onOpenInspector?: (selection: CommandSelection) => void;
};

export function CommandEditor({
	world,
	updateWorld,
	selectedCommandId,
	onSelectedCommandIdChange,
	selection,
	onSelectionChange,
	onOpenLogicLibrary,
	onOpenInspector,
}: CommandEditorProps) {
	const commands = world.commands;
	const selectedCommand =
		commands.find((command) => idValue(command.id) === selectedCommandId) ?? commands[0] ?? null;
	const [patternNavigation, setPatternNavigation] = useState({
		commandId: selectedCommandId,
		index: 0,
	});
	const dragIndex = useRef<number | null>(null);
	const dragPatternIndex = useRef<number | null>(null);
	const popup = useOptionalPopup();
	const patternCount = selectedCommand?.patterns.length ?? 0;
	const storedPatternIndex =
		patternNavigation.commandId === selectedCommandId ? patternNavigation.index : 0;
	const activePatternIndex = Math.min(storedPatternIndex, Math.max(0, patternCount - 1));
	function setActivePatternIndex(next: number | ((current: number) => number)) {
		setPatternNavigation((current) => {
			const currentIndex = current.commandId === selectedCommandId ? current.index : 0;
			return {
				commandId: selectedCommandId,
				index: typeof next === "function" ? next(currentIndex) : next,
			};
		});
	}
	const behaviorIsOpen =
		selection?.kind === "behavior" ||
		selection?.kind === "fallback" ||
		selection?.kind === "behavior-condition" ||
		selection?.kind === "behavior-effect";

	useEffect(() => {
		if (!selectedCommand || behaviorIsOpen || patternCount <= 1) return;

		function handlePatternKeyDown(event: KeyboardEvent) {
			if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
			const target = event.target;
			if (
				target instanceof HTMLElement &&
				(target.isContentEditable ||
					target.matches("input, textarea, select") ||
					target.closest('[role="dialog"]'))
			) {
				return;
			}

			const offset = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
			if (offset === 0) return;
			const nextIndex = Math.max(0, Math.min(patternCount - 1, activePatternIndex + offset));
			if (nextIndex === activePatternIndex) return;

			event.preventDefault();
			setPatternNavigation({commandId: selectedCommandId, index: nextIndex});
			onSelectionChange({kind: "command", commandId: idValue(selectedCommand.id)});
		}

		window.addEventListener("keydown", handlePatternKeyDown);
		return () => window.removeEventListener("keydown", handlePatternKeyDown);
	}, [
		activePatternIndex,
		behaviorIsOpen,
		onSelectionChange,
		patternCount,
		selectedCommand,
		selectedCommandId,
	]);

	function addCommand() {
		const command = createCommand(world);
		updateWorld((draft) => {
			draft.commands.push(command);
		});
		const commandId = idValue(command.id);
		onSelectedCommandIdChange(commandId);
		onSelectionChange({kind: "command", commandId});
		setActivePatternIndex(0);
	}

	function updateSelected(recipe: (command: Command) => void) {
		if (!selectedCommand) return;
		updateWorld((draft) => {
			const command = draft.commands.find(
				(candidate) => idValue(candidate.id) === idValue(selectedCommand.id),
			);
			if (command) recipe(command as Command);
		});
	}

	async function addBlock(type: BlockType) {
		if (!selectedCommand) return;
		const definition = blockDefinition(type);
		const hasMultiplePatterns = selectedCommand.patterns.length > 1;
		let additionScope: "pattern" | "all" | undefined = "pattern";

		if (hasMultiplePatterns && definition.structural) {
			additionScope = popup
				? await popup.open<"pattern" | "all">(
						({resolve, cancel}) => (
							<PopupTemplate
								title={`Add ${definition.label.toLowerCase()} block?`}
								message="Choose whether to add this structure to the current pattern or every pattern."
								actions={
									<>
										<button
											type="button"
											className="popupButton popupButtonSecondary"
											onClick={cancel}
											autoFocus
										>
											Cancel
										</button>
										<button
											type="button"
											className="popupButton popupButtonSecondary"
											onClick={() => resolve("pattern")}
										>
											Add to this pattern
										</button>
										<button
											type="button"
											className="popupButton popupButtonPrimary"
											onClick={() => resolve("all")}
										>
											Add to all patterns
										</button>
									</>
								}
							/>
						),
						{
							ariaLabel: `Add ${definition.label.toLowerCase()} block?`,
							closeOnBackdropClick: false,
							className: "popupSurfaceConfirm",
						},
					)
				: "pattern";
		} else if (hasMultiplePatterns) {
			const confirmed = popup
				? await popup.confirm({
						title: `Add ${definition.label.toLowerCase()} block to all patterns?`,
						message: "Value blocks are shared. This block will be added to every pattern in the command.",
						confirmLabel: "Add to all patterns",
					})
				: true;
			additionScope = confirmed ? "all" : undefined;
		}

		if (!additionScope) return;
		const block = createBlock(type, selectedCommand);
		updateSelected((command) => {
			if (additionScope === "all") {
				command.patterns.forEach((pattern) => pattern.blocks.push(cloneValue(block)));
			} else {
				command.patterns[activePatternIndex]?.blocks.push(block);
			}
		});
		const nextSelection: CommandSelection = {
			kind: "block",
			commandId: idValue(selectedCommand.id),
			patternIndex: activePatternIndex,
			blockId: idValue(block.id),
		};
		onSelectionChange(nextSelection);
		onOpenInspector?.(nextSelection);
	}

	async function removeBlock(patternIndex: number, blockIndex: number) {
		if (!selectedCommand) return;
		const block = selectedCommand.patterns[patternIndex]?.blocks[blockIndex];
		if (!block) return;
		const definition = blockDefinition(block.type);
		const hasMultiplePatterns = selectedCommand.patterns.length > 1;
		const removalScope = !hasMultiplePatterns
			? "all"
			: popup
				? await popup.open<"pattern" | "all">(
						({resolve, cancel}) => (
							<PopupTemplate
								title={`Delete ${definition.label.toLowerCase()} block?`}
								message={
									isStructuralBlock(block)
										? "Choose whether to remove this structure from the current pattern or every pattern that uses it."
										: "Value blocks are shared by every pattern and can only be removed from the whole command."
								}
								actions={
									<>
										<button
											type="button"
											className="popupButton popupButtonSecondary"
											onClick={cancel}
											autoFocus
										>
											Cancel
										</button>
										{isStructuralBlock(block) ? (
											<button
												type="button"
												className="popupButton popupButtonSecondary"
												onClick={() => resolve("pattern")}
											>
												Delete from this pattern
											</button>
										) : null}
										<button
											type="button"
											className="popupButton popupButtonDanger"
											onClick={() => resolve("all")}
										>
											Delete from all patterns
										</button>
									</>
								}
							/>
						),
						{
							ariaLabel: `Delete ${definition.label.toLowerCase()} block?`,
							closeOnBackdropClick: false,
							className: "popupSurfaceConfirm",
						},
					)
				: isStructuralBlock(block)
					? "pattern"
					: "all";
		if (!removalScope) return;
		const removedId = idValue(block.id);
		updateSelected((command) => {
			if (removalScope === "all") {
				command.patterns.forEach((pattern) => {
					pattern.blocks = pattern.blocks.filter((candidate) => idValue(candidate.id) !== removedId);
				});
				command.fallbacks = command.fallbacks.filter(
					(fallback) => idValue(fallback.blockId) !== removedId,
				);
			} else {
				command.patterns[patternIndex]?.blocks.splice(blockIndex, 1);
			}
		});
		onSelectionChange({kind: "command", commandId: idValue(selectedCommand.id)});
	}

	function addPattern() {
		if (!selectedCommand) return;
		const source = selectedCommand.patterns[activePatternIndex];
		if (!source) return;
		const clonedBlocks = source.blocks.map((block) => cloneValue(block));
		const nextIndex = selectedCommand.patterns.length;
		updateSelected((command) => {
			command.patterns.push({blocks: clonedBlocks});
		});
		setActivePatternIndex(nextIndex);
	}

	function removePattern(patternIndex: number) {
		if (!selectedCommand || selectedCommand.patterns.length <= 1) return;
		updateSelected((command) => {
			command.patterns.splice(patternIndex, 1);
			const remainingBlockIds = new Set(
				command.patterns.flatMap((pattern) => pattern.blocks.map((block) => idValue(block.id))),
			);
			command.fallbacks = command.fallbacks.filter((fallback) =>
				remainingBlockIds.has(idValue(fallback.blockId)),
			);
		});
		setActivePatternIndex(Math.max(0, patternIndex - 1));
		onSelectionChange({kind: "command", commandId: idValue(selectedCommand.id)});
	}

	function moveBlock(patternIndex: number, fromIndex: number, toIndex: number) {
		if (fromIndex === toIndex) return;
		updateSelected((command) => {
			const blocks = command.patterns[patternIndex]?.blocks;
			if (!blocks) return;
			const [block] = blocks.splice(fromIndex, 1);
			if (block) blocks.splice(toIndex, 0, block);
		});
	}

	if (!selectedCommand) {
		return (
			<div className="logicEmpty">
				<p>No commands yet.</p>
				<button type="button" onClick={addCommand}>
					<Plus size={16} aria-hidden="true" />
					New command
				</button>
			</div>
		);
	}

	const commandId = idValue(selectedCommand.id);
	const commandColor = entityColorFor("command");
	const commandStyle = {
		"--logic-command-color-dark": commandColor.dark,
		"--logic-command-color-light": commandColor.light,
	} as CSSProperties;
	return (
		<div className="commandEditor" style={commandStyle}>
			{behaviorIsOpen && selection ? (
				<CommandBehaviorEditor
					world={world}
					updateWorld={updateWorld}
					command={selectedCommand}
					selection={selection}
					onSelectionChange={onSelectionChange}
					onOpenLogicLibrary={onOpenLogicLibrary}
				/>
			) : (
				<div className="commandBuilder">
					<div className="commandBuilderDock">
						<div className="commandActions" aria-label="Command actions">
							<button
								type="button"
								className="commandActions__behavior"
								onClick={() => onSelectionChange({kind: "behavior", commandId})}
							>
								<span className="commandActions__behaviorIcon" aria-hidden="true">
									<Workflow size={16} />
								</span>
								<span className="commandActions__behaviorCopy">
									<strong>Command behavior</strong>
									<small>{behaviorSummary(selectedCommand.behavior)}</small>
								</span>
								<ChevronRight className="commandActions__behaviorArrow" size={15} aria-hidden="true" />
							</button>
							<button type="button" className="commandActions__addPattern" onClick={addPattern}>
								<Plus size={15} aria-hidden="true" />
								Add pattern
							</button>
						</div>
						<div className="commandBlockBar" role="toolbar" aria-label="Add a command block">
							<div className="commandBlockBar__heading">
								<strong>Add block</strong>
							</div>
							<div className="commandBlockBar__groups">
								{[
									{
										label: "Structure",
										definitions: COMMAND_BLOCKS.filter((definition) => definition.structural),
									},
									{
										label: "Values",
										definitions: COMMAND_BLOCKS.filter((definition) => !definition.structural),
									},
								].map((group) => (
									<div className="commandBlockBar__group" key={group.label}>
										<span className="commandBlockBar__groupLabel">{group.label}</span>
										<div className="commandBlockBar__blocks">
											{group.definitions.map((definition) => {
												const Icon = definition.icon;
												return (
													<button
														type="button"
														key={definition.type}
														className={`commandBlockChoice commandColor--${definition.type}`}
														title={definition.description}
														onClick={() => void addBlock(definition.type)}
													>
														<Icon size={14} aria-hidden="true" />
														{definition.label}
													</button>
												);
											})}
										</div>
									</div>
								))}
							</div>
						</div>
					</div>

					<div className="commandPatterns">
						{selectedCommand.patterns
							.slice(activePatternIndex, activePatternIndex + 1)
							.map((pattern, visiblePatternIndex) => {
								const patternIndex = activePatternIndex + visiblePatternIndex;
								return (
									<section className="commandPattern" key={patternIndex}>
										<div className="commandPattern__caption">
											<strong>Pattern</strong>
											<span>{commandPatternText(pattern)}</span>
										</div>
										<div className="commandPattern__overlay">
											{patternCount > 1 ? (
												<button
													type="button"
													className="commandPattern__removePattern"
													aria-label={`Remove pattern ${patternIndex + 1}`}
													onClick={() => removePattern(patternIndex)}
												>
													<Trash2 size={14} aria-hidden="true" />
												</button>
											) : null}
											<nav className="commandPatternNavigation" aria-label="Pattern navigation">
												<button
													type="button"
													aria-label="Previous pattern"
													disabled={activePatternIndex === 0}
													onClick={() => {
														setActivePatternIndex((current) => Math.max(0, current - 1));
														onSelectionChange({kind: "command", commandId});
													}}
												>
													<ChevronLeft size={15} aria-hidden="true" />
												</button>
												<span>
													{activePatternIndex + 1} of {patternCount}
												</span>
												<button
													type="button"
													aria-label="Next pattern"
													disabled={activePatternIndex >= patternCount - 1}
													onClick={() => {
														setActivePatternIndex((current) => Math.min(patternCount - 1, current + 1));
														onSelectionChange({kind: "command", commandId});
													}}
												>
													<ChevronRight size={15} aria-hidden="true" />
												</button>
											</nav>
										</div>
										<div className="commandPattern__blocks">
											{pattern.blocks.length === 0 ? (
												<p className="commandPattern__empty">Add a phrase or value block above.</p>
											) : (
												pattern.blocks.map((block, blockIndex) => {
													const definition = blockDefinition(block.type);
													const blockId = idValue(block.id);
													const selected =
														selection?.kind === "block" &&
														selection.patternIndex === patternIndex &&
														selection.blockId === blockId;
													const hasFallback = selectedCommand.fallbacks.some(
														(fallback) => idValue(fallback.blockId) === blockId,
													);
													return (
														<div
															className={`commandBlock commandColor--${block.type} ${selected ? "commandBlock--selected" : ""}`}
															key={blockId}
															draggable={true}
															onDragStart={(event) => {
																event.dataTransfer.effectAllowed = "move";
																event.dataTransfer.setData("text/plain", String(blockIndex));
																dragIndex.current = blockIndex;
																dragPatternIndex.current = patternIndex;
															}}
															onDragOver={(event) => {
																event.preventDefault();
																if (dragPatternIndex.current !== patternIndex || dragIndex.current == null) return;
																moveBlock(patternIndex, dragIndex.current, blockIndex);
																dragIndex.current = blockIndex;
															}}
															onDragEnd={() => {
																dragIndex.current = null;
																dragPatternIndex.current = null;
															}}
														>
															<span className="commandBlock__grip" aria-hidden="true">
																<GripVertical size={13} />
															</span>
															<button
																type="button"
																className="commandBlock__select"
																onClick={(event) => {
																	event.stopPropagation();
																	setActivePatternIndex(patternIndex);
																	const nextSelection: CommandSelection = {
																		kind: "block",
																		commandId,
																		patternIndex,
																		blockId,
																	};
																	onSelectionChange(nextSelection);
																	onOpenInspector?.(nextSelection);
																}}
															>
																<span>
																	<small>{definition.label}</small>
																	<strong>{commandBlockWord(block)}</strong>
																</span>
																{hasFallback ? (
																	<span className="commandBlock__fallback" title="Fallback configured">
																		Fallback
																	</span>
																) : null}
															</button>
															<button
																type="button"
																className="commandBlock__remove"
																aria-label={`Remove ${definition.label} block`}
																onClick={(event) => {
																	event.stopPropagation();
																	void removeBlock(patternIndex, blockIndex);
																}}
															>
																<Trash2 size={13} aria-hidden="true" />
															</button>
														</div>
													);
												})
											)}
										</div>
									</section>
								);
							})}
					</div>
				</div>
			)}
		</div>
	);
}

export function CommandToolbar({
	command,
	onBack,
	onDelete,
	onOpenSettings,
}: {
	command: Command | null;
	onBack: () => void;
	onDelete: () => void;
	onOpenSettings?: () => void;
}) {
	const popup = useOptionalPopup();

	if (!command) {
		return (
			<div className="editorToolbar logicToolbar">
				<button
					type="button"
					className="logicToolbar__back"
					onClick={onBack}
					aria-label="Back to Logic"
				>
					<ArrowLeft size={16} aria-hidden="true" />
				</button>
				<p className="editorToolbarTitle">Commands</p>
			</div>
		);
	}
	const activeCommand = command;

	async function requestDelete() {
		const confirmed = popup
			? await popup.confirm({
					title: "Delete command?",
					message: `Delete “${activeCommand.name}” and all of its patterns and behavior? This cannot be undone.`,
					confirmLabel: "Delete command",
					danger: true,
				})
			: true;
		if (confirmed) onDelete();
	}

	return (
		<div className="editorToolbar logicToolbar commandToolbar">
			<button
				type="button"
				className="logicToolbar__back"
				onClick={onBack}
				aria-label="Back to Commands"
			>
				<ArrowLeft size={16} aria-hidden="true" />
			</button>
			<div className="logicToolbar__identity">
				<p>{command.name || "Unnamed command"}</p>
				<span>{command.enabled ? "Enabled" : "Disabled"}</span>
			</div>
			<button
				type="button"
				className="commandToolbar__scope"
				onClick={onOpenSettings}
				aria-label="Edit command"
			>
				<Settings size={14} aria-hidden="true" />
				<span>Edit command</span>
			</button>
			<button
				type="button"
				className="logicToolbar__delete"
				onClick={() => void requestDelete()}
				aria-label="Delete command"
			>
				<Trash2 size={15} aria-hidden="true" />
				<span>Delete</span>
			</button>
		</div>
	);
}
