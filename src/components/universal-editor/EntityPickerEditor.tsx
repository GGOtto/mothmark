"use client";

import {
	EntityPicker,
	type EntityPickerEntry,
	type EntityPickerPresentation,
} from "@/components/entity-picker";
import type {EntityPickerOption, EntityType} from "@/types/editor/editorRegistryTypes";
import type {EditorControlMetadata, EditorControlProps} from "@/types/universalEditorTypes";
import {idValue, type ID, type WorldIdEntityType} from "@/utils/idUtils";
import {resolveEditorControlAppearance} from "@/types/universalEditorTypes";
import {FieldShell} from "./FieldShell";

export type EntityPickerFeatures = {
	entityType?: WorldIdEntityType;
	entityTypes?: WorldIdEntityType[];
	presentation?: EntityPickerPresentation;
	searchable?: boolean;
	searchPlaceholder?: string;
	allowCreate?: boolean;
	showPreview?: boolean;
	showDescriptions?: boolean;
	showTags?: boolean;
	showBadges?: boolean;
	clearButton?: boolean;
	clearable?: boolean;
	resultLimit?: number;
	scope?: "world" | "sibling-room";
	options?: EntityPickerOption[];
};

export type EntityPickerControlMetadata = EditorControlMetadata & {
	type: "entity-picker";
	features: EntityPickerFeatures;
};

export type EntityPickerEditorProps = EditorControlProps<
	ID | undefined,
	EntityPickerControlMetadata
>;

function registryEntityType(entityType: WorldIdEntityType): EntityType | undefined {
	if (entityType === "npc") return "character";
	if (entityType === "command" || entityType === "quest-objective") return undefined;
	return entityType;
}

function siblingRoomId(path: Array<string | number>, context: EntityPickerEditorProps["context"]) {
	const siblingPath = [...path.slice(0, -1), "roomId"];
	return idValue(context.getWorldValue?.(siblingPath) ?? context.getValue(siblingPath));
}

function pickerEntry(
	option: EntityPickerOption,
	requestedType: WorldIdEntityType,
): EntityPickerEntry {
	const entityType = option.entityType ?? registryEntityType(requestedType) ?? requestedType;
	return {
		ref: {type: requestedType, id: option.id},
		entityType,
		label: option.label,
		description: option.description,
		summary: option.description,
		aliases: option.aliases ?? [],
		tags: option.tags ?? [],
		kind: option.kind,
		hierarchy: option.hierarchy ?? [],
		facts: option.facts,
		relations: option.relations,
		path: option.path,
		parentId: option.parentId,
		disabled: option.disabled,
		deprecated: option.deprecated,
	};
}

export function EntityPickerEditor({
	value,
	onChange,
	metadata,
	path,
	error,
	warnings,
	disabled,
	readonly,
	autoFocus,
	context,
}: EntityPickerEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const configuredTypes = metadata.features.entityTypes?.length
		? metadata.features.entityTypes
		: metadata.features.entityType
			? [metadata.features.entityType]
			: value?.type
				? [value.type as WorldIdEntityType]
				: [];
	const requestedTypes = [...new Set(configuredTypes)];
	const inferredSiblingRoomId = siblingRoomId(path, context);
	const explicitOptions = metadata.features.options;
	const nextEntries = requestedTypes.flatMap((requestedType) => {
		const registryType = registryEntityType(requestedType);
		const options = explicitOptions?.length
			? explicitOptions.filter(
					(option) =>
						!option.entityType ||
						option.entityType === registryType ||
						option.entityType === requestedType,
				)
			: registryType
				? (context.registerEntityPicker?.getEntities(registryType) ?? [])
				: [];
		return options.map((option) => pickerEntry(option, requestedType));
	});
	const shouldScopeToRoom =
		metadata.features.scope === "sibling-room" ||
		(metadata.features.scope !== "world" && requestedTypes.every((type) => type === "feature"));
	const scopedEntries =
		shouldScopeToRoom && inferredSiblingRoomId
			? nextEntries.filter((entry) => !entry.parentId || entry.parentId === inferredSiblingRoomId)
			: nextEntries;
	const seenEntries = new Set<string>();
	const entries = scopedEntries.filter((entry) => {
		const key = `${entry.ref.type}:${entry.parentId ?? ""}:${entry.ref.id}`;
		if (seenEntries.has(key)) return false;
		seenEntries.add(key);
		return true;
	});

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
			<EntityPicker
				value={value}
				entries={entries}
				entityTypes={requestedTypes.map((type) => registryEntityType(type) ?? type)}
				onChange={(selection) => onChange(selection?.ref)}
				title={metadata.title}
				placeholder={metadata.placeholder}
				searchPlaceholder={metadata.features.searchPlaceholder}
				presentation={metadata.features.presentation}
				searchable={metadata.features.searchable ?? true}
				clearable={metadata.features.clearButton ?? metadata.features.clearable ?? !metadata.required}
				allowCreate={metadata.features.allowCreate}
				showPreview={metadata.features.showPreview}
				showDescriptions={metadata.features.showDescriptions ?? true}
				showTags={metadata.features.showTags ?? true}
				showBadges={metadata.features.showBadges ?? true}
				resultLimit={metadata.features.resultLimit}
				disabled={isDisabled}
				readonly={isReadonly}
				autoFocus={autoFocus}
				invalid={Boolean(error)}
			/>
		</FieldShell>
	);
}
