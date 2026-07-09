"use client";

import type {
	EditorControlContext,
	EditorControlMetadata,
	EditorControlProps,
	EditorSelectOption,
} from "../../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../../types/universalEditorTypes";
import {generateConditionSummary} from "../../../utils/universalEditorUtils";
import {FieldShell} from "./FieldShell";
import {renderChildControl} from "./renderChildControl";
import "./ConditionBuilderEditor.scss";

export type ConditionValue = Record<string, unknown>;

export type ConditionBuilderFeatures = {
	allowGroups?: boolean;
	allowNestedGroups?: boolean;
	maxDepth?: number;
	defaultGroupOperator?: "all" | "any" | "none";
	allowedConditionTypes?: string[];
	conditionTypeOptions?: EditorSelectOption[];
	groupOperatorOptions?: EditorSelectOption[];
	comparisonOperatorOptions?: EditorSelectOption[];
	operatorOptions?: EditorSelectOption[];
	operatorOptionsByType?: Record<string, EditorSelectOption[]>;
	conditionTypeOptionSource?: string;
	groupOperatorOptionSource?: string;
	comparisonOperatorOptionSource?: string;
	operatorOptionSource?: string;
	operatorOptionSourcesByType?: Record<string, string>;
	showGeneratedSummary?: boolean;
	compact?: boolean;
};

export type ConditionBuilderControlMetadata = EditorControlMetadata & {
	type: "condition-builder";
	features?: ConditionBuilderFeatures;
};

export type ConditionBuilderEditorProps = EditorControlProps<
	ConditionValue | ConditionValue[],
	ConditionBuilderControlMetadata
>;

const FALLBACK_CONDITION_TYPE_OPTIONS = [
	{label: "Flag", value: "flag", description: "Compare a boolean flag."},
	{label: "Counter", value: "counter", description: "Compare a numeric counter."},
	{label: "Inventory", value: "inventory", description: "Check an item list."},
	{label: "Current room", value: "current-room", description: "Check the player's room."},
	{label: "Group", value: "group", description: "Nest multiple conditions."},
];

const FALLBACK_GROUP_OPERATOR_OPTIONS = [
	{label: "All conditions", value: "all", description: "Every child condition must pass."},
	{label: "Any condition", value: "any", description: "At least one child condition must pass."},
	{label: "No conditions", value: "none", description: "No child condition may pass."},
];

const FALLBACK_OPERATOR_OPTIONS = [
	{label: "Is", value: "equals"},
	{label: "Exists", value: "exists"},
	{label: "Missing", value: "missing"},
];

const FALLBACK_COMPARISON_OPERATOR_OPTIONS = [
	{label: "Equals", value: "eq"},
	{label: "Does not equal", value: "neq"},
	{label: "Greater than", value: "gt"},
	{label: "Greater than or equal to", value: "gte"},
	{label: "Less than", value: "lt"},
	{label: "Less than or equal to", value: "lte"},
];

function optionList(
	context: EditorControlContext,
	source?: string,
	metadataOptions?: EditorSelectOption[],
	fallbackOptions: EditorSelectOption[] = [],
) {
	if (metadataOptions?.length) return metadataOptions;
	if (source) return context.getOptionList?.(source) ?? fallbackOptions;
	return fallbackOptions;
}

function conditionTypeOptions(
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
) {
	const allowedTypes = metadata.features?.allowedConditionTypes?.length
		? metadata.features.allowedConditionTypes
		: undefined;
	const options = optionList(
		context,
		metadata.features?.conditionTypeOptionSource,
		metadata.features?.conditionTypeOptions,
		FALLBACK_CONDITION_TYPE_OPTIONS,
	);

	return options.filter((option) => {
		if (option.value === "group" && metadata.features?.allowGroups === false) return false;
		return allowedTypes ? allowedTypes.includes(option.value) : true;
	});
}

function groupOperatorOptions(
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
) {
	return optionList(
		context,
		metadata.features?.groupOperatorOptionSource,
		metadata.features?.groupOperatorOptions,
		FALLBACK_GROUP_OPERATOR_OPTIONS,
	);
}

function operatorOptionsForType(
	type: string,
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
) {
	return optionList(
		context,
		metadata.features?.operatorOptionSourcesByType?.[type] ?? metadata.features?.operatorOptionSource,
		metadata.features?.operatorOptionsByType?.[type] ?? metadata.features?.operatorOptions,
		FALLBACK_OPERATOR_OPTIONS,
	);
}

