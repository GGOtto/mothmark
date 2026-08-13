"use client";

import {ArrowLeft, Plus, Workflow} from "lucide-react";
import {produce} from "immer";
import {useLayoutEffect, useRef} from "react";
import {useOptionalPopup} from "@/components/popup/Popup";
import {EffectBranch} from "@/components/logic/shared/EffectBranch";
import {buildCommandVariableCatalog} from "@/features/command-variables";
import {
	CommandEffectGroupSchema,
	type CommandConditionBranch,
	type CommandEffectGroup,
} from "@/schemas/world/commandLogicSchemas";
import type {Command, CommandBlock} from "@/schemas/world/commandSchemas";
import type {World} from "@/schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {idValue, toID} from "@/utils/idUtils";
import type {CommandSelection, OpenLogicLibraryRequest} from "../shared";
import {CommandConditionEditorSchema} from "../shared/logicEditorSchemas";
import {commandBlockWord} from "./CommandSummary";
import {createBlockFallbackBehavior} from "./commandFallback";

type BranchKey = "always" | "if" | "elif" | "else";
type BehaviorTarget = {kind: "command"} | {kind: "fallback"; blockId: string};

function targetFromSelection(selection: CommandSelection): BehaviorTarget | null {
	if (selection.kind === "behavior") return {kind: "command"};
	if (selection.kind === "fallback") return {kind: "fallback", blockId: selection.blockId};
	if (selection.kind === "behavior-condition" || selection.kind === "behavior-effect") {
		return selection.behavior === "fallback" && selection.blockId
			? {kind: "fallback", blockId: selection.blockId}
			: {kind: "command"};
	}
	return null;
}

function behaviorFor(command: Command, target: BehaviorTarget) {
	if (target.kind === "command") return command.behavior;
	return command.fallbacks.find((fallback) => idValue(fallback.blockId) === target.blockId)
		?.behavior;
}

function blockFor(command: Command, blockId: string) {
	for (const [patternIndex, pattern] of command.patterns.entries()) {
		const block = pattern.blocks.find((candidate) => idValue(candidate.id) === blockId);
		if (block) return {block, patternIndex};
	}
}

function fallbackBlocks(command: Command) {
	const seen = new Set<string>();
	return command.patterns.flatMap((pattern) =>
		pattern.blocks.filter((block) => {
			if (block.type === "phrase" || block.type === "relation") return false;
			const blockId = idValue(block.id);
			if (seen.has(blockId)) return false;
			seen.add(blockId);
			return true;
		}),
	);
}

function emptyGroup(commandId: string, label: string): CommandEffectGroup {
	return {
		id: toID("effect", `${commandId}-${label.toLocaleLowerCase().replaceAll(" ", "-")}`),
		name: label,
		type: "group",
		effects: [],
		allowMultipleUsesInWorld: true,
	};
}

function defaultCondition(): NonNullable<CommandConditionBranch["if"]>["condition"] {
	return {type: "group", operation: "all", conditions: []};
}

function branchGroup(behavior: CommandConditionBranch, branch: BranchKey, elifIndex?: number) {
	if (branch === "always") return behavior.always;
	if (branch === "if") return behavior.if?.effect;
	if (branch === "else") return behavior.else;
	return behavior.elifs?.[elifIndex ?? -1]?.effect;
}

function branchCondition(
	behavior: CommandConditionBranch,
	branch: "if" | "elif",
	elifIndex?: number,
) {
	return branch === "if" ? behavior.if?.condition : behavior.elifs?.[elifIndex ?? -1]?.condition;
}

function fallbackTitle(block: CommandBlock | undefined) {
	if (!block) return "Fallback behavior";
	return `${block.type.charAt(0).toLocaleUpperCase()}${block.type.slice(1)} fallback`;
}

