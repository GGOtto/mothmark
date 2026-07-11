"use client";

import type {EditorControlMetadata, EditorControlProps} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import type {ObjectFieldMetadata} from "./ObjectEditor";
import {ObjectEditor} from "./ObjectEditor";
import "./DiscriminatedUnionEditor.scss";

export type DiscriminatedUnionOption = {
	label: string;
	value: string;
	description?: string;
	defaultValue?: Record<string, unknown>;
	fields?: ObjectFieldMetadata[];
};

export type DiscriminatedUnionFeatures = {
	discriminator: string;
	options: DiscriminatedUnionOption[];
};

export type DiscriminatedUnionControlMetadata = EditorControlMetadata & {
	type: "discriminated-union";
	features: DiscriminatedUnionFeatures;
};

export type DiscriminatedUnionEditorProps = EditorControlProps<
	Record<string, unknown>,
	DiscriminatedUnionControlMetadata
>;

export function DiscriminatedUnionEditor({
	value,
	onChange,
	metadata,
	path,
	error,
	warnings,
	disabled,
	readonly,
	context,
}: DiscriminatedUnionEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const discriminator = metadata.features.discriminator;
	const selectedValue = String(value[discriminator] ?? metadata.features.options[0]?.value ?? "");
	const selectedOption = metadata.features.options.find((option) => option.value === selectedValue);
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;

	function changeBranch(nextDiscriminatorValue: string) {
		const nextOption = metadata.features.options.find(
			(option) => option.value === nextDiscriminatorValue,
		);

		onChange({
			...(nextOption?.defaultValue ?? {}),
			[discriminator]: nextDiscriminatorValue,
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
			<div className="discriminatedUnionEditor">
				<select
					className="discriminatedUnionEditor__select"
					value={selectedValue}
					disabled={isDisabled || isReadonly}
					onChange={(event) => changeBranch(event.target.value)}
				>
					{metadata.features.options.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>

				{selectedOption?.description ? (
					<div className="discriminatedUnionEditor__description">{selectedOption.description}</div>
				) : null}

				<ObjectEditor
					value={value}
					onChange={onChange}
					metadata={{
						type: "object",
						features: {
							fields: selectedOption?.fields,
							layout: "stack",
						},
					}}
					path={path}
					disabled={disabled}
					readonly={readonly}
					context={context}
				/>
			</div>
		</FieldShell>
	);
}
