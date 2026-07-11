"use client";

import {useMemo, useState} from "react";
import type {
	EditorControlMetadata,
	EditorControlProps,
	EditorSelectOption,
} from "../../../types/universalEditorTypes";
import type {EntityType} from "../../../types/editor/editorRegistryTypes";
import {idValue, type ID, type WorldIdEntityType} from "../../../utils/idUtils";
import {resolveEditorControlAppearance} from "../../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./SelectEditor.scss";

export type SelectOption = EditorSelectOption;

export type SelectFeatures = {
	options: SelectOption[];
	placeholder?: string;
	searchable?: boolean;
	grouped?: boolean;
	groupBy?: string;
	showDescriptions?: boolean;
	showBadges?: boolean;
	allowCreate?: boolean;
	clearButton?: boolean;
	clearable?: boolean;
	entityType?: WorldIdEntityType;
};

export type SelectControlMetadata = EditorControlMetadata & {
	type: "select";
	features: SelectFeatures;
};

export type SelectEditorValue = string | ID | undefined;

export type SelectEditorProps = EditorControlProps<SelectEditorValue, SelectControlMetadata>;

function registryEntityType(entityType: SelectFeatures["entityType"]): EntityType | undefined {
	if (entityType === "object") return undefined;
	if (entityType === "quest-objective") return undefined;
	return entityType;
}

function selectValue(value: SelectEditorValue) {
	if (typeof value === "string") return value;
	return idValue(value);
}

export function SelectEditor({
	value,
	onChange,
	metadata,
	error,
	warnings,
	disabled,
	readonly,
	autoFocus,
	context,
}: SelectEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const [query, setQuery] = useState("");

	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const searchable = metadata.features.searchable || metadata.features.allowCreate;
	const clearable = metadata.features.clearButton || metadata.features.clearable;
	const showDescriptions = metadata.features.showDescriptions ?? true;
	const entityType = registryEntityType(metadata.features.entityType);
	const selectedValue = selectValue(value);
	const registryOptions =
		entityType && context.registerEntityPicker
			? context.registerEntityPicker.getEntities(entityType).map((option) => ({
					label: option.label,
					value: option.id,
					description: option.description,
					group: undefined,
					badge: option.kind ?? option.entityType,
					disabled: option.disabled || option.deprecated,
				}))
			: [];
	const options: SelectOption[] =
		metadata.features.options.length > 0 ? metadata.features.options : registryOptions;
	const filteredOptions = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) return options;

		return options.filter((option) =>
			[option.label, option.value, option.description, option.group, option.badge]
				.filter(Boolean)
				.some((part) => String(part).toLowerCase().includes(normalizedQuery)),
		);
	}, [options, query]);
	const hasBadges = metadata.features.showBadges ?? options.some((option) => option.badge);
	const selectedOption = options.find((option) => option.value === selectedValue);

	function commitValue(nextId: string) {
		if (metadata.features.entityType) {
			onChange(nextId ? {type: metadata.features.entityType, id: nextId} : undefined);
			return;
		}

		onChange(nextId);
	}

	function createValue() {
		const nextValue = query.trim();
		if (!canEdit || !metadata.features.allowCreate || !nextValue) return;

		commitValue(nextValue);
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
			<div className="selectEditor">
				<div className="selectEditor__row">
					<select
						className="selectEditor__input"
						value={selectedValue}
						disabled={isDisabled || isReadonly}
						autoFocus={autoFocus}
						required={metadata.required}
						aria-readonly={isReadonly || undefined}
						data-readonly={isReadonly || undefined}
						onChange={(event) => {
							commitValue(event.target.value);
						}}
					>
						{metadata.features.placeholder ? (
							<option value="" disabled={metadata.required}>
								{metadata.features.placeholder}
							</option>
						) : null}

						{filteredOptions.map((option) => (
							<option key={option.value} value={option.value} disabled={option.disabled}>
								{option.group && metadata.features.grouped ? `${option.group} - ` : ""}
								{option.label}
								{option.badge && hasBadges ? ` (${option.badge})` : ""}
							</option>
						))}
					</select>

					{clearable ? (
						<button
							className="selectEditor__button"
							type="button"
							disabled={!canEdit || selectedValue.length === 0}
							onClick={() => commitValue("")}
						>
							Clear
						</button>
					) : null}
				</div>

				{searchable ? (
					<div className="selectEditor__searchRow">
						<input
							className="selectEditor__search"
							type="search"
							value={query}
							placeholder="Search options"
							disabled={!canEdit}
							onChange={(event) => setQuery(event.target.value)}
						/>
						{metadata.features.allowCreate ? (
							<button
								className="selectEditor__button"
								type="button"
								disabled={!canEdit || query.trim().length === 0}
								onClick={createValue}
							>
								Use value
							</button>
						) : null}
					</div>
				) : null}

				{showDescriptions && selectedOption && (selectedOption.description || selectedOption.badge) ? (
					<div className="selectEditor__selectedPreview">
						<strong>{selectedOption.label}</strong>
						{selectedOption.badge && hasBadges ? <span>{selectedOption.badge}</span> : null}
						{selectedOption.description ? <span>{selectedOption.description}</span> : null}
					</div>
				) : null}
			</div>
		</FieldShell>
	);
}
