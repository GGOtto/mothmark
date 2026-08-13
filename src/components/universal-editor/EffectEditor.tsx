"use client";

import {useEffect, useId, useRef, useState} from "react";
import type {z} from "zod";
import type {EditorControlMetadata, EditorControlProps} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {idValue, isID, toID} from "../../utils/idUtils";
import {FieldShell} from "./FieldShell";
import type {EffectListFeatures, EffectValue} from "./EffectListEditor";
import {renderChildControl} from "./renderChildControl";
import {generateEffectSummary} from "./utils/universalEditorUtils";
import "./EffectEditor.scss";

export type EffectFeatures = EffectListFeatures;

export type EffectControlMetadata = EditorControlMetadata & {
	type: "effect";
	features?: EffectFeatures;
};

export type EffectGroupValue = {
	type: "group";
	name: string;
	id: unknown;
	effects: EffectValue[];
	allowMultipleUsesInWorld: boolean;
};

export type EffectEditorProps = EditorControlProps<
	EffectGroupValue | undefined,
	EffectControlMetadata
>;
type DefinedEffectEditorProps = EffectEditorProps & {
	value: EffectGroupValue;
	onChange: (nextValue: EffectGroupValue) => void;
};

function groupId(value: unknown) {
	if (isID(value) && value.type === "effect") return idValue(value).trim();
	return typeof value === "string" ? value.trim() : "";
}

function requireEffectSchema(schema: z.ZodTypeAny | undefined) {
	if (!schema) throw new Error("Effect editor metadata is missing its child effect schema.");
	return schema;
}

export function generateEffectGroupName(effects: EffectValue[], schema: z.ZodTypeAny) {
	if (effects.length === 0) return "New effect group";

	const summary = generateEffectSummary(effects[0], schema).replace(/\s+/g, " ").trim();
	const firstEffect = summary
		? `${summary.charAt(0).toUpperCase()}${summary.slice(1)}`
		: "New effect group";
	const suffix = effects.length > 1 ? ` + ${effects.length - 1} more` : "";
	const availableLength = Math.max(1, 72 - suffix.length);
	const compactFirstEffect =
		firstEffect.length > availableLength
			? `${firstEffect.slice(0, Math.max(1, availableLength - 1)).trimEnd()}…`
			: firstEffect;

	return `${compactFirstEffect}${suffix}`;
}

/**
 * Edits one complete EffectGroup. The parent owns where that group is stored:
 * embedded outcomes stay embedded, while groups authored in world.effects are
 * reusable definitions because their parent array already persists them there.
 */
function DefinedEffectEditor({
	value,
	onChange,
	metadata,
	path,
	error,
	warnings,
	disabled,
	readonly,
	context,
}: DefinedEffectEditorProps) {
	const generatedId = `effect-${useId()
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-+|-+$/g, "")}`;
	const initialized = useRef(false);
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const canEdit = !(disabled || metadata.disabled || readonly || metadata.readonly);
	const currentId = groupId(value.id) || generatedId;
	const childListFeatures = metadata.childControls?.effects?.features as
		EffectListFeatures | undefined;
	const inheritedListFeatures: EffectListFeatures = {
		...metadata.features,
		...childListFeatures,
	};
	const effectSchema = requireEffectSchema(
		inheritedListFeatures.effectSchema ?? inheritedListFeatures.sourceSchema,
	);
	const generatedName = generateEffectGroupName(value.effects, effectSchema);
	const [isAutoNamed, setIsAutoNamed] = useState(
		() => value.name.trim().length === 0 || value.name.trim() === generatedName,
	);

	function commit(nextValue: EffectGroupValue) {
		const nextId = groupId(nextValue.id) || generatedId;
		const nextGroup: EffectGroupValue = {
			...nextValue,
			id: toID("effect", nextId),
			allowMultipleUsesInWorld: true,
		};
		onChange(nextGroup);
	}

	useEffect(() => {
		if (initialized.current) return;
		initialized.current = true;
		commit({
			...value,
			name: isAutoNamed ? generatedName : value.name,
		});
	});

	function updateName(nextName: string) {
		setIsAutoNamed(nextName === generatedName);
		commit({...value, name: nextName});
	}

	function updateEffects(nextEffects: EffectValue[]) {
		const nextGeneratedName = generateEffectGroupName(nextEffects, effectSchema);
		const nextName = isAutoNamed ? nextGeneratedName : value.name;
		commit({...value, effects: nextEffects, name: nextName});
	}

	const listFeatures: EffectListFeatures = {
		...inheritedListFeatures,
		reorderable: inheritedListFeatures.reorderable ?? true,
		duplicateable: inheritedListFeatures.duplicateable ?? true,
		removable: inheritedListFeatures.removable ?? true,
		collapsibleItems: inheritedListFeatures.collapsibleItems ?? true,
		showCountSummary: false,
		showGeneratedSummary: false,
		excludedEffectIds: [...(inheritedListFeatures.excludedEffectIds ?? []), currentId],
	};
	const nameControl = metadata.childControls?.name;
	const nameParentMetadata: EffectControlMetadata = {
		...metadata,
		childControls: {
			...metadata.childControls,
			name: {
				...nameControl,
				features: {
					...nameControl?.features,
					clearButton: true,
					clearValue: generatedName,
				},
			},
		},
	};

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
			<div className="effectEditor">
				<div className="effectEditor__identity">
					{renderChildControl({
						type: "input",
						childKey: "name",
						value: value.name,
						onChange: updateName,
						metadata: {},
						parentMetadata: nameParentMetadata,
						path: [...path, "name"],
						disabled: disabled || !canEdit,
						readonly,
						context,
					})}
				</div>

				{renderChildControl({
					type: "effect-list",
					childKey: "effects",
					value: value.effects,
					onChange: updateEffects,
					metadata: {
						features: listFeatures,
						childControls: metadata.childControls,
					},
					parentMetadata: metadata,
					path: [...path, "effects"],
					disabled: disabled || !canEdit,
					readonly,
					context,
				})}
			</div>
		</FieldShell>
	);
}

export function EffectEditor(props: EffectEditorProps) {
	if (props.value) {
		return <DefinedEffectEditor {...props} value={props.value} onChange={props.onChange} />;
	}

	const appearance = resolveEditorControlAppearance(
		props.context.appearance,
		props.metadata.appearance,
	);
	const canEdit = !(
		props.disabled ||
		props.metadata.disabled ||
		props.readonly ||
		props.metadata.readonly
	);
	return (
		<FieldShell
			title={props.metadata.title}
			description={props.metadata.description}
			error={props.error}
			warnings={props.warnings}
			appearance={appearance}
			className={props.metadata.className}
			testId={props.metadata.testId}
		>
			<button
				type="button"
				className="effectEditor__addOutcome"
				disabled={!canEdit}
				onClick={() =>
					props.onChange({
						type: "group",
						name: "",
						id: "",
						effects: [],
						allowMultipleUsesInWorld: true,
					})
				}
			>
				Add outcome
			</button>
		</FieldShell>
	);
}
