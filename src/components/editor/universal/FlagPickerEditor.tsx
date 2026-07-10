"use client";

import type {FlagOption} from "../../../types/editor/editorRegistryTypes";
import type {EditorControlMetadata, EditorControlProps} from "../../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./FlagPickerEditor.scss";

type FlagPickerOptionWithMeta = FlagOption & {
	kind?: "boolean" | "number" | "string";
	usageCount?: number;
};

export type FlagPickerFeatures = {
	allowCreate?: boolean;
	showUsageCount?: boolean;
	showPreview?: boolean;
	clearButton?: boolean;
	filter?: "all" | "boolean" | "number" | "string";
	options?: FlagPickerOptionWithMeta[];
};

export type FlagPickerControlMetadata = EditorControlMetadata & {
	type: "flag-picker";
	features?: FlagPickerFeatures;
};

export type FlagPickerEditorProps = EditorControlProps<string, FlagPickerControlMetadata>;

export function FlagPickerEditor({
	value,
	onChange,
	metadata,
	error,
	warnings,
	disabled,
	readonly,
	autoFocus,
	context,
}: FlagPickerEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const registryOptions: FlagPickerOptionWithMeta[] = context.registerFlagPicker?.getFlags() ?? [];
	const rawOptions: FlagPickerOptionWithMeta[] = metadata.features?.options ?? registryOptions;
	const filter = metadata.features?.filter ?? "all";
	const showPreview = metadata.features?.showPreview ?? true;
	const options = rawOptions.filter((option) => filter === "all" || option.kind === filter);
	const selectedOption: FlagPickerOptionWithMeta | undefined =
		options.find((option) => option.id === value) ?? context.registerFlagPicker?.getFlagById(value);
	const isUnknownValue = value.length > 0 && !selectedOption;

	function createFlag() {
		if (!canEdit || !metadata.features?.allowCreate) return;

		const nextId = value.trim();
		if (!nextId) return;

		context.registerFlagPicker?.createFlag?.(nextId);
		onChange(nextId);
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
			<div className="flagPickerEditor">
				<div className="flagPickerEditor__row">
					<select
						className="flagPickerEditor__select"
						value={selectedOption ? value : ""}
						disabled={isDisabled || isReadonly}
						autoFocus={autoFocus}
						onChange={(event) => onChange(event.target.value)}
					>
						<option value="">{metadata.placeholder ?? "Choose flag"}</option>
						{options.map((option) => (
							<option key={option.id} value={option.id}>
								{option.label ?? option.id}
							</option>
						))}
					</select>

					{metadata.features?.clearButton ? (
						<button
							className="flagPickerEditor__button"
							type="button"
							disabled={!canEdit || value.length === 0}
							onClick={() => onChange("")}
						>
							Clear
						</button>
					) : null}
				</div>

				{metadata.features?.allowCreate ? (
					<div className="flagPickerEditor__createRow">
						<input
							className="flagPickerEditor__createInput"
							value={isUnknownValue ? value : ""}
							placeholder="puzzle.flagName"
							disabled={!canEdit}
							onChange={(event) => onChange(event.target.value)}
						/>
						<button
							className="flagPickerEditor__button"
							type="button"
							disabled={!canEdit || !isUnknownValue}
							onClick={createFlag}
						>
							Use Flag
						</button>
					</div>
				) : null}

				{showPreview && (selectedOption || isUnknownValue) ? (
					<div className="flagPickerEditor__preview">
						<strong>{selectedOption?.label ?? value}</strong>
						<span>{selectedOption?.description ?? (isUnknownValue ? "Unknown flag" : value)}</span>
						{metadata.features?.showUsageCount && typeof selectedOption?.usageCount === "number" ? (
							<span>{selectedOption.usageCount} uses</span>
						) : null}
					</div>
				) : null}
			</div>
		</FieldShell>
	);
}
