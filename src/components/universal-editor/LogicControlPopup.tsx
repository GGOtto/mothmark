"use client";

import {GitBranch, X, Zap} from "lucide-react";
import {useState, type ReactNode} from "react";
import {produce} from "immer";
import type {z} from "zod";
import {useOptionalPopup} from "@/components/popup/Popup";
import type {CommandVariableReference} from "@/features/command-variables";
import type {
	EditorControlContext,
	EditorControlMetadata,
	EditorPath,
} from "@/types/universalEditorTypes";
import {resolveEditorControlAppearance} from "@/types/universalEditorTypes";
import {FieldShell} from "./FieldShell";
import {ConditionBuilderEditor, type ConditionBuilderEditorProps} from "./ConditionBuilderEditor";
import {EffectEditor, type EffectEditorProps, type EffectGroupValue} from "./EffectEditor";
import {EffectListEditor, type EffectListEditorProps} from "./EffectListEditor";
import {generateConditionSummary, generateEffectSummary} from "./utils/universalEditorUtils";
import "./LogicControlPopup.scss";

type LogicControlPopupProps =
	ConditionBuilderEditorProps | EffectEditorProps | EffectListEditorProps;

export type LogicKind = "condition" | "effect";

type CommandVariableBinding = CommandVariableReference & {field: string};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valueAtPath(value: unknown, path: EditorPath): unknown {
	return path.reduce<unknown>((current, segment) => {
		if (Array.isArray(current) && typeof segment === "number") return current[segment];
		if (isRecord(current)) return current[segment];
		return undefined;
	}, value);
}

function valueWithChange(value: unknown, path: EditorPath, nextValue: unknown): unknown {
	if (path.length === 0) return nextValue;
	return produce(value, (draft) => {
		let current = draft as Record<string | number, unknown>;
		for (const segment of path.slice(0, -1)) {
			const next = current[segment];
			if (!isRecord(next) && !Array.isArray(next)) return;
			current = next as Record<string | number, unknown>;
		}
		current[path[path.length - 1]] = nextValue;
	});
}

function relativePath(path: EditorPath, rootPath: EditorPath): EditorPath | undefined {
	if (path.length < rootPath.length) return undefined;
	if (rootPath.some((segment, index) => segment !== path[index])) return undefined;
	return path.slice(rootPath.length);
}

function pathKey(path: EditorPath) {
	return JSON.stringify(path);
}

function logicKind(props: LogicControlPopupProps): LogicKind {
	return isConditionProps(props) ? "condition" : "effect";
}

function isConditionProps(props: LogicControlPopupProps): props is ConditionBuilderEditorProps {
	return props.metadata.type === "condition-builder";
}

function isEffectListProps(props: LogicControlPopupProps): props is EffectListEditorProps {
	return props.metadata.type === "effect-list";
}

function conditionSchema(props: ConditionBuilderEditorProps) {
	const schema = props.metadata.features?.conditionSchema ?? props.metadata.features?.sourceSchema;
	if (!schema) throw new Error("Condition editor metadata is missing its source schema.");
	return schema;
}

function effectSchema(props: EffectEditorProps | EffectListEditorProps) {
	const childFeatures =
		props.metadata.type === "effect" ? props.metadata.childControls?.effects?.features : undefined;
	const schema = (childFeatures?.effectSchema ??
		childFeatures?.sourceSchema ??
		props.metadata.features?.effectSchema ??
		props.metadata.features?.sourceSchema) as z.ZodTypeAny | undefined;
	if (!schema) throw new Error("Effect editor metadata is missing its source schema.");
	return schema;
}

function effectValues(props: EffectEditorProps | EffectListEditorProps) {
	if (isEffectListProps(props)) return props.value;
	return (props as EffectEditorProps).value?.effects ?? [];
}

function effectSummary(props: EffectEditorProps | EffectListEditorProps) {
	const effects = effectValues(props);
	if (effects.length === 0) return "No effects configured";
	const firstSummary = generateEffectSummary(effects[0], effectSchema(props));
	return effects.length === 1 ? firstSummary : `${firstSummary} + ${effects.length - 1} more`;
}

function conditionIsEmpty(value: ConditionBuilderEditorProps["value"]) {
	if (Array.isArray(value)) return value.length === 0;
	return value?.type === "group" && Array.isArray(value.conditions) && value.conditions.length === 0;
}

function emptyEffectGroup(): EffectGroupValue {
	return {
		type: "group",
		name: "",
		id: "",
		effects: [],
		allowMultipleUsesInWorld: true,
	};
}

function popupInitialValue(props: LogicControlPopupProps) {
	if (!isConditionProps(props) && !isEffectListProps(props) && !props.value) {
		return emptyEffectGroup();
	}
	return props.value;
}

function popupCopy(kind: LogicKind, isEmpty: boolean) {
	const noun = kind === "condition" ? "condition" : "effect";
	return {
		action: `${isEmpty ? "Add" : "Edit"} ${noun}`,
		title: `${isEmpty ? "Add" : "Edit"} ${noun}`,
	};
}

