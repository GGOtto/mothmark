"use client";

import {Fragment} from "react";
import type {z} from "zod";
import type {
	EditorControlContext,
	EditorControlMetadata,
	EditorControlProps,
	EditorSelectOption,
} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {generateEffectSummary} from "./utils/universalEditorUtils";
import {idValue, isID, toID} from "../../utils/idUtils";
import {FieldShell} from "./FieldShell";
import {renderChildControl} from "./renderChildControl";
import {resolveEditorMetadata} from "./utils/resolveEditorMetadata";
import {
	createSchemaVariantDefault,
	findEditorSchemaVariant,
	schemaFieldOptions,
	schemaTypeOptions,
} from "./utils/editorSchemaVariants";
import "./EffectListEditor.scss";

export type EffectValue = Record<string, unknown>;

export type EffectListFeatures = {
	reorderable?: boolean;
	duplicateable?: boolean;
	removable?: boolean;
	collapsibleItems?: boolean;
	showGeneratedSummary?: boolean;
	showCountSummary?: boolean;
	searchableEffectTypes?: boolean;
	excludedEffectIds?: string[];
	effectSchema?: z.ZodTypeAny;
	sourceSchema?: z.ZodTypeAny;
};

export type EffectListControlMetadata = EditorControlMetadata & {
	type: "effect-list";
	features?: EffectListFeatures;
};

export type EffectListEditorProps = EditorControlProps<EffectValue[], EffectListControlMetadata>;

function editorEffectSchema(metadata: EffectListControlMetadata) {
	const schema = metadata.features?.effectSchema ?? metadata.features?.sourceSchema;
	if (!schema) throw new Error("Effect editor metadata is missing its source schema.");
	return schema;
}

function effectTypeOptions(metadata: EffectListControlMetadata) {
	const options = schemaTypeOptions(editorEffectSchema(metadata));

	return options;
}

function operationOptionsForType(type: string, metadata: EffectListControlMetadata) {
	return schemaFieldOptions(editorEffectSchema(metadata), "operation", {type});
}

function defaultEffect(
	schema: z.ZodTypeAny | undefined,
	type: string,
	operationOptions: EditorSelectOption[] = [],
	operation?: string,
	flagType: "normal" | "room" | "item" = "normal",
): EffectValue {
	const selectedOperation = operation ?? operationOptions[0]?.value;
	return schema
		? createSchemaVariantDefault(schema, {
				type,
				"flag-type": type === "flag" ? flagType : undefined,
				operation: selectedOperation,
			})
		: {type, ...(selectedOperation ? {operation: selectedOperation} : {})};
}

function normalizeEffect(effect: EffectValue): EffectValue {
	if (effect.type === "effect-ref") {
		return {
			type: "effect-ref",
			effectId:
				isID(effect.effectId) && effect.effectId.type === "effect"
					? effect.effectId
					: toID("effect", ""),
		};
	}

	return effect;
}

function isEffectReference(effect: EffectValue) {
	return effect.type === "effect-ref";
}

function storedEffectId(effect: EffectValue) {
	return isID(effect.id) && idValue(effect.id).trim().length > 0
		? idValue(effect.id).trim()
		: undefined;
}

function storedEffectName(effect: EffectValue) {
	const explicitName = effect.name ?? effect.label ?? effect.title;
	return typeof explicitName === "string" && explicitName.trim().length > 0
		? explicitName.trim()
		: undefined;
}

function worldEffects(context: EditorControlContext) {
	const effects = context.getWorldValue?.(["effects"]) ?? context.getValue(["effects"]);
	return Array.isArray(effects) ? (effects as EffectValue[]).map(normalizeEffect) : [];
}

function worldEffectById(context: EditorControlContext, id: unknown) {
	if (!isID(id) || id.type !== "effect") return undefined;
	const effectId = id.id.trim();
	if (!effectId) return undefined;
	return worldEffects(context).find((effect) => storedEffectId(effect) === effectId);
}

