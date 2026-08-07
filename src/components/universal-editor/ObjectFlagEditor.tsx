"use client";

import {LockKeyhole, Plus, Trash2} from "lucide-react";
import type {EditorControlMetadata, EditorControlProps} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import "./ObjectFlagEditor.scss";

export type ObjectFlagDefinitionMetadata = {
	permanent?: boolean;
	defaultValue?: boolean;
	defaultReadonly?: boolean;
	description?: string;
};

export type ObjectFlagFeatures = {
	flags?: Record<string, ObjectFlagDefinitionMetadata>;
	linkedFlags?: Array<{
		name: string;
		valueField: string;
		sourceArrayField: string;
		sourceDiscriminator?: string;
		sourceValue: string;
		description?: string;
	}>;
	addLabel?: string;
	emptyTitle?: string;
	emptyDescription?: string;
};

export type ObjectFlagControlMetadata = EditorControlMetadata & {
	type: "object-flag-editor";
	features?: ObjectFlagFeatures;
};

export type ObjectFlagEditorProps = EditorControlProps<
	Record<string, boolean>,
	ObjectFlagControlMetadata
>;

function nextFlagName(flags: Record<string, boolean>) {
	let suffix = 1;
	let name = "flag";
	while (Object.hasOwn(flags, name)) {
		suffix += 1;
		name = `flag${suffix}`;
	}
	return name;
}

