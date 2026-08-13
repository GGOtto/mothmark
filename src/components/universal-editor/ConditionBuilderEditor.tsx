"use client";

import {Fragment, useEffect, useState} from "react";
import {Pencil, Plus, Trash2} from "lucide-react";
import type {CSSProperties, ReactNode} from "react";
import type {z} from "zod";
import type {
	EditorControlContext,
	EditorControlMetadata,
	EditorControlProps,
	EditorSelectOption,
} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {useOptionalPopup} from "@/components/popup/Popup";
import {generateConditionSummary} from "./utils/universalEditorUtils";
import {idValue, isID, toID} from "../../utils/idUtils";
import {FieldShell} from "./FieldShell";
import {renderChildControl} from "./renderChildControl";
import {
	createSchemaVariantDefault,
	findEditorSchemaVariant,
	schemaFieldOptions,
	schemaLogicOptionForValue,
	type SchemaLogicOption,
	schemaTypeOptions,
} from "./utils/editorSchemaVariants";
import {resolveEditorMetadata} from "./utils/resolveEditorMetadata";
import {openLogicPicker} from "./LogicPicker";
import "./ConditionBuilderEditor.scss";

export type ConditionValue = Record<string, unknown>;

export type ConditionBuilderFeatures = {
	allowGroups?: boolean;
	allowNestedGroups?: boolean;
	allowEmptyGroups?: boolean;
	maxDepth?: number;
	defaultGroupOperator?: "all" | "any" | "none";
	showGeneratedSummary?: boolean;
	showSummary?: boolean;
	showNaturalLanguagePreview?: boolean;
	compact?: boolean;
	addConditionLabel?: string;
	addGroupLabel?: string;
	rootGroup?: boolean;
	reuseWorldConditions?: boolean;
	navigateChildEditors?: boolean;
	conditionSchema?: z.ZodTypeAny;
	sourceSchema?: z.ZodTypeAny;
};

export type ConditionBuilderControlMetadata = EditorControlMetadata & {
	type: "condition-builder";
	features?: ConditionBuilderFeatures;
};

export type ConditionBuilderEditorProps = EditorControlProps<
	ConditionValue | ConditionValue[] | undefined,
	ConditionBuilderControlMetadata
>;

function editorConditionSchema(metadata: ConditionBuilderControlMetadata) {
	const schema = metadata.features?.conditionSchema ?? metadata.features?.sourceSchema;
	if (!schema) throw new Error("Condition editor metadata is missing its source schema.");
	return schema;
}

function conditionTypeOptions(metadata: ConditionBuilderControlMetadata) {
	const options = schemaTypeOptions(editorConditionSchema(metadata));

	return options.filter((option) => {
		if (option.value === "group" && metadata.features?.allowGroups === false) return false;
		return true;
	});
}

function defaultLeafConditionType(metadata: ConditionBuilderControlMetadata) {
	const options = conditionTypeOptions(metadata);
	return (
		options.find((option) => !["group", "condition-ref", "comparison"].includes(option.value))
			?.value ?? options.find((option) => option.value !== "group")?.value
	);
}

function groupOperatorOptions(metadata: ConditionBuilderControlMetadata) {
	return schemaFieldOptions(editorConditionSchema(metadata), "operation", {type: "group"});
}

function shouldShowSummary(metadata: ConditionBuilderControlMetadata) {
	return (
		metadata.features?.showGeneratedSummary ??
		metadata.features?.showSummary ??
		metadata.features?.showNaturalLanguagePreview ??
		true
	);
}

export function createDefaultCondition(type = "world", schema?: z.ZodTypeAny): ConditionValue {
	return schema ? createSchemaVariantDefault(schema, {type}) : {type};
}

