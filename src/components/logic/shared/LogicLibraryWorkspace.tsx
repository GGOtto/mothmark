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
import {generateUniqueId, idValue} from "@/utils/idUtils";
import {SavedConditionEditorSchema} from "./logicEditorSchemas";
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

function schemaSituationText(value: unknown, schema: z.ZodTypeAny) {
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
		if (option?.searchText) terms.add(option.searchText);
		Object.values(candidate).forEach(visit);
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
	const [newDraft, setNewDraft] = useState<SavedCondition | EffectGroup | null>(null);
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

	function updateDraft(value: unknown, error: string | null = null) {
		setStoredDraft({key: editorKey, value, error});
	}

	const entries = useMemo(() => {
		const query = search.trim().toLocaleLowerCase();
		const source = isCondition
			? world.conditions.map((condition) => {
					const id = idValue(condition.identity);
					const summary = conditionSummary(condition);
					const usages = findLogicUsages(world, "condition", id);
					return {
						id,
						name: condition.name.trim() || summary,
						summary,
						count: condition.condition.type === "group" ? condition.condition.conditions.length : 1,
						usages,
						searchText: `${id} ${condition.name} ${summary} ${schemaSituationText(
							condition.condition,
							ConditionSchema,
						)} ${usages.map((usage) => `${usage.label} ${usage.detail}`).join(" ")}`,
					};
				})
			: world.effects.map((effect) => {
					const id = idValue(effect.id);
					const summary = effectSummary(effect);
					const usages = findLogicUsages(world, "effect", id);
					return {
						id,
						name: effect.name.trim() || summary,
						summary,
						count: effect.effects.length,
						usages,
						searchText: `${id} ${effect.name} ${summary} ${schemaSituationText(
							effect.effects,
							EffectSchema,
						)} ${usages.map((usage) => `${usage.label} ${usage.detail}`).join(" ")}`,
					};
				});

		return source.filter((entry) => {
			if (query && !entry.searchText.toLocaleLowerCase().includes(query)) return false;
			if (filter === "used") return entry.usages.length > 0;
			if (filter === "unused") return entry.usages.length === 0;
			return true;
		});
	}, [filter, isCondition, search, world]);

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
					message: `Delete “${editorTitle}”? Existing references to it will need to be repaired.`,
					confirmLabel: `Delete ${singular}`,
					danger: true,
				})
			: true;
		if (!confirmed) return;
		updateWorld((draft) => {
			if (isCondition) {
				draft.conditions = draft.conditions.filter(
					(condition) => idValue(condition.identity) !== savedId,
				);
			} else {
				draft.effects = draft.effects.filter((effect) => idValue(effect.id) !== savedId);
			}
		});
		onSelectedIdChange(null);
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
					<p>
						Searches names, configured behavior, authoring situations, and where each {singular} is used.
					</p>
				</div>

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
								key={entry.id}
								onClick={() => onSelectedIdChange(entry.id)}
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
										<button type="button" key={usage.key} onClick={() => onOpenUsage?.(usage)}>
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
