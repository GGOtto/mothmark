"use client";

import {useEffect, useState} from "react";
import {Pencil, Plus, Trash2} from "lucide-react";
import type {CSSProperties, ReactNode} from "react";
import {
	comparisonOperatorOptions as defaultComparisonOperatorOptions,
	conditionGroupOperatorOptions,
	conditionOperationOptionsByType,
	conditionTypeOptions as defaultConditionTypeOptions,
	createDefaultConditionValue,
	stringComparisonOperatorOptions,
} from "@/schemas/editorCatalogs";
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
	allowEmptyGroups?: boolean;
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
	showSummary?: boolean;
	showNaturalLanguagePreview?: boolean;
	compact?: boolean;
	addConditionLabel?: string;
	addGroupLabel?: string;
};

export type ConditionBuilderControlMetadata = EditorControlMetadata & {
	type: "condition-builder";
	features?: ConditionBuilderFeatures;
};

export type ConditionBuilderEditorProps = EditorControlProps<
	ConditionValue | ConditionValue[],
	ConditionBuilderControlMetadata
>;

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
		defaultConditionTypeOptions,
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
		conditionGroupOperatorOptions,
	);
}

function operationOptionsForType(
	type: string,
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
) {
	return optionList(
		context,
		metadata.features?.operatorOptionSourcesByType?.[type] ?? metadata.features?.operatorOptionSource,
		metadata.features?.operatorOptionsByType?.[type] ?? metadata.features?.operatorOptions,
		conditionOperationOptionsByType[type] ?? [{label: "Equals", value: "equals"}],
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
		defaultComparisonOperatorOptions,
	);
}

function shouldShowSummary(metadata: ConditionBuilderControlMetadata) {
	return (
		metadata.features?.showGeneratedSummary ??
		metadata.features?.showSummary ??
		metadata.features?.showNaturalLanguagePreview ??
		true
	);
}

export function createDefaultCondition(type = "flag"): ConditionValue {
	return createDefaultConditionValue(type);
}

function getConditionType(condition: ConditionValue) {
	if (condition.type === "condition-ref") return "condition-ref";
	if (condition.kind === "group" || condition.type === "group") return "group";
	return String(condition.type ?? (condition.kind === "expression" ? "counter" : "flag"));
}

function normalizeGroupOperator(operator: unknown): "all" | "any" | "none" {
	if (operator === "or" || operator === "any") return "any";
	if (operator === "none") return "none";
	return "all";
}

function normalizeCondition(condition: ConditionValue): ConditionValue {
	if (condition.type === "condition-ref") {
		return {
			type: "condition-ref",
			conditionId: typeof condition.conditionId === "string" ? condition.conditionId : "",
		};
	}

	if (condition.kind === "group" || condition.type === "group") {
		return {
			...condition,
			kind: "group",
			type: "group",
			operator: normalizeGroupOperator(condition.operator),
			conditions: Array.isArray(condition.conditions) ? condition.conditions : [],
		};
	}

	const type = getConditionType(condition);
	return {
		...createDefaultCondition(type),
		...condition,
		type,
	};
}

function groupTitle(operator: unknown) {
	const normalized = normalizeGroupOperator(operator);
	if (normalized === "any") return "Any of these can pass";
	if (normalized === "none") return "None of these may pass";
	return "All of these must pass";
}

function typeLabel(
	type: string,
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
) {
	return (
		conditionTypeOptions(metadata, context).find((option) => option.value === type)?.label ?? type
	);
}

function conditionListName(
	condition: ConditionValue,
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
	index: number,
) {
	const explicitName = condition.name ?? condition.label ?? condition.title;
	if (typeof explicitName === "string" && explicitName.trim().length > 0) return explicitName.trim();

	const type = getConditionType(condition);
	if (type === "group") return `Group ${index + 1}`;
	return `${typeLabel(type, metadata, context)} ${index + 1}`;
}

function hasStoredConditionName(condition: ConditionValue) {
	return [condition.name, condition.label, condition.title].some(
		(value) => typeof value === "string" && value.trim().length > 0,
	);
}

function storedConditionName(condition: ConditionValue) {
	const explicitName = condition.name ?? condition.label ?? condition.title;
	return typeof explicitName === "string" && explicitName.trim().length > 0
		? explicitName.trim()
		: undefined;
}

function storedConditionId(condition: ConditionValue) {
	return typeof condition.id === "string" && condition.id.trim().length > 0
		? condition.id.trim()
		: undefined;
}

function uniqueSiblingValue(
	baseValue: string,
	siblings: ConditionValue[],
	readValue: (condition: ConditionValue) => string | undefined,
) {
	const usedNames = new Set(
		siblings
			.map(readValue)
			.filter((name): name is string => Boolean(name))
			.map((name) => name.toLowerCase()),
	);
	if (!usedNames.has(baseValue.toLowerCase())) return baseValue;

	const numberedMatch = baseValue.match(/^(.*?)(?:[-\s]+(\d+))$/);
	const rootName = numberedMatch?.[1]?.trim() || baseValue;
	const separator = baseValue.includes("-") ? "-" : " ";
	let index = numberedMatch?.[2] ? Number(numberedMatch[2]) + 1 : 2;
	let nextName = `${rootName}${separator}${index}`;

	while (usedNames.has(nextName.toLowerCase())) {
		index += 1;
		nextName = `${rootName}${separator}${index}`;
	}

	return nextName;
}

function uniqueConditionName(baseName: string, siblings: ConditionValue[]) {
	return uniqueSiblingValue(baseName, siblings, storedConditionName);
}

function conditionIdPrefix(type: string) {
	const normalizedType = type.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
	return normalizedType || "condition";
}

function uniqueConditionId(condition: ConditionValue, siblings: ConditionValue[]) {
	const type = getConditionType(condition);
	return uniqueSiblingValue(`${conditionIdPrefix(type)}-1`, siblings, storedConditionId);
}

function generatedConditionNameForType(
	type: string,
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
	siblings: ConditionValue[],
) {
	const typeCount = siblings.filter((condition) => getConditionType(condition) === type).length;
	if (type === "group") return `Group ${typeCount + 1}`;
	return `${typeLabel(type, metadata, context)} ${typeCount + 1}`;
}

function ensureConditionIdentity(
	condition: ConditionValue,
	index: number,
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
	siblings: ConditionValue[],
) {
	return {
		...condition,
		id: storedConditionId(condition) ?? uniqueConditionId(condition, siblings),
		name:
			storedConditionName(condition) ??
			uniqueConditionName(conditionListName(condition, metadata, context, index), siblings),
	};
}

