"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {z} from "zod";
import type {World} from "@/schemas/worldSchema";
import type {
	EditorEntityOption,
	EditorKeyOption,
	EditorRegistries,
	EntityType,
	FlagOption,
} from "@/types/editor/editorRegistryTypes";
import type {
	EditorControlAppearance,
	EditorControlContext,
	EditorControlMetadata,
	EditorControlProps,
	EditorLinkOpenRequest,
	EditorLinkRef,
	EditorLinkTargetMetadata,
	EditorPath,
} from "@/types/universalEditorTypes";
import {buildEditorRegistries} from "@/utils/buildEditorRegistries";
import {generateUniqueId} from "@/utils/idUtils";
import {createDefaultValue, resolveEditorMetadata} from "@/utils/resolveEditorMetadata";
import {getArrayElement, getSchemaAtPath} from "@/utils/schemaIntrospection";
import {renderEditorControl} from "./renderEditorControl";
import "./UniversalEditor.scss";

type UniversalEditorProps<TValue> = {
	schema: z.ZodTypeAny;
	value: TValue;
	onChange: (value: TValue) => void;
	world?: World;
	path?: EditorPath;
	appearance?: EditorControlAppearance;
	readonly?: boolean;
	disabled?: boolean;
	className?: string;
};

type UniversalEditorView = {
	title?: string;
	description?: string;
	schema: z.ZodTypeAny;
	value?: unknown;
	path: EditorPath;
	metadata?: EditorControlMetadata;
	showBackLink?: boolean;
	backLabel?: string;
	returnScrollPosition?: EditorScrollPosition;
};

function EditorControlRenderer(props: EditorControlProps<unknown, EditorControlMetadata>) {
	return renderEditorControl(props);
}

type EditorScrollPosition = {
	container: HTMLElement | Window;
	top: number;
};

const EMPTY_REGISTRIES: EditorRegistries = buildEditorRegistries({
	startRoomId: "",
	rooms: [],
	connections: [],
} as unknown as World);
function isScrollableContainer(element: HTMLElement) {
	const style = window.getComputedStyle(element);
	return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
}

function getScrollContainer(element: HTMLElement): HTMLElement | Window {
	let parent = element.parentElement;

	while (parent) {
		if (isScrollableContainer(parent)) return parent;
		parent = parent.parentElement;
	}

	return window;
}

function getScrollTop(container: HTMLElement | Window) {
	return container instanceof Window ? window.scrollY : container.scrollTop;
}

function setScrollTop(container: HTMLElement | Window, top: number) {
	if (container instanceof Window) {
		container.scrollTo({top});
		return;
	}

	container.scrollTo({top});
}

function captureScrollPosition(element: HTMLElement | null): EditorScrollPosition | undefined {
	if (!element) return undefined;

	const container = getScrollContainer(element);
	return {
		container,
		top: getScrollTop(container),
	};
}

function getEditorScrollTarget(element: HTMLElement) {
	return (
		element.closest<HTMLElement>(".roomEditor") ??
		element.closest<HTMLElement>(".rightSideBarSection") ??
		element.parentElement ??
		element
	);
}

function scrollEditorTop(element: HTMLElement | null) {
	if (!element) return;

	const target = getEditorScrollTarget(element);
	const container = getScrollContainer(target);
	const targetRect = target.getBoundingClientRect();

	if (container instanceof Window) {
		window.scrollTo({
			top: Math.max(0, window.scrollY + targetRect.top),
		});
		return;
	}

	const containerRect = container.getBoundingClientRect();
	container.scrollTo({
		top: Math.max(0, container.scrollTop + targetRect.top - containerRect.top),
	});
}

function getValueAtPath(value: unknown, path: EditorPath): unknown {
	return path.reduce<unknown>((currentValue, segment) => {
		if (currentValue == null) return undefined;
		return (currentValue as Record<string | number, unknown>)[segment];
	}, value);
}

function setValueAtPath(value: unknown, path: EditorPath, nextValue: unknown): unknown {
	if (path.length === 0) return nextValue;

	const [segment, ...rest] = path;

	if (Array.isArray(value)) {
		const nextArray = [...value];
		nextArray[Number(segment)] = setValueAtPath(nextArray[Number(segment)], rest, nextValue);
		return nextArray;
	}

	const currentObject =
		value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};

	return {
		...currentObject,
		[segment]: setValueAtPath(currentObject[String(segment)], rest, nextValue),
	};
}

function registryKey(entityType: EntityType): keyof EditorRegistries | undefined {
	if (entityType === "character") return "npcs";
	if (entityType === "container") return "containers";
	if (entityType === "surface") return "surfaces";
	if (entityType === "object") return "objects";
	if (entityType === "direction") return undefined;
	return `${entityType}s` as keyof EditorRegistries;
}

