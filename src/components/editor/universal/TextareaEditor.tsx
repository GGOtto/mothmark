"use client";

import type {EditorControlMetadata, EditorControlProps} from "../../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./TextareaEditor.scss";

export type TextareaTransform = "none" | "trim";

export type TextareaFeatures = {
	copyButton?: boolean;
	clearButton?: boolean;
	resize?: "none" | "vertical";
	minRows?: number;
	maxRows?: number;
	monospace?: boolean;
	autoGrow?: boolean;
	selectOnFocus?: boolean;
};

export type TextareaControlMetadata = EditorControlMetadata & {
	type: "textarea";

	minLength?: number;
	maxLength?: number;
	transform?: TextareaTransform;
	features?: TextareaFeatures;
};

export type TextareaProps = EditorControlProps<string, TextareaControlMetadata>;

export function TextareaEditor({
	value,
	onChange,
	metadata,
	error,
	warnings,
	disabled,
	readonly,
	autoFocus,
	context,
}: TextareaProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);

	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const rows = metadata.features?.minRows ?? 4;

	function updateValue(rawValue: string) {
		onChange(metadata.transform === "trim" ? rawValue.trim() : rawValue);
	}

	function copyValue() {
		if (!navigator?.clipboard) return;

		void navigator.clipboard.writeText(value);
	}

	function clearValue() {
		if (!canEdit) return;

		onChange("");
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
			<div
				className={[
					"textareaEditor",
					metadata.features?.monospace ? "textareaEditor--monospace" : "",
					metadata.features?.autoGrow ? "textareaEditor--autoGrow" : "",
				]
					.filter(Boolean)
					.join(" ")}
			>
				<textarea
					className="textareaEditor__input"
					value={value}
					placeholder={metadata.placeholder}
					disabled={isDisabled}
					readOnly={isReadonly}
					autoFocus={autoFocus}
					minLength={metadata.minLength}
					maxLength={metadata.maxLength}
					required={metadata.required}
					rows={rows}
					style={{
						resize: metadata.features?.resize ?? "vertical",
						maxHeight: metadata.features?.maxRows
							? `${metadata.features.maxRows * 1.45 + 1.2}em`
							: undefined,
					}}
					onFocus={(event) => {
						if (metadata.features?.selectOnFocus) {
							event.currentTarget.select();
						}
					}}
					onChange={(event) => {
						updateValue(event.target.value);
					}}
				/>

				{metadata.features?.clearButton || metadata.features?.copyButton ? (
					<div className="textareaEditor__actions">
						{metadata.features?.clearButton ? (
							<button
								className="textareaEditor__button"
								type="button"
								disabled={!canEdit || value.length === 0}
								onClick={clearValue}
							>
								Clear
							</button>
						) : null}

						{metadata.features?.copyButton ? (
							<button
								className="textareaEditor__button"
								type="button"
								disabled={value.length === 0}
								onClick={copyValue}
							>
								Copy
							</button>
						) : null}
					</div>
				) : null}
			</div>
		</FieldShell>
	);
}
