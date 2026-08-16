"use client";

import {
	ArrowLeft,
	Braces,
	CalendarClock,
	ChevronRight,
	Command,
	MapPin,
	Package,
	Plus,
	Search,
	Sparkles,
	Trash2,
	ExternalLink,
	type LucideIcon,
} from "lucide-react";
import {produce} from "immer";
import {useMemo, useState} from "react";
import type {z} from "zod";
import {useOptionalPopup} from "@/components/popup/Popup";
import {UniversalEditor} from "@/components/universal-editor/UniversalEditor";
import {schemaLogicOptionForValue} from "@/components/universal-editor/utils/editorSchemaVariants";
import {
	generateConditionSummary,
	generateEffectSummary,
} from "@/components/universal-editor/utils/universalEditorUtils";
import {
	ConditionSchema,
	DefaultConditionGroup,
	SavedConditionSchema,
	type SavedCondition,
} from "@/schemas/world/conditionSchema";
import {EffectGroupSchema, EffectSchema, type EffectGroup} from "@/schemas/world/effectSchema";
import type {World} from "@/schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {deleteWorldEntity, generateUniqueId, idValue, toID} from "@/utils/idUtils";
import {SavedConditionEditorSchema} from "./logicEditorSchemas";
import {
	findLogicOccurrences,
	findLogicSources,
	replaceLogicOccurrence,
	type LogicOccurrence,
} from "./editorRelationships";
import {findLogicUsages, type LogicLibraryKind, type LogicUsage} from "./logicLibraryUsage";
import type {LogicLibraryDraftEditor} from "./logicTypes";
import "./LogicLibraryWorkspace.scss";

export type {LogicLibraryKind} from "./logicLibraryUsage";

export type LogicLibraryReturn = {
	label: string;
	onCancel: () => void;
	onDone?: (selectedId: string) => void;
	draftEditor?: LogicLibraryDraftEditor;
};

type LogicLibraryWorkspaceProps = {
	kind: LogicLibraryKind;
	world: World;
	updateWorld: UpdateWorld;
	selectedId: string | null;
	onSelectedIdChange: (selectedId: string | null) => void;
	onBackToLogic: () => void;
	onOpenUsage?: (usage: LogicUsage) => void;
	returnTo?: LogicLibraryReturn | null;
};

type LibraryFilter = "all" | "used" | "unused";
type LibraryView = "parents" | "entries";
type LibrarySort = "alphabetical" | "parent-type" | "most" | "least" | "recent" | "least-recent";

type InlineOccurrenceDraft = {
	occurrence: LogicOccurrence;
	value: unknown;
	error: string | null;
	returnTo: "usage" | "entries";
};

const PARENT_LABELS: Record<LogicUsage["kind"], string> = {
	command: "Command",
	event: "Event",
	condition: "Condition",
	effect: "Effect",
	item: "Item",
	room: "Room",
};

function pathLabel(path: Array<string | number>) {
	const useful = path.filter(
		(segment) =>
			typeof segment === "string" &&
			!["behavior", "branch", "condition", "conditions", "effect", "effects"].includes(segment),
	);
	if (useful.length === 0) return "Inline logic";
	return useful
		.slice(-3)
		.map((segment) =>
			typeof segment === "number"
				? `${segment + 1}`
				: segment.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("-", " "),
		)
		.join(" · ");
}

