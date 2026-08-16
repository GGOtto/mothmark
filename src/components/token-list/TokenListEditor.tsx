"use client";

import {useId, useState, type ReactNode} from "react";
import "./TokenListEditor.scss";

export type TokenListEditorProps = {
	addLabel: string;
	allowDuplicates?: boolean;
	autoFocus?: boolean;
	className?: string;
	disabled?: boolean;
	footer?: ReactNode;
	inputListId?: string;
	maxItems?: number;
	onChange: (values: string[]) => void;
	onDraftChange?: (value: string) => void;
	normalizeValue?: (value: string) => string;
	readonly?: boolean;
	suggestions?: readonly string[];
	tone?: "aliases" | "tags";
	values: string[];
	addOnBlur?: boolean;
	addOnComma?: boolean;
};

export function TokenListEditor({
	addLabel,
	allowDuplicates = false,
	autoFocus = false,
	className = "",
	disabled = false,
	footer,
	inputListId,
	maxItems,
	onChange,
	onDraftChange,
	normalizeValue = (value) => value.trim(),
	readonly = false,
	suggestions = [],
	tone = "aliases",
	values,
	addOnBlur = true,
	addOnComma = true,
}: TokenListEditorProps) {
	const generatedId = useId();
	const [draft, setDraft] = useState("");
	const canEdit = !disabled && !readonly;
	const canAdd = canEdit && (maxItems === undefined || values.length < maxItems);
	const normalizedValues = new Set(values.map((value) => normalizeValue(value).toLocaleLowerCase()));
	const visibleSuggestions = suggestions.filter(
		(suggestion) => !normalizedValues.has(normalizeValue(suggestion).toLocaleLowerCase()),
	);
	const listId = visibleSuggestions.length
		? (inputListId ?? `token-list-${generatedId}`)
		: undefined;

	function changeDraft(value: string) {
		setDraft(value);
		onDraftChange?.(value);
	}

	function addValue(rawValue = draft) {
		if (!canAdd) return;
		const nextValue = normalizeValue(rawValue);
		if (!nextValue) return;
		if (!allowDuplicates && normalizedValues.has(nextValue.toLocaleLowerCase())) {
			changeDraft("");
			return;
		}
		onChange([...values, nextValue]);
		changeDraft("");
	}

	return (
		<div className={["tokenList", `tokenList--${tone}`, className].filter(Boolean).join(" ")}>
			<div className="tokenList__well">
				{values.map((value, index) => (
					<span className="tokenList__token" key={`${value}-${index}`}>
						<span className="tokenList__tokenText">{value}</span>
						<button
							type="button"
							aria-label={`Remove ${value}`}
							disabled={!canEdit}
							onClick={() => onChange(values.filter((_, valueIndex) => valueIndex !== index))}
						>
							×
						</button>
					</span>
				))}
				<input
					type="text"
					autoFocus={autoFocus}
					value={draft}
					aria-label={addLabel}
					placeholder={addLabel}
					disabled={!canAdd}
					readOnly={readonly}
					list={listId}
					onBlur={() => {
						if (addOnBlur) addValue();
					}}
					onChange={(event) => {
						const nextValue = event.target.value;
						if (addOnComma && nextValue.includes(",")) {
							addValue(nextValue.split(",")[0]);
							return;
						}
						changeDraft(nextValue);
					}}
					onKeyDown={(event) => {
						if (event.key !== "Enter" && !(addOnComma && event.key === ",")) return;
						event.preventDefault();
						addValue();
					}}
				/>
			</div>
			{listId ? (
				<datalist id={listId}>
					{visibleSuggestions.map((suggestion) => (
						<option key={suggestion} value={suggestion} />
					))}
				</datalist>
			) : null}
			{visibleSuggestions.length ? (
				<div className="tokenList__suggestions" aria-label={`${addLabel} suggestions`}>
					{visibleSuggestions.slice(0, 8).map((suggestion) => (
						<button
							key={suggestion}
							type="button"
							disabled={!canAdd}
							onClick={() => addValue(suggestion)}
						>
							{suggestion}
						</button>
					))}
				</div>
			) : null}
			{footer}
		</div>
	);
}