export function ObjectFlagEditor({
	value,
	onChange,
	metadata,
	path,
	error,
	warnings,
	disabled,
	readonly,
	context,
}: ObjectFlagEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const definitions = metadata.features?.flags ?? {};
	const parentPath = path.slice(0, -1);
	const ownerPath = path.slice(0, -2);
	const ownerValue = context.getValue(ownerPath);
	const parentValue = context.getValue(parentPath);
	const activeLinkedFlags = (metadata.features?.linkedFlags ?? []).filter((linkedFlag) => {
		if (!ownerValue || typeof ownerValue !== "object" || Array.isArray(ownerValue)) return false;
		const sourceValue = (ownerValue as Record<string, unknown>)[linkedFlag.sourceArrayField];
		if (!Array.isArray(sourceValue)) return false;
		const discriminator = linkedFlag.sourceDiscriminator ?? "type";
		return sourceValue.some(
			(entry) =>
				entry !== null &&
				typeof entry === "object" &&
				!Array.isArray(entry) &&
				(entry as Record<string, unknown>)[discriminator] === linkedFlag.sourceValue,
		);
	});
	const linkedFlagNames = new Set(activeLinkedFlags.map((linkedFlag) => linkedFlag.name));
	const effectiveValue = Object.fromEntries([
		...Object.entries(definitions)
			.filter(([, definition]) => definition.permanent)
			.map(([name, definition]) => [name, definition.defaultValue ?? false] as const),
		...Object.entries(value).filter(([name]) => !linkedFlagNames.has(name)),
	]);
	const flags = [
		...Object.entries(effectiveValue).map(([name, defaultValue]) => ({
			name,
			defaultValue,
			definition: definitions[name],
			linked: false as const,
			valueField: undefined,
		})),
		...activeLinkedFlags.map((linkedFlag) => ({
			name: linkedFlag.name,
			defaultValue: Boolean(
				parentValue &&
				typeof parentValue === "object" &&
				!Array.isArray(parentValue) &&
				(parentValue as Record<string, unknown>)[linkedFlag.valueField],
			),
			definition: {
				permanent: true,
				defaultReadonly: false,
				description: linkedFlag.description,
			},
			linked: true as const,
			valueField: linkedFlag.valueField,
		})),
	];

	function renameFlag(previousName: string, nextName: string) {
		if (!canEdit || previousName === nextName || Object.hasOwn(effectiveValue, nextName)) return;
		onChange(
			Object.fromEntries(
				Object.entries(effectiveValue).map(([name, defaultValue]) => [
					name === previousName ? nextName : name,
					defaultValue,
				]),
			),
		);
	}

	function setDefault(name: string, defaultValue: boolean, valueField?: string) {
		if (!canEdit) return;
		if (valueField) {
			context.setValue([...parentPath, valueField], defaultValue);
			return;
		}
		onChange({...effectiveValue, [name]: defaultValue});
	}

	function deleteFlag(name: string) {
		if (!canEdit || definitions[name]?.permanent) return;
		const nextValue = {...effectiveValue};
		delete nextValue[name];
		onChange(nextValue);
	}

	function addFlag() {
		if (!canEdit) return;
		onChange({...effectiveValue, [nextFlagName(effectiveValue)]: false});
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
			slots={{summary: flags.length === 1 ? "1 flag" : `${flags.length} flags`}}
		>
			<div className="objectFlagEditor">
				{flags.length > 0 ? (
					<div className="objectFlagEditor__header" aria-hidden="true">
						<span>Flag</span>
						<span>Default</span>
					</div>
				) : null}

				{flags.length === 0 ? (
					<div className="objectFlagEditor__empty">
						<strong>{metadata.features?.emptyTitle ?? "No flags yet."}</strong>
						{metadata.features?.emptyDescription ? (
							<span>{metadata.features.emptyDescription}</span>
						) : null}
					</div>
				) : null}

				{flags.map(({name, defaultValue, definition, linked, valueField}, index) => {
					const permanent = Boolean(definition?.permanent);
					const defaultReadonly = Boolean(definition?.defaultReadonly);
					return (
						<div
							className={["objectFlagEditor__row", permanent ? "objectFlagEditor__row--permanent" : ""]
								.filter(Boolean)
								.join(" ")}
							key={permanent ? `permanent-${name}` : `editable-${index}`}
						>
							<div className="objectFlagEditor__name">
								{permanent ? (
									<span
										className="objectFlagEditor__fixedName"
										title={definition?.description ?? "Permanent flag"}
									>
										<LockKeyhole size={12} aria-hidden="true" />
										<span>{name}</span>
									</span>
								) : (
									<input
										value={name}
										disabled={isDisabled}
										readOnly={isReadonly}
										aria-label="Flag name"
										title={definition?.description}
										onChange={(event) => renameFlag(name, event.target.value)}
									/>
								)}
							</div>

							<button
								className={[
									"objectFlagEditor__default",
									defaultValue ? "objectFlagEditor__default--true" : "",
								]
									.filter(Boolean)
									.join(" ")}
								type="button"
								role="switch"
								aria-label={`Default value for ${name}`}
								aria-checked={defaultValue}
								disabled={!canEdit || defaultReadonly}
								title={defaultReadonly ? "This default is fixed" : `Default: ${defaultValue}`}
								onClick={() => setDefault(name, !defaultValue, linked ? valueField : undefined)}
							>
								<span className="objectFlagEditor__defaultTrack" aria-hidden="true">
									<span />
								</span>
								<span>{defaultValue ? "True" : "False"}</span>
								{defaultReadonly ? <LockKeyhole size={11} aria-hidden="true" /> : null}
							</button>

							{permanent ? (
								<span className="objectFlagEditor__actionSpacer" />
							) : (
								<button
									className="objectFlagEditor__delete"
									type="button"
									disabled={!canEdit}
									onClick={() => deleteFlag(name)}
									aria-label={`Delete ${name}`}
									title={`Delete ${name}`}
								>
									<Trash2 size={13} aria-hidden="true" />
								</button>
							)}
						</div>
					);
				})}

				<button className="objectFlagEditor__add" type="button" disabled={!canEdit} onClick={addFlag}>
					<Plus size={14} aria-hidden="true" />
					{metadata.features?.addLabel ?? "Add flag"}
				</button>
			</div>
		</FieldShell>
	);
}
