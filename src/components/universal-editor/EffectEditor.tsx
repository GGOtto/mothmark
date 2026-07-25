"use client";

import {useEffect, useId, useRef, useState} from "react";
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

export type EffectEditorProps = EditorControlProps<EffectGroupValue, EffectControlMetadata>;

function worldEffectGroups(context: EffectEditorProps["context"]) {
	const effects = context.getWorldValue?.(["effects"]) ?? context.getValue(["effects"]);
	return Array.isArray(effects) ? (effects as EffectGroupValue[]) : [];
}

function groupId(value: unknown) {
	if (isID(value) && value.type === "effect") return idValue(value).trim();
	return typeof value === "string" ? value.trim() : "";
}

function setWorldEffectGroups(context: EffectEditorProps["context"], groups: EffectGroupValue[]) {
	if (context.setWorldValue) context.setWorldValue(["effects"], groups);
	else context.setValue(["effects"], groups);
}

export function generateEffectGroupName(effects: EffectValue[]) {
	if (effects.length === 0) return "New effect group";

	const summary = generateEffectSummary(effects[0]).replace(/\s+/g, " ").trim();
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
 * Edits one complete EffectGroup. Every group has an internal ID and is kept
 * synchronized in world.effects; child rows can reference those saved groups.
 */
export function EffectEditor({
	value,
	onChange,
	metadata,
	path,
	error,
	warnings,
	disabled,
	readonly,
	context,
}: EffectEditorProps) {
	const generatedId = `effect-${useId()
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-+|-+$/g, "")}`;
	const initialized = useRef(false);
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const canEdit = !(disabled || metadata.disabled || readonly || metadata.readonly);
	const groups = worldEffectGroups(context);
	const currentId = groupId(value.id) || generatedId;
	const generatedName = generateEffectGroupName(value.effects);
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
		const matchingIndex = groups.findIndex((group) => groupId(group.id) === nextId);
		const nextGroups =
			matchingIndex >= 0
				? groups.map((group, index) => (index === matchingIndex ? nextGroup : group))
				: [...groups, nextGroup];

		setWorldEffectGroups(context, nextGroups);
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
		const nextGeneratedName = generateEffectGroupName(nextEffects);
		const nextName = isAutoNamed ? nextGeneratedName : value.name;
		commit({...value, effects: nextEffects, name: nextName});
	}

	const childTypes = (metadata.features?.effectTypeOptions ?? []).filter(
		(option) => option.value !== "group" && option.value !== "conditional",
	);
	const listFeatures: EffectListFeatures = {
		...metadata.features,
		allowedEffectTypes: metadata.features?.allowedEffectTypes?.filter(
			(type) => type !== "group" && type !== "conditional",
		),
		effectTypeOptions: childTypes.length ? childTypes : metadata.features?.effectTypeOptions,
		reorderable: metadata.features?.reorderable ?? true,
		duplicateable: metadata.features?.duplicateable ?? true,
		removable: metadata.features?.removable ?? true,
		collapsibleItems: metadata.features?.collapsibleItems ?? true,
		showCountSummary: false,
		showGeneratedSummary: false,
		excludedEffectIds: [...(metadata.features?.excludedEffectIds ?? []), currentId],
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
						metadata: {appearance: {chrome: "inline", size: "sm"}},
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
						appearance: {chrome: "bare", size: "sm"},
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