function sentenceCase(value: string) {
	return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function occurrenceDisplay(world: World, kind: LogicLibraryKind, occurrence: LogicOccurrence) {
	if (occurrence.savedId) {
		if (kind === "condition") {
			const saved = world.conditions.find(
				(condition) => idValue(condition.identity) === occurrence.savedId,
			);
			return {
				title: saved?.name || "Missing saved condition",
				summary: saved ? conditionSummary(saved) : occurrence.savedId,
				detail: "Saved condition",
			};
		}
		const saved = world.effects.find((effect) => idValue(effect.id) === occurrence.savedId);
		return {
			title: saved?.name || "Missing saved effect",
			summary: saved ? effectSummary(saved) : occurrence.savedId,
			detail: "Saved effect",
		};
	}

	if (kind === "condition") {
		if (
			typeof occurrence.value === "object" &&
			occurrence.value !== null &&
			"type" in occurrence.value &&
			occurrence.value.type === "group" &&
			"conditions" in occurrence.value &&
			Array.isArray(occurrence.value.conditions)
		) {
			const group = occurrence.value as {conditions: unknown[]};
			const summary =
				group.conditions.length === 0
					? "No conditions configured"
					: group.conditions
							.map((condition) => generateConditionSummary(condition, ConditionSchema))
							.join("; ");
			const location = pathLabel(occurrence.path);
			return {
				title: location === "Inline logic" ? "Condition group" : `${sentenceCase(location)} condition`,
				summary,
				detail: `${group.conditions.length} ${group.conditions.length === 1 ? "condition" : "conditions"}`,
			};
		}
		const parsed = ConditionSchema.safeParse(occurrence.value);
		const summary = parsed.success
			? generateConditionSummary(parsed.data, ConditionSchema)
			: "Invalid inline condition";
		return {title: summary, summary, detail: pathLabel(occurrence.path)};
	}
	if (
		typeof occurrence.value === "object" &&
		occurrence.value !== null &&
		"type" in occurrence.value &&
		occurrence.value.type === "group" &&
		"effects" in occurrence.value &&
		Array.isArray(occurrence.value.effects)
	) {
		const group = occurrence.value as {name?: unknown; effects: unknown[]};
		const summary =
			group.effects.length === 0
				? "No effects configured"
				: group.effects.map((effect) => generateEffectSummary(effect, EffectSchema)).join("; ");
		const location = pathLabel(occurrence.path);
		const authoredName = typeof group.name === "string" ? group.name.trim() : "";
		return {
			title:
				authoredName ||
				(location === "Inline logic" ? "Effect group" : `${sentenceCase(location)} effects`),
			summary,
			detail: `${group.effects.length} ${group.effects.length === 1 ? "effect" : "effects"}`,
		};
	}
	const parsed = EffectSchema.safeParse(occurrence.value);
	const summary = parsed.success
		? generateEffectSummary(parsed.data, EffectSchema)
		: "Invalid inline effect";
	return {title: summary, summary, detail: pathLabel(occurrence.path)};
}

function cloneValue<T>(value: T): T {
	return typeof structuredClone === "function"
		? structuredClone(value)
		: (JSON.parse(JSON.stringify(value)) as T);
}

function conditionSummary(condition: SavedCondition) {
	return generateConditionSummary(condition.condition, ConditionSchema);
}

function effectSummary(effect: EffectGroup) {
	if (effect.effects.length === 0) return "No effects configured";
	return effect.effects.map((child) => generateEffectSummary(child, EffectSchema)).join("; ");
}

function createCondition(world: World): SavedCondition {
	return produce(createDefaultFieldObject(SavedConditionSchema), (draft) => {
		draft.identity = generateUniqueId(
			"condition",
			world.conditions.map((condition) => ({id: condition.identity})),
		);
		draft.name = "New condition";
		draft.condition = cloneValue(DefaultConditionGroup);
	});
}

function createEffect(world: World): EffectGroup {
	return produce(createDefaultFieldObject(EffectGroupSchema), (draft) => {
		draft.id = generateUniqueId("effect", world.effects);
		draft.name = "New effect";
	});
}

function schemaMetadataSearchText(value: unknown, schema: z.ZodTypeAny) {
	const terms = new Set<string>();
	const seen = new Set<object>();

	function visit(candidate: unknown) {
		if (!candidate || typeof candidate !== "object" || seen.has(candidate)) return;
		seen.add(candidate);
		if (Array.isArray(candidate)) {
			candidate.forEach(visit);
			return;
		}
		const option = schemaLogicOptionForValue(schema, candidate as Record<string, unknown>);
		if (option) {
			terms.add(
				[option.searchText, option.example, option.note, ...option.requires].filter(Boolean).join(" "),
			);
		}
		Object.values(candidate).forEach(visit);
	}

	visit(value);
	return [...terms].join(" ");
}

function authoredSearchText(value: unknown) {
	const terms = new Set<string>();
	const seen = new Set<object>();

	function visit(candidate: unknown) {
		if (typeof candidate === "string") {
			const normalized = candidate.trim();
			if (normalized) terms.add(normalized);
			return;
		}
		if (typeof candidate === "number" || typeof candidate === "boolean") {
			terms.add(String(candidate));
			return;
		}
		if (!candidate || typeof candidate !== "object" || seen.has(candidate)) return;
		seen.add(candidate);
		if (Array.isArray(candidate)) {
			candidate.forEach(visit);
			return;
		}
		Object.entries(candidate).forEach(([key, child]) => {
			terms.add(key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("-", " "));
			visit(child);
		});
	}

	visit(value);
	return [...terms].join(" ");
}

const USAGE_ICONS: Record<LogicUsage["kind"], LucideIcon> = {
	command: Command,
	event: CalendarClock,
	condition: Braces,
	effect: Sparkles,
	item: Package,
	room: MapPin,
};

export function LogicLibraryWorkspace({
	kind,
	world,
	updateWorld,
	selectedId,
	onSelectedIdChange,
	onBackToLogic,
	onOpenUsage,
	returnTo,
}: LogicLibraryWorkspaceProps) {
	const popup = useOptionalPopup();
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<LibraryFilter>("all");
	const [view, setView] = useState<LibraryView>("parents");
	const [sort, setSort] = useState<LibrarySort>("alphabetical");
	const [selectedUsageState, setSelectedUsageState] = useState<{
		libraryKind: LogicLibraryKind;
		usage: LogicUsage;
	} | null>(null);
	const [inlineDraft, setInlineDraft] = useState<InlineOccurrenceDraft | null>(null);
	const [newDraft, setNewDraft] = useState<SavedCondition | EffectGroup | null>(null);
	const selectedUsage = selectedUsageState?.libraryKind === kind ? selectedUsageState.usage : null;
	const isCondition = kind === "condition";
	const singular = isCondition ? "condition" : "effect";
	const title = isCondition ? "Conditions" : "Effects";
	const selectedCondition = isCondition
		? (world.conditions.find((condition) => idValue(condition.identity) === selectedId) ?? null)
		: null;
	const selectedEffect = !isCondition
		? (world.effects.find((effect) => idValue(effect.id) === selectedId) ?? null)
		: null;
	const selected = selectedCondition ?? selectedEffect;
	const isEditing = Boolean(returnTo || selected || newDraft);
	const draftSource = returnTo?.draftEditor?.value ?? selected ?? newDraft;
	const editorSchema =
		returnTo?.draftEditor?.schema ?? (isCondition ? SavedConditionEditorSchema : EffectGroupSchema);
	const savedId = selectedCondition
		? idValue(selectedCondition.identity)
		: selectedEffect
			? idValue(selectedEffect.id)
			: null;
	const editorKey = returnTo
		? `return:${returnTo.label}:${selectedId ?? "draft"}`
		: selected
			? `saved:${kind}:${savedId}`
			: newDraft
				? `new:${kind}`
				: `library:${kind}`;
	const [storedDraft, setStoredDraft] = useState<{
		key: string;
		value: unknown;
		error: string | null;
	}>({key: "", value: null, error: null});
	const activeDraft =
		storedDraft.key === editorKey
			? storedDraft
			: {key: editorKey, value: draftSource ? cloneValue(draftSource) : null, error: null};
	const draftValue = activeDraft.value;
	const draftError = activeDraft.error;
	const selectedUsageOccurrences = useMemo(
		() => (selectedUsage ? findLogicOccurrences(world, selectedUsage, kind) : []),
		[kind, selectedUsage, world],
	);
	const logicSources = useMemo(() => findLogicSources(world, kind), [kind, world]);
	const hasSearch = search.trim().length > 0;

	function updateDraft(value: unknown, error: string | null = null) {
		setStoredDraft({key: editorKey, value, error});
	}

	function openOccurrence(occurrence: LogicOccurrence, returnTarget: "usage" | "entries" = "usage") {
		if (occurrence.savedId) {
			setSelectedUsageState(null);
			onSelectedIdChange(occurrence.savedId);
			return;
		}
		setInlineDraft({
			occurrence,
			value: cloneValue(occurrence.value),
			error: null,
			returnTo: returnTarget,
		});
	}

	function closeInlineOccurrence() {
		if (inlineDraft?.returnTo === "entries") setSelectedUsageState(null);
		setInlineDraft(null);
	}

	function saveInlineOccurrence() {
		if (!inlineDraft || !selectedUsage) return;
		const parsed = inlineDraft.occurrence.schema.safeParse(inlineDraft.value);
		if (!parsed.success) {
			setInlineDraft({
				...inlineDraft,
				error: parsed.error.issues[0]?.message ?? `This ${singular} is not complete.`,
			});
			return;
		}
		updateWorld(
			replaceLogicOccurrence(world, selectedUsage, inlineDraft.occurrence.path, parsed.data),
		);
		closeInlineOccurrence();
	}

	const entryIndex = useMemo(() => {
		if (view !== "entries") return [];
		const savedSource = isCondition
			? world.conditions.map((condition, order) => {
					const id = idValue(condition.identity);
					const summary = conditionSummary(condition);
					const usages = findLogicUsages(world, "condition", id);
					return {
						key: `saved:${id}`,
						savedId: id,
						name: condition.name.trim() || summary,
						summary,
						count: condition.condition.type === "group" ? condition.condition.conditions.length : 1,
						usages,
						order,
						searchText: `${id} ${condition.name} ${summary} ${authoredSearchText(condition.condition)} ${schemaMetadataSearchText(
							condition.condition,
							ConditionSchema,
						)} ${usages.map((usage) => `${usage.label} ${usage.detail}`).join(" ")}`,
					};
				})
			: world.effects.map((effect, order) => {
					const id = idValue(effect.id);
					const summary = effectSummary(effect);
					const usages = findLogicUsages(world, "effect", id);
					return {
						key: `saved:${id}`,
						savedId: id,
						name: effect.name.trim() || summary,
						summary,
						count: effect.effects.length,
						usages,
						order,
						searchText: `${id} ${effect.name} ${summary} ${authoredSearchText(effect)} ${schemaMetadataSearchText(
							effect.effects,
							EffectSchema,
						)} ${usages.map((usage) => `${usage.label} ${usage.detail}`).join(" ")}`,
					};
				});

		const inlineSource = logicSources.flatMap(({usage}, sourceOrder) =>
			findLogicOccurrences(world, usage, kind)
				.filter((occurrence) => !occurrence.savedId)
				.map((occurrence, occurrenceOrder) => {
					const display = occurrenceDisplay(world, kind, occurrence);
					const value = occurrence.value as {conditions?: unknown[]; effects?: unknown[]};
					const count = isCondition ? (value.conditions?.length ?? 1) : (value.effects?.length ?? 1);
					return {
						key: `inline:${occurrence.key}`,
						savedId: null,
						usage,
						occurrence,
						name: `${usage.label} · ${display.title}`,
						summary: display.summary,
						count,
						usages: [usage],
						order: world.conditions.length + world.effects.length + sourceOrder * 100 + occurrenceOrder,
						searchText: `${usage.label} ${PARENT_LABELS[usage.kind]} ${usage.detail} ${display.title} ${display.detail} ${display.summary} ${pathLabel(occurrence.path)} ${authoredSearchText(occurrence.value)} ${schemaMetadataSearchText(
							occurrence.value,
							isCondition ? ConditionSchema : EffectSchema,
						)}`,
					};
				}),
		);
		return [...savedSource, ...inlineSource];
	}, [isCondition, kind, logicSources, view, world]);
	const entries = useMemo(() => {
		const query = search.trim().toLocaleLowerCase();
		const filtered = entryIndex.filter((entry) => {
			if (query && !entry.searchText.toLocaleLowerCase().includes(query)) return false;
			if (filter === "used") return entry.usages.length > 0;
			if (filter === "unused") return entry.usages.length === 0;
			return true;
		});
		return filtered.sort((left, right) => {
			if (sort === "alphabetical") return left.name.localeCompare(right.name);
			if (sort === "most") return right.usages.length - left.usages.length;
			if (sort === "least") return left.usages.length - right.usages.length;
			if (sort === "parent-type") {
				const leftType = left.usages[0] ? PARENT_LABELS[left.usages[0].kind] : "Unused";
				const rightType = right.usages[0] ? PARENT_LABELS[right.usages[0].kind] : "Unused";
				return leftType.localeCompare(rightType) || left.name.localeCompare(right.name);
			}
			if (sort === "recent") return right.order - left.order;
			if (sort === "least-recent") return left.order - right.order;
			return left.name.localeCompare(right.name);
		});
	}, [entryIndex, filter, search, sort]);
	const sourceEntryIndex = useMemo(() => {
		if (view !== "parents") return [];
		return logicSources.map((entry, order) => {
			const occurrenceText = hasSearch
				? findLogicOccurrences(world, entry.usage, kind)
						.map((occurrence) => {
							const display = occurrenceDisplay(world, kind, occurrence);
							return `${display.title} ${display.detail} ${display.summary} ${pathLabel(occurrence.path)} ${authoredSearchText(occurrence.value)} ${schemaMetadataSearchText(
								occurrence.value,
								isCondition ? ConditionSchema : EffectSchema,
							)}`;
						})
						.join(" ")
				: "";
			return {
				...entry,
				order,
				searchText: `${entry.usage.label} ${PARENT_LABELS[entry.usage.kind]} ${entry.usage.detail} ${occurrenceText}`,
			};
		});
	}, [hasSearch, isCondition, kind, logicSources, view, world]);
	const sourceEntries = useMemo(() => {
		if (filter === "unused") return [];
		const query = search.trim().toLocaleLowerCase();
		return sourceEntryIndex
			.filter(({searchText}) => {
				return !query || searchText.toLocaleLowerCase().includes(query);
			})
			.sort((left, right) => {
				if (sort === "alphabetical") return left.usage.label.localeCompare(right.usage.label);
				if (sort === "parent-type") {
					return (
						PARENT_LABELS[left.usage.kind].localeCompare(PARENT_LABELS[right.usage.kind]) ||
						left.usage.label.localeCompare(right.usage.label)
					);
				}
				if (sort === "most") return right.count - left.count;
				if (sort === "least") return left.count - right.count;
				if (sort === "recent") return right.order - left.order;
				if (sort === "least-recent") return left.order - right.order;
				return left.usage.label.localeCompare(right.usage.label);
			});
	}, [filter, search, sort, sourceEntryIndex]);

	const currentUsages = savedId ? findLogicUsages(world, kind, savedId) : [];
	const editorTitle = (() => {
		if (returnTo?.draftEditor) {
			const value = draftValue as {name?: unknown} | null;
			return typeof value?.name === "string" && value.name.trim()
				? value.name
				: `Edit ${singular} group`;
		}
		if (isCondition) {
			const value = draftValue as SavedCondition | null;
			return value?.name?.trim() || (value ? conditionSummary(value) : `New ${singular}`);
		}
		const value = draftValue as EffectGroup | null;
		return value?.name?.trim() || `New ${singular}`;
	})();

	function beginNewDraft() {
		onSelectedIdChange(null);
		setStoredDraft({key: "", value: null, error: null});
		setNewDraft(isCondition ? createCondition(world) : createEffect(world));
	}

	function closeEditor() {
		if (returnTo) {
			returnTo.onCancel();
			return;
		}
		setStoredDraft({key: "", value: null, error: null});
		setNewDraft(null);
		onSelectedIdChange(null);
	}

	function saveDraft() {
		if (draftValue == null) return;
		const parsed = editorSchema.safeParse(draftValue);
		if (!parsed.success) {
			updateDraft(draftValue, parsed.error.issues[0]?.message ?? `This ${singular} is not complete.`);
			return;
		}

		if (returnTo?.draftEditor) {
			returnTo.draftEditor.onDone(parsed.data);
			return;
		}

		if (isCondition) {
			const condition = SavedConditionSchema.parse(parsed.data);
			const conditionId = idValue(condition.identity);
			updateWorld((draft) => {
				const index = draft.conditions.findIndex(
					(candidate) => idValue(candidate.identity) === conditionId,
				);
				if (index >= 0) draft.conditions[index] = condition;
				else draft.conditions.push(condition);
			});
			if (returnTo) returnTo.onDone?.(conditionId);
		} else {
			const effect = EffectGroupSchema.parse(parsed.data);
			const effectId = idValue(effect.id);
			updateWorld((draft) => {
				const index = draft.effects.findIndex((candidate) => idValue(candidate.id) === effectId);
				if (index >= 0) draft.effects[index] = effect;
				else draft.effects.push(effect);
			});
			if (returnTo) returnTo.onDone?.(effectId);
		}

		if (!returnTo) {
			setNewDraft(null);
			onSelectedIdChange(null);
		}
	}

	async function deleteSavedEntry() {
		if (!savedId || returnTo) return;
		const confirmed = popup
			? await popup.confirm({
					title: `Delete ${singular}?`,
					message: (
						<div>
							<p>Delete “{editorTitle}”?</p>
							{currentUsages.length ? (
								<>
									<p>The following dependent records will be removed or repaired:</p>
									<ul>
										{currentUsages.map((usage) => (
											<li key={usage.key}>
												{usage.label} · {usage.detail}
											</li>
										))}
									</ul>
								</>
							) : (
								<p>This {singular} is not currently referenced.</p>
							)}
						</div>
					),
					confirmLabel: `Delete ${singular}`,
					danger: true,
				})
			: true;
		if (!confirmed) return;
		updateWorld(deleteWorldEntity(world, toID(kind, savedId)));
		onSelectedIdChange(null);
	}

	if (inlineDraft && selectedUsage) {
		const display = occurrenceDisplay(world, kind, inlineDraft.occurrence);
		return (
			<div className="logicLibraryWorkspace logicLibraryWorkspace--editor">
				<header className="logicDraftHeader">
					<button type="button" className="logicDraftHeader__back" onClick={closeInlineOccurrence}>
						<ArrowLeft size={16} aria-hidden="true" />
						<span>
							<strong>Back</strong>
							<small>{selectedUsage.label}</small>
						</span>
					</button>
					<div className="logicDraftHeader__actions">
						<button type="button" onClick={closeInlineOccurrence}>
							Cancel
						</button>
						<button type="button" className="logicDraftHeader__save" onClick={saveInlineOccurrence}>
							Save
						</button>
					</div>
				</header>
				<div className="logicDraftBody">
					<div className="logicDraftIntro">
						<div>
							<h1>{display.title}</h1>
							<p>
								Inline {singular} in {selectedUsage.label}
							</p>
						</div>
					</div>
					{inlineDraft.error ? (
						<div className="logicDraftError" role="alert">
							{inlineDraft.error}
						</div>
					) : null}
					<div className={`logicDraftEditor logicDraftEditor--${kind}`}>
						<UniversalEditor
							schema={inlineDraft.occurrence.schema}
							value={inlineDraft.value}
							onChange={(value) => setInlineDraft({...inlineDraft, value, error: null})}
							world={world}
							updateWorld={() => undefined}
							commandVariableCatalog={inlineDraft.occurrence.commandVariableCatalog}
							logicEditorPresentation="inline"
							hideRootShellHeader
							scrollOnExternalValueChange={false}
						/>
					</div>
				</div>
			</div>
		);
	}

	if (selectedUsage) {
		const ParentIcon = USAGE_ICONS[selectedUsage.kind];
		const parentLabel = PARENT_LABELS[selectedUsage.kind];
		return (
			<div className="logicLibraryWorkspace logicLibraryWorkspace--usage">
				<header className="logicLibraryHeader logicUsageDetailHeader">
					<div className="logicLibraryHeader__title">
						<button
							type="button"
							className="logicLibraryBack"
							onClick={() => setSelectedUsageState(null)}
						>
							<ArrowLeft size={15} aria-hidden="true" />
							Back
						</button>
						<div>
							<h1>{selectedUsage.label}</h1>
							<p>
								{parentLabel} · {selectedUsageOccurrences.length} {singular}
								{selectedUsageOccurrences.length === 1 ? "" : "s"}
							</p>
						</div>
					</div>
					<button
						type="button"
						className="logicLibraryPrimaryAction"
						onClick={() => onOpenUsage?.(selectedUsage)}
					>
						<ExternalLink size={14} aria-hidden="true" />
						See {parentLabel}
					</button>
				</header>
				<div className="logicUsageDetailBody">
					<div className="logicUsageDetailIntro">
						<ParentIcon size={18} aria-hidden="true" />
						<div>
							<h2>
								{title} in this {parentLabel.toLocaleLowerCase()}
							</h2>
							<p>Select an entry to edit it here. The parent opens only from See {parentLabel}.</p>
						</div>
					</div>
					{selectedUsageOccurrences.length === 0 ? (
						<div className="logicLibraryEmpty">
							<h2>No {singular}s found</h2>
							<p>This parent no longer contains matching logic.</p>
						</div>
					) : (
						<div className="logicOccurrenceList">
							{selectedUsageOccurrences.map((occurrence) => {
								const display = occurrenceDisplay(world, kind, occurrence);
								return (
									<button type="button" key={occurrence.key} onClick={() => openOccurrence(occurrence)}>
										<span>
											<strong>{display.title}</strong>
											<small>{display.detail}</small>
										</span>
										<span>{display.summary}</span>
										<ChevronRight size={15} aria-hidden="true" />
									</button>
								);
							})}
						</div>
					)}
				</div>
			</div>
		);
	}

	if (!isEditing) {
		return (
			<div className="logicLibraryWorkspace">
				<header className="logicLibraryHeader">
					<div className="logicLibraryHeader__title">
						<button type="button" className="logicLibraryBack" onClick={onBackToLogic}>
							<ArrowLeft size={15} aria-hidden="true" />
							Back
						</button>
						<div>
							<h1>{title}</h1>
							<p>
								{isCondition
									? "Reusable groups that decide whether something is true."
									: "Reusable groups that change the world or tell the player something."}
							</p>
						</div>
					</div>
					<button type="button" className="logicLibraryPrimaryAction" onClick={beginNewDraft}>
						<Plus size={15} aria-hidden="true" />
						New {singular}
					</button>
				</header>

				<div className="logicLibraryTools">
					<label className="logicLibrarySearch">
						<span>Search {singular}s</span>
						<span className="logicLibrarySearch__control">
							<Search size={15} aria-hidden="true" />
							<input
								type="search"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder={
									isCondition
										? "Try “outside with a shovel”, “trap armed”, or “used by Dig”"
										: "Try “unlock a door”, “set a trap”, or “used by Drop”"
								}
							/>
						</span>
					</label>
					<div className="logicLibraryViewControls" aria-label={`${title} views`}>
						{(["parents", "entries"] as const).map((value) => (
							<button
								type="button"
								key={value}
								aria-pressed={view === value}
								onClick={() => {
									setView(value);
									if (value === "parents") setFilter("all");
								}}
							>
								{value === "parents" ? "By parent" : title}
							</button>
						))}
					</div>
					<label className="logicLibrarySort">
						<span>Sort by</span>
						<select value={sort} onChange={(event) => setSort(event.target.value as LibrarySort)}>
							<option value="alphabetical">Alphabetical</option>
							<option value="parent-type">Parent type</option>
							<option value="most">Most {view === "parents" ? "logic" : "used"}</option>
							<option value="least">Least {view === "parents" ? "logic" : "used"}</option>
							<option value="recent">Recently added</option>
							<option value="least-recent">Least recently added</option>
						</select>
					</label>
					{view === "entries" ? (
						<div className="logicLibraryFilters" aria-label={`${title} filters`}>
							{(["all", "used", "unused"] as const).map((value) => (
								<button
									type="button"
									key={value}
									aria-pressed={filter === value}
									onClick={() => setFilter(value)}
								>
									{value.charAt(0).toLocaleUpperCase() + value.slice(1)}
								</button>
							))}
						</div>
					) : null}
					<p>
						{view === "parents"
							? `Select a parent to see and edit its ${singular}s without leaving this library.`
							: `Select any authored ${singular} group to open its editor directly.`}
					</p>
				</div>

				<div className="logicLibraryBody">
					{view === "entries" ? (
						<div className="logicLibraryList" aria-label={`${title} library`}>
							{entries.length === 0 ? (
								<div className="logicLibraryEmpty">
									<Search size={20} aria-hidden="true" />
									<h2>No matching {singular}s</h2>
									<p>Try a behavior, situation, entity, command, event, or authored name.</p>
								</div>
							) : (
								entries.map((entry) => (
									<button
										type="button"
										className="logicLibraryRow"
										key={entry.key}
										onClick={() => {
											if (entry.savedId) {
												onSelectedIdChange(entry.savedId);
												return;
											}
											if (!("usage" in entry) || !("occurrence" in entry)) return;
											setSelectedUsageState({libraryKind: kind, usage: entry.usage});
											openOccurrence(entry.occurrence, "entries");
										}}
									>
										<span>
											<strong>{entry.name}</strong>
											<small>
												{entry.count} {entry.count === 1 ? singular : `${singular}s`}
											</small>
										</span>
										<span className="logicLibraryRow__summary">{entry.summary}</span>
										<span className="logicLibraryRow__usage">
											{entry.usages.length === 0
												? "Unused"
												: `Used in ${entry.usages.length} ${entry.usages.length === 1 ? "place" : "places"}`}
											<ChevronRight size={15} aria-hidden="true" />
										</span>
									</button>
								))
							)}
						</div>
					) : sourceEntries.length === 0 ? (
						<div className="logicLibraryEmpty">
							<Search size={20} aria-hidden="true" />
							<h2>No matching parents</h2>
							<p>Try a command, event, item, room, or parent type.</p>
						</div>
					) : (
						<section
							className="logicSourceSection logicSourceSection--primary"
							aria-labelledby={`${kind}-source-title`}
						>
							<div className="logicSourceSection__heading">
								<h2 id={`${kind}-source-title`}>By parent</h2>
								<p>Commands, events, items, and rooms containing {singular} logic.</p>
							</div>
							<div className="logicUsageList">
								{sourceEntries.map(({usage}) => {
									const Icon = USAGE_ICONS[usage.kind];
									return (
										<button
											type="button"
											key={usage.key}
											onClick={() => {
												setInlineDraft(null);
												setSelectedUsageState({libraryKind: kind, usage});
											}}
										>
											<Icon size={15} aria-hidden="true" />
											<span>
												<strong>{usage.label}</strong>
												<small>
													{PARENT_LABELS[usage.kind]} · {usage.detail}
												</small>
											</span>
											<ChevronRight size={15} aria-hidden="true" />
										</button>
									);
								})}
							</div>
						</section>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="logicLibraryWorkspace logicLibraryWorkspace--editor">
			<header className="logicDraftHeader">
				<button type="button" className="logicDraftHeader__back" onClick={closeEditor}>
					<ArrowLeft size={16} aria-hidden="true" />
					<span>
						<strong>Back</strong>
						<small>{returnTo?.label ?? `${title} library`}</small>
					</span>
				</button>
				<div className="logicDraftHeader__actions">
					<button type="button" onClick={closeEditor}>
						Cancel
					</button>
					<button type="button" className="logicDraftHeader__save" onClick={saveDraft}>
						Save
					</button>
				</div>
			</header>

			<div className="logicDraftBody">
				<div className="logicDraftIntro">
					<div>
						<h1>{editorTitle}</h1>
						<p>
							{isCondition
								? "One condition group. Groups can contain conditions or other groups."
								: "One effect group. Effects run from top to bottom."}
						</p>
					</div>
					{savedId && !returnTo ? (
						<button type="button" className="logicDraftDelete" onClick={() => void deleteSavedEntry()}>
							<Trash2 size={14} aria-hidden="true" />
							Delete {singular}
						</button>
					) : null}
				</div>

				{draftError ? (
					<div className="logicDraftError" role="alert">
						{draftError}
					</div>
				) : null}

				{draftValue != null ? (
					<div className={`logicDraftEditor logicDraftEditor--${kind}`}>
						<UniversalEditor
							key={editorKey}
							schema={editorSchema}
							value={draftValue}
							onChange={(nextValue) => {
								updateDraft(nextValue);
							}}
							world={world}
							updateWorld={() => undefined}
							commandVariableCatalog={returnTo?.draftEditor?.commandVariableCatalog}
							logicEditorPresentation="inline"
							hideRootShellHeader
							scrollOnExternalValueChange={false}
						/>
					</div>
				) : null}

				{savedId && !returnTo ? (
					<section className="logicUsageSection">
						<h2>Used in</h2>
						<p>Changing this {singular} changes every place below.</p>
						{currentUsages.length === 0 ? (
							<p className="logicUsageSection__empty">This {singular} is not used yet.</p>
						) : (
							<div className="logicUsageList">
								{currentUsages.map((usage) => {
									const Icon = USAGE_ICONS[usage.kind];
									return (
										<button
											type="button"
											key={usage.key}
											onClick={() => {
												setInlineDraft(null);
												setSelectedUsageState({libraryKind: kind, usage});
											}}
										>
											<Icon size={15} aria-hidden="true" />
											<span>
												<strong>{usage.label}</strong>
												<small>{usage.detail}</small>
											</span>
											<ChevronRight size={15} aria-hidden="true" />
										</button>
									);
								})}
							</div>
						)}
					</section>
				) : null}
			</div>
		</div>
	);
}