function createNamedCondition(
	type: "flag" | "group",
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
	siblings: ConditionValue[],
	overrides: ConditionValue = {},
) {
	const condition = {
		...createDefaultCondition(type),
		...overrides,
	};
	if (type === "group" && Array.isArray(condition.conditions)) {
		const identifiedChildren: ConditionValue[] = [];
		condition.conditions = condition.conditions.map((childCondition, childIndex) => {
			const nextCondition = ensureConditionIdentity(
				normalizeCondition(childCondition as ConditionValue),
				childIndex,
				metadata,
				context,
				identifiedChildren,
			);
			identifiedChildren.push(nextCondition);
			return nextCondition;
		});
	}

	return {
		...condition,
		id: uniqueConditionId(condition, siblings),
		name: uniqueConditionName(
			generatedConditionNameForType(getConditionType(condition), metadata, context, siblings),
			siblings,
		),
	};
}

function conditionDisplayNameFields(condition: ConditionValue) {
	return {
		id: condition.id,
		name: condition.name,
		label: condition.label,
		title: condition.title,
		allowMultipleUsesInWorld: condition.allowMultipleUsesInWorld,
	};
}

function worldConditions(context: EditorControlContext) {
	const conditions = context.getWorldValue?.(["conditions"]) ?? context.getValue(["conditions"]);
	return Array.isArray(conditions) ? (conditions as ConditionValue[]).map(normalizeCondition) : [];
}

function worldConditionById(context: EditorControlContext, id: unknown) {
	if (typeof id !== "string" || !id.trim()) return undefined;
	return worldConditions(context).find((condition) => storedConditionId(condition) === id.trim());
}

function worldConditionIndexById(context: EditorControlContext, id: unknown) {
	if (typeof id !== "string" || !id.trim()) return -1;
	return worldConditions(context).findIndex(
		(condition) => storedConditionId(condition) === id.trim(),
	);
}

function updateWorldConditionById(
	context: EditorControlContext,
	id: unknown,
	nextCondition: ConditionValue,
) {
	const conditionIndex = worldConditionIndexById(context, id);
	if (conditionIndex < 0) return false;

	const conditions = worldConditions(context);
	const nextConditions = conditions.map((condition, index) =>
		index === conditionIndex ? nextCondition : condition,
	);

	if (context.setWorldValue) {
		context.setWorldValue(["conditions"], nextConditions);
	} else {
		context.setValue(["conditions"], nextConditions);
	}

	return true;
}

function isConditionReference(condition: ConditionValue) {
	return condition.type === "condition-ref";
}

function isWorldConditionEditorPath(path: Array<string | number>) {
	return path[0] === "conditions" && typeof path[1] === "number";
}

function conditionUsage(
	condition: ConditionValue,
	context: EditorControlContext,
	seenConditionIds = new Set<string>(),
): ConditionValue {
	if (isConditionReference(condition)) {
		const conditionId = typeof condition.conditionId === "string" ? condition.conditionId.trim() : "";
		if (!conditionId || seenConditionIds.has(conditionId)) return condition;

		const worldCondition = worldConditionById(context, conditionId);
		if (!worldCondition) return condition;

		const nextSeenConditionIds = new Set(seenConditionIds);
		nextSeenConditionIds.add(conditionId);
		return conditionUsage(worldCondition, context, nextSeenConditionIds);
	}

	if (getConditionType(condition) === "group" && Array.isArray(condition.conditions)) {
		return {
			...condition,
			conditions: condition.conditions.map((childCondition) =>
				conditionUsage(childCondition as ConditionValue, context, seenConditionIds),
			),
		};
	}

	return condition;
}

function uniqueWorldConditionId(condition: ConditionValue, context: EditorControlContext) {
	return uniqueConditionId(condition, worldConditions(context));
}

function uniqueWorldConditionName(
	condition: ConditionValue,
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
) {
	return uniqueConditionName(
		generatedConditionNameForType(
			getConditionType(condition),
			metadata,
			context,
			worldConditions(context),
		),
		worldConditions(context),
	);
}

function createWorldConditionDefinition(
	type: "flag" | "group",
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
	overrides: ConditionValue = {},
) {
	const condition = {
		...createDefaultCondition(type),
		...overrides,
	};
	const nextCondition = {
		...condition,
		id: uniqueWorldConditionId(condition, context),
		name: uniqueWorldConditionName(condition, metadata, context),
		allowMultipleUsesInWorld: false,
	};
	return nextCondition;
}

function createWorldCondition(
	type: "flag" | "group",
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
	overrides: ConditionValue = {},
) {
	const nextCondition = createWorldConditionDefinition(type, metadata, context, overrides);
	const conditions = worldConditions(context);
	if (context.setWorldValue) {
		context.setWorldValue(["conditions"], [...conditions, nextCondition]);
	} else {
		context.setValue(["conditions"], [...conditions, nextCondition]);
	}

	return nextCondition;
}

function conditionRefFor(condition: ConditionValue) {
	return {
		type: "condition-ref",
		conditionId: storedConditionId(condition) ?? "",
	};
}

function materializeWorldConditionDefinition(
	condition: ConditionValue,
	index: number,
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
	pendingConditions: ConditionValue[],
): ConditionValue {
	const normalizedCondition = normalizeCondition(condition);
	const siblingConditions = [...worldConditions(context), ...pendingConditions];
	const identifiedCondition: ConditionValue = ensureConditionIdentity(
		normalizedCondition,
		index,
		metadata,
		context,
		siblingConditions,
	);

	if (getConditionType(identifiedCondition) !== "group") return identifiedCondition;

	const childConditions = Array.isArray(identifiedCondition.conditions)
		? (identifiedCondition.conditions as ConditionValue[])
		: [];
	const nextChildRefs = childConditions.map((childCondition, childIndex) => {
		if (isConditionReference(childCondition)) return childCondition;

		const childDefinition = materializeWorldConditionDefinition(
			childCondition,
			childIndex,
			metadata,
			context,
			pendingConditions,
		);
		pendingConditions.push(childDefinition);
		return conditionRefFor(childDefinition);
	});

	return {
		...identifiedCondition,
		conditions: nextChildRefs,
	};
}

function reusableWorldConditions(context: EditorControlContext) {
	return worldConditions(context).filter(
		(condition) => condition.allowMultipleUsesInWorld === true && storedConditionId(condition),
	);
}

