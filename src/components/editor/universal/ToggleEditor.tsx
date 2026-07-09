"use client";

import type {EditorControlMetadata, EditorControlProps} from "../../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./ToggleEditor.scss";

export type ToggleDisplay = "switch" | "checkbox" | "button";

export type ToggleFeatures = {
	labels?: {
		on: string;
		off: string;
	};
	display?: ToggleDisplay;
};

export type ToggleControlMetadata = EditorControlMetadata & {
	type: "toggle";
	features?: ToggleFeatures;
};

export type ToggleEditorProps = EditorControlProps<boolean, ToggleControlMetadata>;

export function ToggleEditor({
	value,
	onChange,
	metadata,
	error,
	warnings,
	disabled,
	readonly,
	context,
}: ToggleEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);

	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const display = metadata.features?.display ?? "switch";
	const labels = metadata.features?.labels ?? {
		on: "On",
		off: "Off",
	};
	const currentLabel = value ? labels.on : labels.off;

	function toggleValue() {
		if (!canEdit) return;

		onChange(!value);
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
			{display === "checkbox" ? (
				<label className="toggleEditor toggleEditor--checkbox">
					<input
						className="toggleEditor__checkbox"
						type="checkbox"
						checked={value}
						disabled={isDisabled}
						readOnly={isReadonly}
						required={metadata.required}
						onChange={toggleValue}
					/>
					<span className="toggleEditor__label">{currentLabel}</span>
				</label>
			) : (
				<button
					className={[
						"toggleEditor",
						display === "button" ? "toggleEditor--button" : "toggleEditor--switch",
						value ? "toggleEditor--checked" : "",
					]
						.filter(Boolean)
						.join(" ")}
					type="button"
					role={display === "switch" ? "switch" : undefined}
					aria-checked={display === "switch" ? value : undefined}
					aria-pressed={display === "button" ? value : undefined}
					disabled={isDisabled}
					data-readonly={isReadonly || undefined}
					onClick={toggleValue}
				>
					{display === "switch" ? <span className="toggleEditor__track" /> : null}
					<span className="toggleEditor__label">{currentLabel}</span>
				</button>
			)}
		</FieldShell>
	);
}