export function CommandBehaviorEditor({
	world,
	updateWorld,
	command,
	selection,
	onSelectionChange,
	onOpenLogicLibrary,
}: {
	world: World;
	updateWorld: UpdateWorld;
	command: Command;
	selection: CommandSelection;
	onSelectionChange: (selection: CommandSelection | null) => void;
	onOpenLogicLibrary?: (request: OpenLogicLibraryRequest) => void;
}) {
	const popup = useOptionalPopup();
	const target = targetFromSelection(selection);
	const behavior = target ? behaviorFor(command, target) : undefined;
	const fallbackLocation =
		target?.kind === "fallback" ? blockFor(command, target.blockId) : undefined;
	const treeRef = useRef<HTMLDivElement>(null);
	const pendingBranchScrollRef = useRef<string | null>(null);
	const availableFallbackBlocks = fallbackBlocks(command);

	useLayoutEffect(() => {
		const key = pendingBranchScrollRef.current;
		const tree = treeRef.current;
		if (!key || !tree) return;
		const branch = tree.querySelector<HTMLElement>(`[data-branch-scroll-key="${key}"]`);
		if (!branch) return;
		pendingBranchScrollRef.current = null;
		branch.scrollIntoView({block: "nearest", behavior: "smooth"});
	}, [behavior?.always, behavior?.if, behavior?.elifs?.length, behavior?.else]);

	if (!target || !behavior) return <p className="logicEmpty">Behavior not found.</p>;

	const commandId = idValue(command.id);
	function updateBehavior(recipe: (draft: CommandConditionBranch) => void) {
		updateWorld((draft) => {
			const nextCommand = draft.commands.find((candidate) => idValue(candidate.id) === commandId);
			if (!nextCommand) return;
			const nextBehavior =
				target!.kind === "command"
					? nextCommand.behavior
					: nextCommand.fallbacks.find((fallback) => idValue(fallback.blockId) === target!.blockId)
							?.behavior;
			if (nextBehavior) recipe(nextBehavior);
		});
	}

	function worldWithBehaviorUpdate(recipe: (draft: CommandConditionBranch) => void) {
		return produce(world, (draft) => {
			const nextCommand = draft.commands.find((candidate) => idValue(candidate.id) === commandId);
			if (!nextCommand) return;
			const nextBehavior =
				target!.kind === "command"
					? nextCommand.behavior
					: nextCommand.fallbacks.find((fallback) => idValue(fallback.blockId) === target!.blockId)
							?.behavior;
			if (nextBehavior) recipe(nextBehavior);
		});
	}

	function editCondition(
		branch: "if" | "elif",
		elifIndex?: number,
		value = branchCondition(behavior!, branch, elifIndex),
		onCancel?: () => void,
	) {
		if (!value) return;
		const currentReference =
			value.conditions.length === 1 && value.conditions[0]?.type === "condition-ref"
				? idValue(value.conditions[0].conditionId)
				: null;
		const failedBlockId =
			target!.kind === "fallback" ? toID("command-block", target!.blockId) : undefined;
		onOpenLogicLibrary?.({
			kind: "condition",
			returnSection: "commands",
			selectedId: currentReference,
			returnLabel: `${command.name || "Command"} · ${branch === "if" ? "If" : "Else if"} condition`,
			onCancel,
			draftEditor: currentReference
				? undefined
				: {
						schema: CommandConditionEditorSchema,
						value,
						commandVariableCatalog: buildCommandVariableCatalog(command, failedBlockId),
						onDone: (draftValue) => {
							const condition = CommandConditionEditorSchema.parse(draftValue);
							updateBehavior((next) => {
								if (branch === "if" && next.if) next.if.condition = condition;
								else if (branch === "elif" && next.elifs?.[elifIndex ?? -1]) {
									next.elifs[elifIndex ?? -1].condition = condition;
								}
							});
						},
					},
			onDone: (conditionId) => {
				updateBehavior((next) => {
					const condition = {
						type: "group" as const,
						operation: "all" as const,
						conditions: [{type: "condition-ref" as const, conditionId: toID("condition", conditionId)}],
					};
					if (branch === "if" && next.if) next.if.condition = condition;
					else if (branch === "elif" && next.elifs?.[elifIndex ?? -1]) {
						next.elifs[elifIndex ?? -1].condition = condition;
					}
				});
			},
		});
	}

	function editEffectReference(effectId: string) {
		onOpenLogicLibrary?.({
			kind: "effect",
			returnSection: "commands",
			selectedId: effectId,
			returnLabel: `${command.name || "Command"} · Effect`,
			onDone: () => undefined,
		});
	}

	function addEffect(branch: BranchKey, elifIndex?: number) {
		const group = branchGroup(behavior!, branch, elifIndex);
		if (!group) return;
		const failedBlockId =
			target!.kind === "fallback" ? toID("command-block", target!.blockId) : undefined;
		onOpenLogicLibrary?.({
			kind: "effect",
			returnSection: "commands",
			selectedId: null,
			returnLabel: `${command.name || "Command"} · ${branch === "elif" ? "Else if" : branch} effects`,
			draftEditor: {
				schema: CommandEffectGroupSchema,
				value: group,
				commandVariableCatalog: buildCommandVariableCatalog(command, failedBlockId),
				onDone: (draftValue) => {
					const nextGroup = CommandEffectGroupSchema.parse(draftValue);
					updateBehavior((next) => {
						if (branch === "always") next.always = nextGroup;
						else if (branch === "if" && next.if) next.if.effect = nextGroup;
						else if (branch === "else") next.else = nextGroup;
						else if (branch === "elif" && next.elifs?.[elifIndex ?? -1]) {
							next.elifs[elifIndex ?? -1].effect = nextGroup;
						}
					});
				},
			},
			onDone: (effectId) => {
				updateBehavior((next) => {
					branchGroup(next, branch, elifIndex)?.effects.push({
						type: "effect-ref",
						effectId: toID("effect", effectId),
					});
				});
			},
		});
	}

	function editInlineEffect(branch: BranchKey, index: number, elifIndex?: number) {
		const group = branchGroup(behavior!, branch, elifIndex);
		if (!group) return;
		const failedBlockId =
			target!.kind === "fallback" ? toID("command-block", target!.blockId) : undefined;
		onOpenLogicLibrary?.({
			kind: "effect",
			returnSection: "commands",
			selectedId: null,
			returnLabel: `${command.name || "Command"} · Edit effects`,
			draftEditor: {
				schema: CommandEffectGroupSchema,
				value: group,
				commandVariableCatalog: buildCommandVariableCatalog(command, failedBlockId),
				onDone: (draftValue) => {
					const nextGroup = CommandEffectGroupSchema.parse(draftValue);
					updateBehavior((next) => {
						if (branch === "always") next.always = nextGroup;
						else if (branch === "if" && next.if) next.if.effect = nextGroup;
						else if (branch === "else") next.else = nextGroup;
						else if (branch === "elif" && next.elifs?.[elifIndex ?? -1]) {
							next.elifs[elifIndex ?? -1].effect = nextGroup;
						}
					});
				},
			},
			onDone: (effectId) => {
				updateBehavior((next) => {
					const effects = branchGroup(next, branch, elifIndex)?.effects;
					if (effects?.[index]) {
						effects[index] = {type: "effect-ref", effectId: toID("effect", effectId)};
					}
				});
			},
		});
	}

	function removeEffect(branch: BranchKey, index: number, elifIndex?: number) {
		updateBehavior((next) => branchGroup(next, branch, elifIndex)?.effects.splice(index, 1));
	}

	function moveEffect(branch: BranchKey, from: number, to: number, elifIndex?: number) {
		updateBehavior((next) => {
			const effects = branchGroup(next, branch, elifIndex)?.effects;
			if (!effects) return;
			const [moved] = effects.splice(from, 1);
			if (moved) effects.splice(to, 0, moved);
		});
	}

	async function deleteBranch(label: string, recipe: (next: CommandConditionBranch) => void) {
		const confirmed = popup
			? await popup.confirm({
					title: `Delete ${label.toLocaleLowerCase()} branch?`,
					message: `Remove this branch from ${target!.kind === "command" ? `“${command.name}”` : "this fallback"}?`,
					confirmLabel: "Delete branch",
					danger: true,
				})
			: true;
		if (confirmed) updateBehavior(recipe);
	}

	function backToPatterns() {
		if (target!.kind === "fallback" && fallbackLocation) {
			onSelectionChange({
				kind: "block",
				commandId,
				patternIndex: fallbackLocation.patternIndex,
				blockId: target!.blockId,
			});
		} else {
			onSelectionChange({kind: "command", commandId});
		}
	}

	function openCommandBehavior() {
		onSelectionChange({kind: "behavior", commandId});
	}

	function openFallbackBehavior(block: CommandBlock) {
		const blockId = idValue(block.id);
		const configured = command.fallbacks.some((fallback) => idValue(fallback.blockId) === blockId);
		if (!configured) {
			updateWorld((draft) => {
				const nextCommand = draft.commands.find((candidate) => idValue(candidate.id) === commandId);
				if (!nextCommand) return;
				nextCommand.fallbacks.push({
					blockId: block.id,
					behavior: createBlockFallbackBehavior(block),
				});
			});
		}
		onSelectionChange({kind: "fallback", commandId, blockId});
	}

	const title =
		target.kind === "command" ? "Command behavior" : fallbackTitle(fallbackLocation?.block);

	return (
		<div
			className={`commandBehaviorWorkspace ${availableFallbackBlocks.length > 0 ? "commandBehaviorWorkspace--withTargets" : ""}`}
		>
			<header className="commandBehaviorWorkspace__header">
				<button type="button" onClick={backToPatterns}>
					<ArrowLeft size={14} aria-hidden="true" /> Patterns
				</button>
				<div>
					<p>{target.kind === "command" ? command.name : "Fallback behavior"}</p>
					<h2>{title}</h2>
				</div>
			</header>

			{availableFallbackBlocks.length > 0 ? (
				<nav className="commandBehaviorWorkspace__targets" aria-label="Command behaviors">
					<button
						type="button"
						className={`commandBehaviorTarget ${target.kind === "command" ? "commandBehaviorTarget--active" : ""}`}
						aria-current={target.kind === "command" ? "page" : undefined}
						onClick={openCommandBehavior}
					>
						<span className="commandBehaviorTarget__icon" aria-hidden="true">
							<Workflow size={15} />
						</span>
						<span>
							<strong>Command behavior</strong>
							<small>After a pattern matches</small>
						</span>
					</button>
					{availableFallbackBlocks.map((block) => {
						const blockId = idValue(block.id);
						const configured = command.fallbacks.some(
							(fallback) => idValue(fallback.blockId) === blockId,
						);
						const active = target.kind === "fallback" && target.blockId === blockId;
						return (
							<button
								type="button"
								key={blockId}
								className={`commandBehaviorTarget commandBehaviorTarget--fallback commandColor--${block.type} ${active ? "commandBehaviorTarget--active" : ""}`}
								aria-current={active ? "page" : undefined}
								onClick={() => openFallbackBehavior(block)}
							>
								<span className="commandBehaviorTarget__marker" aria-hidden="true" />
								<span>
									<strong>{fallbackTitle(block)}</strong>
									<small>
										{commandBlockWord(block)} · {configured ? "Configured" : "Add fallback"}
									</small>
								</span>
								{!configured ? <Plus size={13} aria-hidden="true" /> : null}
							</button>
						);
					})}
				</nav>
			) : null}

			<div className="commandBehaviorWorkspace__tree" ref={treeRef}>
				<div className="logicTree__branchToolbar" role="toolbar" aria-label="Add a branch">
					<span className="logicTree__branchToolbarLabel">Add branch</span>
					<div className="logicTree__branchToolbarActions">
						{!behavior.always ? (
							<button
								type="button"
								onClick={() => {
									pendingBranchScrollRef.current = "always";
									updateBehavior((next) => void (next.always = emptyGroup(commandId, "Always")));
								}}
							>
								<Plus size={15} />
								<span>
									<strong>Always</strong>
									<small>Runs every time</small>
								</span>
							</button>
						) : null}
						{!behavior.if ? (
							<button
								type="button"
								onClick={() => {
									const condition = defaultCondition();
									pendingBranchScrollRef.current = "if";
									const editorWorld = worldWithBehaviorUpdate(
										(next) =>
											void (next.if = {
												condition,
												effect: emptyGroup(commandId, "If"),
												delayTurns: 0,
												cancelIfConditionFails: true,
											}),
									);
									updateWorld(editorWorld);
									editCondition("if", undefined, condition, () =>
										updateBehavior((next) => {
											delete next.if;
										}),
									);
								}}
							>
								<Plus size={15} />
								<span>
									<strong>If</strong>
									<small>When a condition passes</small>
								</span>
							</button>
						) : (
							<button
								type="button"
								onClick={() => {
									const index = behavior.elifs?.length ?? 0;
									const condition = defaultCondition();
									pendingBranchScrollRef.current = `elif-${index}`;
									const editorWorld = worldWithBehaviorUpdate(
										(next) =>
											void (next.elifs ??= []).push({
												condition,
												effect: emptyGroup(commandId, `Else if ${index + 1}`),
												delayTurns: 0,
												cancelIfConditionFails: true,
											}),
									);
									updateWorld(editorWorld);
									editCondition("elif", index, condition, () =>
										updateBehavior((next) => {
											next.elifs?.splice(index, 1);
										}),
									);
								}}
							>
								<Plus size={15} />
								<span>
									<strong>Else if</strong>
									<small>Try another condition</small>
								</span>
							</button>
						)}
						{behavior.if && !behavior.else ? (
							<button
								type="button"
								onClick={() => {
									pendingBranchScrollRef.current = "else";
									updateBehavior((next) => void (next.else = emptyGroup(commandId, "Else")));
								}}
							>
								<Plus size={15} />
								<span>
									<strong>Else</strong>
									<small>When no conditions pass</small>
								</span>
							</button>
						) : null}
					</div>
				</div>

				{behavior.always ? (
					<EffectBranch
						scrollKey="always"
						label="Always"
						world={world}
						group={behavior.always}
						onSelectGroup={editEffectReference}
						onSelectInlineEffect={(index) => editInlineEffect("always", index)}
						onAddEffect={() => addEffect("always")}
						onRemoveEffect={(index) => removeEffect("always", index)}
						onMoveEffect={(from, to) => moveEffect("always", from, to)}
						onDeleteBranch={() => void deleteBranch("Always", (next) => void delete next.always)}
					/>
				) : null}
				{behavior.if ? (
					<EffectBranch
						scrollKey="if"
						label="If"
						world={world}
						group={behavior.if.effect}
						condition={behavior.if.condition}
						delayTurns={behavior.if.delayTurns}
						cancelIfConditionFails={behavior.if.cancelIfConditionFails}
						onSelectCondition={() => editCondition("if")}
						onDelayEnabledChange={(enabled) =>
							updateBehavior((next) => {
								if (next.if) next.if.delayTurns = enabled ? 1 : 0;
							})
						}
						onDelayTurnsChange={(turns) =>
							updateBehavior((next) => {
								if (next.if) next.if.delayTurns = turns;
							})
						}
						onCancelIfConditionFailsChange={(cancel) =>
							updateBehavior((next) => {
								if (next.if) next.if.cancelIfConditionFails = cancel;
							})
						}
						onSelectGroup={editEffectReference}
						onSelectInlineEffect={(index) => editInlineEffect("if", index)}
						onAddEffect={() => addEffect("if")}
						onRemoveEffect={(index) => removeEffect("if", index)}
						onMoveEffect={(from, to) => moveEffect("if", from, to)}
						onDeleteBranch={() =>
							void deleteBranch("If", (next) => {
								delete next.if;
								delete next.elifs;
								delete next.else;
							})
						}
					/>
				) : null}
				{behavior.elifs?.map((branch, index) => (
					<EffectBranch
						key={index}
						scrollKey={`elif-${index}`}
						label="Else if"
						world={world}
						group={branch.effect}
						condition={branch.condition}
						delayTurns={branch.delayTurns}
						cancelIfConditionFails={branch.cancelIfConditionFails}
						onSelectCondition={() => editCondition("elif", index)}
						onDelayEnabledChange={(enabled) =>
							updateBehavior((next) => {
								const item = next.elifs?.[index];
								if (item) item.delayTurns = enabled ? 1 : 0;
							})
						}
						onDelayTurnsChange={(turns) =>
							updateBehavior((next) => {
								const item = next.elifs?.[index];
								if (item) item.delayTurns = turns;
							})
						}
						onCancelIfConditionFailsChange={(cancel) =>
							updateBehavior((next) => {
								const item = next.elifs?.[index];
								if (item) item.cancelIfConditionFails = cancel;
							})
						}
						onSelectGroup={editEffectReference}
						onSelectInlineEffect={(effectIndex) => editInlineEffect("elif", effectIndex, index)}
						onAddEffect={() => addEffect("elif", index)}
						onRemoveEffect={(effectIndex) => removeEffect("elif", effectIndex, index)}
						onMoveEffect={(from, to) => moveEffect("elif", from, to, index)}
						onDeleteBranch={() =>
							void deleteBranch("Else if", (next) => void next.elifs?.splice(index, 1))
						}
					/>
				))}
				{behavior.else ? (
					<EffectBranch
						scrollKey="else"
						label="Else"
						world={world}
						group={behavior.else}
						onSelectGroup={editEffectReference}
						onSelectInlineEffect={(index) => editInlineEffect("else", index)}
						onAddEffect={() => addEffect("else")}
						onRemoveEffect={(index) => removeEffect("else", index)}
						onMoveEffect={(from, to) => moveEffect("else", from, to)}
						onDeleteBranch={() => void deleteBranch("Else", (next) => void delete next.else)}
					/>
				) : null}
			</div>
		</div>
	);
}
