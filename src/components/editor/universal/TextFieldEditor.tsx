import type {EditorControlProps, EditorControlMetadata} from "../../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import {applyTextTransform} from "../../../utils/universalEditorUtils";
import "./TextFieldEditor.scss";

export type TextFieldControlMetadata = EditorControlMetadata & {
	type: "input";

	minLength?: number;
	maxLength?: number;
	pattern?: string;

	inputMode?: "text" | "search" | "email" | "url" | "tel" | "numeric" | "decimal";

	autoComplete?: string;

	prefix?: string;
	suffix?: string;

	transform?: "none" | "slug" | "id" | "lowercase" | "uppercase";
};

export type TextFieldProps = EditorControlProps<string, TextFieldControlMetadata>;

export function TextField({
	value,
	onChange,
	metadata,
	error,
	disabled,
	readonly,
	autoFocus,
	context,
}: TextFieldProps) {
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;

	return (
		<FieldShell
			title={metadata.title}
			description={metadata.description}
			error={error}
			chrome={metadata.chrome}
			tone={metadata.tone}
			size={metadata.size}
			theme={context.theme}
		>
			<input
				value={value}
				placeholder={metadata.placeholder}
				disabled={isDisabled}
				readOnly={isReadonly}
				autoFocus={autoFocus}
				inputMode={metadata.inputMode}
				autoComplete={metadata.autoComplete}
				minLength={metadata.minLength}
				maxLength={metadata.maxLength}
				pattern={metadata.pattern}
				data-testid={metadata.testId}
				onChange={(event) => {
					const rawValue = event.target.value;
					onChange(applyTextTransform(rawValue, metadata.transform));
				}}
			/>
		</FieldShell>
	);
}
