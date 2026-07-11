"use client";

import {useMemo, useState} from "react";
import type {EditorControlMetadata, EditorControlProps} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import type {SelectOption} from "./SelectEditor";
import {FieldShell} from "./FieldShell";
import "./MultiSelectEditor.scss";

export type MultiSelectFeatures = {
	options: SelectOption[];
	maxSelected?: number;
	searchable?: boolean;
	clearButton?: boolean;
	allowCreate?: boolean;
	grouped?: boolean;
	showDescriptions?: boolean;
	showBadges?: boolean;
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
	const [query, setQuery] = useState("");

	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const selectedValues = new Set(value);
	const selectedCount = value.length;
	const filteredOptions = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) return metadata.features.options;

		return metadata.features.options.filter((option) =>
			[option.label, option.value, option.description, option.group, option.badge]
				.filter(Boolean)
				.some((part) => String(part).toLowerCase().includes(normalizedQuery)),
		);
	}, [metadata.features.options, query]);
	const hasDescriptions =
		metadata.features.showDescriptions ??
		metadata.features.options.some((option) => option.description);
	const hasBadges =
		metadata.features.showBadges ?? metadata.features.options.some((option) => option.badge);

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

	function createValue() {
		const nextValue = query.trim();
		if (!canEdit || !metadata.features.allowCreate || !nextValue || selectedValues.has(nextValue))
			return;

		if (
			typeof metadata.features.maxSelected === "number" &&
			selectedCount >= metadata.features.maxSelected
		) {
			return;
		}

		onChange([...value, nextValue]);
		setQuery("");
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

				{metadata.features.searchable || metadata.features.allowCreate ? (
					<div className="multiSelectEditor__searchRow">
						<input
							className="multiSelectEditor__search"
							type="search"
							value={query}
							placeholder="Search options"
							disabled={!canEdit}
							onChange={(event) => setQuery(event.target.value)}
						/>
						{metadata.features.allowCreate ? (
							<button
								className="multiSelectEditor__clearButton"
								type="button"
								disabled={!canEdit || query.trim().length === 0}
								onClick={createValue}
							>
								Add value
							</button>
						) : null}
					</div>
				) : null}

				<div className="multiSelectEditor__options">
					{filteredOptions.map((option) => {
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
									<span className="multiSelectEditor__optionLabel">
										{metadata.features.grouped && option.group ? `${option.group} - ` : ""}
										{option.label}
										{option.badge && hasBadges ? (
											<span className="multiSelectEditor__optionBadge">{option.badge}</span>
										) : null}
									</span>
									{option.description && hasDescriptions ? (
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
