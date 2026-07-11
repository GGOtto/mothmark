"use client";

import type {EditorControlMetadata, EditorControlProps} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./StringListEditor.scss";

export type StringListFeatures = {
	addLabel?: string;
	itemPlaceholder?: string;
	reorderable?: boolean;
	duplicateable?: boolean;
	minItems?: number;
	maxItems?: number;
};

export type StringListControlMetadata = EditorControlMetadata & {
	type: "string-list";
	features?: StringListFeatures;
};

export type StringListEditorProps = EditorControlProps<string[], StringListControlMetadata>;

export function StringListEditor({
	value,
	onChange,
	metadata,
	error,
	warnings,
	disabled,
	readonly,
	context,
}: StringListEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const minItems = metadata.features?.minItems ?? 0;
	const maxItems = metadata.features?.maxItems;
	const canAdd = canEdit && (typeof maxItems !== "number" || value.length < maxItems);

	function updateItem(index: number, nextItem: string) {
		onChange(value.map((item, itemIndex) => (itemIndex === index ? nextItem : item)));
	}

	function removeItem(index: number) {
		if (!canEdit || value.length <= minItems) return;

		onChange(value.filter((_, itemIndex) => itemIndex !== index));
	}

	function duplicateItem(index: number) {
		if (!canAdd) return;

		onChange([...value.slice(0, index + 1), value[index], ...value.slice(index + 1)]);
	}

	function moveItem(index: number, direction: -1 | 1) {
		const nextIndex = index + direction;
		if (!canEdit || nextIndex < 0 || nextIndex >= value.length) return;

		const nextValue = [...value];
		[nextValue[index], nextValue[nextIndex]] = [nextValue[nextIndex], nextValue[index]];
		onChange(nextValue);
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
			<div className="stringListEditor">
				{value.map((item, index) => (
					<div key={index} className="stringListEditor__item">
						<textarea
							className="stringListEditor__textarea"
							value={item}
							placeholder={metadata.features?.itemPlaceholder ?? metadata.placeholder}
							disabled={isDisabled}
							readOnly={isReadonly}
							rows={2}
							onChange={(event) => updateItem(index, event.target.value)}
						/>

						<div className="stringListEditor__actions">
							{metadata.features?.reorderable ? (
								<>
									<button
										type="button"
										disabled={!canEdit || index === 0}
										onClick={() => moveItem(index, -1)}
									>
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
								disabled={!canEdit || value.length <= minItems}
								onClick={() => removeItem(index)}
							>
								Remove
							</button>
						</div>
					</div>
				))}

				<button
					className="stringListEditor__addButton"
					type="button"
					disabled={!canAdd}
					onClick={() => onChange([...value, ""])}
				>
					{metadata.features?.addLabel ?? "Add row"}
				</button>
			</div>
		</FieldShell>
	);
}
