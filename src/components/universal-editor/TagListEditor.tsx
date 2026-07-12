"use client";

import {useState} from "react";
import type {EditorControlMetadata, EditorControlProps} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {applyTextTransform} from "../../utils/universalEditorUtils";
import {FieldShell} from "./FieldShell";
import "./TagListEditor.scss";

export type TagListTransform = "none" | "slug" | "id" | "lowercase" | "uppercase";

export type TagListFeatures = {
	allowDuplicates?: boolean;
	suggestions?: string[];
	suggestionFields?: string[];
	autoSuggestFrom?: "title" | "description" | "registry";
	sourceText?: string;
	collisionValues?: string[];
	showCollisions?: boolean;
	showNormalization?: boolean;
	suggestPlural?: boolean;
	suggestArticleless?: boolean;
	transform?: TagListTransform;
	addOnBlur?: boolean;
	addOnComma?: boolean;
	maxItems?: number;
};

export type TagListControlMetadata = EditorControlMetadata & {
	type: "tag-list";
	features?: TagListFeatures;
};

export type TagListEditorProps = EditorControlProps<string[], TagListControlMetadata>;

export function TagListEditor({
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
}: TagListEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const [draftValue, setDraftValue] = useState("");

	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const maxItems = metadata.features?.maxItems;
	const canAdd = canEdit && (typeof maxItems !== "number" || value.length < maxItems);
	const collisionValues = new Set(metadata.features?.collisionValues ?? []);
	const suggestionSourceText =
		metadata.features?.sourceText ??
		resolveSuggestionSourceText(
			metadata.features?.suggestionFields,
			metadata.features?.autoSuggestFrom,
			path,
			context,
		);
	const generatedSuggestions = createAliasSuggestions(
		suggestionSourceText,
		metadata.features?.suggestions,
		metadata.features?.suggestPlural,
		metadata.features?.suggestArticleless,
		metadata.features?.suggestionFields !== undefined,
	);
	const visibleSuggestions = generatedSuggestions.filter(
		(suggestion) => !value.includes(suggestion),
	);
	const normalizedDraft = normalizeTag(draftValue);
	const collisions = value.filter((tag) => collisionValues.has(tag));

	function normalizeTag(rawValue: string) {
		return applyTextTransform(rawValue.trim(), metadata.features?.transform);
	}

	function addTag(rawValue = draftValue) {
		if (!canAdd) return;

		const nextTag = normalizeTag(rawValue);
		if (!nextTag) return;
		if (!metadata.features?.allowDuplicates && value.includes(nextTag)) {
			setDraftValue("");
			return;
		}

		onChange([...value, nextTag]);
		setDraftValue("");
	}

	function removeTag(index: number) {
		if (!canEdit) return;

		onChange(value.filter((_, valueIndex) => valueIndex !== index));
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
			<div className="tagListEditor">
				<div className="tagListEditor__tags">
					{value.map((tag, index) => (
						<span key={`${tag}-${index}`} className="tagListEditor__tag">
							<span className="tagListEditor__tagText">{tag}</span>
							<button
								className="tagListEditor__removeButton"
								type="button"
								aria-label={`Remove ${tag}`}
								disabled={!canEdit}
								onClick={() => removeTag(index)}
							>
								x
							</button>
						</span>
					))}

					<input
						className="tagListEditor__input"
						value={draftValue}
						placeholder={metadata.placeholder ?? "Add tag"}
						disabled={!canAdd}
						readOnly={isReadonly}
						autoFocus={autoFocus}
						list={
							visibleSuggestions.length > 0 ? `${metadata.testId ?? "tag-list"}-suggestions` : undefined
						}
						onBlur={() => {
							if (metadata.features?.addOnBlur) addTag();
						}}
						onChange={(event) => {
							const nextValue = event.target.value;

							if (metadata.features?.addOnComma && nextValue.includes(",")) {
								const [firstTag] = nextValue.split(",");
								addTag(firstTag);
								return;
							}

							setDraftValue(nextValue);
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								addTag();
							}
						}}
					/>
				</div>

				{visibleSuggestions.length > 0 ? (
					<datalist id={`${metadata.testId ?? "tag-list"}-suggestions`}>
						{visibleSuggestions.map((suggestion) => (
							<option key={suggestion} value={suggestion} />
						))}
					</datalist>
				) : null}

				{visibleSuggestions.length > 0 ? (
					<div className="tagListEditor__suggestions">
						{visibleSuggestions.slice(0, 8).map((suggestion) => (
							<button key={suggestion} type="button" disabled={!canAdd} onClick={() => addTag(suggestion)}>
								{suggestion}
							</button>
						))}
					</div>
				) : null}

				{metadata.features?.showNormalization && draftValue.trim() ? (
					<div className="tagListEditor__meta">Normalizes to {normalizedDraft || "(empty)"}</div>
				) : null}

				{metadata.features?.showCollisions && collisions.length > 0 ? (
					<div className="tagListEditor__warning">
						Collides with existing aliases: {collisions.join(", ")}
					</div>
				) : null}

				{typeof maxItems === "number" ? (
					<div className="tagListEditor__meta">
						{value.length} / {maxItems}
					</div>
				) : null}
			</div>
		</FieldShell>
	);
}

function resolveSuggestionSourceText(
	suggestionFields: TagListFeatures["suggestionFields"],
	legacySource: TagListFeatures["autoSuggestFrom"],
	path: TagListEditorProps["path"],
	context: TagListEditorProps["context"],
) {
	const fields = suggestionFields ?? fieldsForLegacySuggestionSource(legacySource);
	if (fields.length === 0) return undefined;

	const parentPath = path.slice(0, -1);
	const parentValue = context.getValue(parentPath);
	if (!parentValue || typeof parentValue !== "object" || Array.isArray(parentValue))
		return undefined;

	const record = parentValue as Record<string, unknown>;

	for (const fieldName of fields) {
		const fieldValue = record[fieldName];
		if (typeof fieldValue !== "string") continue;

		const trimmedValue = fieldValue.trim();
		if (trimmedValue) return trimmedValue;
	}

	return undefined;
}

function fieldsForLegacySuggestionSource(source: TagListFeatures["autoSuggestFrom"]) {
	if (source === "description") return ["description"];
	if (source === "title") return ["name", "title", "label"];
	return [];
}

function createAliasSuggestions(
	sourceText?: string,
	suggestions: string[] = [],
	suggestPlural?: boolean,
	suggestArticleless?: boolean,
	suggestNumberedAliases?: boolean,
) {
	const values = new Set<string>(suggestions.map((suggestion) => suggestion.trim()).filter(Boolean));
	const normalizedSource = sourceText?.trim();

	if (normalizedSource) {
		if (suggestNumberedAliases) {
			values.add(`${normalizedSource} 1`);
			values.add(`${normalizedSource} 2`);
			values.add(`${normalizedSource} 3`);
		} else {
			values.add(normalizedSource);
		}

		const articleless = normalizedSource.replace(/^(a|an|the)\s+/i, "").trim();
		if (suggestArticleless && articleless) values.add(articleless);

		const words = articleless.split(/\s+/).filter(Boolean);
		if (words.length > 1) values.add(words[words.length - 1]);

		if (suggestPlural) {
			for (const value of [...values]) {
				if (!value.endsWith("s")) values.add(`${value}s`);
			}
		}
	}

	return [...values];
}