function entityOptionsForType(
	registries: EditorRegistries,
	entityType: EntityType,
): EditorEntityOption[] {
	const key = registryKey(entityType);
	if (!key) return [];

	const options = registries[key];
	return Array.isArray(options) ? (options as EditorEntityOption[]) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findArrayEntityPath(
	value: unknown,
	collectionPath: EditorPath,
	id: string,
): EditorPath | undefined {
	const collection = getValueAtPath(value, collectionPath);
	if (!Array.isArray(collection)) return undefined;

	const index = collection.findIndex((item) => isRecord(item) && item.id === id);
	return index >= 0 ? [...collectionPath, index] : undefined;
}

function getEntityPathByRef(value: unknown, ref: EditorLinkRef): EditorPath | undefined {
	if (ref.type === "room") return findArrayEntityPath(value, ["rooms"], ref.id);
	if (ref.type === "connection") return findArrayEntityPath(value, ["connections"], ref.id);
	if (ref.type === "item") return findArrayEntityPath(value, ["items"], ref.id);
	if (ref.type === "npc" || ref.type === "character") {
		return findArrayEntityPath(value, ["npcs"], ref.id);
	}
	if (ref.type === "topic") return findArrayEntityPath(value, ["topics"], ref.id);
	if (ref.type === "quest") return findArrayEntityPath(value, ["quests"], ref.id);
	if (ref.type === "command") return findArrayEntityPath(value, ["commands"], ref.id);
	if (ref.type === "event") return findArrayEntityPath(value, ["events"], ref.id);

	return undefined;
}

function resolvePathTemplate(
	value: unknown,
	path: EditorPath,
	ref: EditorLinkRef,
	sourcePath: EditorPath = [],
): EditorPath | undefined {
	const resolvedPath: EditorPath = [];

	for (const segment of path) {
		if (segment === "{sourcePath}") {
			resolvedPath.push(...sourcePath);
			continue;
		}

		if (segment !== "{id}") {
			resolvedPath.push(segment);
			continue;
		}

		const collection = getValueAtPath(value, resolvedPath);
		if (Array.isArray(collection)) {
			const index = collection.findIndex((item) => isRecord(item) && item.id === ref.id);
			if (index < 0) return undefined;
			resolvedPath.push(index);
			continue;
		}

		resolvedPath.push(ref.id);
	}

	return resolvedPath;
}

function idPrefixForTarget(target: EditorLinkTargetMetadata) {
	return target.create?.idPrefix ?? target.entityType ?? "item";
}

function labelFieldForValue(value: unknown) {
	if (!isRecord(value)) return undefined;
	if ("name" in value) return "name";
	if ("title" in value) return "title";
	if ("label" in value) return "label";
	return undefined;
}

function labelFromValue(value: unknown) {
	if (!isRecord(value)) return undefined;
	const label = value.label ?? value.name ?? value.title ?? value.id;
	return label == null ? undefined : String(label);
}

function assignCreatedEntityDefaults(value: unknown, id: string, target: EditorLinkTargetMetadata) {
	if (!isRecord(value)) return value;

	const nextValue: Record<string, unknown> = {
		...value,
		id,
	};
	const labelField = labelFieldForValue(nextValue);
	if (labelField) {
		nextValue[labelField] = target.create?.defaultLabel ?? `New ${target.entityType ?? "item"}`;
	}

	return nextValue;
}

function metadataForTarget(schema: z.ZodTypeAny, target: EditorLinkTargetMetadata) {
	const metadata = resolveEditorMetadata(schema);
	if (!target.controlType) return metadata;

	return {
		...metadata,
		type: target.controlType,
	} satisfies EditorControlMetadata;
}

export function UniversalEditor<TValue>({
	schema,
	value,
	onChange,
	world,
	path = [],
	appearance,
	readonly,
	disabled,
	className,
}: UniversalEditorProps<TValue>) {
	const rootRef = useRef<HTMLDivElement | null>(null);
	const previousValueRef = useRef(value);
	const previousRootPathKeyRef = useRef(JSON.stringify(path));
	const previousSchemaRef = useRef(schema);
	const emittedValueRef = useRef<TValue | undefined>(undefined);
	const pendingBackScrollPositionRef = useRef<EditorScrollPosition | undefined>(undefined);
	const [viewStack, setViewStack] = useState<UniversalEditorView[]>([]);
	const registries = useMemo(
		() => (world ? buildEditorRegistries(world) : EMPTY_REGISTRIES),
		[world],
	);
	const metadata = useMemo(() => resolveEditorMetadata(schema), [schema]);
	const activeView = viewStack[viewStack.length - 1];
	const rootPathKey = JSON.stringify(path);
	const activeViewPathKey = activeView ? JSON.stringify(activeView.path) : "root";

	const emitChange = useCallback(
		(nextValue: TValue) => {
			emittedValueRef.current = nextValue;
			onChange(nextValue);
		},
		[onChange],
	);

	useEffect(() => {
		if (pendingBackScrollPositionRef.current) {
			const scrollPosition = pendingBackScrollPositionRef.current;
			pendingBackScrollPositionRef.current = undefined;
			requestAnimationFrame(() => setScrollTop(scrollPosition.container, scrollPosition.top));
			return;
		}

		scrollEditorTop(rootRef.current);
	}, [activeViewPathKey]);

	useEffect(() => {
		if (previousRootPathKeyRef.current === rootPathKey && previousSchemaRef.current === schema) {
			return;
		}

		previousRootPathKeyRef.current = rootPathKey;
		previousSchemaRef.current = schema;
		pendingBackScrollPositionRef.current = undefined;
		setViewStack([]);
		requestAnimationFrame(() => scrollEditorTop(rootRef.current));
	}, [rootPathKey, schema]);

	useEffect(() => {
		if (previousValueRef.current === value) return;

		previousValueRef.current = value;

		if (emittedValueRef.current === value) {
			emittedValueRef.current = undefined;
			return;
		}

		pendingBackScrollPositionRef.current = undefined;
		setViewStack([]);
		requestAnimationFrame(() => scrollEditorTop(rootRef.current));
	}, [value]);

	const resolveEditorNavigationEntry = useCallback(
		(request: EditorLinkOpenRequest): UniversalEditorView | undefined => {
			const {ref, target} = request;

			if (target.entityType && ref.type !== target.entityType) return undefined;

			const resolvedPath =
				target.path && target.path.length > 0
					? resolvePathTemplate(value, target.path, ref, request.sourcePath)
					: getEntityPathByRef(value, ref);
			if (!resolvedPath) return undefined;

			const childSchema = getSchemaAtPath(schema, resolvedPath);
			if (!childSchema) return undefined;

			const childMetadata = metadataForTarget(childSchema, target);
			const option = target.entityType
				? entityOptionsForType(registries, target.entityType).find((entity) => entity.id === ref.id)
				: undefined;

			return {
				title: ref.label ?? option?.label ?? childMetadata.title ?? `${ref.type}/${ref.id}`,
				description: option?.description ?? childMetadata.description,
				schema: childSchema,
				value: getValueAtPath(value, resolvedPath),
				path: resolvedPath,
				metadata: childMetadata,
				showBackLink: target.showBackLink ?? true,
				backLabel: target.backLabel,
			};
		},
		[registries, schema, value],
	);

	const openEditorLink = useCallback(
		(request: EditorLinkOpenRequest) => {
			const entry = resolveEditorNavigationEntry(request);
			if (!entry) return;

			setViewStack((views) => [
				...views,
				{
					...entry,
					returnScrollPosition: captureScrollPosition(rootRef.current),
				},
			]);
		},
		[resolveEditorNavigationEntry],
	);

	const createEditorLink = useCallback(
		({
			target,
			sourcePath,
		}: {
			target: EditorLinkTargetMetadata;
			sourcePath: EditorPath;
		}): EditorLinkRef | undefined => {
			if (!target.create?.enabled) return undefined;

			const collection = getValueAtPath(value, sourcePath);
			if (!Array.isArray(collection)) return undefined;

			const collectionSchema = getSchemaAtPath(schema, sourcePath);
			const itemSchema = collectionSchema ? getArrayElement(collectionSchema) : undefined;
			if (!itemSchema) return undefined;

			const id = generateUniqueId(
				idPrefixForTarget(target),
				collection.filter(
					(item): item is {id: string} => isRecord(item) && typeof item.id === "string",
				),
			);
			const defaultItem = assignCreatedEntityDefaults(createDefaultValue(itemSchema), id, target);
			const nextCollection = [...collection, defaultItem];
			const nextPath = [...sourcePath, collection.length];
			const childMetadata = metadataForTarget(itemSchema, target);
			const ref: EditorLinkRef = {
				type: target.entityType ?? "editor",
				id,
				label: labelFromValue(defaultItem),
			};

			emitChange(setValueAtPath(value, sourcePath, nextCollection) as TValue);

			if (target.create.openAfterCreate ?? true) {
				const returnScrollPosition = captureScrollPosition(rootRef.current);
				setViewStack((views) => [
					...views,
					{
						title: ref.label ?? childMetadata.title ?? `${ref.type}/${ref.id}`,
						description: childMetadata.description,
						schema: itemSchema,
						value: defaultItem,
						path: nextPath,
						metadata: childMetadata,
						showBackLink: target.showBackLink ?? true,
						backLabel: target.backLabel,
						returnScrollPosition,
					},
				]);
			}

			return ref;
		},
		[emitChange, schema, value],
	);

	function popEditorView() {
		pendingBackScrollPositionRef.current = activeView?.returnScrollPosition;
		setViewStack((views) => views.slice(0, -1));
	}

	const resolveEditorLinkLabel = useCallback(
		(ref: EditorLinkRef, target?: EditorLinkTargetMetadata) => {
			if (ref.label) return ref.label;

			const entityType = target?.entityType;
			if (entityType) {
				return (
					entityOptionsForType(registries, entityType).find((entity) => entity.id === ref.id)?.label ??
					ref.id
				);
			}

			return ref.id;
		},
		[registries],
	);

	const resolveEditorLinkDescription = useCallback(
		(ref: EditorLinkRef, target?: EditorLinkTargetMetadata) => {
			const entityType = target?.entityType;
			if (!entityType) return undefined;

			return entityOptionsForType(registries, entityType).find((entity) => entity.id === ref.id)
				?.description;
		},
		[registries],
	);

	const context = useMemo<EditorControlContext>(
		() => ({
			appearance,
			mode: "edit",
			world,
			registries,
			readOnly: readonly,
			disabled,
			getValue: (editorPath) => getValueAtPath(value, editorPath),
			setValue: (editorPath, nextValue) => {
				emitChange(setValueAtPath(value, editorPath, nextValue) as TValue);
			},
			getOptionList: (source) => {
				if (source === "rooms") {
					return registries.rooms.map((room: EditorEntityOption) => ({
						label: room.label,
						value: room.id,
					}));
				}

				if (source === "flags") {
					return registries.flags.map((flag: EditorKeyOption) => ({
						label: flag.label,
						value: flag.key,
					}));
				}

				if (source === "counters") {
					return registries.counters.map((counter: EditorKeyOption) => ({
						label: counter.label,
						value: counter.key,
					}));
				}

				return undefined;
			},
			registerEntityPicker: {
				getEntities: (entityType) => entityOptionsForType(registries, entityType),
				getEntityById: (entityType, id) =>
					entityOptionsForType(registries, entityType).find((option) => option.id === id),
				isValidEntityId: (entityType, id) =>
					entityOptionsForType(registries, entityType).some((option) => option.id === id),
			},
			registerFlagPicker: {
				getFlags: () =>
					registries.flags.map<FlagOption>((flag: EditorKeyOption) => ({
						id: flag.key,
						label: flag.label,
						description: flag.description,
						source: flag.source,
					})),
				getFlagById: (id) => {
					const flag = registries.flags.find((option: EditorKeyOption) => option.key === id);
					return flag
						? {
								id: flag.key,
								label: flag.label,
								description: flag.description,
								source: flag.source,
							}
						: undefined;
				},
				isKnownFlag: (id) => registries.flags.some((option: EditorKeyOption) => option.key === id),
			},
			editorNavigation: {
				openEditorLink,
				createEditorLink,
				resolveEditorLinkLabel,
				resolveEditorLinkDescription,
			},
		}),
		[
			appearance,
			disabled,
			createEditorLink,
			emitChange,
			openEditorLink,
			readonly,
			registries,
			resolveEditorLinkDescription,
			resolveEditorLinkLabel,
			value,
			world,
		],
	);
	const renderedMetadata = activeView?.metadata ?? metadata;
	const renderedPath = activeView?.path ?? path;
	const renderedValue = activeView
		? (getValueAtPath(value, activeView.path) ?? activeView.value)
		: value;

	return (
		<div ref={rootRef} className={["universalEditor", className ?? ""].filter(Boolean).join(" ")}>
			{activeView?.showBackLink ? (
				<div className="universalEditor__childBar">
					<button className="universalEditor__backButton" type="button" onClick={popEditorView}>
						{activeView.backLabel ?? "Back"}
					</button>
					<div className="universalEditor__childTitle">
						<span>{activeView.title ?? renderedMetadata.title ?? "Editor"}</span>
						{activeView.description ? <small>{activeView.description}</small> : null}
					</div>
				</div>
			) : null}
			<EditorControlRenderer
				value={renderedValue}
				onChange={(nextValue) => {
					if (activeView) {
						emitChange(setValueAtPath(value, activeView.path, nextValue) as TValue);
						return;
					}

					emitChange(nextValue as TValue);
				}}
				metadata={renderedMetadata}
				path={renderedPath}
				disabled={disabled}
				readonly={readonly}
				context={context}
			/>
		</div>
	);
}