function comparisonOperatorOptions(
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
) {
	return optionList(
		context,
		metadata.features?.comparisonOperatorOptionSource,
		metadata.features?.comparisonOperatorOptions,
		FALLBACK_COMPARISON_OPERATOR_OPTIONS,
	);
}

export function createDefaultCondition(type = "flag"): ConditionValue {
	if (type === "group") {
		return {
			type: "group",
			operator: "all",
			conditions: [createDefaultCondition("flag")],
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

	if (type === "inventory") {
		return {
			type,
			operation: "has-item",
			itemId: "",
		};
	}

	if (type === "current-room") {
		return {
			type,
			operation: "is",
			roomId: "",
		};
	}

	return {
		type,
		operation: "equals",
		flag: "",
		value: true,
	};
}

function getConditionType(condition: ConditionValue) {
	if (condition.kind === "group" || condition.type === "group") return "group";
	return String(condition.type ?? (condition.kind === "expression" ? "counter" : "flag"));
}

function normalizeGroupOperator(operator: unknown): "all" | "any" | "none" {
	if (operator === "or" || operator === "any") return "any";
	if (operator === "none") return "none";
	return "all";
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

	if (Array.isArray(value)) {
		const conditions = value as ConditionValue[];
		const summaryCondition = {
			type: "group",
			operator: "all",
			conditions,
		};

		function updateCondition(index: number, nextCondition: ConditionValue) {
			onChange(
				conditions.map((condition, conditionIndex) =>
					conditionIndex === index ? nextCondition : condition,
				),
			);
		}

		function removeCondition(index: number) {
			if (!canEdit) return;
			onChange(conditions.filter((_, conditionIndex) => conditionIndex !== index));
		}

		function addCondition() {
			if (!canEdit) return;
			onChange([...conditions, createDefaultCondition("flag")]);
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
					{(metadata.features?.showGeneratedSummary ?? true) ? (
						<div className="conditionBuilderEditor__summary">
							{conditions.length > 0 ? generateConditionSummary(summaryCondition) : "Always"}
						</div>
					) : null}
					<div className="conditionBuilderEditor__nested">
						{conditions.map((condition, index) => (
							<div key={index} className="conditionBuilderEditor__nestedItem">
								<ConditionNodeEditor
									value={normalizeCondition(condition)}
									onChange={(nextCondition) => updateCondition(index, nextCondition)}
									metadata={metadata}
									path={[...path, index]}
									depth={0}
									disabled={disabled}
									readonly={readonly}
									context={context}
								/>
								<button type="button" disabled={!canEdit} onClick={() => removeCondition(index)}>
									Remove
								</button>
							</div>
						))}
						<div className="conditionBuilderEditor__actions">
							<button type="button" disabled={!canEdit} onClick={addCondition}>
								Add condition
							</button>
						</div>
					</div>
				</div>
			</FieldShell>
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
				{(metadata.features?.showGeneratedSummary ?? true) ? (
					<div className="conditionBuilderEditor__summary">
						{generateConditionSummary(normalizeCondition(value))}
					</div>
				) : null}
				<ConditionNodeEditor
					value={normalizeCondition(value)}
					onChange={onChange}
					metadata={metadata}
					path={path}
					depth={0}
					disabled={disabled}
					readonly={readonly}
					context={context}
				/>
			</div>
		</FieldShell>
	);
}

function normalizeCondition(condition: ConditionValue): ConditionValue {
	if (condition.kind === "group" || condition.type === "group") {
		return {
			...condition,
			kind: "group",
			type: "group",
			operator: normalizeGroupOperator(condition.operator),
			conditions: Array.isArray(condition.conditions) ? condition.conditions : [],
		};
	}

	return condition.kind ? condition : createDefaultCondition(getConditionType(condition));
}

type ConditionNodeEditorProps = {
	value: ConditionValue;
	onChange: (nextValue: ConditionValue) => void;
	metadata: ConditionBuilderControlMetadata;
	path: Array<string | number>;
	depth: number;
	disabled?: boolean;
	readonly?: boolean;
	context: ConditionBuilderEditorProps["context"];
};

function ConditionNodeEditor({
	value,
	onChange,
	metadata,
	path,
	depth,
	disabled,
	readonly,
	context,
}: ConditionNodeEditorProps) {
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const type = getConditionType(value);
	const isGroup = type === "group";
	const maxDepth = metadata.features?.maxDepth ?? 5;
	const canAddGroup =
		canEdit &&
		(metadata.features?.allowGroups ?? true) &&
		(metadata.features?.allowNestedGroups ?? true) &&
		depth < maxDepth;
	const availableTypes = conditionTypeOptions(metadata, context).filter(
		(option) => option.value !== "group" || canAddGroup || isGroup,
	);

	function updateField(key: string, nextValue: unknown) {
		onChange({
			...value,
			[key]: nextValue,
		});
	}

	function addChild(type: "flag" | "group") {
		const conditions = Array.isArray(value.conditions) ? value.conditions : [];
		updateField("conditions", [
			...conditions,
			type === "group"
				? {
						...createDefaultCondition("group"),
						operator: metadata.features?.defaultGroupOperator ?? "all",
					}
				: createDefaultCondition("flag"),
		]);
	}

	function updateChild(index: number, nextValue: ConditionValue) {
		const conditions = Array.isArray(value.conditions) ? value.conditions : [];
		updateField(
			"conditions",
			conditions.map((condition, conditionIndex) =>
				conditionIndex === index ? nextValue : condition,
			),
		);
	}

	function removeChild(index: number) {
		const conditions = Array.isArray(value.conditions) ? value.conditions : [];
		updateField(
			"conditions",
			conditions.filter((_, conditionIndex) => conditionIndex !== index),
		);
	}

	return (
		<div className="conditionBuilderEditor__node">
			<div className="conditionBuilderEditor__row">
				{renderChildControl({
					type: "select",
					childKey: "conditionType",
					value: type,
					onChange: (nextType) => onChange(createDefaultCondition(nextType)),
					metadata: {
						title: "Type",
						appearance: {chrome: "inline", size: "sm"},
						features: {
							options: availableTypes,
							showDescriptions: true,
							searchable: availableTypes.length > 6,
						},
					},
					parentMetadata: metadata,
					path: [...path, "type"],
					disabled,
					readonly,
					context,
				})}

				{isGroup
					? renderChildControl({
							type: "select",
							childKey: "groupOperator",
							value: normalizeGroupOperator(value.operator),
							onChange: (nextOperator) => updateField("operator", nextOperator),
							metadata: {
								title: "Operator",
								appearance: {chrome: "inline", size: "sm"},
								features: {
									options: groupOperatorOptions(metadata, context),
									showDescriptions: true,
								},
							},
							parentMetadata: metadata,
							path: [...path, "operator"],
							disabled,
							readonly,
							context,
						})
					: null}
			</div>

			{isGroup ? (
				<div className="conditionBuilderEditor__nested">
					{(Array.isArray(value.conditions) ? value.conditions : []).map((condition, index) => (
						<div key={index} className="conditionBuilderEditor__nestedItem">
							<ConditionNodeEditor
								value={normalizeCondition(condition as ConditionValue)}
								onChange={(nextCondition) => updateChild(index, nextCondition)}
								metadata={metadata}
								path={[...path, "conditions", index]}
								depth={depth + 1}
								disabled={disabled}
								readonly={readonly}
								context={context}
							/>
							<button type="button" disabled={!canEdit} onClick={() => removeChild(index)}>
								Remove
							</button>
						</div>
					))}
					<div className="conditionBuilderEditor__actions">
						<button type="button" disabled={!canEdit} onClick={() => addChild("flag")}>
							Add condition
						</button>
						<button
							type="button"
							disabled={!canAddGroup}
							title={!canAddGroup && depth >= maxDepth ? "Maximum nesting depth reached." : undefined}
							onClick={() => addChild("group")}
						>
							Add group
						</button>
					</div>
				</div>
			) : (
				<ConditionLeafFields
					value={value}
					onChange={updateField}
					metadata={metadata}
					path={path}
					disabled={disabled}
					readonly={readonly}
					context={context}
				/>
			)}
		</div>
	);
}

function ConditionLeafFields({
	value,
	onChange,
	metadata,
	path,
	disabled,
	readonly,
	context,
}: {
	value: ConditionValue;
	onChange: (key: string, nextValue: unknown) => void;
	metadata: ConditionBuilderControlMetadata;
	path: Array<string | number>;
	disabled?: boolean;
	readonly?: boolean;
	context: ConditionBuilderEditorProps["context"];
}) {
	const type = getConditionType(value);
	const operatorOptions = operatorOptionsForType(type, metadata, context);
	const comparisonOptions = comparisonOperatorOptions(metadata, context);
	const hasComparisonOperator =
		value.operator !== undefined ||
		(type === "counter" && String(value.operation ?? "") === "compare") ||
		(type === "inventory" && ["count", "tag-count"].includes(String(value.operation ?? "")));

	if (type === "flag") {
		const operatorOptions = operatorOptionsForType(type, metadata, context);
		const operation = String(value.operation ?? "equals");

		return (
			<div className="conditionBuilderEditor__fields">
				{renderChildControl({
					type: "select",
					childKey: "operation",
					value: operation,
					onChange: (nextValue) => onChange("operation", nextValue),
					metadata: {
						title: "Operation",
						appearance: {chrome: "inline", size: "sm"},
						features: {options: operatorOptions, searchable: operatorOptions.length > 6},
					},
					parentMetadata: metadata,
					path: [...path, "operation"],
					disabled,
					readonly,
					context,
				})}
				{renderChildControl({
					type: "flag-picker",
					childKey: "flag",
					value: String(value.flag ?? ""),
					onChange: (nextValue) => onChange("flag", nextValue),
					metadata: {
						title: "Flag",
						appearance: {chrome: "inline", size: "sm"},
						features: {allowCreate: true, clearButton: true},
					},
					parentMetadata: metadata,
					path: [...path, "flag"],
					disabled,
					readonly,
					context,
				})}
				{operation === "equals"
					? renderChildControl({
							type: "toggle",
							childKey: "value",
							value: Boolean(value.value ?? true),
							onChange: (nextValue) => onChange("value", nextValue),
							metadata: {
								title: "Expected",
								appearance: {chrome: "inline", size: "sm"},
							},
							parentMetadata: metadata,
							path: [...path, "value"],
							disabled,
							readonly,
							context,
						})
					: null}
			</div>
		);
	}

	return (
		<div className="conditionBuilderEditor__fields">
			{renderChildControl({
				type: "select",
				childKey: "operation",
				value: String(value.operation ?? value.operator ?? ""),
				onChange: (nextValue) => onChange("operation", nextValue),
				metadata: {
					title: "Operation",
					appearance: {chrome: "inline", size: "sm"},
					features: {options: operatorOptions, searchable: operatorOptions.length > 6},
				},
				parentMetadata: metadata,
				path: [...path, "operation"],
				disabled,
				readonly,
				context,
			})}
			{hasComparisonOperator
				? renderChildControl({
						type: "select",
						childKey: "comparisonOperator",
						value: String(value.operator ?? "eq"),
						onChange: (nextValue) => onChange("operator", nextValue),
						metadata: {
							title: "Compare",
							appearance: {chrome: "inline", size: "sm"},
							features: {options: comparisonOptions, searchable: comparisonOptions.length > 6},
						},
						parentMetadata: metadata,
						path: [...path, "operator"],
						disabled,
						readonly,
						context,
					})
				: null}
			{renderChildControl({
				type: type === "current-room" ? "room-picker" : "text",
				childKey: "subject",
				value: String(value.subject ?? value.counter ?? value.itemId ?? value.roomId ?? ""),
				onChange: (nextValue) => {
					if (type === "counter") onChange("counter", nextValue);
					else if (type === "inventory") onChange("itemId", nextValue);
					else if (type === "current-room") onChange("roomId", nextValue);
					else onChange("subject", nextValue);
				},
				metadata: {
					title: type === "current-room" ? "Room" : type === "counter" ? "Counter" : "Subject",
					appearance: {chrome: "inline", size: "sm"},
					features: {clearButton: true},
				},
				parentMetadata: metadata,
				path: [...path, "subject"],
				disabled,
				readonly,
				context,
			})}
			{value.value !== undefined || type === "counter"
				? renderChildControl({
						type: typeof value.value === "number" || type === "counter" ? "number" : "text",
						childKey: "value",
						value: (value.value ?? 0) as string | number,
						onChange: (nextValue) => onChange("value", nextValue),
						metadata: {
							title: "Value",
							appearance: {chrome: "inline", size: "sm"},
							features: {clearButton: true},
						},
						parentMetadata: metadata,
						path: [...path, "value"],
						disabled,
						readonly,
						context,
					})
				: null}
		</div>
	);
}
