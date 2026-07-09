"use client";

import type {EditorControlMetadata, EditorControlProps} from "../../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./EffectListEditor.scss";

export type EffectValue = Record<string, unknown>;

export type EffectListFeatures = {
	reorderable?: boolean;
	duplicateable?: boolean;
	removable?: boolean;
	allowedEffectTypes?: string[];
	collapsibleItems?: boolean;
};

export type EffectListControlMetadata = EditorControlMetadata & {
	type: "effect-list";
	features?: EffectListFeatures;
};

export type EffectListEditorProps = EditorControlProps<EffectValue[], EffectListControlMetadata>;

const DEFAULT_EFFECT_TYPES = ["message", "flag", "counter", "inventory", "room", "npc", "flow"];

function defaultEffect(type: string): EffectValue {
	if (type === "message") return {type, messageType: "show", text: ""};
	if (type === "flag") return {type, operation: "set", flag: "", value: true};
	if (type === "counter") return {type, operation: "set", counter: "", value: 0};
	if (type === "inventory") return {type, operation: "add", itemId: ""};
	if (type === "room") return {type, operation: "move-player", roomId: ""};
	if (type === "npc") return {type, operation: "move-to-room", npcId: "", roomId: ""};
	return {type, operation: "stop-processing"};
}

function cloneEffect(effect: EffectValue) {
	if (typeof structuredClone === "function") return structuredClone(effect);
	return JSON.parse(JSON.stringify(effect)) as EffectValue;
}

export function EffectListEditor({
	value,
	onChange,
	metadata,
	error,
	warnings,
	disabled,
	readonly,
	context,
}: EffectListEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const allowedTypes = metadata.features?.allowedEffectTypes?.length
		? metadata.features.allowedEffectTypes
		: DEFAULT_EFFECT_TYPES;
	const removable = metadata.features?.removable ?? true;

	function updateEffect(index: number, nextEffect: EffectValue) {
		onChange(value.map((effect, effectIndex) => (effectIndex === index ? nextEffect : effect)));
	}

	function updateEffectField(index: number, key: string, nextFieldValue: unknown) {
		updateEffect(index, {
			...value[index],
			[key]: nextFieldValue,
		});
	}

	function removeEffect(index: number) {
		if (!canEdit || !removable) return;

		onChange(value.filter((_, effectIndex) => effectIndex !== index));
	}

	function duplicateEffect(index: number) {
		if (!canEdit) return;

		onChange([...value.slice(0, index + 1), cloneEffect(value[index]), ...value.slice(index + 1)]);
	}

	function moveEffect(index: number, direction: -1 | 1) {
		const nextIndex = index + direction;
		if (!canEdit || nextIndex < 0 || nextIndex >= value.length) return;

		const nextValue = [...value];
		[nextValue[index], nextValue[nextIndex]] = [nextValue[nextIndex], nextValue[index]];
		onChange(nextValue);
	}

	return (
		<FieldShell
			title={metadata.title}
			description={metadata.description}
			error={error}
			warnings={warnings}
			appearance={appearance}
			className={metadata.className}
			testId={metadata.testId}
		>
			<div className="effectListEditor">
				<div className="effectListEditor__summary">{value.length} effects</div>
				{value.map((effect, index) => {
					const title = `${index + 1}. ${String(effect.type ?? "effect")}`;
					const body = (
						<>
							<label>
								<span>type</span>
								<select
									value={String(effect.type ?? allowedTypes[0])}
									disabled={!canEdit}
									onChange={(event) => updateEffect(index, defaultEffect(event.target.value))}
								>
									{allowedTypes.map((type) => (
										<option key={type} value={type}>
											{type}
										</option>
									))}
								</select>
							</label>

							<div className="effectListEditor__fields">
								{Object.entries(effect)
									.filter(([key]) => key !== "type")
									.map(([key, fieldValue]) => (
										<label key={key}>
											<span>{key}</span>
											<input
												type={
													typeof fieldValue === "boolean"
														? "checkbox"
														: typeof fieldValue === "number"
															? "number"
															: "text"
												}
												checked={typeof fieldValue === "boolean" ? fieldValue : undefined}
												value={typeof fieldValue === "boolean" ? undefined : String(fieldValue ?? "")}
												disabled={!canEdit}
												onChange={(event) => {
													if (typeof fieldValue === "boolean") {
														updateEffectField(index, key, event.target.checked);
														return;
													}

													if (typeof fieldValue === "number") {
														updateEffectField(index, key, Number(event.target.value));
														return;
													}

													updateEffectField(index, key, event.target.value);
												}}
											/>
										</label>
									))}
							</div>

							<div className="effectListEditor__actions">
								{metadata.features?.reorderable ? (
									<>
										<button
											type="button"
											disabled={!canEdit || index === 0}
											onClick={() => moveEffect(index, -1)}
										>
											Up
										</button>
										<button
											type="button"
											disabled={!canEdit || index === value.length - 1}
											onClick={() => moveEffect(index, 1)}
										>
											Down
										</button>
									</>
								) : null}
								{metadata.features?.duplicateable ? (
									<button type="button" disabled={!canEdit} onClick={() => duplicateEffect(index)}>
										Duplicate
									</button>
								) : null}
								<button type="button" disabled={!canEdit || !removable} onClick={() => removeEffect(index)}>
									Remove
								</button>
							</div>
						</>
					);

					return metadata.features?.collapsibleItems ? (
						<details key={index} className="effectListEditor__item" open>
							<summary className="effectListEditor__itemTitle">{title}</summary>
							{body}
						</details>
					) : (
						<div key={index} className="effectListEditor__item">
							<div className="effectListEditor__itemTitle">{title}</div>
							{body}
						</div>
					);
				})}
				<button
					className="effectListEditor__addButton"
					type="button"
					disabled={!canEdit}
					onClick={() => onChange([...value, defaultEffect(allowedTypes[0])])}
				>
					Add effect
				</button>
			</div>
		</FieldShell>
	);
}