function getConditionType(condition: ConditionValue) {
	if (condition.type === "condition-ref") return "condition-ref";
	if (condition.kind === "group" || condition.type === "group") return "group";
	return String(condition.type ?? "world");
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
			conditionId:
				isID(condition.conditionId) && condition.conditionId.type === "condition"
					? condition.conditionId
					: toID("condition", ""),
		};
	}

	if (condition.kind === "group" || condition.type === "group") {
		return {
			...condition,
			kind: "group",
			type: "group",
			operation: normalizeGroupOperator(condition.operation ?? condition.operator),
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

function typeLabel(type: string, metadata: ConditionBuilderControlMetadata) {
	return conditionTypeOptions(metadata).find((option) => option.value === type)?.label ?? type;
}

function conditionLinkName(
	condition: ConditionValue,
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
	index: number,
) {
	const explicitName = condition.name ?? condition.label ?? condition.title;
	if (typeof explicitName === "string" && explicitName.trim().length > 0) return explicitName.trim();

	const type = getConditionType(condition);
	if (type === "group") return `Group ${index + 1}`;
	return `${typeLabel(type, metadata)} ${index + 1}`;
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
	return isID(condition.id) && idValue(condition.id).trim().length > 0
		? idValue(condition.id).trim()
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
	return `${typeLabel(type, metadata)} ${typeCount + 1}`;
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
		id: toID("condition", storedConditionId(condition) ?? uniqueConditionId(condition, siblings)),
		name:
			storedConditionName(condition) ??
			uniqueConditionName(conditionLinkName(condition, metadata, context, index), siblings),
	};
}

function createNamedCondition(
	type: string,
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
	siblings: ConditionValue[],
	overrides: ConditionValue = {},
) {
	const condition = {
		...createDefaultCondition(type, editorConditionSchema(metadata)),
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
		id: toID("condition", uniqueConditionId(condition, siblings)),
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
	};
}

function worldConditions(context: EditorControlContext) {
	const conditions = context.getWorldValue?.(["conditions"]) ?? context.getValue(["conditions"]);
	if (!Array.isArray(conditions)) return [];
	return (conditions as ConditionValue[]).map((storedCondition) => {
		if (
			isID(storedCondition.identity) &&
			typeof storedCondition.condition === "object" &&
			storedCondition.condition !== null &&
			!Array.isArray(storedCondition.condition)
		) {
			return {
				...normalizeCondition(storedCondition.condition as ConditionValue),
				id: storedCondition.identity,
				name:
					typeof storedCondition.name === "string" && storedCondition.name.trim()
						? storedCondition.name
						: undefined,
			};
		}
		return normalizeCondition(storedCondition);
	});
}

function storedWorldCondition(condition: ConditionValue) {
	const conditionId = storedConditionId(condition);
	if (!conditionId) return condition;
	const definition = {...condition};
	delete definition.id;
	delete definition.name;
	delete definition.label;
	delete definition.title;
	delete definition.allowMultipleUsesInWorld;
	return {
		identity: toID("condition", conditionId),
		name: storedConditionName(condition) ?? "",
		condition: definition,
	};
}

function setWorldConditions(context: EditorControlContext, conditions: ConditionValue[]) {
	const storedConditions = conditions.map(storedWorldCondition);
	if (context.setWorldValue) {
		context.setWorldValue(["conditions"], storedConditions);
	} else {
		context.setValue(["conditions"], storedConditions);
	}
}

function worldConditionById(context: EditorControlContext, id: unknown) {
	if (!isID(id) || id.type !== "condition") return undefined;
	const conditionId = id.id.trim();
	if (!conditionId) return undefined;
	return worldConditions(context).find((condition) => storedConditionId(condition) === conditionId);
}

function worldConditionIndexById(context: EditorControlContext, id: unknown) {
	if (!isID(id) || id.type !== "condition") return -1;
	const conditionId = id.id.trim();
	if (!conditionId) return -1;
	return worldConditions(context).findIndex(
		(condition) => storedConditionId(condition) === conditionId,
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

	setWorldConditions(context, nextConditions);

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
		if (!isID(condition.conditionId) || condition.conditionId.type !== "condition") {
			return condition;
		}
		const conditionId = condition.conditionId.id.trim();
		if (!conditionId || seenConditionIds.has(conditionId)) return condition;

		const worldCondition = worldConditionById(context, condition.conditionId);
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
	type: string,
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
	overrides: ConditionValue = {},
) {
	const condition = {
		...createDefaultCondition(type, editorConditionSchema(metadata)),
		...overrides,
	};
	const nextCondition = {
		...condition,
		id: toID("condition", uniqueWorldConditionId(condition, context)),
		name: uniqueWorldConditionName(condition, metadata, context),
	};
	return nextCondition;
}

function createWorldCondition(
	type: string,
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
	overrides: ConditionValue = {},
) {
	const nextCondition = createWorldConditionDefinition(type, metadata, context, overrides);
	const conditions = worldConditions(context);
	setWorldConditions(context, [...conditions, nextCondition]);

	return nextCondition;
}

function conditionRefFor(condition: ConditionValue) {
	const conditionId = storedConditionId(condition) ?? "";

	return {
		type: "condition-ref",
		conditionId: toID("condition", conditionId),
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
	return worldConditions(context).filter((condition) => storedConditionId(condition));
}

function reusableConditionPickerOptions(
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
): SchemaLogicOption[] {
	return reusableWorldConditions(context).map((condition) => {
		const conditionId = storedConditionId(condition) ?? "";
		const title = storedConditionName(condition) ?? conditionId;
		const description = generateConditionSummary(
			conditionUsage(condition, context),
			editorConditionSchema(metadata),
		);
		return {
			key: `condition-ref:${conditionId}`,
			type: "condition-ref",
			title,
			description,
			category: "Reusable",
			keywords: ["saved", "reusable", "shared"],
			situations: [],
			requires: [],
			fields: [],
			defaultValue: {type: "condition-ref", conditionId: toID("condition", conditionId)},
			searchText: `${title} ${description} saved reusable shared`.toLocaleLowerCase(),
		};
	});
}

function hasWorldConditionLibrary(context: EditorControlContext) {
	return Array.isArray(context.getWorldValue?.(["conditions"]) ?? context.getValue(["conditions"]));
}

function canReuseWorldConditions(
	metadata: ConditionBuilderControlMetadata,
	context: EditorControlContext,
) {
	return metadata.features?.reuseWorldConditions !== false && hasWorldConditionLibrary(context);
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
	const popup = useOptionalPopup();
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
	const isMissingCondition = value === undefined;
	const isConditionList = Array.isArray(value);
	const singleCondition =
		isConditionList || isMissingCondition ? undefined : normalizeCondition(value as ConditionValue);
	const worldConditionIndex =
		!isConditionList && isWorldConditionEditorPath(path) && typeof path[1] === "number"
			? path[1]
			: undefined;

	async function chooseCondition(current?: ConditionValue, includeReusable = true) {
		const currentReferenceId =
			current && isID(current.conditionId) ? idValue(current.conditionId) : undefined;
		return openLogicPicker(popup, {
			kind: "condition",
			schema: editorConditionSchema(metadata),
			additionalOptions:
				includeReusable && canReuseWorldConditions(metadata, context)
					? reusableConditionPickerOptions(metadata, context)
					: [],
			hiddenTypes: ["condition-ref", "group"],
			selectedKey: currentReferenceId
				? `condition-ref:${currentReferenceId}`
				: current
					? schemaLogicOptionForValue(editorConditionSchema(metadata), current)?.key
					: undefined,
		});
	}

	useEffect(() => {
		if (!isConditionList || !value || !canEdit || !canReuseWorldConditions(metadata, context)) return;

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

		setWorldConditions(context, [...nextWorldConditions, ...pendingConditions]);
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
			operation: "all",
			conditions: summaryConditions,
		};
		const canAddGroup = canEdit && (metadata.features?.allowGroups ?? true);
		const defaultLeafType = defaultLeafConditionType(metadata);

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

		function addConditionValue(selectedCondition: ConditionValue) {
			if (!canEdit) return;
			if (isConditionReference(selectedCondition)) {
				onChange([...conditions, selectedCondition]);
				return;
			}
			const type = getConditionType(selectedCondition);
			if (type === "group" && !canAddGroup) return;
			if (canReuseWorldConditions(metadata, context)) {
				const nextCondition = createWorldCondition(type, metadata, context, selectedCondition);
				onChange([...conditions, conditionRefFor(nextCondition)]);
				return;
			}
			onChange([
				...conditions,
				createNamedCondition(type, metadata, context, conditions, selectedCondition),
			]);
		}

		function addGroup() {
			addConditionValue({
				type: "group",
				operation: metadata.features?.defaultGroupOperator ?? "all",
				conditions: [],
			});
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
							summary={
								conditions.length > 0
									? generateConditionSummary(summaryCondition, editorConditionSchema(metadata))
									: "Always"
							}
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
						canAddCondition={canEdit && Boolean(defaultLeafType)}
						canAddGroup={canAddGroup}
						onAddCondition={async () => {
							const selected = await chooseCondition();
							if (selected) addConditionValue(selected.defaultValue);
						}}
						onAddGroup={addGroup}
					/>
				</div>
			</FieldShell>
		);
	}

	if (isMissingCondition) {
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
				<button
					className="conditionBuilderEditor__add"
					type="button"
					disabled={!canEdit}
					onClick={async () => {
						const selected = await chooseCondition();
						if (!selected) return;
						const condition = selected.defaultValue;
						onChange(
							metadata.features?.rootGroup
								? {type: "group", operation: "all", conditions: [condition]}
								: condition,
						);
					}}
				>
					{metadata.emptyState?.emptyActionLabel ?? "Add condition"}
				</button>
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
						summary={generateConditionSummary(
							conditionUsage(condition, context),
							editorConditionSchema(metadata),
						)}
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
			<span>Add a condition to make this variant conditional.</span>
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
	const canOpenChildEditor =
		metadata.features?.navigateChildEditors !== false &&
		typeof context.editorNavigation?.openEditorLink === "function";
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
		canEdit && onAddExistingCondition && canReuseWorldConditions(metadata, context)
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
		const name = conditionLinkName(usage, metadata, context, index);

		if (canOpenChildEditor) {
			const conditionIdentity = isConditionReference(condition) ? condition.conditionId : condition.id;
			const conditionId = idValue(conditionIdentity);
			const opensWorldCondition = Boolean(
				conditionId && worldConditionById(context, conditionIdentity),
			);
			context.editorNavigation?.openEditorLink?.({
				ref: {
					type: "condition",
					id: opensWorldCondition ? (conditionId ?? String(index)) : String(index),
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
					const name = conditionLinkName(usage, metadata, context, index);
					const summary = generateConditionSummary(usage, editorConditionSchema(metadata));
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
					title={conditionLinkName(
						conditionUsage(selectedCondition, context),
						metadata,
						context,
						safeSelectedIndex,
					)}
					summary={generateConditionSummary(
						conditionUsage(selectedCondition, context),
						editorConditionSchema(metadata),
					)}
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
						editorTitle={`Editing ${conditionLinkName(
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
	const popup = useOptionalPopup();
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const type = getConditionType(value);
	const isGroup = type === "group";
	const isFixedRootGroup = depth === 0 && metadata.features?.rootGroup === true;
	const maxDepth = metadata.features?.maxDepth ?? 5;
	const canAddGroup =
		canEdit &&
		(metadata.features?.allowGroups ?? true) &&
		(metadata.features?.allowNestedGroups ?? true) &&
		depth < maxDepth;
	const addConditionLabel = metadata.features?.addConditionLabel ?? "Add condition";
	const addGroupLabel = metadata.features?.addGroupLabel ?? "Add group";
	const defaultLeafType = defaultLeafConditionType(metadata);
	const childConditions = Array.isArray(value.conditions)
		? (value.conditions as ConditionValue[]).map(normalizeCondition)
		: [];

	function updateField(key: string, nextValue: unknown) {
		onChange({
			...value,
			[key]: nextValue,
		});
	}

	function addChildValue(selectedCondition: ConditionValue) {
		if (isConditionReference(selectedCondition)) {
			updateField("conditions", [...childConditions, selectedCondition]);
			return;
		}
		const type = getConditionType(selectedCondition);
		if (type === "group" && !canAddGroup) return;
		if (canReuseWorldConditions(metadata, context)) {
			const nextCondition = createWorldConditionDefinition(type, metadata, context, selectedCondition);
			const nextChildConditions = [...childConditions, conditionRefFor(nextCondition)];

			if (context.setWorldValue && isWorldConditionEditorPath(path) && typeof path[1] === "number") {
				const conditions = worldConditions(context);
				const nextConditions = [...conditions, nextCondition];
				nextConditions[path[1]] = {
					...value,
					conditions: nextChildConditions,
				};
				setWorldConditions(context, nextConditions);
				return;
			}

			if (context.setWorldValue) {
				setWorldConditions(context, [...worldConditions(context), nextCondition]);
			}
			updateField("conditions", [...childConditions, conditionRefFor(nextCondition)]);
			return;
		}
		updateField("conditions", [
			...childConditions,
			createNamedCondition(type, metadata, context, childConditions, selectedCondition),
		]);
	}

	function addChildGroup() {
		addChildValue({
			type: "group",
			operation: metadata.features?.defaultGroupOperator ?? "all",
			conditions: [],
		});
	}

	async function chooseChildCondition() {
		const selected = await openLogicPicker(popup, {
			kind: "condition",
			schema: editorConditionSchema(metadata),
			additionalOptions: canReuseWorldConditions(metadata, context)
				? reusableConditionPickerOptions(metadata, context)
				: [],
			hiddenTypes: ["condition-ref", "group"],
		});
		if (selected) addChildValue(selected.defaultValue);
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

	async function changeCondition() {
		const selected = await openLogicPicker(popup, {
			kind: "condition",
			schema: editorConditionSchema(metadata),
			hiddenTypes: ["condition-ref", "group"],
			selectedKey: schemaLogicOptionForValue(editorConditionSchema(metadata), value)?.key,
		});
		if (!selected) return;
		onChange({
			...selected.defaultValue,
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
				{!isFixedRootGroup && !isGroup ? (
					<button
						className="conditionBuilderEditor__change"
						type="button"
						disabled={!canEdit}
						onClick={changeCondition}
					>
						<span>Condition</span>
						<strong>
							{schemaLogicOptionForValue(editorConditionSchema(metadata), value)?.title ??
								generateConditionSummary(value, editorConditionSchema(metadata))}
						</strong>
						<small>Change</small>
					</button>
				) : null}

				{isGroup
					? renderSelect({
							childKey: "groupOperator",
							value: normalizeGroupOperator(value.operation ?? value.operator),
							onChange: (nextOperation) => updateField("operation", nextOperation),
							title: "Group logic",
							options: groupOperatorOptions(metadata),
							metadata,
							path: [...path, "operation"],
							disabled,
							readonly,
							context,
						})
					: null}
			</div>

			{isGroup ? (
				<div className="conditionBuilderEditor__group">
					<div className="conditionBuilderEditor__groupHeader">
						<strong>
							{groupOperatorOptions(metadata).find(
								(option) => option.value === normalizeGroupOperator(value.operation ?? value.operator),
							)?.label ?? normalizeGroupOperator(value.operation ?? value.operator)}
						</strong>
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
						canAddCondition={canEdit && Boolean(defaultLeafType)}
						canAddGroup={canAddGroup}
						groupTitle={!canAddGroup && depth >= maxDepth ? "Maximum nesting depth reached." : undefined}
						onAddCondition={chooseChildCondition}
						onAddGroup={addChildGroup}
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
	const operation = typeof value.operation === "string" ? value.operation : undefined;
	const schema = editorConditionSchema(metadata);
	const variant = findEditorSchemaVariant(schema, {
		type,
		operation,
	});
	if (!variant) return null;

	return (
		<div className="conditionBuilderEditor__fields">
			{Object.entries(variant.shape)
				.filter(([key]) => !["type", "operation", "commandVariables"].includes(key))
				.map(([key, fieldSchema]) => {
					const fieldMetadata = resolveEditorMetadata(fieldSchema);
					return (
						<Fragment key={key}>
							{renderChildControl({
								type: fieldMetadata.type,
								childKey: key,
								value: value[key],
								onChange: (nextValue) => onChange(key, nextValue),
								metadata: {
									...fieldMetadata,
									appearance: {chrome: "inline", size: "sm"},
								},
								useMetadataCopy: true,
								parentMetadata: metadata,
								path: [...path, key],
								disabled,
								readonly,
								context,
							})}
						</Fragment>
					);
				})}
		</div>
	);
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
		useMetadataCopy: true,
		path,
		disabled,
		readonly,
		context,
	});
}