function hasWorldConditionLibrary(context: EditorControlContext) {
	return Array.isArray(context.getWorldValue?.(["conditions"]) ?? context.getValue(["conditions"]));
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
	const addConditionLabel = metadata.features?.addConditionLabel ?? "Add condition";
	const addGroupLabel = metadata.features?.addGroupLabel ?? "Add group";
	const className = [
		"conditionBuilderEditor",
		metadata.features?.compact ? "conditionBuilderEditor--compact" : "",
	]
		.filter(Boolean)
		.join(" ");
	const isConditionList = Array.isArray(value);
	const singleCondition = isConditionList ? undefined : normalizeCondition(value as ConditionValue);
	const worldConditionIndex =
		!isConditionList && isWorldConditionEditorPath(path) && typeof path[1] === "number"
			? path[1]
			: undefined;

	useEffect(() => {
		if (!isConditionList || !canEdit || !hasWorldConditionLibrary(context)) return;

		const conditions = value.map((condition) => normalizeCondition(condition as ConditionValue));
		if (conditions.every(isConditionReference)) return;

		const nextWorldConditions = worldConditions(context);
		const pendingConditions: ConditionValue[] = [];
		const nextRefs = conditions.map((condition, index) => {
			if (isConditionReference(condition)) return condition;

			const nextCondition = materializeWorldConditionDefinition(
				condition,
				index,
				metadata,
				context,
				pendingConditions,
			);
			pendingConditions.push(nextCondition);
			return conditionRefFor(nextCondition);
		});

		if (context.setWorldValue) {
			context.setWorldValue(["conditions"], [...nextWorldConditions, ...pendingConditions]);
		} else {
			context.setValue(["conditions"], [...nextWorldConditions, ...pendingConditions]);
		}
		onChange(nextRefs);
	}, [canEdit, context, isConditionList, metadata, onChange, value]);

	useEffect(() => {
		if (isConditionList || !singleCondition || !canEdit || worldConditionIndex === undefined) {
			return;
		}

		if (hasStoredConditionName(singleCondition) && storedConditionId(singleCondition)) return;

		const siblingConditions = worldConditions(context).filter(
			(_, conditionIndex) => conditionIndex !== worldConditionIndex,
		);
		onChange(
			ensureConditionIdentity(
				singleCondition,
				worldConditionIndex,
				metadata,
				context,
				siblingConditions,
			),
		);
	}, [canEdit, context, isConditionList, metadata, onChange, singleCondition, worldConditionIndex]);

	if (isConditionList) {
		const conditions = value.map((condition) => normalizeCondition(condition as ConditionValue));
		const summaryConditions = conditions.map((condition) => conditionUsage(condition, context));
		const summaryCondition = {
			type: "group",
			operator: "all",
			conditions: summaryConditions,
		};
		const canAddGroup = canEdit && (metadata.features?.allowGroups ?? true);

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

		function addCondition(type: "flag" | "group") {
			if (!canEdit) return;
			if (type === "group" && !canAddGroup) return;
			if (hasWorldConditionLibrary(context)) {
				const nextCondition = createWorldCondition(
					type,
					metadata,
					context,
					type === "group" ? {operator: metadata.features?.defaultGroupOperator ?? "all"} : {},
				);
				onChange([...conditions, conditionRefFor(nextCondition)]);
				return;
			}
			onChange([
				...conditions,
				createNamedCondition(
					type,
					metadata,
					context,
					conditions,
					type === "group" ? {operator: metadata.features?.defaultGroupOperator ?? "all"} : {},
				),
			]);
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
				<div className={className}>
					{shouldShowSummary(metadata) ? (
						<ConditionSummary
							title="Allowed when"
							summary={conditions.length > 0 ? generateConditionSummary(summaryCondition) : "Always"}
							isEmpty={conditions.length === 0}
						/>
					) : null}

					<ConditionLinkList
						conditions={conditions}
						onUpdateCondition={updateCondition}
						onRemoveCondition={removeCondition}
						metadata={metadata}
						path={path}
						depth={0}
						canEdit={canEdit}
						disabled={disabled}
						readonly={readonly}
						context={context}
						emptyState={<ConditionEmptyState />}
						addConditionLabel={addConditionLabel}
						addGroupLabel={addGroupLabel}
						canAddCondition={canEdit}
						canAddGroup={canAddGroup}
						onAddCondition={() => addCondition("flag")}
						onAddGroup={() => addCondition("group")}
						onAddExistingCondition={(conditionId) =>
							onChange([...conditions, {type: "condition-ref", conditionId}])
						}
					/>
				</div>
			</FieldShell>
		);
	}

	const condition = singleCondition ?? normalizeCondition(value as ConditionValue);

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
			<div className={className}>
				{shouldShowSummary(metadata) ? (
					<ConditionSummary
						title="Allowed when"
						summary={generateConditionSummary(conditionUsage(condition, context))}
					/>
				) : null}
				<ConditionNodeEditor
					value={condition}
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

function ConditionSummary({
	title,
	summary,
	isEmpty,
}: {
	title: string;
	summary: string;
	isEmpty?: boolean;
}) {
	return (
		<div className="conditionBuilderEditor__summary" data-empty={isEmpty || undefined}>
			<span>{title}</span>
			<strong>{summary}</strong>
		</div>
	);
}

function ConditionEmptyState() {
	return (
		<div className="conditionBuilderEditor__empty">
			<strong>No conditions yet</strong>
			<span>This rule is currently always allowed. Add a condition to make it conditional.</span>
		</div>
	);
}

function ConditionLinkList({
	conditions,
	onUpdateCondition,
	onRemoveCondition,
	metadata,
	path,
	depth,
	canEdit,
	disabled,
	readonly,
	context,
	emptyState,
	addConditionLabel,
	addGroupLabel,
	canAddCondition,
	canAddGroup,
	onAddCondition,
	onAddGroup,
	onAddExistingCondition,
	groupTitle,
}: {
	conditions: ConditionValue[];
	onUpdateCondition: (index: number, nextCondition: ConditionValue) => void;
	onRemoveCondition: (index: number) => void;
	metadata: ConditionBuilderControlMetadata;
	path: Array<string | number>;
	depth: number;
	canEdit: boolean;
	disabled?: boolean;
	readonly?: boolean;
	context: ConditionBuilderEditorProps["context"];
	emptyState: ReactNode;
	addConditionLabel: string;
	addGroupLabel: string;
	canAddCondition: boolean;
	canAddGroup: boolean;
	onAddCondition: () => void;
	onAddGroup: () => void;
	onAddExistingCondition?: (conditionId: string) => void;
	groupTitle?: string;
}) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const canOpenChildEditor = typeof context.editorNavigation?.openEditorLink === "function";
	const safeSelectedIndex =
		conditions.length > 0 ? Math.min(selectedIndex, conditions.length - 1) : 0;
	const selectedConditionReference = canOpenChildEditor ? undefined : conditions[safeSelectedIndex];
	const selectedWorldCondition =
		selectedConditionReference && isConditionReference(selectedConditionReference)
			? worldConditionById(context, selectedConditionReference.conditionId)
			: undefined;
	const selectedWorldConditionIndex =
		selectedConditionReference && isConditionReference(selectedConditionReference)
			? worldConditionIndexById(context, selectedConditionReference.conditionId)
			: -1;
	const selectedCondition = selectedWorldCondition ?? selectedConditionReference;
	const reusableConditions =
		canEdit && onAddExistingCondition && hasWorldConditionLibrary(context)
			? reusableWorldConditions(context)
			: [];

	function removeCondition(index: number) {
		onRemoveCondition(index);
		setSelectedIndex((currentIndex) => {
			if (conditions.length <= 1) return 0;
			if (currentIndex > index) return currentIndex - 1;
			if (currentIndex === index) return Math.max(0, Math.min(index, conditions.length - 2));
			return currentIndex;
		});
	}

	function addAndSelect(add: () => void) {
		add();
		setSelectedIndex(conditions.length);
	}

	function openCondition(index: number) {
		const condition = conditions[index];
		const usage = conditionUsage(condition, context);
		const name = conditionListName(usage, metadata, context, index);

		if (
			canEdit &&
			!isConditionReference(condition) &&
			(!hasStoredConditionName(condition) || !storedConditionId(condition))
		) {
			const siblingConditions = conditions.filter((_, conditionIndex) => conditionIndex !== index);
			onUpdateCondition(
				index,
				ensureConditionIdentity(condition, index, metadata, context, siblingConditions),
			);
		}

		if (canOpenChildEditor) {
			const conditionId = isConditionReference(condition)
				? String(condition.conditionId ?? "")
				: storedConditionId(condition);
			const opensWorldCondition = Boolean(conditionId && worldConditionById(context, conditionId));
			context.editorNavigation?.openEditorLink?.({
				ref: {
					type: "condition",
					id: conditionId ?? String(index),
					label: name,
				},
				target: {
					kind: "condition",
					entityType: opensWorldCondition ? "condition" : undefined,
					controlType: "condition-builder",
					showBackLink: true,
					backLabel: groupTitle ? "Back to group conditions" : "Back to conditions",
				},
				sourcePath: path,
			});
			return;
		}

		setSelectedIndex(index);
	}

	function addExistingCondition(conditionId: string) {
		if (!conditionId || !onAddExistingCondition) return;
		onAddExistingCondition(conditionId);
		setSelectedIndex(conditions.length);
	}

	return (
		<div className="conditionBuilderEditor__linkList">
			<div className="conditionBuilderEditor__linkItems">
				{conditions.length === 0 ? emptyState : null}
				{conditions.map((condition, index) => {
					const usage = conditionUsage(condition, context);
					const name = conditionListName(usage, metadata, context, index);
					const summary = generateConditionSummary(usage);
					const isSelected = !canOpenChildEditor && index === safeSelectedIndex;
					const missingReference = isConditionReference(condition) && usage === condition;

					return (
						<div
							key={index}
							className={[
								"conditionBuilderEditor__linkItem",
								isSelected ? "conditionBuilderEditor__linkItem--active" : "",
							]
								.filter(Boolean)
								.join(" ")}
						>
							<button
								className="conditionBuilderEditor__linkButton"
								type="button"
								aria-pressed={isSelected}
								onClick={() => openCondition(index)}
							>
								<Pencil size={13} aria-hidden="true" />
								<span className="conditionBuilderEditor__linkContent">
									<span className="conditionBuilderEditor__linkText">{name}</span>
									<span className="conditionBuilderEditor__linkSummary">
										{missingReference ? "Missing world condition" : summary}
									</span>
								</span>
								<span className="conditionBuilderEditor__linkHint">{isSelected ? "Editing" : "Edit"}</span>
							</button>
							<button
								className="conditionBuilderEditor__linkRemoveButton"
								type="button"
								disabled={!canEdit}
								aria-label={`Remove ${name}`}
								title={`Remove ${name}`}
								onClick={() => removeCondition(index)}
							>
								<Trash2 size={13} aria-hidden="true" />
							</button>
						</div>
					);
				})}
			</div>

			<ConditionActions
				addConditionLabel={addConditionLabel}
				addGroupLabel={addGroupLabel}
				canAddCondition={canAddCondition}
				canAddGroup={canAddGroup}
				onAddCondition={() => addAndSelect(onAddCondition)}
				onAddGroup={() => addAndSelect(onAddGroup)}
				reusableConditions={reusableConditions}
				onAddExistingCondition={addExistingCondition}
				groupTitle={groupTitle}
			/>

			{selectedCondition ? (
				<ConditionItemShell
					title={conditionListName(
						conditionUsage(selectedCondition, context),
						metadata,
						context,
						safeSelectedIndex,
					)}
					summary={generateConditionSummary(conditionUsage(selectedCondition, context))}
				>
					<ConditionNodeEditor
						value={selectedCondition}
						onChange={(nextCondition) => {
							if (
								selectedConditionReference &&
								isConditionReference(selectedConditionReference) &&
								updateWorldConditionById(context, selectedConditionReference.conditionId, nextCondition)
							) {
								return;
							}

							onUpdateCondition(safeSelectedIndex, nextCondition);
						}}
						metadata={metadata}
						path={
							selectedWorldConditionIndex >= 0
								? ["conditions", selectedWorldConditionIndex]
								: [...path, safeSelectedIndex]
						}
						depth={depth}
						disabled={disabled}
						readonly={readonly}
						context={context}
						editorTitle={`Editing ${conditionListName(
							selectedCondition,
							metadata,
							context,
							safeSelectedIndex,
						)}`}
					/>
				</ConditionItemShell>
			) : null}
		</div>
	);
}

