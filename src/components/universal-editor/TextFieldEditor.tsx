import {useState} from "react";
import type {EditorControlMetadata, EditorControlProps} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {applyTextTransform} from "../../utils/universalEditorUtils";
import {FieldShell} from "./FieldShell";
import "./TextFieldEditor.scss";

export type TextFieldInputMode =
	"text" | "search" | "email" | "url" | "tel" | "numeric" | "decimal";

export type TextFieldTransform = "none" | "slug" | "id" | "lowercase" | "uppercase";

export type TextFieldFeatures = {
	/**
	 * Shows a small button that copies the current value.
	 */
	copyButton?: boolean;

	/**
	 * Shows a small button that clears the current value.
	 */
	clearButton?: boolean;

	/**
	 * Shows a prefix next to the input.
	 * Example: "item/"
	 */
	prefix?: string;

	/**
	 * Shows a suffix next to the input.
	 * Example: " turns"
	 */
	suffix?: string;

	/**
	 * Selects all text when the input receives focus.
	 */
	selectOnFocus?: boolean;
};

export type TextFieldControlMetadata = EditorControlMetadata & {
	type: "input";

	minLength?: number;
	maxLength?: number;
	pattern?: string;

	inputMode?: TextFieldInputMode;
	autoComplete?: string;

	transform?: TextFieldTransform;

	features?: TextFieldFeatures;
};

export type TextFieldProps = EditorControlProps<string, TextFieldControlMetadata>;

export function TextField({
	value,
	onChange,
	metadata,
	error,
	warnings,
	disabled,
	readonly,
	autoFocus,
	context,
}: TextFieldProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);

	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const [inputText, setInputText] = useState<string>(value);

	const canEdit = !isDisabled && !isReadonly;

	function updateValue(rawValue: string) {
		setInputText(rawValue);
		onChange(applyTextTransform(rawValue, metadata.transform));
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
			<div className="textField">
				{metadata.features?.prefix ? (
					<span className="textField__affix textField__affix--prefix">{metadata.features.prefix}</span>
				) : null}

				<input
					className="textField__input"
					value={inputText}
					placeholder={metadata.placeholder}
					disabled={isDisabled}
					readOnly={isReadonly}
					autoFocus={autoFocus}
					inputMode={metadata.inputMode}
					autoComplete={metadata.autoComplete}
					minLength={metadata.minLength}
					maxLength={metadata.maxLength}
					pattern={metadata.pattern}
					required={metadata.required}
					onFocus={(event) => {
						if (metadata.features?.selectOnFocus) {
							event.currentTarget.select();
						}
					}}
					onChange={(event) => {
						updateValue(event.target.value);
					}}
				/>

				{metadata.features?.suffix ? (
					<span className="textField__affix textField__affix--suffix">{metadata.features.suffix}</span>
				) : null}

				{metadata.features?.clearButton ? (
					<button
						className="textField__button"
						type="button"
						disabled={!canEdit || value.length === 0}
						onClick={clearValue}
					>
						Clear
					</button>
				) : null}

				{metadata.features?.copyButton ? (
					<button
						className="textField__button"
						type="button"
						disabled={value.length === 0}
						onClick={copyValue}
					>
						Copy
					</button>
				) : null}
			</div>
		</FieldShell>
	);
}
