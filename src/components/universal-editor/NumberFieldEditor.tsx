"use client";

import {useState} from "react";
import type {EditorControlMetadata, EditorControlProps} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./NumberFieldEditor.scss";

export type NumberFieldFeatures = {
	kind?: "plain" | "coordinate" | "percentage" | "priority" | "count" | "weight";
	unit?: string;
	prefix?: string;
	suffix?: string;
	slider?: boolean;
	clearButton?: boolean;
	clampOnBlur?: boolean;
	nudgeButtons?: boolean;
	resetButton?: boolean;
	resetValue?: number;
};

export type NumberControlMetadata = EditorControlMetadata & {
	type: "number";

	min?: number;
	max?: number;
	step?: number;
	features?: NumberFieldFeatures;
};

export type NumberFieldProps = EditorControlProps<number | undefined, NumberControlMetadata>;

function numberDraftValue(value: number | undefined) {
	return typeof value === "number" ? String(value) : "";
}

function clampValue(value: number, min?: number, max?: number) {
	if (typeof min === "number" && value < min) return min;
	if (typeof max === "number" && value > max) return max;

	return value;
}

export function NumberFieldEditor({
	value,
	onChange,
	metadata,
	error,
	warnings,
	disabled,
	readonly,
	autoFocus,
	context,
}: NumberFieldProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const [draftState, setDraftState] = useState(() => ({
		sourceValue: value,
		draftValue: numberDraftValue(value),
	}));

	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const step = metadata.step ?? (metadata.features?.kind === "percentage" ? 1 : 1);
	const suffix =
		metadata.features?.unit ?? metadata.features?.suffix ?? kindSuffix(metadata.features?.kind);
	const hasSlider =
		metadata.features?.slider && typeof metadata.min === "number" && typeof metadata.max === "number";
	const draftValue =
		draftState.sourceValue === value ? draftState.draftValue : numberDraftValue(value);

	function commitNumber(rawValue: string) {
		setDraftState({
			sourceValue: value,
			draftValue: rawValue,
		});

		if (rawValue.trim() === "") {
			if (!metadata.required) onChange(undefined);
			return;
		}

		const nextValue = Number(rawValue);

		if (!Number.isFinite(nextValue)) return;

		onChange(nextValue);
	}

	function restoreOrClampValue() {
		if (draftValue.trim() === "") {
			if (!metadata.required) return;
			setDraftState({
				sourceValue: value,
				draftValue: numberDraftValue(value),
			});
			return;
		}

		const nextValue = Number(draftValue);

		if (!Number.isFinite(nextValue)) {
			setDraftState({
				sourceValue: value,
				draftValue: numberDraftValue(value),
			});
			return;
		}

		if (!metadata.features?.clampOnBlur) return;

		const clampedValue = clampValue(nextValue, metadata.min, metadata.max);
		setDraftState({
			sourceValue: clampedValue,
			draftValue: String(clampedValue),
		});
		onChange(clampedValue);
	}

	function clearValue() {
		if (!canEdit) return;

		if (!metadata.required) {
			setDraftState({sourceValue: undefined, draftValue: ""});
			onChange(undefined);
			return;
		}

		const fallbackValue = metadata.min ?? 0;
		setDraftState({
			sourceValue: fallbackValue,
			draftValue: String(fallbackValue),
		});
		onChange(fallbackValue);
	}

	function setNumber(nextValue: number) {
		const clampedValue = clampValue(nextValue, metadata.min, metadata.max);
		setDraftState({
			sourceValue: clampedValue,
			draftValue: String(clampedValue),
		});
		onChange(clampedValue);
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
					"numberField",
					metadata.features?.kind ? `numberField--kind-${metadata.features.kind}` : "",
				]
					.filter(Boolean)
					.join(" ")}
			>
				<div className="numberField__row">
					{metadata.features?.prefix ? (
						<span className="numberField__affix numberField__affix--prefix">
							{metadata.features.prefix}
						</span>
					) : null}

					<input
						className="numberField__input"
						aria-label={metadata.title}
						type="number"
						value={draftValue}
						placeholder={metadata.placeholder}
						disabled={isDisabled}
						readOnly={isReadonly}
						autoFocus={autoFocus}
						min={metadata.min}
						max={metadata.max}
						step={step}
						data-kind={metadata.features?.kind}
						required={metadata.required}
						onBlur={restoreOrClampValue}
						onChange={(event) => {
							commitNumber(event.target.value);
						}}
					/>

					{suffix ? (
						<span className="numberField__affix numberField__affix--suffix">{suffix}</span>
					) : null}

					{metadata.features?.nudgeButtons ? (
						<>
							<button
								className="numberField__button"
								type="button"
								disabled={!canEdit}
								onClick={() => setNumber((value ?? 0) - step)}
							>
								- {step}
							</button>
							<button
								className="numberField__button"
								type="button"
								disabled={!canEdit}
								onClick={() => setNumber((value ?? 0) + step)}
							>
								+ {step}
							</button>
						</>
					) : null}

					{metadata.features?.clearButton ? (
						<button
							className="numberField__button"
							type="button"
							disabled={!canEdit || value === (metadata.min ?? 0)}
							onClick={clearValue}
						>
							Clear
						</button>
					) : null}

					{metadata.features?.resetButton ? (
						<button
							className="numberField__button"
							type="button"
							disabled={!canEdit || value === (metadata.features.resetValue ?? 0)}
							onClick={() => setNumber(metadata.features?.resetValue ?? 0)}
						>
							Reset
						</button>
					) : null}
				</div>

				{metadata.features?.kind === "priority" ? (
					<div className="numberField__hint">Higher priority runs before lower priority.</div>
				) : null}

				{hasSlider ? (
					<input
						className="numberField__slider"
						type="range"
						value={value}
						disabled={isDisabled || isReadonly}
						min={metadata.min}
						max={metadata.max}
						step={metadata.step}
						onChange={(event) => {
							commitNumber(event.target.value);
						}}
					/>
				) : null}
			</div>
		</FieldShell>
	);
}

function kindSuffix(kind: NumberFieldFeatures["kind"]) {
	if (kind === "percentage") return "%";
	return undefined;
}
