"use client";

import {useState} from "react";
import type {EditorControlMetadata, EditorControlProps} from "../../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../../types/universalEditorTypes";
import {applyTextTransform} from "../../../utils/universalEditorUtils";
import {FieldShell} from "./FieldShell";
import "./TagListEditor.scss";

export type TagListTransform = "none" | "slug" | "id" | "lowercase" | "uppercase";

export type TagListFeatures = {
	allowDuplicates?: boolean;
	suggestions?: string[];
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
							metadata.features?.suggestions ? `${metadata.testId ?? "tag-list"}-suggestions` : undefined
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

				{metadata.features?.suggestions ? (
					<datalist id={`${metadata.testId ?? "tag-list"}-suggestions`}>
						{metadata.features.suggestions.map((suggestion) => (
							<option key={suggestion} value={suggestion} />
						))}
					</datalist>
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