function ConditionActions({
	addConditionLabel,
	addGroupLabel,
	canAddCondition,
	canAddGroup,
	onAddCondition,
	onAddGroup,
	reusableConditions,
	onAddExistingCondition,
	groupTitle,
}: {
	addConditionLabel: string;
	addGroupLabel: string;
	canAddCondition: boolean;
	canAddGroup: boolean;
	onAddCondition: () => void;
	onAddGroup: () => void;
	reusableConditions?: ConditionValue[];
	onAddExistingCondition?: (conditionId: string) => void;
	groupTitle?: string;
}) {
	return (
		<div className="conditionBuilderEditor__actions">
			<button type="button" disabled={!canAddCondition} onClick={onAddCondition}>
				<Plus size={14} aria-hidden="true" />
				<span>{addConditionLabel}</span>
			</button>
			<button type="button" disabled={!canAddGroup} title={groupTitle} onClick={onAddGroup}>
				<Plus size={14} aria-hidden="true" />
				<span>{addGroupLabel}</span>
			</button>
			{reusableConditions && reusableConditions.length > 0 && onAddExistingCondition ? (
				<div className="conditionBuilderEditor__reuse">
					<select
						value=""
						aria-label="Reusable world condition"
						onChange={(event) => onAddExistingCondition(event.target.value)}
					>
						<option value="">Use existing reusable condition...</option>
						{reusableConditions.map((condition) => {
							const conditionId = storedConditionId(condition) ?? "";
							return (
								<option key={conditionId} value={conditionId}>
									{storedConditionName(condition) ?? conditionId}
								</option>
							);
						})}
					</select>
				</div>
			) : null}
		</div>
	);
}

