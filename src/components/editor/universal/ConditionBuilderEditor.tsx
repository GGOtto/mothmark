"use client";

import type {EditorControlMetadata, EditorControlProps} from "../../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./ConditionBuilderEditor.scss";

export type ConditionValue = Record<string, unknown>;

export type ConditionBuilderFeatures = {
	allowNestedGroups?: boolean;
	maxDepth?: number;
	allowedConditionTypes?: string[];
	compact?: boolean;
};

export type ConditionBuilderControlMetadata = EditorControlMetadata & {
	type: "condition-builder";
	features?: ConditionBuilderFeatures;
};

export type ConditionBuilderEditorProps = EditorControlProps<
	ConditionValue,
	ConditionBuilderControlMetadata
>;

const DEFAULT_CONDITION_TYPES = [
	"flag",
	"counter",
	"current-room",
	"inventory",
	"room-history",
	"random-chance",
];

function conditionTypeOptions(allowedConditionTypes?: string[]) {
	return allowedConditionTypes?.length ? allowedConditionTypes : DEFAULT_CONDITION_TYPES;
}

function defaultCondition(type: string): ConditionValue {
	if (type === "group") {
		return {
			type: "group",
			operator: "and",
			conditions: [],
		};
	}

	if (type === "counter") {
		return {
			type,
			operation: "compare",
			counter: "",
			operator: "eq",
			value: 0,
		};
	}

	if (type === "current-room") {
		return {
			type,
			operation: "is",
			roomId: "",
		};
	}

	if (type === "inventory") {
		return {
			type,
			operation: "has-item",
			itemId: "",
		};
	}

	if (type === "random-chance") {
		return {
			type,
			chance: 0.5,
			invert: false,
		};
	}

	return {
		type,
		operation: "equals",
		flag: "",
		value: true,
	};
}

function scalarInputType(value: unknown) {
	if (typeof value === "number") return "number";
	if (typeof value === "boolean") return "checkbox";
	return "text";
}

export function ConditionBuilderEditor({
	value,
	onChange,
	metadata,
	path,
	error,
	warnings,
	disabled,
	readonly,
	context,
}: ConditionBuilderEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const allowedTypes = conditionTypeOptions(metadata.features?.allowedConditionTypes);
	const selectedType = String(value.type ?? allowedTypes[0] ?? "flag");
	const isGroup = selectedType === "group";

	function updateField(key: string, nextValue: unknown) {
		onChange({
			...value,
			[key]: nextValue,
		});
	}

	function addNestedCondition() {
		const conditions = Array.isArray(value.conditions) ? value.conditions : [];
		updateField("conditions", [...conditions, defaultCondition("flag")]);
	}

	function updateNestedCondition(index: number, nextCondition: unknown) {
		const conditions = Array.isArray(value.conditions) ? value.conditions : [];
		updateField(
			"conditions",
			conditions.map((condition, conditionIndex) =>
				conditionIndex === index ? nextCondition : condition,
			),
		);
	}

	function removeNestedCondition(index: number) {
		const conditions = Array.isArray(value.conditions) ? value.conditions : [];
		updateField(
			"conditions",
			conditions.filter((_, conditionIndex) => conditionIndex !== index),
		);
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
					"conditionBuilderEditor",
					metadata.features?.compact ? "conditionBuilderEditor--compact" : "",
				]
					.filter(Boolean)
					.join(" ")}
			>
				<div className="conditionBuilderEditor__row">
					<label>
						<span>Type</span>
						<select
							value={selectedType}
							disabled={!canEdit}
							onChange={(event) => onChange(defaultCondition(event.target.value))}
						>
							{allowedTypes.map((type) => (
								<option key={type} value={type}>
									{type}
								</option>
							))}
							{metadata.features?.allowNestedGroups ? <option value="group">group</option> : null}
						</select>
					</label>

					{isGroup ? (
						<label>
							<span>Operator</span>
							<select
								value={String(value.operator ?? "and")}
								disabled={!canEdit}
								onChange={(event) => updateField("operator", event.target.value)}
							>
								<option value="and">and</option>
								<option value="or">or</option>
							</select>
						</label>
					) : null}
				</div>

				{isGroup ? (
					<div className="conditionBuilderEditor__nested">
						{(Array.isArray(value.conditions) ? value.conditions : []).map((condition, index) => (
							<div key={index} className="conditionBuilderEditor__nestedItem">
								<ConditionBuilderEditor
									value={condition as ConditionValue}
									onChange={(nextCondition) => updateNestedCondition(index, nextCondition)}
									metadata={{
										type: "condition-builder",
										features: {
											...metadata.features,
											compact: true,
										},
									}}
									path={[...path, "conditions", index]}
									disabled={disabled}
									readonly={readonly}
									context={context}
								/>
								<button type="button" disabled={!canEdit} onClick={() => removeNestedCondition(index)}>
									Remove
								</button>
							</div>
						))}
						<button type="button" disabled={!canEdit} onClick={addNestedCondition}>
							Add condition
						</button>
					</div>
				) : (
					<div className="conditionBuilderEditor__fields">
						{Object.entries(value)
							.filter(([key]) => key !== "type")
							.map(([key, fieldValue]) => (
								<label key={key}>
									<span>{key}</span>
									<input
										type={scalarInputType(fieldValue)}
										checked={typeof fieldValue === "boolean" ? fieldValue : undefined}
										value={typeof fieldValue === "boolean" ? undefined : String(fieldValue ?? "")}
										disabled={!canEdit}
										onChange={(event) => {
											if (typeof fieldValue === "boolean") {
												updateField(key, event.target.checked);
												return;
											}

											if (typeof fieldValue === "number") {
												updateField(key, Number(event.target.value));
												return;
											}

											updateField(key, event.target.value);
										}}
									/>
								</label>
							))}
					</div>
				)}
			</div>
		</FieldShell>
	);
}
