"use client";

import type {EditorControlMetadata, EditorControlProps} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {
	createStableId,
	generateConditionSummary,
	generateEditorSummary,
} from "../../utils/universalEditorUtils";
import {FieldShell} from "./FieldShell";
import {renderEditorControl} from "./renderEditorControl";
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

function getItemTitle(item: unknown, index: number, template?: string) {
	if (!template) return `Item ${index + 1}`;
	return templateValue(item, template);
}

function templateValue(item: unknown, template?: string) {
	if (!template) return "";
	if (typeof item === "object" && item !== null) {
		return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
			const fieldValue = (item as Record<string, unknown>)[key];
			if (key === "when") {
				if (Array.isArray(fieldValue)) {
					if (fieldValue.length === 0) return "Always";
					return generateConditionSummary({
						type: "group",
						operator: "all",
						conditions: fieldValue,
					});
				}
				if (typeof fieldValue === "object" && fieldValue !== null) {
					return generateConditionSummary(fieldValue);
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
		const title = getItemTitle(item, index, metadata.features?.getItemTitle);
		const subtitle =
			templateValue(item, metadata.features?.getItemSummary) ||
			templateValue(item, metadata.features?.getItemSubtitle) ||
			generateEditorSummary(item, metadata.features?.itemMetadata?.summary);
		const badge = templateValue(item, metadata.features?.getItemBadge);
		const status = metadata.features?.getItemStatus;
		const itemBody = metadata.features?.itemMetadata ? (
			renderEditorControl({
				value: item,
				onChange: (nextItem) => updateItem(index, nextItem),
				metadata: metadata.features.itemMetadata,
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

					<button
						type="button"
						disabled={!canEdit || !removable || value.length <= minItems}
						onClick={() => removeItem(index)}
					>
						Remove
					</button>
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
						{badge ? <span className="arrayEditor__itemBadge">{badge}</span> : null}
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
					{badge ? <span className="arrayEditor__itemBadge">{badge}</span> : null}
				</div>
				{itemShell}
			</div>
		);
	}

	function addItem(defaultItem: unknown = metadata.features?.defaultItem ?? "") {
		if (!canAdd) return;
		onChange([...value, cloneValue(defaultItem)]);
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
					value.length === 0
						? (metadata.features?.emptyTitle ?? "No items yet")
						: `${value.length} items`,
				),
			}}
		>
			<div className="arrayEditor">
				<div className="arrayEditor__summary">{value.length} items</div>
				{value.map(renderItem)}
				{value.length === 0 ? (
					<div className="arrayEditor__empty">
						<strong>{metadata.features?.emptyTitle ?? "No items yet."}</strong>
						{metadata.features?.emptyDescription ? (
							<span>{metadata.features.emptyDescription}</span>
						) : null}
					</div>
				) : null}
				{metadata.features?.addMenu?.length ? (
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
