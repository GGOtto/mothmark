"use client";

import type {EntityPickerOption, EntityType} from "../../types/editor/editorRegistryTypes";
import type {EditorControlMetadata, EditorControlProps} from "../../types/universalEditorTypes";
import {idValue, toID, type ID, type WorldIdEntityType} from "../../utils/idUtils";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./EntityPickerEditor.scss";

export type EntityPickerFeatures = {
	entityType: WorldIdEntityType;
	allowCreate?: boolean;
	showPreview?: boolean;
	clearButton?: boolean;
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

function registryEntityType(
	entityType: EntityPickerFeatures["entityType"],
): EntityType | undefined {
	if (entityType === "npc") return "character";
	if (entityType === "command" || entityType === "quest-objective") return undefined;
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
	const selectedId = idValue(value);
	const entityType = registryEntityType(metadata.features.entityType);
	const registryOptions =
		entityType && context.registerEntityPicker
			? context.registerEntityPicker.getEntities(entityType)
			: [];
	const options = metadata.features.options ?? registryOptions;
	const selectedOption =
		options.find((option) => option.id === selectedId) ??
		(entityType ? context.registerEntityPicker?.getEntityById(entityType, selectedId) : undefined);
	const isUnknownValue = selectedId.length > 0 && !selectedOption;

	function commitValue(nextId: string) {
		onChange(nextId ? toID(metadata.features.entityType, nextId) : undefined);
	}

	function createEntity() {
		if (!canEdit || !metadata.features.allowCreate) return;

		const nextId = selectedId.trim();
		if (nextId) commitValue(nextId);
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
						value={selectedOption ? selectedId : ""}
						disabled={isDisabled || isReadonly}
						autoFocus={autoFocus}
						onChange={(event) => commitValue(event.target.value)}
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
							disabled={!canEdit || selectedId.length === 0}
							onClick={() => commitValue("")}
						>
							Clear
						</button>
					) : null}
				</div>

				{metadata.features.allowCreate ? (
					<div className="entityPickerEditor__createRow">
						<input
							className="entityPickerEditor__createInput"
							value={isUnknownValue ? selectedId : ""}
							placeholder="new-entity-id"
							disabled={!canEdit}
							onChange={(event) => commitValue(event.target.value)}
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
							<span>{selectedId ? "Unknown entity" : "No entity selected"}</span>
						)}
					</div>
				) : null}
			</div>
		</FieldShell>
	);
}
