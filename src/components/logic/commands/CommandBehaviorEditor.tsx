"use client";

import {ArrowLeft, Plus, Workflow} from "lucide-react";
import {useLayoutEffect, useRef} from "react";
import {useOptionalPopup} from "@/components/popup/Popup";
import {EffectBranch} from "@/components/logic/shared/EffectBranch";
import type {CommandConditionBranch, CommandEffectGroup} from "@/schemas/world/commandLogicSchemas";
import type {Command, CommandBlock} from "@/schemas/world/commandSchemas";
import type {World} from "@/schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {idValue, toID} from "@/utils/idUtils";
import type {CommandSelection} from "../shared";
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
}: {
	world: World;
	updateWorld: UpdateWorld;
	command: Command;
	selection: CommandSelection;
	onSelectionChange: (selection: CommandSelection | null) => void;
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
	const behaviorKind = target.kind === "command" ? "command" : "fallback";

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

	function selectCondition(branch: "if" | "elif", elifIndex?: number) {
		onSelectionChange({
			kind: "behavior-condition",
			commandId,
			behavior: behaviorKind,
			blockId: target!.kind === "fallback" ? target!.blockId : undefined,
			branch,
			elifIndex,
		});
	}

	function selectEffect(branch: BranchKey, elifIndex?: number) {
		onSelectionChange({
			kind: "behavior-effect",
			commandId,
			behavior: behaviorKind,
			blockId: target!.kind === "fallback" ? target!.blockId : undefined,
			branch,
			elifIndex,
		});
	}

	function addEffect(branch: BranchKey, elifIndex?: number) {
		updateBehavior((next) => {
			branchGroup(next, branch, elifIndex)?.effects.push({
				type: "message",
				operation: "show",
				message: "",
			});
		});
		selectEffect(branch, elifIndex);
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
									pendingBranchScrollRef.current = "if";
									updateBehavior(
										(next) =>
											void (next.if = {
												condition: defaultCondition(),
												effect: emptyGroup(commandId, "If"),
												delayTurns: 0,
												cancelIfConditionFails: true,
											}),
									);
									selectCondition("if");
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
									pendingBranchScrollRef.current = `elif-${index}`;
									updateBehavior(
										(next) =>
											void (next.elifs ??= []).push({
												condition: defaultCondition(),
												effect: emptyGroup(commandId, `Else if ${index + 1}`),
												delayTurns: 0,
												cancelIfConditionFails: true,
											}),
									);
									selectCondition("elif", index);
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
						onSelectGroup={() => selectEffect("always")}
						onSelectInlineGroup={() => selectEffect("always")}
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
						onSelectCondition={() => selectCondition("if")}
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
						onSelectGroup={() => selectEffect("if")}
						onSelectInlineGroup={() => selectEffect("if")}
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
						onSelectCondition={() => selectCondition("elif", index)}
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
						onSelectGroup={() => selectEffect("elif", index)}
						onSelectInlineGroup={() => selectEffect("elif", index)}
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
						onSelectGroup={() => selectEffect("else")}
						onSelectInlineGroup={() => selectEffect("else")}
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
