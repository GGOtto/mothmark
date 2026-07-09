"use client";

import type {
	EditorControlContext,
	EditorControlMetadata,
	EditorControlProps,
	EditorSelectOption,
} from "../../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../../types/universalEditorTypes";
import {generateEffectSummary} from "../../../utils/universalEditorUtils";
import {FieldShell} from "./FieldShell";
import {renderChildControl} from "./renderChildControl";
import "./EffectListEditor.scss";

export type EffectValue = Record<string, unknown>;

export type EffectListFeatures = {
	reorderable?: boolean;
	duplicateable?: boolean;
	removable?: boolean;
	allowedEffectTypes?: string[];
	effectTypeOptions?: EditorSelectOption[];
	operationOptionsByType?: Record<string, EditorSelectOption[]>;
	effectTypeOptionSource?: string;
	operationOptionSourcesByType?: Record<string, string>;
	collapsibleItems?: boolean;
	showGeneratedSummary?: boolean;
};

export type EffectListControlMetadata = EditorControlMetadata & {
	type: "effect-list";
	features?: EffectListFeatures;
};

export type EffectListEditorProps = EditorControlProps<EffectValue[], EffectListControlMetadata>;

const FALLBACK_EFFECT_TYPE_OPTIONS = [
	{label: "Show message", value: "message"},
	{label: "Set flag", value: "flag"},
	{label: "Counter", value: "counter"},
	{label: "Inventory", value: "inventory"},
	{label: "Item location", value: "item-location"},
	{label: "Object state", value: "object-state"},
	{label: "Move room", value: "room"},
	{label: "NPC", value: "npc"},
	{label: "Event", value: "event"},
	{label: "Flow", value: "flow"},
	{label: "Group", value: "group"},
	{label: "Conditional", value: "conditional"},
];

const FALLBACK_OPERATION_OPTIONS_BY_TYPE: Record<string, EditorSelectOption[]> = {
	message: [
		{label: "Show", value: "show"},
		{label: "Random", value: "random"},
		{label: "Append room description", value: "append-room-description"},
	],
	flag: [
		{label: "Set", value: "set"},
		{label: "Toggle", value: "toggle"},
		{label: "Clear", value: "clear"},
	],
	counter: [
		{label: "Set", value: "set"},
		{label: "Increase", value: "increase"},
		{label: "Decrease", value: "decrease"},
		{label: "Reset", value: "reset"},
		{label: "Clamp", value: "clamp"},
	],
	inventory: [
		{label: "Add item", value: "add"},
		{label: "Remove item", value: "remove"},
		{label: "Remove all with tag", value: "remove-all-with-tag"},
		{label: "Replace item", value: "replace"},
	],
	"item-location": [
		{label: "Move to room", value: "move-to-room"},
		{label: "Move to current room", value: "move-to-current-room"},
		{label: "Place on surface", value: "place-on-surface"},
		{label: "Place in container", value: "place-in-container"},
		{label: "Give to NPC", value: "give-to-npc"},
		{label: "Hide", value: "hide"},
		{label: "Reveal", value: "reveal"},
		{label: "Destroy", value: "destroy"},
		{label: "Create", value: "create"},
	],
	"object-state": [
		{label: "Open", value: "open"},
		{label: "Close", value: "close"},
		{label: "Lock", value: "lock"},
		{label: "Unlock", value: "unlock"},
		{label: "Light", value: "light"},
		{label: "Extinguish", value: "extinguish"},
		{label: "Break", value: "break"},
		{label: "Repair", value: "repair"},
		{label: "Clean", value: "clean"},
		{label: "Dirty", value: "dirty"},
		{label: "Set custom", value: "set-custom"},
	],
	room: [
		{label: "Move player", value: "move-player"},
		{label: "Set description variant", value: "set-description-variant"},
		{label: "Reveal exit", value: "reveal-exit"},
		{label: "Hide exit", value: "hide-exit"},
		{label: "Lock exit", value: "lock-exit"},
		{label: "Unlock exit", value: "unlock-exit"},
		{label: "Add tag", value: "add-tag"},
		{label: "Remove tag", value: "remove-tag"},
	],
	npc: [
		{label: "Move to room", value: "move-to-room"},
		{label: "Move to current room", value: "move-to-current-room"},
		{label: "Remove", value: "remove"},
		{label: "Set mood", value: "set-mood"},
		{label: "Increase trust", value: "increase-trust"},
		{label: "Decrease trust", value: "decrease-trust"},
		{label: "Make hostile", value: "make-hostile"},
		{label: "Make friendly", value: "make-friendly"},
		{label: "Start dialogue", value: "start-dialogue"},
		{label: "End dialogue", value: "end-dialogue"},
	],
	event: [
		{label: "Schedule", value: "schedule"},
		{label: "Cancel instance", value: "cancel"},
		{label: "Cancel by event", value: "cancel-by-event-id"},
		{label: "Cancel with tag", value: "cancel-with-tag"},
		{label: "Delay", value: "delay"},
		{label: "Repeat", value: "repeat"},
	],
	flow: [
		{label: "Stop processing", value: "stop-processing"},
		{label: "Continue processing", value: "continue-processing"},
		{label: "Run generic command afterward", value: "run-generic-command-afterward"},
		{label: "Prevent turn consumption", value: "prevent-turn-consumption"},
		{label: "Consume extra turn", value: "consume-extra-turn"},
	],
};

