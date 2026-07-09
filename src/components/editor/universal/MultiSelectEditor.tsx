"use client";

import type {EditorControlMetadata, EditorControlProps} from "../../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../../types/universalEditorTypes";
import type {SelectOption} from "./SelectEditor";
import {FieldShell} from "./FieldShell";
import "./MultiSelectEditor.scss";

export type MultiSelectFeatures = {
	options: SelectOption[];
	maxSelected?: number;
	searchable?: boolean;
	clearButton?: boolean;
};

export type MultiSelectControlMetadata = EditorControlMetadata & {
	type: "multi-select";
	features: MultiSelectFeatures;
};

export type MultiSelectEditorProps = EditorControlProps<string[], MultiSelectControlMetadata>;

export function MultiSelectEditor({
	value,
	onChange,
	metadata,
	error,
	warnings,
	disabled,
	readonly,
	context,
}: MultiSelectEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);

	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const selectedValues = new Set(value);
	const selectedCount = value.length;

	function toggleOption(optionValue: string) {
		if (!canEdit) return;

		if (selectedValues.has(optionValue)) {
			onChange(value.filter((selectedValue) => selectedValue !== optionValue));
			return;
		}

		if (
			typeof metadata.features.maxSelected === "number" &&
			selectedCount >= metadata.features.maxSelected
		) {
			return;
		}

		onChange([...value, optionValue]);
	}

	function clearValue() {
		if (!canEdit) return;

		onChange([]);
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
			<div className="multiSelectEditor">
				<div className="multiSelectEditor__summary">
					<span>{selectedCount} selected</span>
					{typeof metadata.features.maxSelected === "number" ? (
						<span>Max {metadata.features.maxSelected}</span>
					) : null}
					{metadata.features.clearButton ? (
						<button
							className="multiSelectEditor__clearButton"
							type="button"
							disabled={!canEdit || value.length === 0}
							onClick={clearValue}
						>
							Clear
						</button>
					) : null}
				</div>

				<div className="multiSelectEditor__options">
					{metadata.features.options.map((option) => {
						const isChecked = selectedValues.has(option.value);
						const isAtMax =
							typeof metadata.features.maxSelected === "number" &&
							selectedCount >= metadata.features.maxSelected;
						const isOptionDisabled = isDisabled || option.disabled || (!isChecked && isAtMax);

						return (
							<label
								key={option.value}
								className={[
									"multiSelectEditor__option",
									isChecked ? "multiSelectEditor__option--checked" : "",
									isReadonly ? "multiSelectEditor__option--readonly" : "",
								]
									.filter(Boolean)
									.join(" ")}
							>
								<input
									className="multiSelectEditor__checkbox"
									type="checkbox"
									checked={isChecked}
									disabled={isOptionDisabled || isReadonly}
									onChange={() => {
										toggleOption(option.value);
									}}
								/>
								<span className="multiSelectEditor__optionText">
									<span className="multiSelectEditor__optionLabel">{option.label}</span>
									{option.description ? (
										<span className="multiSelectEditor__optionDescription">{option.description}</span>
									) : null}
								</span>
							</label>
						);
					})}
				</div>
			</div>
		</FieldShell>
	);
}
