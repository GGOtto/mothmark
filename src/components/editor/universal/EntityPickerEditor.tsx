"use client";

import type {EntityPickerOption, EntityType} from "../../../types/editor/editorRegistryTypes";
import type {EditorControlMetadata, EditorControlProps} from "../../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./EntityPickerEditor.scss";

export type EntityPickerFeatures = {
	entityType: EntityType | "npc" | "command";
	allowCreate?: boolean;
	showPreview?: boolean;
	clearButton?: boolean;
	options?: EntityPickerOption[];
};

export type EntityPickerControlMetadata = EditorControlMetadata & {
	type: "entity-picker";
	features: EntityPickerFeatures;
};

export type EntityPickerEditorProps = EditorControlProps<string, EntityPickerControlMetadata>;

function registryEntityType(
	entityType: EntityPickerFeatures["entityType"],
): EntityType | undefined {
	if (entityType === "npc") return "character";
	if (entityType === "command") return undefined;
	return entityType;
}

export function EntityPickerEditor({
	value,
	onChange,
	metadata,
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
	const canEdit = !isDisabled && !isReadonly;
	const entityType = registryEntityType(metadata.features.entityType);
	const registryOptions =
		entityType && context.registerEntityPicker
			? context.registerEntityPicker.getEntities(entityType)
			: [];
	const options = metadata.features.options ?? registryOptions;
	const selectedOption =
		options.find((option) => option.id === value) ??
		(entityType ? context.registerEntityPicker?.getEntityById(entityType, value) : undefined);
	const isUnknownValue = value.length > 0 && !selectedOption;

	function createEntity() {
		if (!canEdit || !metadata.features.allowCreate) return;

		const nextId = value.trim();
		if (nextId) onChange(nextId);
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
			<div className="entityPickerEditor">
				<div className="entityPickerEditor__row">
					<select
						className="entityPickerEditor__select"
						value={selectedOption ? value : ""}
						disabled={isDisabled || isReadonly}
						autoFocus={autoFocus}
						onChange={(event) => onChange(event.target.value)}
					>
						<option value="">{metadata.placeholder ?? "Choose entity"}</option>
						{options.map((option) => (
							<option key={option.id} value={option.id}>
								{option.label}
							</option>
						))}
					</select>

					{metadata.features.clearButton ? (
						<button
							className="entityPickerEditor__button"
							type="button"
							disabled={!canEdit || value.length === 0}
							onClick={() => onChange("")}
						>
							Clear
						</button>
					) : null}
				</div>

				{metadata.features.allowCreate ? (
					<div className="entityPickerEditor__createRow">
						<input
							className="entityPickerEditor__createInput"
							value={isUnknownValue ? value : ""}
							placeholder="new-entity-id"
							disabled={!canEdit}
							onChange={(event) => onChange(event.target.value)}
						/>
						<button
							className="entityPickerEditor__button"
							type="button"
							disabled={!canEdit || !isUnknownValue}
							onClick={createEntity}
						>
							Use ID
						</button>
					</div>
				) : null}

				{metadata.features.showPreview ? (
					<div className="entityPickerEditor__preview">
						{selectedOption ? (
							<>
								<strong>{selectedOption.label}</strong>
								<span>{selectedOption.description ?? selectedOption.id}</span>
							</>
						) : (
							<span>{value ? "Unknown entity" : "No entity selected"}</span>
						)}
					</div>
				) : null}
			</div>
		</FieldShell>
	);
}
