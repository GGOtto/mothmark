"use client";

import type {EditorControlMetadata, EditorControlProps} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./FlagPickerEditor.scss";

export type TextPickerFeatures = {
	allowCreate?: boolean;
	clearButton?: boolean;
};

export type TextPickerControlMetadata = EditorControlMetadata & {
	type: "text-picker";
	features?: TextPickerFeatures;
};

export type TextPickerEditorProps = EditorControlProps<string, TextPickerControlMetadata>;

export function TextPickerEditor({
	value = "",
	onChange,
	metadata,
	error,
	warnings,
	disabled,
	readonly,
	autoFocus,
	context,
}: TextPickerEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const options = context.getOptionList?.("texts") ?? [];
	const selectedOption = options.find((option) => option.value === value);
	const isUnknownValue = value.length > 0 && !selectedOption;

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
						aria-label={metadata.title ?? "Text variable"}
						value={selectedOption ? value : ""}
						disabled={isDisabled || isReadonly}
						autoFocus={autoFocus}
						onChange={(event) => onChange(event.target.value)}
					>
						<option value="">{metadata.placeholder ?? "Choose text variable"}</option>
						{options.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
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
							aria-label={`New ${metadata.title?.toLocaleLowerCase() ?? "text variable"}`}
							value={isUnknownValue ? value : ""}
							placeholder="text-name"
							disabled={!canEdit}
							onChange={(event) => onChange(event.target.value)}
						/>
					</div>
				) : null}
			</div>
		</FieldShell>
	);
}
