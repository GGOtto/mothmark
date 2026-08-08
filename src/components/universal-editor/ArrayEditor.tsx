"use client";

import {Trash2} from "lucide-react";
import type {z} from "zod";
import type {EditorControlMetadata, EditorControlProps} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {
	createStableId,
	generateConditionSummary,
	generateEditorSummary,
} from "./utils/universalEditorUtils";
import {FieldShell} from "./FieldShell";
import {MultiSelectEditor, type MultiSelectControlMetadata} from "./MultiSelectEditor";
import {renderEditorControl} from "./renderEditorControl";
import {resolveEditorMetadata} from "./utils/resolveEditorMetadata";
import {getSchemaAtPath} from "./utils/schemaIntrospection";
import "./ArrayEditor.scss";

export type ArrayFeatures = {
	addLabel?: string;
	reorderable?: boolean;
	duplicateable?: boolean;
	removable?: boolean;
	collapsibleItems?: boolean;
	defaultCollapsedItems?: boolean;
	minItems?: number;
	maxItems?: number;
	getItemTitle?: string;
	getItemSubtitle?: string;
	getItemSummary?: string;
	getItemBadge?: string;
	getItemStatus?: "valid" | "warning" | "error";
	confirmRemove?: boolean;
	collapsedSummary?: boolean;
	itemMetadata?: EditorControlMetadata & Record<string, unknown>;
	defaultItem?: unknown;
	addMenu?: Array<{
		label: string;
		defaultItem: unknown;
	}>;
	emptyTitle?: string;
	emptyDescription?: string;
	emptyActionLabel?: string;
	duplicateBehavior?: "exact" | "with-new-id" | "from-template";
	idField?: string;
	idPrefix?: string;
	selectionControl?: "multi-select";
	selectionTitle?: string;
};

export type ArrayControlMetadata = EditorControlMetadata & {
	type: "array";
	features?: ArrayFeatures;
};

export type ArrayEditorProps = EditorControlProps<unknown[], ArrayControlMetadata>;

function cloneValue(value: unknown) {
	if (typeof structuredClone === "function") return structuredClone(value);
	return JSON.parse(JSON.stringify(value));
}

function getItemTitle(item: unknown, index: number, template?: string, itemSchema?: z.ZodTypeAny) {
	if (!template) return `Item ${index + 1}`;
	return templateValue(item, template.replaceAll("{index}", String(index + 1)), itemSchema);
}

function templateValue(item: unknown, template?: string, itemSchema?: z.ZodTypeAny) {
	if (!template) return "";
	if (typeof item === "object" && item !== null) {
		return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
			const fieldValue = (item as Record<string, unknown>)[key];
			if (key === "when") {
				const fieldSchema = itemSchema ? getSchemaAtPath(itemSchema, [key]) : undefined;
				const fieldFeatures = fieldSchema ? resolveEditorMetadata(fieldSchema).features : undefined;
				const conditionSchema = (fieldFeatures?.conditionSchema ?? fieldFeatures?.sourceSchema) as
					z.ZodTypeAny | undefined;
				if (!conditionSchema) return "";
				if (Array.isArray(fieldValue)) {
					if (fieldValue.length === 0) return "Always";
					return generateConditionSummary(
						{
							type: "group",
							operator: "all",
							conditions: fieldValue,
						},
						conditionSchema,
					);
				}
				if (typeof fieldValue === "object" && fieldValue !== null) {
					return generateConditionSummary(fieldValue, conditionSchema);
				}
			}
			return fieldValue == null ? "" : String(fieldValue);
		});
	}

	return template.replace("{value}", String(item ?? ""));
}

function duplicateValue(value: unknown, features?: ArrayFeatures) {
	const nextValue = cloneValue(value);
	if (
		features?.duplicateBehavior === "with-new-id" &&
		typeof nextValue === "object" &&
		nextValue !== null &&
		!Array.isArray(nextValue)
	) {
		const idField = features.idField ?? "id";
		const record = nextValue as Record<string, unknown>;
		record[idField] = createStableId(record[idField] ?? record, features.idPrefix);
	}

	return nextValue;
}

