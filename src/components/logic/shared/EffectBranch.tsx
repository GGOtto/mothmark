"use client";

import {GripVertical, Plus, Trash2} from "lucide-react";
import {useRef} from "react";
import {
	generateConditionSummary,
	generateEffectSummary,
} from "@/components/universal-editor/utils/universalEditorUtils";
import type {Condition} from "@/schemas/world/conditionSchema";
import type {Effect, EffectGroup} from "@/schemas/world/effectSchema";
import type {World} from "@/schemas/world/worldSchema";
import {idValue} from "@/utils/idUtils";
import "./EffectBranch.scss";

type EffectReference = Extract<Effect, {type: "effect-ref"}>;
type BranchEffectEntry =
	| {reference: EffectReference; group: EffectGroup | null; effect: null}
	| {reference: null; group: null; effect: Effect};

function referencedEffectGroups(group: EffectGroup | undefined, world: World) {
	if (!group) return [];
	return group.effects.map<BranchEffectEntry>((effect) => {
		if (effect.type !== "effect-ref") return {reference: null, group: null, effect};
		const id = idValue(effect.effectId);
		const found = world.effects.find((candidate) => idValue(candidate.id) === id) ?? null;
		return {reference: effect, group: found, effect: null};
	});
}

type EffectBranchProps = {
	scrollKey: string;
	label: string;
	world: World;
	group: EffectGroup | undefined;
	condition?: Condition;
	delayTurns?: number;
	cancelIfConditionFails?: boolean;
	onSelectCondition?: () => void;
	onDelayEnabledChange?: (enabled: boolean) => void;
	onDelayTurnsChange?: (turns: number) => void;
	onCancelIfConditionFailsChange?: (cancel: boolean) => void;
	onSelectGroup: (effectId: string) => void;
	onAddEffect: () => void;
	onRemoveEffect: (index: number) => void;
	onMoveEffect: (fromIndex: number, toIndex: number) => void;
	onDeleteBranch?: () => void;
};

export function EffectBranch({
	scrollKey,
	label,
	world,
	group,
	condition,
	delayTurns = 0,
	cancelIfConditionFails = true,
	onSelectCondition,
	onDelayEnabledChange,
	onDelayTurnsChange,
	onCancelIfConditionFailsChange,
	onSelectGroup,
	onAddEffect,
	onRemoveEffect,
	onMoveEffect,
	onDeleteBranch,
}: EffectBranchProps) {
	const entries = referencedEffectGroups(group, world);
	const draggedIndex = useRef<number | null>(null);
	const keyOccurrences = new Map<string, number>();

	function entryKey(entry: BranchEffectEntry) {
		const base = entry.reference
			? `reference-${idValue(entry.reference.effectId)}`
			: `legacy-${JSON.stringify(entry.effect)}`;
		const occurrence = keyOccurrences.get(base) ?? 0;
		keyOccurrences.set(base, occurrence + 1);
		return `${base}-${occurrence}`;
	}

	function startDragging(index: number, event: React.DragEvent) {
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", String(index));
		draggedIndex.current = index;
	}

	function dragOver(index: number, event: React.DragEvent) {
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";

		const fromIndex = draggedIndex.current;
		if (fromIndex == null || fromIndex === index) return;

		draggedIndex.current = index;
		onMoveEffect(fromIndex, index);
	}

	function stopDragging() {
		draggedIndex.current = null;
	}

	return (
		<section className="logicBranch" data-branch-scroll-key={scrollKey}>
			<header className="logicBranch__header">
				<div className="logicBranch__summary">
					<span className="logicBranch__label">
						<span className="logicBranch__marker" aria-hidden="true" />
						{label}
					</span>
					{condition ? (
						<button type="button" className="logicBranch__condition" onClick={onSelectCondition}>
							{generateConditionSummary(condition)}
						</button>
					) : null}
					{condition && onDelayEnabledChange ? (
						<span className="logicBranch__delay">
							<label>
								<input
									type="checkbox"
									checked={delayTurns > 0}
									onChange={(event) => onDelayEnabledChange(event.target.checked)}
								/>
								Delay
							</label>
							{delayTurns > 0 ? (
								<>
									<label>
										<input
											type="number"
											min={1}
											aria-label={`${label} delay turns`}
											value={delayTurns}
											onChange={(event) => onDelayTurnsChange?.(Math.max(1, Number(event.target.value) || 1))}
										/>
										turns
									</label>
									<label>
										<input
											type="checkbox"
											checked={cancelIfConditionFails}
											onChange={(event) => onCancelIfConditionFailsChange?.(event.target.checked)}
										/>
										Cancel if condition fails
									</label>
								</>
							) : null}
						</span>
					) : null}
				</div>
				<div className="logicBranch__actions">
					<button type="button" onClick={onAddEffect} aria-label={`Add effect to ${label}`}>
						<Plus size={15} aria-hidden="true" />
						Effect
					</button>
					{onDeleteBranch ? (
						<button type="button" onClick={onDeleteBranch} aria-label={`Delete ${label} branch`}>
							<Trash2 size={15} aria-hidden="true" />
						</button>
					) : null}
				</div>
			</header>

			<div className="logicBranch__effects">
				{entries.length === 0 ? (
					<button type="button" className="logicBranch__empty" onClick={onAddEffect}>
						Add an effect
					</button>
				) : (
					entries.map((entry, index) => {
						if (!entry.reference) {
							return (
								<div
									className="logicEffectGroup logicEffectGroup--legacy"
									key={entryKey(entry)}
									draggable={true}
									title="Drag to reorder"
									onDragStart={(event) => startDragging(index, event)}
									onDragOver={(event) => dragOver(index, event)}
									onDrop={stopDragging}
									onDragEnd={stopDragging}
								>
									{generateEffectSummary(entry.effect)}
								</div>
							);
						}

						const effectId = idValue(entry.reference.effectId);
						return (
							<div
								className="logicEffectGroup"
								key={entryKey(entry)}
								draggable={true}
								title="Drag to reorder"
								onDragStart={(event) => startDragging(index, event)}
								onDragOver={(event) => dragOver(index, event)}
								onDrop={stopDragging}
								onDragEnd={stopDragging}
							>
								<div className="logicEffectGroup__row">
									<span className="logicEffectGroup__drag" aria-hidden="true">
										<GripVertical size={14} />
									</span>
									<button
										type="button"
										className="logicEffectGroup__select"
										onClick={() => onSelectGroup(effectId)}
									>
										<span>{entry.group?.name || effectId || "Missing effect group"}</span>
										<span className="logicEffectGroup__count">{entry.group?.effects.length ?? 0}</span>
									</button>
									<button
										type="button"
										className="logicEffectGroup__remove"
										onClick={() => onRemoveEffect(index)}
										aria-label={`Remove ${entry.group?.name || effectId}`}
									>
										<Trash2 size={14} aria-hidden="true" />
									</button>
								</div>
								{entry.group?.effects.map((effect, effectIndex) => (
									<button
										type="button"
										className="logicSubEffect"
										onClick={() => onSelectGroup(effectId)}
										key={effectIndex}
									>
										{generateEffectSummary(effect)}
									</button>
								))}
							</div>
						);
					})
				)}
			</div>
		</section>
	);
}
