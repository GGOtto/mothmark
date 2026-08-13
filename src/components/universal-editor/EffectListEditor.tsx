"use client";

import {Fragment} from "react";
import type {z} from "zod";
import type {
	EditorControlContext,
	EditorControlMetadata,
	EditorControlProps,
} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {useOptionalPopup} from "@/components/popup/Popup";
import {generateEffectSummary} from "./utils/universalEditorUtils";
import {idValue, isID, toID} from "../../utils/idUtils";
import {FieldShell} from "./FieldShell";
import {renderChildControl} from "./renderChildControl";
import {resolveEditorMetadata} from "./utils/resolveEditorMetadata";
import {
	createSchemaVariantDefault,
	findEditorSchemaVariant,
	schemaFieldOptions,
	schemaLogicOptionForValue,
	type SchemaLogicOption,
	schemaTypeOptions,
} from "./utils/editorSchemaVariants";
import {openLogicPicker} from "./LogicPicker";
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
	operationOptions: Array<{value: string}> = [],
	operation?: string,
): EffectValue {
	const selectedOperation = operation ?? operationOptions[0]?.value;
	return schema
		? createSchemaVariantDefault(schema, {
				type,
				operation: selectedOperation,
			})
		: {type, ...(selectedOperation ? {operation: selectedOperation} : {})};
}

function reusableEffectPickerOptions(
	metadata: EffectListControlMetadata,
	context: EditorControlContext,
): SchemaLogicOption[] {
	return reusableWorldEffects(context)
		.filter(
			(effect) =>
				storedEffectId(effect) &&
				!metadata.features?.excludedEffectIds?.includes(storedEffectId(effect) ?? ""),
		)
		.map((effect) => {
			const effectId = storedEffectId(effect) ?? "";
			const title = storedEffectName(effect) ?? effectId;
			const description = storedEffectDescription(effect, editorEffectSchema(metadata));
			return {
				key: `effect-ref:${effectId}`,
				type: "effect-ref",
				title,
				description,
				category: "Reusable",
				keywords: ["saved", "reusable", "group", "sequence"],
				situations: [],
				requires: [],
				fields: [],
				defaultValue: {type: "effect-ref", effectId: toID("effect", effectId)},
				searchText: `${title} ${description} reusable saved group sequence`.toLocaleLowerCase(),
			};
		});
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function embeddedEffectGroupIds(context: EditorControlContext) {
	const world = context.getWorldValue?.([]);
	const ids = new Set<string>();
	const seen = new Set<object>();

	function visit(value: unknown) {
		if (!value || typeof value !== "object" || seen.has(value)) return;
		seen.add(value);
		if (Array.isArray(value)) {
			value.forEach(visit);
			return;
		}

		if (isRecord(value) && value.type === "group") {
			const id = storedEffectId(value);
			if (id) ids.add(id);
		}
		Object.values(value).forEach(visit);
	}

	if (isRecord(world)) {
		Object.entries(world).forEach(([key, value]) => {
			if (key !== "effects") visit(value);
		});
	}

	return ids;
}

function reusableWorldEffects(context: EditorControlContext) {
	const embeddedIds = embeddedEffectGroupIds(context);
	return worldEffects(context).filter((effect) => {
		const id = storedEffectId(effect);
		return !id || !embeddedIds.has(id);
	});
}

function storedEffectDescription(effect: EffectValue, schema: z.ZodTypeAny) {
	const effects = Array.isArray(effect.effects) ? (effect.effects as EffectValue[]) : [];
	return effects.length > 0
		? effects.map((child) => generateEffectSummary(child, schema)).join("; ")
		: "No effects";
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
	return {
		...defaultEffect(
			editorEffectSchema(metadata),
			type,
			operationOptionsForType(type, metadata),
			effectOperation(effect),
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
	const popup = useOptionalPopup();
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const availableEffectTypeOptions = effectTypeOptions(metadata);
	const allowedTypes = availableEffectTypeOptions.map((option) => option.value);
	const removable = metadata.features?.removable ?? true;
	const normalizedEffects = value.map(normalizeEffect);
	const pickerOptions = reusableEffectPickerOptions(metadata, context);

	async function chooseEffect(current?: EffectValue) {
		const currentReferenceId =
			current && isID(current.effectId) ? idValue(current.effectId) : undefined;
		const selected = await openLogicPicker(popup, {
			kind: "effect",
			schema: editorEffectSchema(metadata),
			additionalOptions: pickerOptions,
			hiddenTypes: ["effect-ref"],
			selectedKey: currentReferenceId
				? `effect-ref:${currentReferenceId}`
				: current
					? schemaLogicOptionForValue(editorEffectSchema(metadata), current)?.key
					: undefined,
		});
		return selected?.defaultValue;
	}

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
					const effectVariant = findEditorSchemaVariant(editorEffectSchema(metadata), {
						type: effectType,
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
							<button
								className="effectListEditor__change"
								type="button"
								disabled={!canEdit}
								onClick={async () => {
									const nextEffect = await chooseEffect(rawEffect);
									if (nextEffect) updateEffect(index, nextEffect);
								}}
							>
								<span>Behavior</span>
								<strong>
									{storedEffectName(resolvedEffect) ??
										schemaLogicOptionForValue(editorEffectSchema(metadata), resolvedEffect)?.title ??
										generateEffectSummary(resolvedEffect, editorEffectSchema(metadata))}
								</strong>
								<small>Change</small>
							</button>

							<div className="effectListEditor__fields">
								{(effectVariant
									? Object.keys(effectVariant.shape).map((key) => [key, effect[key]] as const)
									: Object.entries(effect)
								)
									.filter(([key]) => key !== "type" && key !== "operation" && key !== "messageType")
									.map(([key, fieldValue]) => {
										const schemaMetadata = effectVariant?.shape[key]
											? resolveEditorMetadata(effectVariant.shape[key])
											: undefined;
										const referenceType = schemaMetadata?.features?.entityType;
										if (referenceType) {
											const savedEffectOptions =
												referenceType === "effect"
													? reusableWorldEffects(context)
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
																	description: storedEffectDescription(worldEffect, editorEffectSchema(metadata)),
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
					onClick={async () => {
						const nextEffect = await chooseEffect();
						if (nextEffect) onChange([...normalizedEffects, nextEffect]);
					}}
				>
					{metadata.emptyState?.emptyActionLabel ?? "Add effect"}
				</button>
			</div>
		</FieldShell>
	);
}