export function ArrayEditor({
	value,
	onChange,
	metadata,
	path,
	error,
	warnings,
	disabled,
	readonly,
	context,
}: ArrayEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const minItems = metadata.features?.minItems ?? 0;
	const maxItems = metadata.features?.maxItems;
	const canAdd = canEdit && (typeof maxItems !== "number" || value.length < maxItems);
	const removable = metadata.features?.removable ?? true;
	const itemMetadata = metadata.features?.itemMetadata;
	const selectableUnion =
		metadata.features?.selectionControl === "multi-select" &&
		itemMetadata?.type === "discriminated-union"
			? itemMetadata
			: undefined;
	const selectionDiscriminator = String(selectableUnion?.features?.discriminator ?? "type");
	const selectionOptions = (selectableUnion?.features?.options ?? []) as Array<{
		label: string;
		value: string;
		description?: string;
		defaultValue?: Record<string, unknown>;
	}>;
	const selectedTypes = value.flatMap((item) => {
		if (!item || typeof item !== "object" || Array.isArray(item)) return [];
		const selectedType = (item as Record<string, unknown>)[selectionDiscriminator];
		return typeof selectedType === "string" ? [selectedType] : [];
	});

	function updateItem(index: number, nextItem: unknown) {
		onChange(value.map((item, itemIndex) => (itemIndex === index ? nextItem : item)));
	}

	function removeItem(index: number) {
		if (!canEdit || !removable || value.length <= minItems) return;
		if (metadata.features?.confirmRemove && !window.confirm("Remove this item?")) return;

		onChange(value.filter((_, itemIndex) => itemIndex !== index));
	}

	function duplicateItem(index: number) {
		if (!canAdd) return;

		onChange([
			...value.slice(0, index + 1),
			duplicateValue(value[index], metadata.features),
			...value.slice(index + 1),
		]);
	}

	function moveItem(index: number, direction: -1 | 1) {
		const nextIndex = index + direction;
		if (!canEdit || nextIndex < 0 || nextIndex >= value.length) return;

		const nextValue = [...value];
		[nextValue[index], nextValue[nextIndex]] = [nextValue[nextIndex], nextValue[index]];
		onChange(nextValue);
	}

	function renderItem(item: unknown, index: number) {
		const itemSchema = metadata.features?.itemMetadata?.features?.sourceSchema as
			z.ZodTypeAny | undefined;
		const title = getItemTitle(item, index, metadata.features?.getItemTitle, itemSchema);
		const subtitle =
			templateValue(item, metadata.features?.getItemSummary, itemSchema) ||
			templateValue(item, metadata.features?.getItemSubtitle, itemSchema) ||
			generateEditorSummary(item, metadata.features?.itemMetadata?.summary);
		const badge = templateValue(item, metadata.features?.getItemBadge);
		const status = metadata.features?.getItemStatus;
		const removeButton = removable ? (
			<button
				className="arrayEditor__removeButton"
				type="button"
				disabled={!canEdit || value.length <= minItems}
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					removeItem(index);
				}}
				aria-label={`Delete ${title}`}
				title={`Delete ${title}`}
			>
				<Trash2 size={13} aria-hidden="true" />
			</button>
		) : null;
		const itemTitleActions =
			badge || removeButton ? (
				<span className="arrayEditor__itemTitleActions">
					{badge ? <span className="arrayEditor__itemBadge">{badge}</span> : null}
					{removeButton}
				</span>
			) : null;
		const resolvedItemMetadata = metadata.features?.itemMetadata;
		const itemBody = resolvedItemMetadata ? (
			renderEditorControl({
				value: item,
				onChange: (nextItem) => updateItem(index, nextItem),
				metadata: resolvedItemMetadata,
				path: [...path, index],
				disabled,
				readonly,
				context,
			})
		) : (
			<pre className="arrayEditor__preview">{JSON.stringify(item, null, 2)}</pre>
		);

		const itemShell = (
			<>
				{itemBody}
				<div className="arrayEditor__actions">
					{metadata.features?.reorderable ? (
						<>
							<button type="button" disabled={!canEdit || index === 0} onClick={() => moveItem(index, -1)}>
								Up
							</button>
							<button
								type="button"
								disabled={!canEdit || index === value.length - 1}
								onClick={() => moveItem(index, 1)}
							>
								Down
							</button>
						</>
					) : null}

					{metadata.features?.duplicateable ? (
						<button type="button" disabled={!canAdd} onClick={() => duplicateItem(index)}>
							Duplicate
						</button>
					) : null}
				</div>
			</>
		);

		if (metadata.features?.collapsibleItems) {
			return (
				<details
					key={index}
					className={["arrayEditor__item", status ? `arrayEditor__item--${status}` : ""]
						.filter(Boolean)
						.join(" ")}
					open={!metadata.features.defaultCollapsedItems && !metadata.features.collapsedSummary}
				>
					<summary className="arrayEditor__itemTitle">
						<span className="arrayEditor__itemTitleText">{title}</span>
						{subtitle ? <span className="arrayEditor__itemSubtitle">{subtitle}</span> : null}
						{itemTitleActions}
					</summary>
					{itemShell}
				</details>
			);
		}

		return (
			<div
				key={index}
				className={["arrayEditor__item", status ? `arrayEditor__item--${status}` : ""]
					.filter(Boolean)
					.join(" ")}
			>
				<div className="arrayEditor__itemTitle">
					<span className="arrayEditor__itemTitleText">{title}</span>
					{subtitle ? <span className="arrayEditor__itemSubtitle">{subtitle}</span> : null}
					{itemTitleActions}
				</div>
				{itemShell}
			</div>
		);
	}

	function addItem(defaultItem: unknown = metadata.features?.defaultItem ?? "") {
		if (!canAdd) return;
		onChange([...value, cloneValue(defaultItem)]);
	}

	function changeSelection(nextTypes: string[]) {
		const existingItems = new Map(
			value.flatMap((item) => {
				if (!item || typeof item !== "object" || Array.isArray(item)) return [];
				const selectedType = (item as Record<string, unknown>)[selectionDiscriminator];
				return typeof selectedType === "string" ? [[selectedType, item] as const] : [];
			}),
		);

		onChange(
			nextTypes.flatMap((type) => {
				const existingItem = existingItems.get(type);
				if (existingItem !== undefined) return [existingItem];
				const option = selectionOptions.find((candidate) => candidate.value === type);
				if (!option) return [];
				return [
					{
						...cloneValue(option.defaultValue ?? {}),
						[selectionDiscriminator]: type,
					},
				];
			}),
		);
	}

	return (
		<FieldShell
			title={metadata.title}
			description={metadata.description}
			error={error}
			warnings={warnings}
			required={metadata.required}
			disabled={isDisabled}
			readonly={isReadonly}
			appearance={appearance}
			className={metadata.className}
			testId={metadata.testId}
			slots={{
				summary: generateEditorSummary(
					value,
					metadata.summary,
					selectableUnion
						? value.length === 0
							? "No behaviors selected"
							: `${value.length} ${value.length === 1 ? "behavior" : "behaviors"}`
						: value.length === 0
							? (metadata.features?.emptyTitle ?? "No items yet")
							: `${value.length} items`,
				),
			}}
		>
			<div className="arrayEditor">
				{selectableUnion ? (
					<MultiSelectEditor
						value={selectedTypes}
						onChange={changeSelection}
						metadata={
							{
								type: "multi-select",
								title: metadata.features?.selectionTitle,
								features: {
									options: selectionOptions,
									searchable: false,
									clearButton: true,
									showDescriptions: true,
									showBadges: false,
								},
							} satisfies MultiSelectControlMetadata
						}
						path={path}
						disabled={disabled}
						readonly={readonly}
						context={context}
					/>
				) : null}
				{selectableUnion ? null : value.map(renderItem)}
				{value.length === 0 && !selectableUnion ? (
					<div className="arrayEditor__empty">
						<strong>{metadata.features?.emptyTitle ?? "No items yet."}</strong>
						{metadata.features?.emptyDescription ? (
							<span>{metadata.features.emptyDescription}</span>
						) : null}
					</div>
				) : null}
				{selectableUnion ? null : metadata.features?.addMenu?.length ? (
					<div className="arrayEditor__addMenu">
						{metadata.features.addMenu.map((item) => (
							<button
								key={item.label}
								className="arrayEditor__addButton"
								type="button"
								disabled={!canAdd}
								onClick={() => addItem(item.defaultItem)}
							>
								{item.label}
							</button>
						))}
					</div>
				) : (
					<button
						className="arrayEditor__addButton"
						type="button"
						disabled={!canAdd}
						onClick={() => addItem()}
					>
						{metadata.features?.emptyActionLabel ?? metadata.features?.addLabel ?? "Add item"}
					</button>
				)}
			</div>
		</FieldShell>
	);
}
