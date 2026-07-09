"use client";

import type {
	EditorControlMetadata,
	EditorControlProps,
	EditorPath,
} from "../../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import {renderEditorControl} from "./renderEditorControl";
import "./ObjectEditor.scss";

export type ObjectFieldMetadata = {
	key: string;
	metadata: EditorControlMetadata & Record<string, unknown>;
	defaultValue?: unknown;
	error?: string;
	warnings?: string[];
};

export type ObjectFeatures = {
	collapsible?: boolean;
	defaultCollapsed?: boolean;
	showFieldCount?: boolean;
	layout?: "stack" | "grid" | "section";
	fields?: ObjectFieldMetadata[];
	emptyTitle?: string;
	emptyDescription?: string;
	emptyActionLabel?: string;
	defaultValue?: Record<string, unknown>;
};

export type ObjectControlMetadata = EditorControlMetadata & {
	type: "object";
	features?: ObjectFeatures;
};

export type ObjectEditorProps = EditorControlProps<Record<string, unknown>, ObjectControlMetadata>;

function isObjectValue(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown) {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (value === null) return "null";
	return JSON.stringify(value, null, 2);
}

export function ObjectEditor({
	value,
	onChange,
	metadata,
	path,
	error,
	warnings,
	disabled,
	readonly,
	context,
}: ObjectEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const fields = metadata.features?.fields ?? [];
	const entries = Object.entries(value);
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const content = (
		<div
			className={[
				"objectEditor__fields",
				`objectEditor__fields--${metadata.features?.layout ?? "stack"}`,
			].join(" ")}
		>
			{fields.length > 0
				? fields.map((field) => {
						const childPath: EditorPath = [...path, field.key];
						const childValue = value[field.key] ?? field.defaultValue;

						return (
							<div key={field.key} className="objectEditor__field">
								{renderEditorControl({
									value: childValue,
									onChange: (nextValue) => {
										onChange({
											...value,
											[field.key]: nextValue,
										});
									},
									metadata: field.metadata,
									path: childPath,
									error: field.error,
									warnings: field.warnings,
									disabled,
									readonly,
									context,
								})}
							</div>
						);
					})
				: entries.map(([key, entryValue]) => (
						<div key={key} className="objectEditor__previewRow">
							<span className="objectEditor__previewKey">{key}</span>
							<pre className="objectEditor__previewValue">{formatValue(entryValue)}</pre>
						</div>
					))}

			{fields.length === 0 && entries.length === 0 ? (
				<div className="objectEditor__empty">
					<strong>{metadata.features?.emptyTitle ?? "Empty object"}</strong>
					{metadata.features?.emptyDescription ? (
						<span>{metadata.features.emptyDescription}</span>
					) : null}
					{metadata.features?.defaultValue ? (
						<button
							type="button"
							disabled={!canEdit}
							onClick={() => onChange(metadata.features?.defaultValue ?? {})}
						>
							{metadata.features.emptyActionLabel ?? "Add defaults"}
						</button>
					) : null}
				</div>
			) : null}
		</div>
	);
	const fieldCount = fields.length || entries.length;

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
			<div className="objectEditor">
				{metadata.features?.collapsible ? (
					<details className="objectEditor__details" open={!metadata.features.defaultCollapsed}>
						<summary className="objectEditor__summary">
							<span>{metadata.placeholder ?? "Object fields"}</span>
							{metadata.features.showFieldCount ? <span>{fieldCount} fields</span> : null}
						</summary>
						{content}
					</details>
				) : (
					<>
						{metadata.features?.showFieldCount ? (
							<div className="objectEditor__count">{fieldCount} fields</div>
						) : null}
						{content}
					</>
				)}
			</div>
		</FieldShell>
	);
}

export {isObjectValue};
