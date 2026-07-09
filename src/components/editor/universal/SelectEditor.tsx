"use client";

import type {EditorControlMetadata, EditorControlProps} from "../../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./SelectEditor.scss";

export type SelectOption = {
	label: string;
	value: string;
	description?: string;
	disabled?: boolean;
};

export type SelectFeatures = {
	options: SelectOption[];
	placeholder?: string;
	searchable?: boolean;
};

export type SelectControlMetadata = EditorControlMetadata & {
	type: "select";
	features: SelectFeatures;
};

export type SelectEditorProps = EditorControlProps<string, SelectControlMetadata>;

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

	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;

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
				<select
					className="selectEditor__input"
					value={value}
					disabled={isDisabled || isReadonly}
					autoFocus={autoFocus}
					required={metadata.required}
					aria-readonly={isReadonly || undefined}
					data-readonly={isReadonly || undefined}
					onChange={(event) => {
						onChange(event.target.value);
					}}
				>
					{metadata.features.placeholder ? (
						<option value="" disabled={metadata.required}>
							{metadata.features.placeholder}
						</option>
					) : null}

					{metadata.features.options.map((option) => (
						<option key={option.value} value={option.value} disabled={option.disabled}>
							{option.label}
						</option>
					))}
				</select>

				{metadata.features.options.some((option) => option.description) ? (
					<div className="selectEditor__descriptions">
						{metadata.features.options.map((option) =>
							option.description ? (
								<div key={option.value} className="selectEditor__description">
									<span className="selectEditor__descriptionLabel">{option.label}</span>
									<span>{option.description}</span>
								</div>
							) : null,
						)}
					</div>
				) : null}
			</div>
		</FieldShell>
	);
}
