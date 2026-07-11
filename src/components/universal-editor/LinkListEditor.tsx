"use client";

import {useState} from "react";
import {ExternalLink, LinkIcon, Pencil, Plus, X} from "lucide-react";
import type {
	EditorControlMetadata,
	EditorControlProps,
	EditorLinkRef,
	EditorLinkTargetMetadata,
} from "../../types/universalEditorTypes";
import type {EntityType} from "../../types/editor/editorRegistryTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./LinkListEditor.scss";

export type LinkListLinkType = "internal-link" | "external-link" | "editor";
export type LinkListValue = string[] | EditorLinkRef[];
export type SingleLinkValue = string | EditorLinkRef | null | undefined;
export type LinkListMode = "read" | "edit" | "single-link";
export type LinkListDisplay = "inline" | "block" | "compact";
export type LinkListOpenBehavior = "same-tab" | "new-tab";
export type EditorLinkTargetKind = "entity" | "path" | "control" | "condition" | "effect";

export type LinkListFeatures = {
	mode?: LinkListMode;
	linkType: LinkListLinkType;
	display?: LinkListDisplay;
	clearButton?: boolean;
	removeButton?: boolean;
	addButton?: boolean;
	openBehavior?: LinkListOpenBehavior;
	basePath?: string;
	normalizeInternalPath?: boolean;
	validateExternalUrl?: boolean;
	editorTarget?: EditorLinkTargetMetadata;
	addLabel?: string;
	inputPlaceholder?: string;
	pickerPlaceholder?: string;
	emptyText?: string;
	clickHint?: string;
};

export type LinkListControlMetadata = EditorControlMetadata & {
	type: "link-list";
	features: LinkListFeatures;
};

export type LinkListEditorProps = EditorControlProps<
	LinkListValue | SingleLinkValue,
	LinkListControlMetadata
>;

function isEditorLinkRef(value: unknown): value is EditorLinkRef {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		typeof (value as EditorLinkRef).type === "string" &&
		typeof (value as EditorLinkRef).id === "string"
	);
}

function isRecordWithId(value: unknown): value is Record<string, unknown> & {id: string} {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		typeof (value as {id?: unknown}).id === "string"
	);
}

function labelFromRecord(value: Record<string, unknown>) {
	const label = value.label ?? value.name ?? value.title ?? value.id;
	return label == null ? undefined : String(label);
}

function stringValues(value: LinkListValue | SingleLinkValue) {
	if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
	return typeof value === "string" && value.length > 0 ? [value] : [];
}

function editorValues(value: LinkListValue | SingleLinkValue, target?: EditorLinkTargetMetadata) {
	const type = editorTypeForTarget(target);

	if (Array.isArray(value)) {
		return value
			.map((item): EditorLinkRef | undefined => {
				if (isEditorLinkRef(item)) return item;
				if (isRecordWithId(item)) return {type, id: item.id, label: labelFromRecord(item)};
				return undefined;
			})
			.filter((item): item is EditorLinkRef => Boolean(item));
	}

	if (isEditorLinkRef(value)) return [value];
	if (isRecordWithId(value)) return [{type, id: value.id, label: labelFromRecord(value)}];
	return [];
}