function effectUsage(
	effect: EffectValue,
	context: EditorControlContext,
	seenEffectIds = new Set<string>(),
): EffectValue {
	if (!isEffectReference(effect)) return effect;
	if (!isID(effect.effectId) || effect.effectId.type !== "effect") return effect;

	const effectId = effect.effectId.id.trim();
	if (!effectId || seenEffectIds.has(effectId)) return effect;

	const worldEffect = worldEffectById(context, effect.effectId);
	if (!worldEffect) return effect;

	const nextSeenEffectIds = new Set(seenEffectIds);
	nextSeenEffectIds.add(effectId);
	return effectUsage(worldEffect, context, nextSeenEffectIds);
}

function effectOperation(effect: EffectValue) {
	const operation = effect.operation ?? effect.messageType;
	return typeof operation === "string" ? operation : undefined;
}

function effectWithVisibleDefaults(effect: EffectValue, metadata: EffectListControlMetadata) {
	const type = String(effect.type ?? "message");
	if (type === "effect-ref") return effect;
	const flagType =
		effect["flag-type"] === "room" || effect["flag-type"] === "item" ? effect["flag-type"] : "normal";
	return {
		...defaultEffect(
			editorEffectSchema(metadata),
			type,
			operationOptionsForType(type, metadata),
			effectOperation(effect),
			flagType,
		),
		...effect,
	};
}

function cloneEffect(effect: EffectValue) {
	if (typeof structuredClone === "function") return structuredClone(effect);
	return JSON.parse(JSON.stringify(effect)) as EffectValue;
}