function ConditionItemShell({
	title,
	summary,
	children,
}: {
	title: string;
	summary: string;
	children: ReactNode;
}) {
	return (
		<div className="conditionBuilderEditor__item">
			<div className="conditionBuilderEditor__itemHeader">
				<div className="conditionBuilderEditor__itemTitle">
					<strong>{title}</strong>
					<span>{summary}</span>
				</div>
			</div>
			<div className="conditionBuilderEditor__itemBody">{children}</div>
		</div>
	);
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
	editorTitle?: string;
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
	editorTitle,
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
	const addConditionLabel = metadata.features?.addConditionLabel ?? "Add condition";
	const addGroupLabel = metadata.features?.addGroupLabel ?? "Add group";
	const childConditions = Array.isArray(value.conditions)
		? (value.conditions as ConditionValue[]).map(normalizeCondition)
		: [];

	function updateField(key: string, nextValue: unknown) {
		onChange({
			...value,
			[key]: nextValue,
		});
	}

	function addChild(type: "flag" | "group") {
		if (type === "group" && !canAddGroup) return;
		if (hasWorldConditionLibrary(context)) {
			const nextCondition = createWorldConditionDefinition(
				type,
				metadata,
				context,
				type === "group" ? {operator: metadata.features?.defaultGroupOperator ?? "all"} : {},
			);
			const nextChildConditions = [...childConditions, conditionRefFor(nextCondition)];

			if (context.setWorldValue && isWorldConditionEditorPath(path) && typeof path[1] === "number") {
				const conditions = worldConditions(context);
				const nextConditions = [...conditions, nextCondition];
				nextConditions[path[1]] = {
					...value,
					conditions: nextChildConditions,
				};
				context.setWorldValue(["conditions"], nextConditions);
				return;
			}

			if (context.setWorldValue) {
				context.setWorldValue(["conditions"], [...worldConditions(context), nextCondition]);
			}
			updateField("conditions", [...childConditions, conditionRefFor(nextCondition)]);
			return;
		}
		updateField("conditions", [
			...childConditions,
			createNamedCondition(
				type,
				metadata,
				context,
				childConditions,
				type === "group" ? {operator: metadata.features?.defaultGroupOperator ?? "all"} : {},
			),
		]);
	}

	function updateChild(index: number, nextValue: ConditionValue) {
		updateField(
			"conditions",
			childConditions.map((condition, conditionIndex) =>
				conditionIndex === index ? nextValue : condition,
			),
		);
	}

	function removeChild(index: number) {
		updateField(
			"conditions",
			childConditions.filter((_, conditionIndex) => conditionIndex !== index),
		);
	}

	function changeType(nextType: string) {
		onChange({
			...createDefaultCondition(nextType),
			...conditionDisplayNameFields(value),
		});
	}

	return (
		<div
			className={[
				"conditionBuilderEditor__node",
				isGroup ? "conditionBuilderEditor__node--group" : "conditionBuilderEditor__node--leaf",
			]
				.filter(Boolean)
				.join(" ")}
			style={{"--condition-depth": depth} as CSSProperties}
		>
			{editorTitle ? <div className="conditionBuilderEditor__editingTitle">{editorTitle}</div> : null}
			<div className="conditionBuilderEditor__row">
				{renderTextField(
					"name",
					String(value.name ?? value.label ?? value.title ?? ""),
					isGroup ? "Group name in list" : "Condition name in list",
					updateField,
					metadata,
					path,
					disabled,
					readonly,
					context,
					"Shown in the parent condition list",
				)}
				{renderTextField(
					"id",
					String(value.id ?? ""),
					isGroup ? "Group ID" : "Condition ID",
					updateField,
					metadata,
					path,
					disabled,
					readonly,
					context,
					"Stable identifier used when reusing this condition",
				)}
				{isWorldConditionEditorPath(path)
					? renderReuseToggleField(
							Boolean(value.allowMultipleUsesInWorld),
							updateField,
							metadata,
							path,
							disabled,
							readonly,
							context,
						)
					: null}
				{renderSelect({
					childKey: "conditionType",
					value: type,
					onChange: (nextType) => changeType(String(nextType)),
					title: "Type",
					options: availableTypes,
					metadata,
					path: [...path, "type"],
					disabled,
					readonly,
					context,
				})}

				{isGroup
					? renderSelect({
							childKey: "groupOperator",
							value: normalizeGroupOperator(value.operator),
							onChange: (nextOperator) => updateField("operator", nextOperator),
							title: "Group logic",
							options: groupOperatorOptions(metadata, context),
							metadata,
							path: [...path, "operator"],
							disabled,
							readonly,
							context,
						})
					: null}
			</div>

			{isGroup ? (
				<div className="conditionBuilderEditor__group">
					<div className="conditionBuilderEditor__groupHeader">
						<strong>{groupTitle(value.operator)}</strong>
						<span>
							{childConditions.length} condition{childConditions.length === 1 ? "" : "s"}
						</span>
					</div>

					<ConditionLinkList
						conditions={childConditions}
						onUpdateCondition={updateChild}
						onRemoveCondition={removeChild}
						metadata={metadata}
						path={[...path, "conditions"]}
						depth={depth + 1}
						canEdit={canEdit}
						disabled={disabled}
						readonly={readonly}
						context={context}
						emptyState={<ConditionEmptyState />}
						addConditionLabel={addConditionLabel}
						addGroupLabel={addGroupLabel}
						canAddCondition={canEdit}
						canAddGroup={canAddGroup}
						groupTitle={!canAddGroup && depth >= maxDepth ? "Maximum nesting depth reached." : undefined}
						onAddCondition={() => addChild("flag")}
						onAddGroup={() => addChild("group")}
						onAddExistingCondition={(conditionId) =>
							updateField("conditions", [...childConditions, {type: "condition-ref", conditionId}])
						}
					/>
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

	if (type === "flag") {
		const operation = String(value.operation ?? "equals");

		return (
			<div className="conditionBuilderEditor__fields">
				{renderOperationSelect(type, operation, onChange, metadata, path, disabled, readonly, context)}
				{renderFlagField(value, onChange, metadata, path, disabled, readonly, context)}
				{operation === "equals"
					? renderToggleField(
							"value",
							Boolean(value.value ?? true),
							"Expected",
							onChange,
							metadata,
							path,
							disabled,
							readonly,
							context,
						)
					: null}
			</div>
		);
	}

	if (type === "counter") {
		const operation = String(value.operation ?? "compare");

		return (
			<div className="conditionBuilderEditor__fields">
				{renderOperationSelect(type, operation, onChange, metadata, path, disabled, readonly, context)}
				{renderTextField(
					"counter",
					String(value.counter ?? ""),
					"Counter",
					onChange,
					metadata,
					path,
					disabled,
					readonly,
					context,
				)}
				{operation === "compare"
					? renderComparisonSelect(value, onChange, metadata, path, disabled, readonly, context)
					: null}
				{operation === "compare"
					? renderNumberField(
							"value",
							Number(value.value ?? 0),
							"Value",
							onChange,
							metadata,
							path,
							disabled,
							readonly,
							context,
						)
					: null}
				{operation === "between" ? (
					<>
						{renderNumberField(
							"min",
							Number(value.min ?? 0),
							"Minimum",
							onChange,
							metadata,
							path,
							disabled,
							readonly,
							context,
						)}
						{renderNumberField(
							"max",
							Number(value.max ?? 0),
							"Maximum",
							onChange,
							metadata,
							path,
							disabled,
							readonly,
							context,
						)}
						{renderToggleField(
							"inclusive",
							Boolean(value.inclusive ?? true),
							"Inclusive",
							onChange,
							metadata,
							path,
							disabled,
							readonly,
							context,
						)}
					</>
				) : null}
			</div>
		);
	}

	if (type === "current-room") {
		const operation = String(value.operation ?? "is");
		const checksTag = operation === "has-tag" || operation === "missing-tag";

		return (
			<div className="conditionBuilderEditor__fields">
				{renderOperationSelect(type, operation, onChange, metadata, path, disabled, readonly, context)}
				{checksTag
					? renderTextField(
							"tag",
							String(value.tag ?? ""),
							"Tag",
							onChange,
							metadata,
							path,
							disabled,
							readonly,
							context,
						)
					: renderRoomField(value, onChange, metadata, path, disabled, readonly, context)}
			</div>
		);
	}

	if (type === "inventory")
		return renderInventoryFields(value, onChange, metadata, path, disabled, readonly, context);
	if (type === "item-location")
		return renderItemLocationFields(value, onChange, metadata, path, disabled, readonly, context);
	if (type === "object-state")
		return renderObjectStateFields(value, onChange, metadata, path, disabled, readonly, context);
	if (type === "npc")
		return renderNpcFields(value, onChange, metadata, path, disabled, readonly, context);
	if (type === "command-history")
		return renderCommandHistoryFields(value, onChange, metadata, path, disabled, readonly, context);
	if (type === "random-chance")
		return renderRandomChanceFields(value, onChange, metadata, path, disabled, readonly, context);
	if (type === "quest")
		return renderQuestFields(value, onChange, metadata, path, disabled, readonly, context);
	if (type === "scheduled-event")
		return renderScheduledEventFields(value, onChange, metadata, path, disabled, readonly, context);
	if (type === "turn")
		return renderTurnFields(value, onChange, metadata, path, disabled, readonly, context);
	if (type === "resolved-target")
		return renderResolvedTargetFields(value, onChange, metadata, path, disabled, readonly, context);

	return renderFallbackFields(value, onChange, metadata, path, disabled, readonly, context);
}

function renderInventoryFields(
	value: ConditionValue,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	const operation = String(value.operation ?? "has-item");
	const comparesCount = operation === "count" || operation === "tag-count";

	return (
		<div className="conditionBuilderEditor__fields">
			{renderOperationSelect(
				"inventory",
				operation,
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
			{operation === "has-item" || operation === "missing-item"
				? renderEntityField(
						"itemId",
						String(value.itemId ?? ""),
						"Item",
						"item",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "has-all-items" || operation === "has-any-item"
				? renderStringListField(
						"itemIds",
						asStringArray(value.itemIds),
						"Items",
						"Add item",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "contains-tag" || operation === "missing-tag" || operation === "tag-count"
				? renderTextField(
						"tag",
						String(value.tag ?? ""),
						"Tag",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{comparesCount
				? renderComparisonSelect(value, onChange, metadata, path, disabled, readonly, context)
				: null}
			{comparesCount
				? renderNumberField(
						"value",
						Number(value.value ?? 0),
						"Count",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
		</div>
	);
}

function renderItemLocationFields(
	value: ConditionValue,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	const operation = String(value.operation ?? "in-inventory");

	return (
		<div className="conditionBuilderEditor__fields">
			{renderOperationSelect(
				"item-location",
				operation,
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
			{renderEntityField(
				"itemId",
				String(value.itemId ?? ""),
				"Item",
				"item",
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
			{operation === "in-room"
				? renderEntityField(
						"roomId",
						String(value.roomId ?? ""),
						"Room",
						"room",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "on-surface"
				? renderEntityField(
						"surfaceId",
						String(value.surfaceId ?? ""),
						"Surface",
						"surface",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "in-container"
				? renderEntityField(
						"containerId",
						String(value.containerId ?? ""),
						"Container",
						"container",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "held-by-npc"
				? renderEntityField(
						"npcId",
						String(value.npcId ?? ""),
						"NPC",
						"npc",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
		</div>
	);
}

function renderObjectStateFields(
	value: ConditionValue,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	const operation = String(value.operation ?? "open");

	return (
		<div className="conditionBuilderEditor__fields">
			{renderOperationSelect(
				"object-state",
				operation,
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
			{operation === "surface-has-item" || operation === "surface-missing-item"
				? renderEntityField(
						"surfaceId",
						String(value.surfaceId ?? ""),
						"Surface",
						"surface",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: renderEntityField(
						"objectId",
						String(value.objectId ?? ""),
						"Object",
						"object",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)}
			{["contains-item", "missing-item", "surface-has-item", "surface-missing-item"].includes(
				operation,
			)
				? renderEntityField(
						"itemId",
						String(value.itemId ?? ""),
						"Item",
						"item",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "custom" ? (
				<>
					{renderTextField(
						"key",
						String(value.key ?? ""),
						"Key",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)}
					{renderStringComparisonSelect(value, onChange, metadata, path, disabled, readonly, context)}
					{renderTextField(
						"value",
						String(value.value ?? ""),
						"Value",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)}
				</>
			) : null}
		</div>
	);
}

function renderNpcFields(
	value: ConditionValue,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	const operation = String(value.operation ?? "in-current-room");

	return (
		<div className="conditionBuilderEditor__fields">
			{renderOperationSelect("npc", operation, onChange, metadata, path, disabled, readonly, context)}
			{renderEntityField(
				"npcId",
				String(value.npcId ?? ""),
				"NPC",
				"npc",
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
			{operation === "in-room"
				? renderEntityField(
						"roomId",
						String(value.roomId ?? ""),
						"Room",
						"room",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "has-item"
				? renderEntityField(
						"itemId",
						String(value.itemId ?? ""),
						"Item",
						"item",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "mood-is"
				? renderTextField(
						"mood",
						String(value.mood ?? ""),
						"Mood",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "trust"
				? renderComparisonSelect(value, onChange, metadata, path, disabled, readonly, context)
				: null}
			{operation === "trust"
				? renderNumberField(
						"value",
						Number(value.value ?? 0),
						"Trust",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
		</div>
	);
}

function renderCommandHistoryFields(
	value: ConditionValue,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	const operation = String(value.operation ?? "previous-command-was");
	const commandOperations = [
		"previous-command-was",
		"used-command-before",
		"never-used-command",
		"used-command-within-turns",
		"repeated-command",
	];

	return (
		<div className="conditionBuilderEditor__fields">
			{renderOperationSelect(
				"command-history",
				operation,
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
			{commandOperations.includes(operation)
				? renderTextField(
						"commandName",
						String(value.commandName ?? ""),
						"Command",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "previous-raw-command-was" ? (
				<>
					{renderStringComparisonSelect(value, onChange, metadata, path, disabled, readonly, context)}
					{renderTextField(
						"value",
						String(value.value ?? ""),
						"Raw command",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)}
				</>
			) : null}
			{operation === "previous-target-was"
				? renderEntityField(
						"targetId",
						String(value.targetId ?? ""),
						"Target",
						"object",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "used-command-within-turns"
				? renderNumberField(
						"turns",
						Number(value.turns ?? 1),
						"Turns",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "repeated-command" ? (
				<>
					{renderNumberField(
						"count",
						Number(value.count ?? 1),
						"Count",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)}
					{renderToggleField(
						"consecutive",
						Boolean(value.consecutive ?? true),
						"Consecutive",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)}
				</>
			) : null}
			{operation === "sequence"
				? renderStringListField(
						"commands",
						asStringArray(value.commands),
						"Commands",
						"Add command",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "sequence"
				? renderNumberField(
						"withinTurns",
						Number(value.withinTurns ?? 1),
						"Within turns",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
		</div>
	);
}

function renderRandomChanceFields(
	value: ConditionValue,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	return (
		<div className="conditionBuilderEditor__fields">
			{renderNumberField(
				"chance",
				Number(value.chance ?? 0.5),
				"Chance",
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
			{renderTextField(
				"seedKey",
				String(value.seedKey ?? ""),
				"Seed key",
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
			{renderToggleField(
				"invert",
				Boolean(value.invert ?? false),
				"Invert",
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
		</div>
	);
}

function renderQuestFields(
	value: ConditionValue,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	const operation = String(value.operation ?? "active");

	return (
		<div className="conditionBuilderEditor__fields">
			{renderOperationSelect(
				"quest",
				operation,
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
			{renderEntityField(
				"questId",
				String(value.questId ?? ""),
				"Quest",
				"quest",
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
			{operation === "objective-complete" || operation === "objective-incomplete"
				? renderTextField(
						"objectiveId",
						String(value.objectiveId ?? ""),
						"Objective",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
		</div>
	);
}

function renderScheduledEventFields(
	value: ConditionValue,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	const operation = String(value.operation ?? "exists");

	return (
		<div className="conditionBuilderEditor__fields">
			{renderOperationSelect(
				"scheduled-event",
				operation,
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
			{operation === "exists" || operation === "missing"
				? renderTextField(
						"instanceId",
						String(value.instanceId ?? ""),
						"Instance ID",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "event-scheduled" || operation === "event-not-scheduled"
				? renderEntityField(
						"eventId",
						String(value.eventId ?? ""),
						"Event",
						"event",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "tag-scheduled" || operation === "tag-not-scheduled"
				? renderTextField(
						"tag",
						String(value.tag ?? ""),
						"Tag",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
		</div>
	);
}

function renderTurnFields(
	value: ConditionValue,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	const operation = String(value.operation ?? "compare");

	return (
		<div className="conditionBuilderEditor__fields">
			{renderOperationSelect("turn", operation, onChange, metadata, path, disabled, readonly, context)}
			{operation === "compare"
				? renderComparisonSelect(value, onChange, metadata, path, disabled, readonly, context)
				: null}
			{renderNumberField(
				"value",
				Number(value.value ?? 0),
				operation === "multiple-of" ? "Multiple" : "Turn",
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
		</div>
	);
}

function renderResolvedTargetFields(
	value: ConditionValue,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	const operation = String(value.operation ?? "object-is");

	return (
		<div className="conditionBuilderEditor__fields">
			{renderOperationSelect(
				"resolved-target",
				operation,
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
			{operation === "object-is"
				? renderEntityField(
						"objectId",
						String(value.objectId ?? ""),
						"Object",
						"object",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "target-is"
				? renderEntityField(
						"targetId",
						String(value.targetId ?? ""),
						"Target",
						"object",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "topic-is"
				? renderEntityField(
						"topicId",
						String(value.topicId ?? ""),
						"Topic",
						"topic",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "connector-is"
				? renderTextField(
						"connector",
						String(value.connector ?? ""),
						"Connector",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
			{operation === "direction-is"
				? renderTextField(
						"direction",
						String(value.direction ?? ""),
						"Direction",
						onChange,
						metadata,
						path,
						disabled,
						readonly,
						context,
					)
				: null}
		</div>
	);
}

function renderFallbackFields(
	value: ConditionValue,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	return (
		<div className="conditionBuilderEditor__fields">
			{renderOperationSelect(
				getConditionType(value),
				String(value.operation ?? value.operator ?? "equals"),
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
			{renderTextField(
				"subject",
				String(value.subject ?? ""),
				"Subject",
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
			{renderTextField(
				"value",
				String(value.value ?? ""),
				"Value",
				onChange,
				metadata,
				path,
				disabled,
				readonly,
				context,
			)}
		</div>
	);
}

function renderOperationSelect(
	type: string,
	operation: string,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	return renderSelect({
		childKey: "operation",
		value: operation,
		onChange: (nextValue) => onChange("operation", nextValue),
		title: "Operation",
		options: operationOptionsForType(type, metadata, context),
		metadata,
		path: [...path, "operation"],
		disabled,
		readonly,
		context,
	});
}

function renderComparisonSelect(
	value: ConditionValue,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	return renderSelect({
		childKey: "comparisonOperator",
		value: String(value.operator ?? "eq"),
		onChange: (nextValue) => onChange("operator", nextValue),
		title: "Compare",
		options: comparisonOperatorOptions(metadata, context),
		metadata,
		path: [...path, "operator"],
		disabled,
		readonly,
		context,
	});
}

function renderStringComparisonSelect(
	value: ConditionValue,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	return renderSelect({
		childKey: "stringComparisonOperator",
		value: String(value.operator ?? "eq"),
		onChange: (nextValue) => onChange("operator", nextValue),
		title: "Compare",
		options: stringComparisonOperatorOptions,
		metadata,
		path: [...path, "operator"],
		disabled,
		readonly,
		context,
	});
}

function renderSelect({
	childKey,
	value,
	onChange,
	title,
	options,
	metadata,
	path,
	disabled,
	readonly,
	context,
	showDescriptions,
}: {
	childKey: string;
	value: string;
	onChange: (nextValue: string) => void;
	title: string;
	options: EditorSelectOption[];
	metadata: ConditionBuilderControlMetadata;
	path: Array<string | number>;
	disabled?: boolean;
	readonly?: boolean;
	context: ConditionBuilderEditorProps["context"];
	showDescriptions?: boolean;
}) {
	return renderChildControl({
		type: "select",
		childKey,
		value,
		onChange,
		metadata: {
			title,
			appearance: {chrome: "inline", size: "sm"},
			features: {
				options,
				showDescriptions: showDescriptions ?? false,
				searchable: showDescriptions ? options.length > 6 : false,
			},
		},
		parentMetadata: metadata,
		path,
		disabled,
		readonly,
		context,
	});
}

function renderFlagField(
	value: ConditionValue,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	return renderChildControl({
		type: "flag-picker",
		childKey: "flag",
		value: String(value.flag ?? ""),
		onChange: (nextValue) => onChange("flag", nextValue),
		metadata: {
			title: "Flag",
			appearance: {chrome: "inline", size: "sm"},
			features: {allowCreate: false, clearButton: false, showPreview: false},
		},
		parentMetadata: metadata,
		path: [...path, "flag"],
		disabled,
		readonly,
		context,
	});
}

function renderRoomField(
	value: ConditionValue,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	return renderEntityField(
		"roomId",
		String(value.roomId ?? ""),
		"Room",
		"room",
		onChange,
		metadata,
		path,
		disabled,
		readonly,
		context,
	);
}

function renderEntityField(
	key: string,
	value: string,
	title: string,
	entityType: string,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	return renderChildControl({
		type: "entity-picker",
		childKey: key,
		value,
		onChange: (nextValue) => onChange(key, nextValue),
		metadata: {
			title,
			appearance: {chrome: "inline", size: "sm"},
			features: {
				entityType,
				allowCreate: false,
				clearButton: false,
			},
		},
		parentMetadata: metadata,
		path: [...path, key],
		disabled,
		readonly,
		context,
	});
}

function renderTextField(
	key: string,
	value: string,
	title: string,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
	description?: string,
) {
	return renderChildControl({
		type: "text",
		childKey: key,
		value,
		onChange: (nextValue) => onChange(key, nextValue),
		metadata: {
			title,
			description,
			appearance: {chrome: "inline", size: "sm"},
			features: {clearButton: true},
		},
		parentMetadata: metadata,
		path: [...path, key],
		disabled,
		readonly,
		context,
	});
}

function renderNumberField(
	key: string,
	value: number,
	title: string,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	return renderChildControl({
		type: "number",
		childKey: key,
		value,
		onChange: (nextValue) => onChange(key, nextValue),
		metadata: {
			title,
			appearance: {chrome: "inline", size: "sm"},
		},
		parentMetadata: metadata,
		path: [...path, key],
		disabled,
		readonly,
		context,
	});
}

function renderToggleField(
	key: string,
	value: boolean,
	title: string,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	return renderChildControl({
		type: "toggle",
		childKey: key,
		value,
		onChange: (nextValue) => onChange(key, nextValue),
		metadata: {
			title,
			appearance: {chrome: "inline", size: "sm"},
			features: {labels: {on: "True", off: "False"}},
		},
		parentMetadata: metadata,
		path: [...path, key],
		disabled,
		readonly,
		context,
	});
}

function renderReuseToggleField(
	value: boolean,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	return renderChildControl({
		type: "toggle",
		childKey: "allowMultipleUsesInWorld",
		value,
		onChange: (nextValue) => onChange("allowMultipleUsesInWorld", nextValue),
		metadata: {
			title: "Allow multiple uses in world",
			description: "Makes this condition available in existing-condition pickers.",
			appearance: {chrome: "inline", size: "sm"},
			features: {
				display: "checkbox",
				labels: {
					on: "Allow multiple uses in world",
					off: "Allow multiple uses in world",
				},
			},
		},
		parentMetadata: metadata,
		path: [...path, "allowMultipleUsesInWorld"],
		disabled,
		readonly,
		context,
	});
}

function renderStringListField(
	key: string,
	value: string[],
	title: string,
	addLabel: string,
	onChange: (key: string, nextValue: unknown) => void,
	metadata: ConditionBuilderControlMetadata,
	path: Array<string | number>,
	disabled: boolean | undefined,
	readonly: boolean | undefined,
	context: ConditionBuilderEditorProps["context"],
) {
	return renderChildControl({
		type: "string-list",
		childKey: key,
		value,
		onChange: (nextValue) => onChange(key, nextValue),
		metadata: {
			title,
			appearance: {chrome: "inline", size: "sm"},
			features: {
				emptyTitle: `No ${title.toLowerCase()}`,
				emptyActionLabel: addLabel,
			},
		},
		parentMetadata: metadata,
		path: [...path, key],
		disabled,
		readonly,
		context,
	});
}

function asStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.map(String) : [];
}