function popupSummary(props: LogicControlPopupProps) {
	if (isConditionProps(props)) {
		return generateConditionSummary(props.value, conditionSchema(props));
	}
	return effectSummary(props);
}

function popupIsEmpty(props: LogicControlPopupProps) {
	if (isConditionProps(props)) return conditionIsEmpty(props.value);
	if (isEffectListProps(props)) return props.value.length === 0;
	return !props.value || props.value.effects.length === 0;
}

function metadataWithoutPopupShell<TMetadata extends EditorControlMetadata>(metadata: TMetadata) {
	return {
		...metadata,
		title: undefined,
		description: undefined,
		appearance: {
			...metadata.appearance,
			chrome: "compact" as const,
		},
	};
}

function LogicPopupContent({props, onClose}: {props: LogicControlPopupProps; onClose: () => void}) {
	const kind = logicKind(props);
	const initialEmpty = popupIsEmpty(props);
	const copy = popupCopy(kind, initialEmpty);
	const [draftValue, setDraftValue] = useState<unknown>(() => popupInitialValue(props));
	const [valueOverrides, setValueOverrides] = useState<Record<string, unknown>>({});
	const [worldValueOverrides, setWorldValueOverrides] = useState<Record<string, unknown>>({});

	function commitDraft(nextValue: unknown) {
		setDraftValue(nextValue);
		(props.onChange as (value: unknown) => void)(nextValue);
	}

	function getLocalValue(editorPath: EditorPath) {
		const localPath = relativePath(editorPath, props.path);
		if (localPath) return valueAtPath(draftValue, localPath);
		const overrideKey = pathKey(editorPath);
		if (overrideKey in valueOverrides) return valueOverrides[overrideKey];
		return props.context.getValue(editorPath);
	}

	function setLocalValue(editorPath: EditorPath, nextValue: unknown) {
		const localPath = relativePath(editorPath, props.path);
		if (localPath) {
			commitDraft(valueWithChange(draftValue, localPath, nextValue));
			return;
		}
		setValueOverrides((current) => ({...current, [pathKey(editorPath)]: nextValue}));
		props.context.setValue(editorPath, nextValue);
	}

	const popupContext: EditorControlContext = (() => {
		const sourceVariables = props.context.commandVariables;
		const commandVariables = sourceVariables
			? {
					...sourceVariables,
					supportsPath: (editorPath: EditorPath) => {
						const localPath = relativePath(editorPath, props.path);
						if (!localPath) return sourceVariables.supportsPath(editorPath);
						const field = localPath.at(-1);
						const parent = valueAtPath(draftValue, localPath.slice(0, -1));
						return (
							typeof field === "string" &&
							isRecord(parent) &&
							typeof parent.type === "string" &&
							parent.type !== "group" &&
							parent.type !== "conditional"
						);
					},
					getBinding: (editorPath: EditorPath) => {
						const localPath = relativePath(editorPath, props.path);
						if (!localPath) return sourceVariables.getBinding(editorPath);
						const field = localPath.at(-1);
						if (typeof field !== "string") return undefined;
						const parent = valueAtPath(draftValue, localPath.slice(0, -1));
						if (!isRecord(parent) || !Array.isArray(parent.commandVariables)) return undefined;
						const binding = (parent.commandVariables as CommandVariableBinding[]).find(
							(candidate) => candidate.field === field,
						);
						return binding ? {blockId: binding.blockId, projection: binding.projection} : undefined;
					},
					setBinding: (
						editorPath: EditorPath,
						reference: CommandVariableReference | undefined,
						fallbackValue: unknown,
					) => {
						const localPath = relativePath(editorPath, props.path);
						if (!localPath) {
							sourceVariables.setBinding(editorPath, reference, fallbackValue);
							return;
						}
						const field = localPath.at(-1);
						if (typeof field !== "string") return;
						const parentPath = localPath.slice(0, -1);
						const parent = valueAtPath(draftValue, parentPath);
						if (!isRecord(parent)) return;
						const bindings = Array.isArray(parent.commandVariables)
							? (parent.commandVariables as CommandVariableBinding[]).filter(
									(candidate) => candidate.field !== field,
								)
							: [];
						if (reference) {
							bindings.push({
								blockId: reference.blockId,
								projection: reference.projection,
								field,
							});
						}
						const nextParent = {
							...parent,
							...(!reference || !(field in parent) ? {[field]: fallbackValue} : {}),
						};
						if (bindings.length > 0) nextParent.commandVariables = bindings;
						else delete nextParent.commandVariables;
						commitDraft(valueWithChange(draftValue, parentPath, nextParent));
					},
				}
			: undefined;

		return {
			...props.context,
			logicEditorPresentation: "inline",
			getValue: getLocalValue,
			setValue: setLocalValue,
			getWorldValue: props.context.getWorldValue
				? (editorPath) => {
						const overrideKey = pathKey(editorPath);
						return overrideKey in worldValueOverrides
							? worldValueOverrides[overrideKey]
							: props.context.getWorldValue?.(editorPath);
					}
				: undefined,
			setWorldValue: props.context.setWorldValue
				? (editorPath, nextValue) => {
						setWorldValueOverrides((current) => ({
							...current,
							[pathKey(editorPath)]: nextValue,
						}));
						props.context.setWorldValue?.(editorPath, nextValue);
					}
				: undefined,
			commandVariables,
		};
	})();

	const innerMetadata = metadataWithoutPopupShell(props.metadata);
	let editor;
	if (isConditionProps(props)) {
		editor = (
			<ConditionBuilderEditor
				{...props}
				value={draftValue as ConditionBuilderEditorProps["value"]}
				onChange={commitDraft as ConditionBuilderEditorProps["onChange"]}
				metadata={innerMetadata as ConditionBuilderEditorProps["metadata"]}
				context={popupContext}
			/>
		);
	} else if (!isEffectListProps(props)) {
		editor = (
			<EffectEditor
				{...props}
				value={draftValue as EffectEditorProps["value"]}
				onChange={commitDraft as EffectEditorProps["onChange"]}
				metadata={innerMetadata as EffectEditorProps["metadata"]}
				context={popupContext}
			/>
		);
	} else {
		editor = (
			<EffectListEditor
				{...props}
				value={draftValue as EffectListEditorProps["value"]}
				onChange={commitDraft as EffectListEditorProps["onChange"]}
				metadata={innerMetadata as EffectListEditorProps["metadata"]}
				context={popupContext}
			/>
		);
	}

	return (
		<LogicEditorPopupSurface
			kind={kind}
			title={copy.title}
			summary={popupSummary({...props, value: draftValue} as LogicControlPopupProps)}
			onClose={onClose}
		>
			{editor}
		</LogicEditorPopupSurface>
	);
}