function joinInternalHref(rawValue: string, basePath = "", normalize = true) {
	const trimmed = rawValue.trim();
	if (!trimmed) return "";

	const [pathWithQuery, hash = ""] = trimmed.split("#", 2);
	const [pathOnly, query = ""] = pathWithQuery.split("?", 2);
	const joinedPath = basePath
		? `${basePath.replace(/\/+$/g, "")}/${pathOnly.replace(/^\/+/g, "")}`
		: pathOnly;
	const normalizedPath = normalize ? joinedPath.replace(/\/{2,}/g, "/") : joinedPath;

	return `${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}${query ? `?${query}` : ""}${
		hash ? `#${hash}` : ""
	}`;
}

function isValidExternalUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

function editorTypeForTarget(target?: EditorLinkTargetMetadata): string {
	return target?.entityType ?? "editor";
}

function selectEntityType(entityType?: EntityType): EntityType | undefined {
	if (!entityType || entityType === "direction") return undefined;
	return entityType;
}

function usesSourcePathTarget(target?: EditorLinkTargetMetadata) {
	return target?.path?.includes("{sourcePath}") ?? false;
}

export function LinkListEditor({
	value,
	onChange,
	metadata,
	path,
	error,
	warnings,
	disabled,
	readonly,
	autoFocus,
	context,
}: LinkListEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const [draftValue, setDraftValue] = useState("");

	const features = metadata.features;
	const mode = features.mode ?? "read";
	const isSingle = mode === "single-link";
	const linkType = features.linkType;
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const isEditableMode = mode === "edit" || mode === "single-link";
	const removeButton = features.removeButton ?? mode === "edit";
	const addButton = features.addButton ?? mode === "edit";
	const clickHint = features.clickHint ?? (linkType === "editor" ? "Edit" : "Open");
	const target = features.editorTarget;
	const isEmbeddedEditorValue = linkType === "editor" && usesSourcePathTarget(target);
	const values = linkType === "editor" ? editorValues(value, target) : stringValues(value);
	const targetEntityType = selectEntityType(target?.entityType);
	const entityOptions =
		linkType === "editor" && targetEntityType
			? (context.registerEntityPicker?.getEntities(targetEntityType) ?? [])
			: [];
	const selectedIds = new Set(values.map((item) => (isEditorLinkRef(item) ? item.id : item)));
	const availableEntityOptions = entityOptions.filter((option) => !selectedIds.has(option.id));
	const canUseEntityPicker =
		linkType === "editor" && target?.kind === "entity" && targetEntityType && !isEmbeddedEditorValue;
	const pickerOptions = isSingle ? entityOptions : availableEntityOptions;
	const canCreateEditorLink =
		linkType === "editor" &&
		target?.create?.enabled &&
		typeof context.editorNavigation?.createEditorLink === "function";

	function commitValues(nextValues: Array<string | EditorLinkRef>) {
		onChange((isSingle ? (nextValues[0] ?? null) : nextValues) as LinkListValue | SingleLinkValue);
	}

	function addStringLink(rawValue = draftValue) {
		if (!canEdit || linkType === "editor") return;

		const nextValue = rawValue.trim();
		if (!nextValue || selectedIds.has(nextValue)) {
			setDraftValue("");
			return;
		}

		commitValues(isSingle ? [nextValue] : [...values, nextValue]);
		setDraftValue("");
	}

	function addEditorLink(ref: EditorLinkRef) {
		if (!canEdit || linkType !== "editor" || selectedIds.has(ref.id)) return;

		commitValues(isSingle ? [ref] : [...values, ref]);
	}

	function createEditorLink() {
		if (!canEdit || !target) return;

		const ref = context.editorNavigation?.createEditorLink?.({
			target,
			sourcePath: path,
		});
		if (ref && !isEmbeddedEditorValue) addEditorLink(ref);
	}

	function removeLink(index: number) {
		if (!canEdit || !removeButton) return;

		if (isEmbeddedEditorValue && Array.isArray(value)) {
			onChange(value.filter((_, valueIndex) => valueIndex !== index) as LinkListValue);
			return;
		}

		commitValues(values.filter((_, valueIndex) => valueIndex !== index));
	}

	function clearLinks() {
		if (!canEdit) return;

		commitValues([]);
	}

	function openEditorLink(ref: EditorLinkRef) {
		if (isDisabled || !target) return;

		context.editorNavigation?.openEditorLink?.({
			ref,
			target,
			sourcePath: path,
		});
	}

	function linkLabel(item: string | EditorLinkRef) {
		if (typeof item === "string") return item;
		return context.editorNavigation?.resolveEditorLinkLabel?.(item, target) ?? item.label ?? item.id;
	}

	function linkDescription(item: EditorLinkRef) {
		return context.editorNavigation?.resolveEditorLinkDescription?.(item, target);
	}

	function isMissingEditorTarget(item: EditorLinkRef) {
		if (isEmbeddedEditorValue) return false;
		if (!targetEntityType) return !target;
		if (!context.registerEntityPicker) return false;
		return !context.registerEntityPicker.isValidEntityId(targetEntityType, item.id);
	}

	function renderStringLink(item: string, index: number) {
		const isExternal = linkType === "external-link";
		const isValid = !isExternal || !features.validateExternalUrl || isValidExternalUrl(item);
		const href = isExternal
			? item
			: joinInternalHref(item, features.basePath, features.normalizeInternalPath !== false);
		const shouldOpenInNewTab = features.openBehavior === "new-tab";
		const label = linkLabel(item);

		return (
			<span
				key={`${item}-${index}`}
				className={["linkListEditor__item", !isValid ? "linkListEditor__item--warning" : ""]
					.filter(Boolean)
					.join(" ")}
			>
				{isValid ? (
					<a
						className="linkListEditor__itemAnchor"
						href={href}
						target={shouldOpenInNewTab ? "_blank" : undefined}
						rel={shouldOpenInNewTab ? "noreferrer noopener" : undefined}
						aria-label={`${clickHint} ${label}`}
					>
						{isExternal ? (
							<ExternalLink aria-hidden="true" size={13} />
						) : (
							<LinkIcon aria-hidden="true" size={13} />
						)}
						<span className="linkListEditor__itemText">{label}</span>
						<span className="linkListEditor__itemHint">{clickHint}</span>
					</a>
				) : (
					<span className="linkListEditor__itemDisabled">
						<ExternalLink aria-hidden="true" size={13} />
						<span className="linkListEditor__itemText">{label}</span>
						<span className="linkListEditor__itemHint">Invalid URL</span>
					</span>
				)}

				{isEditableMode && removeButton ? (
					<button
						className="linkListEditor__removeButton"
						type="button"
						aria-label={`Remove ${label}`}
						disabled={!canEdit}
						onClick={() => removeLink(index)}
					>
						<X aria-hidden="true" size={13} />
					</button>
				) : null}
			</span>
		);
	}

	function renderEditorLink(item: EditorLinkRef, index: number) {
		const label = linkLabel(item);
		const description = linkDescription(item);
		const isMissing = isMissingEditorTarget(item);

		return (
			<span
				key={`${item.type}-${item.id}-${index}`}
				className={["linkListEditor__item", isMissing ? "linkListEditor__item--warning" : ""]
					.filter(Boolean)
					.join(" ")}
			>
				<button
					className="linkListEditor__itemButton"
					type="button"
					aria-label={`${clickHint} ${label}`}
					disabled={isDisabled || !target || isMissing}
					onClick={() => openEditorLink(item)}
				>
					<Pencil aria-hidden="true" size={13} />
					<span className="linkListEditor__itemText">{label}</span>
					<span className="linkListEditor__itemHint">
						{isMissing ? `Missing target: ${item.type}/${item.id}` : clickHint}
					</span>
				</button>

				{description ? <span className="linkListEditor__description">{description}</span> : null}

				{isEditableMode && removeButton ? (
					<button
						className="linkListEditor__removeButton"
						type="button"
						aria-label={`Remove ${label}`}
						disabled={!canEdit}
						onClick={() => removeLink(index)}
					>
						<X aria-hidden="true" size={13} />
					</button>
				) : null}
			</span>
		);
	}

	function renderStringInput() {
		if (!isEditableMode || linkType === "editor") return null;

		if (isSingle) {
			return (
				<input
					className="linkListEditor__input"
					value={stringValues(value)[0] ?? ""}
					placeholder={features.inputPlaceholder ?? metadata.placeholder ?? "Add link"}
					disabled={!canEdit}
					readOnly={isReadonly}
					autoFocus={autoFocus}
					onChange={(event) => commitValues(event.target.value.trim() ? [event.target.value] : [])}
				/>
			);
		}

		return (
			<div className="linkListEditor__inputRow">
				<input
					className="linkListEditor__input"
					value={draftValue}
					placeholder={features.inputPlaceholder ?? metadata.placeholder ?? "Add link"}
					disabled={!canEdit}
					readOnly={isReadonly}
					autoFocus={autoFocus}
					onChange={(event) => setDraftValue(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							addStringLink();
						}
					}}
				/>
				{addButton ? (
					<button
						className="linkListEditor__addButton"
						type="button"
						disabled={!canEdit || draftValue.trim().length === 0}
						onClick={() => addStringLink()}
					>
						<Plus aria-hidden="true" size={14} />
						<span>{features.addLabel ?? "Add"}</span>
					</button>
				) : null}
			</div>
		);
	}

	function renderEditorPicker() {
		if (!isEditableMode || linkType !== "editor") return null;

		return (
			<div className="linkListEditor__inputRow">
				{canUseEntityPicker ? (
					<select
						className="linkListEditor__input"
						value={isSingle ? (editorValues(value, target)[0]?.id ?? "") : ""}
						disabled={!canEdit || pickerOptions.length === 0}
						autoFocus={autoFocus}
						onChange={(event) => {
							const id = event.target.value;
							if (isSingle) {
								commitValues(id ? [{type: editorTypeForTarget(target), id}] : []);
								return;
							}

							if (!id) return;

							addEditorLink({type: editorTypeForTarget(target), id});
						}}
					>
						<option value="">{features.pickerPlaceholder ?? "Choose target"}</option>
						{pickerOptions.map((option) => (
							<option key={option.id} value={option.id}>
								{option.label}
							</option>
						))}
					</select>
				) : null}

				{target?.create?.enabled && addButton ? (
					<button
						className="linkListEditor__addButton"
						type="button"
						disabled={!canEdit || !canCreateEditorLink}
						onClick={createEditorLink}
					>
						<Plus aria-hidden="true" size={14} />
						<span>{target.create.buttonLabel ?? features.addLabel ?? "Create"}</span>
					</button>
				) : null}
			</div>
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
					"linkListEditor",
					`linkListEditor--${features.display ?? "inline"}`,
					isSingle ? "linkListEditor--single" : "",
				]
					.filter(Boolean)
					.join(" ")}
			>
				<div className="linkListEditor__items">
					{values.length > 0 ? (
						values.map((item, index) =>
							linkType === "editor" && isEditorLinkRef(item)
								? renderEditorLink(item, index)
								: renderStringLink(String(item), index),
						)
					) : (
						<div className="linkListEditor__empty">
							{features.emptyText ?? target?.emptyLabel ?? "No links"}
						</div>
					)}
				</div>

				{renderStringInput()}
				{renderEditorPicker()}

				{features.clearButton && !isSingle ? (
					<button
						className="linkListEditor__clearButton"
						type="button"
						disabled={!canEdit || values.length === 0}
						onClick={clearLinks}
					>
						Clear links
					</button>
				) : null}
			</div>
		</FieldShell>
	);
}