export function EffectListEditor({
	value,
	onChange,
	metadata,
	path,
	error,
	warnings,
	disabled,
	readonly,
	context,
}: EffectListEditorProps) {
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const availableEffectTypeOptions = effectTypeOptions(metadata);
	const allowedTypes = availableEffectTypeOptions.map((option) => option.value);
	const removable = metadata.features?.removable ?? true;
	const normalizedEffects = value.map(normalizeEffect);

	function updateEffect(index: number, nextEffect: EffectValue) {
		onChange(
			normalizedEffects.map((effect, effectIndex) => (effectIndex === index ? nextEffect : effect)),
		);
	}

	function updateEffectField(index: number, key: string, nextFieldValue: unknown) {
		const storedEffect = normalizedEffects[index] ?? {};
		const currentEffect = isEffectReference(storedEffect)
			? storedEffect
			: effectUsage(storedEffect, context);
		const nextEffect = {
			...currentEffect,
			[key]: nextFieldValue,
		};

		updateEffect(index, nextEffect);
	}

	function updateFlagType(index: number, nextFlagType: string) {
		const currentEffect = effectUsage(normalizedEffects[index] ?? {}, context);
		const schema = editorEffectSchema(metadata);
		const currentOperation = effectOperation(currentEffect);
		const operation = findEditorSchemaVariant(schema, {
			type: "flag",
			"flag-type": nextFlagType,
			operation: currentOperation,
		})
			? currentOperation
			: schemaFieldOptions(schema, "operation", {
					type: "flag",
					"flag-type": nextFlagType,
				})[0]?.value;
		const variant = findEditorSchemaVariant(schema, {
			type: "flag",
			"flag-type": nextFlagType,
			operation,
		});
		const defaults = createSchemaVariantDefault(schema, {
			type: "flag",
			"flag-type": nextFlagType,
			operation,
		});
		const preservedFields = Object.fromEntries(
			Object.keys(variant?.shape ?? {}).flatMap((key) =>
				currentEffect[key] === undefined ? [] : [[key, currentEffect[key]]],
			),
		);

		updateEffect(index, {...defaults, ...preservedFields, "flag-type": nextFlagType, operation});
	}

	function removeEffect(index: number) {
		if (!canEdit || !removable) return;

		onChange(normalizedEffects.filter((_, effectIndex) => effectIndex !== index));
	}

	function duplicateEffect(index: number) {
		if (!canEdit) return;

		const effect = effectUsage(normalizedEffects[index], context);
		onChange([
			...normalizedEffects.slice(0, index + 1),
			cloneEffect(effect),
			...normalizedEffects.slice(index + 1),
		]);
	}

	function moveEffect(index: number, direction: -1 | 1) {
		const nextIndex = index + direction;
		if (!canEdit || nextIndex < 0 || nextIndex >= value.length) return;

		const nextValue = [...normalizedEffects];
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
			<div className="effectListEditor">
				{metadata.features?.showCountSummary !== false ? (
					<div className="effectListEditor__summary">
						{normalizedEffects.length} {normalizedEffects.length === 1 ? "effect" : "effects"}
					</div>
				) : null}
				{metadata.features?.showGeneratedSummary ? (
					<div className="effectListEditor__generatedSummary">
						{normalizedEffects.length > 0
							? normalizedEffects
									.map((effect) =>
										generateEffectSummary(effectUsage(effect, context), editorEffectSchema(metadata)),
									)
									.join("; ")
							: "No effects"}
					</div>
				) : null}
				{normalizedEffects.length === 0 &&
				(metadata.emptyState?.emptyTitle || metadata.emptyState?.emptyDescription) ? (
					<div className="effectListEditor__empty">
						{metadata.emptyState.emptyTitle ? <strong>{metadata.emptyState.emptyTitle}</strong> : null}
						{metadata.emptyState.emptyDescription ? (
							<span>{metadata.emptyState.emptyDescription}</span>
						) : null}
					</div>
				) : null}
				{normalizedEffects.map((rawEffect, index) => {
					const resolvedEffect = effectUsage(rawEffect, context);
					const effect = isEffectReference(rawEffect)
						? rawEffect
						: effectWithVisibleDefaults(resolvedEffect, metadata);
					const effectType = String(effect.type ?? allowedTypes[0]);
					const flagType = String(effect["flag-type"] ?? "normal");
					const operationOptions = operationOptionsForType(effectType, metadata).filter(
						(option) =>
							effectType !== "flag" ||
							String(effect["flag-type"] ?? "normal") === "normal" ||
							option.value !== "create",
					);
					const effectVariant = findEditorSchemaVariant(editorEffectSchema(metadata), {
						type: effectType,
						"flag-type": effectType === "flag" ? flagType : undefined,
						operation: effectOperation(effect),
					});
					const title = `${index + 1}. ${generateEffectSummary(
						resolvedEffect,
						editorEffectSchema(metadata),
					)}`;
					const missingReference =
						isEffectReference(rawEffect) && !worldEffectById(context, rawEffect.effectId);
					const body = (
						<>
							{renderChildControl({
								type: "select",
								childKey: "effectType",
								value: effectType,
								onChange: (nextType) =>
									updateEffect(
										index,
										defaultEffect(
											editorEffectSchema(metadata),
											nextType,
											operationOptionsForType(nextType, metadata),
										),
									),
								metadata: {
									title: "Type",
									appearance: {chrome: "inline", size: "sm"},
									features: {
										options: availableEffectTypeOptions,
										searchable: metadata.features?.searchableEffectTypes ?? false,
									},
								},
								parentMetadata: metadata,
								useMetadataCopy: true,
								path: [...path, index, "type"],
								disabled,
								readonly,
								context,
							})}

							{operationOptions.length
								? renderChildControl({
										type: "select",
										childKey: "operator",
										value: String(effect.operation ?? effect.messageType ?? ""),
										onChange: (nextOperation) => {
											const flagType =
												effect["flag-type"] === "room" || effect["flag-type"] === "item"
													? effect["flag-type"]
													: "normal";
											updateEffect(
												index,
												defaultEffect(
													editorEffectSchema(metadata),
													effectType,
													operationOptions,
													nextOperation,
													flagType as "normal" | "room" | "item",
												),
											);
										},
										metadata: {
											title: "Action",
											appearance: {chrome: "inline", size: "sm"},
											features: {options: operationOptions},
										},
										parentMetadata: metadata,
										useMetadataCopy: true,
										path: [...path, index, "operation"],
										disabled,
										readonly,
										context,
									})
								: null}

							<div className="effectListEditor__fields">
								{(effectVariant
									? Object.keys(effectVariant.shape).map((key) => [key, effect[key]] as const)
									: Object.entries(effect)
								)
									.filter(([key]) => key !== "type" && key !== "operation" && key !== "messageType")
									.map(([key, fieldValue]) => {
										if (key === "flag-type") {
											return (
												<Fragment key={key}>
													{renderChildControl({
														type: "select",
														childKey: key,
														value: String(fieldValue ?? "normal"),
														onChange: (nextValue) => updateFlagType(index, nextValue),
														metadata: {
															title: "Flag type",
															features: {
																options: schemaFieldOptions(editorEffectSchema(metadata), "flag-type", {
																	type: "flag",
																}),
															},
														},
														parentMetadata: metadata,
														path: [...path, index, key],
														disabled,
														readonly,
														context,
													})}
												</Fragment>
											);
										}

										const schemaMetadata = effectVariant?.shape[key]
											? resolveEditorMetadata(effectVariant.shape[key])
											: undefined;
										const referenceType = schemaMetadata?.features?.entityType;
										if (referenceType) {
											const savedEffectOptions =
												referenceType === "effect"
													? worldEffects(context)
															.filter(
																(worldEffect) =>
																	!metadata.features?.excludedEffectIds?.includes(storedEffectId(worldEffect) ?? ""),
															)
															.map((worldEffect) => {
																const id = storedEffectId(worldEffect);
																if (!id) return undefined;
																return {
																	id,
																	label: storedEffectName(worldEffect) ?? id,
																	description: generateEffectSummary(worldEffect, editorEffectSchema(metadata)),
																	entityType: "effect" as const,
																};
															})
															.filter((option): option is NonNullable<typeof option> => Boolean(option))
													: undefined;
											return (
												<Fragment key={key}>
													{renderChildControl({
														type: "entity-picker",
														childKey: key,
														value: fieldValue,
														onChange: (nextValue) => updateEffectField(index, key, nextValue),
														metadata: {
															title: key,
															features: {
																entityType: referenceType,
																allowCreate: false,
																clearButton: false,
																options: savedEffectOptions,
															},
														},
														parentMetadata: metadata,
														path: [...path, index, key],
														disabled,
														readonly,
														context,
													})}
												</Fragment>
											);
										}

										const childOverride = metadata.childControls?.[key];
										if (childOverride || schemaMetadata) {
											const childType =
												childOverride?.control ??
												schemaMetadata?.type ??
												(typeof fieldValue === "boolean"
													? "toggle"
													: typeof fieldValue === "number"
														? "number"
														: "input");

											return (
												<Fragment key={key}>
													{renderChildControl({
														type: childType,
														childKey: key,
														value: fieldValue,
														onChange: (nextValue) => updateEffectField(index, key, nextValue),
														metadata: {
															...schemaMetadata,
															appearance: {chrome: "inline", size: "sm"},
															...(childType === "toggle"
																? {features: {display: "switch", labels: {on: "On", off: "Off"}}}
																: {}),
														},
														useMetadataCopy: true,
														parentMetadata: metadata,
														path: [...path, index, key],
														disabled,
														readonly,
														context,
													})}
												</Fragment>
											);
										}

										return null;
									})}
							</div>

							<div className="effectListEditor__actions">
								{metadata.features?.reorderable ? (
									<>
										<button
											type="button"
											disabled={!canEdit || index === 0}
											onClick={() => moveEffect(index, -1)}
										>
											Up
										</button>
										<button
											type="button"
											disabled={!canEdit || index === value.length - 1}
											onClick={() => moveEffect(index, 1)}
										>
											Down
										</button>
									</>
								) : null}
								{metadata.features?.duplicateable ? (
									<button type="button" disabled={!canEdit} onClick={() => duplicateEffect(index)}>
										Duplicate
									</button>
								) : null}
								<button type="button" disabled={!canEdit || !removable} onClick={() => removeEffect(index)}>
									Remove
								</button>
							</div>
						</>
					);

					return metadata.features?.collapsibleItems ? (
						<details key={index} className="effectListEditor__item" open>
							<summary className="effectListEditor__itemTitle">
								{missingReference ? `${title} (missing world effect)` : title}
							</summary>
							{body}
						</details>
					) : (
						<div key={index} className="effectListEditor__item">
							<div className="effectListEditor__itemTitle">
								{missingReference ? `${title} (missing world effect)` : title}
							</div>
							{body}
						</div>
					);
				})}
				<button
					className="effectListEditor__addButton"
					type="button"
					disabled={!canEdit}
					onClick={() => {
						const type = allowedTypes[0];
						onChange([
							...normalizedEffects,
							defaultEffect(editorEffectSchema(metadata), type, operationOptionsForType(type, metadata)),
						]);
					}}
				>
					{metadata.emptyState?.emptyActionLabel ?? "Add effect"}
				</button>
			</div>
		</FieldShell>
	);
}