function optionList(
	context: EditorControlContext,
	source?: string,
	metadataOptions?: EditorSelectOption[],
	fallbackOptions: EditorSelectOption[] = [],
) {
	if (metadataOptions?.length) return metadataOptions;
	if (source) return context.getOptionList?.(source) ?? fallbackOptions;
	return fallbackOptions;
}

function effectTypeOptions(metadata: EffectListControlMetadata, context: EditorControlContext) {
	const allowedTypes = metadata.features?.allowedEffectTypes?.length
		? metadata.features.allowedEffectTypes
		: undefined;
	const options = optionList(
		context,
		metadata.features?.effectTypeOptionSource,
		metadata.features?.effectTypeOptions,
		FALLBACK_EFFECT_TYPE_OPTIONS,
	);

	return allowedTypes ? options.filter((option) => allowedTypes.includes(option.value)) : options;
}

function operationOptionsForType(
	type: string,
	metadata: EffectListControlMetadata,
	context: EditorControlContext,
) {
	return optionList(
		context,
		metadata.features?.operationOptionSourcesByType?.[type],
		metadata.features?.operationOptionsByType?.[type],
		FALLBACK_OPERATION_OPTIONS_BY_TYPE[type] ?? [],
	);
}

function defaultEffect(type: string, operationOptions: EditorSelectOption[] = []): EffectValue {
	const operation = operationOptions[0]?.value;
	if (type === "message") return {type, messageType: "show", text: ""};
	if (type === "flag") return {type, operation: operation ?? "set", flag: "", value: true};
	if (type === "counter") return {type, operation: operation ?? "set", counter: "", value: 0};
	if (type === "inventory") return {type, operation: operation ?? "add", itemId: ""};
	if (type === "item-location")
		return {type, operation: operation ?? "move-to-room", itemId: "", roomId: ""};
	if (type === "object-state") return {type, operation: operation ?? "open", objectId: ""};
	if (type === "room") return {type, operation: operation ?? "move-player", roomId: ""};
	if (type === "npc") return {type, operation: operation ?? "move-to-room", npcId: "", roomId: ""};
	if (type === "event") return {type, operation: operation ?? "schedule", eventId: ""};
	if (type === "group") return {type, effects: []};
	if (type === "conditional") return {type, when: [], then: [], otherwise: []};
	return {type, operation: operation ?? "stop-processing"};
}

function cloneEffect(effect: EffectValue) {
	if (typeof structuredClone === "function") return structuredClone(effect);
	return JSON.parse(JSON.stringify(effect)) as EffectValue;
}

export function EffectListEditor({
	value,
	onChange,
	metadata,
	path,
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
	const availableEffectTypeOptions = effectTypeOptions(metadata, context);
	const allowedTypes = availableEffectTypeOptions.map((option) => option.value);
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
				{metadata.features?.showGeneratedSummary ? (
					<div className="effectListEditor__generatedSummary">
						{value.length > 0 ? value.map(generateEffectSummary).join("; ") : "No effects"}
					</div>
				) : null}
				{value.map((effect, index) => {
					const effectType = String(effect.type ?? allowedTypes[0]);
					const operationOptions = operationOptionsForType(effectType, metadata, context);
					const title = `${index + 1}. ${generateEffectSummary(effect)}`;
					const body = (
						<>
							{renderChildControl({
								type: "select",
								childKey: "effectType",
								value: effectType,
								onChange: (nextType) =>
									updateEffect(
										index,
										defaultEffect(nextType, operationOptionsForType(nextType, metadata, context)),
									),
								metadata: {
									title: "Type",
									appearance: {chrome: "inline", size: "sm"},
									features: {options: availableEffectTypeOptions, searchable: true},
								},
								parentMetadata: metadata,
								path: [...path, index, "type"],
								disabled,
								readonly,
								context,
							})}

							{operationOptions.length
								? renderChildControl({
										type: "select",
										childKey: "operator",
										value: String(effect.operation ?? effect.messageType ?? ""),
										onChange: (nextOperation) =>
											updateEffectField(
												index,
												effectType === "message" ? "messageType" : "operation",
												nextOperation,
											),
										metadata: {
											title: "Action",
											appearance: {chrome: "inline", size: "sm"},
											features: {options: operationOptions},
										},
										parentMetadata: metadata,
										path: [...path, index, "operation"],
										disabled,
										readonly,
										context,
									})
								: null}

							<div className="effectListEditor__fields">
								{Object.entries(effect)
									.filter(([key]) => key !== "type" && key !== "operation" && key !== "messageType")
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
					onClick={() =>
						onChange([
							...value,
							defaultEffect(allowedTypes[0], operationOptionsForType(allowedTypes[0], metadata, context)),
						])
					}
				>
					Add effect
				</button>
			</div>
		</FieldShell>
	);
}
