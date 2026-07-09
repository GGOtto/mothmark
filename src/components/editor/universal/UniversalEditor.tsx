"use client";

import {useMemo} from "react";
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
	EditorPath,
} from "@/types/universalEditorTypes";
import {buildEditorRegistries} from "@/utils/buildEditorRegistries";
import {resolveEditorMetadata} from "@/utils/resolveEditorMetadata";
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

const EMPTY_REGISTRIES: EditorRegistries = buildEditorRegistries({
	startRoomId: "",
	rooms: [],
	connections: [],
} as unknown as World);

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
	const registries = useMemo(
		() => (world ? buildEditorRegistries(world) : EMPTY_REGISTRIES),
		[world],
	);
	const metadata = useMemo(() => resolveEditorMetadata(schema), [schema]);
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
				onChange(setValueAtPath(value, editorPath, nextValue) as TValue);
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
		}),
		[appearance, disabled, onChange, readonly, registries, value, world],
	);

	return (
		<div className={["universalEditor", className ?? ""].filter(Boolean).join(" ")}>
			{renderEditorControl({
				value,
				onChange: (nextValue) => onChange(nextValue as TValue),
				metadata,
				path,
				disabled,
				readonly,
				context,
			})}
		</div>
	);
}
