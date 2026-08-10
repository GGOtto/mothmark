"use client";

import type {EditorControlMetadata, EditorControlProps} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./FlagPickerEditor.scss";

export type CounterPickerFeatures = {
	allowCreate?: boolean;
	clearButton?: boolean;
};

export type CounterPickerControlMetadata = EditorControlMetadata & {
	type: "counter-picker";
	features?: CounterPickerFeatures;
};

export type CounterPickerEditorProps = EditorControlProps<string, CounterPickerControlMetadata>;

export function CounterPickerEditor({
	value = "",
	onChange,
	metadata,
	error,
	warnings,
	disabled,
	readonly,
	autoFocus,
	context,
}: CounterPickerEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const options = context.getOptionList?.("counters") ?? [];
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
						aria-label={metadata.title ?? "Counter"}
						value={selectedOption ? value : ""}
						disabled={isDisabled || isReadonly}
						autoFocus={autoFocus}
						onChange={(event) => onChange(event.target.value)}
					>
						<option value="">{metadata.placeholder ?? "Choose counter"}</option>
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
							aria-label={`New ${metadata.title?.toLocaleLowerCase() ?? "counter"}`}
							value={isUnknownValue ? value : ""}
							placeholder="counter-name"
							disabled={!canEdit}
							onChange={(event) => onChange(event.target.value)}
						/>
					</div>
				) : null}
			</div>
		</FieldShell>
	);
}