export function LogicEditorPopupSurface({
	kind,
	title,
	summary,
	onClose,
	children,
}: {
	kind: LogicKind;
	title: string;
	summary: string;
	onClose: () => void;
	children: ReactNode;
}) {
	return (
		<div className={`logicControlPopupSurface logicControlPopupSurface--${kind}`}>
			<header className="logicControlPopup__header">
				<div>
					<h2>{title}</h2>
					<p>{summary}</p>
				</div>
				<button type="button" aria-label={`Close ${kind} editor`} onClick={onClose}>
					<X size={17} aria-hidden="true" />
				</button>
			</header>

			<div className="logicControlPopup__body">{children}</div>

			<footer className="logicControlPopup__actions">
				<button className="logicControlPopup__done" type="button" onClick={onClose}>
					Done
				</button>
			</footer>
		</div>
	);
}

export function LogicControlPopup(props: LogicControlPopupProps) {
	const popup = useOptionalPopup();
	if (!popup) {
		const inlineContext = {...props.context, logicEditorPresentation: "inline" as const};
		if (isConditionProps(props)) {
			return <ConditionBuilderEditor {...props} context={inlineContext} />;
		}
		if (isEffectListProps(props)) {
			return <EffectListEditor {...props} context={inlineContext} />;
		}
		return <EffectEditor {...props} context={inlineContext} />;
	}
	const popupApi = popup;
	const kind = logicKind(props);
	const isEmpty = popupIsEmpty(props);
	const copy = popupCopy(kind, isEmpty);
	const summary = popupSummary(props);
	const appearance = resolveEditorControlAppearance(
		props.context.appearance,
		props.metadata.appearance,
	);
	const canEdit = !(
		props.disabled ||
		props.metadata.disabled ||
		props.readonly ||
		props.metadata.readonly
	);
	const Icon = kind === "condition" ? GitBranch : Zap;

	async function openEditor() {
		if (!canEdit) return;
		await popupApi.open<void>(
			({resolve}) => <LogicPopupContent props={props} onClose={() => resolve()} />,
			{className: "popupSurfaceLogicControl", closeOnBackdropClick: false},
		);
	}

	return (
		<FieldShell
			title={props.metadata.title}
			description={props.metadata.description}
			error={props.error}
			warnings={props.warnings}
			appearance={appearance}
			className={props.metadata.className}
			testId={props.metadata.testId}
		>
			<button
				type="button"
				className="logicControlTrigger"
				aria-label={`${copy.action}: ${summary}`}
				aria-haspopup="dialog"
				disabled={!canEdit}
				onClick={() => void openEditor()}
			>
				<span className="logicControlTrigger__icon">
					<Icon size={16} strokeWidth={1.8} aria-hidden="true" />
				</span>
				<span className="logicControlTrigger__content">
					<strong>{copy.action}</strong>
					<span>{summary}</span>
				</span>
				<span className="logicControlTrigger__action">Open</span>
			</button>
		</FieldShell>
	);
}
