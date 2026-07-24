"use client";

import {ArrowLeft, Braces, Command, GitBranch, Plus, Sparkles, Trash2} from "lucide-react";
import {useRef} from "react";
import type {Event} from "@/schemas/world/eventSchema";
import type {Effect, EffectGroup} from "@/schemas/world/effectSchema";
import type {World} from "@/schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {idValue, toID} from "@/utils/idUtils";
import {
	generateConditionSummary,
	generateEffectSummary,
} from "@/components/universal-editor/utils/universalEditorUtils";
import {CenteredScrollSelector} from "@/components/ui/CenteredScrollSelector";
import "./LogicEditor.scss";

export type LogicBranchKey = "perform" | "if" | "elif" | "else";
export type LogicSection = "home" | "events" | "commands" | "conditions" | "effects";

export type LogicSelection =
	| {kind: "event"; eventId: string}
	| {kind: "condition"; eventId: string; branch: "if" | "elif"; elifIndex?: number}
	| {kind: "effect-group"; eventId: string; effectId: string};

type LogicEditorProps = {
	world: World;
	updateWorld: UpdateWorld;
	selectedEventId: string | null;
	onSelectedEventIdChange: (eventId: string) => void;
	selection: LogicSelection | null;
	onSelectionChange: (selection: LogicSelection | null) => void;
};

function uniqueId(prefix: string, usedIds: string[]) {
	const used = new Set(usedIds);
	let suffix = 1;
	let candidate = prefix;
	while (used.has(candidate)) candidate = `${prefix}-${++suffix}`;
	return candidate;
}

function emptyEffectGroup(id: string, name = ""): EffectGroup {
	return {
		id: toID("effect", id),
		name,
		type: "group",
		effects: [],
		allowMultipleUsesInWorld: true,
	};
}

function defaultEvent(world: World): Event {
	const id = uniqueId(
		"new-event",
		(world.events ?? []).map((event) => idValue(event.id)),
	);
	return {
		id: toID("event", id),
		name: "New event",
		enabled: true,
		disposable: false,
		wait: 0,
		priority: 0,
		branch: {
			id: toID("condition-branch", `${id}-branch`),
			perform: emptyEffectGroup(`${id}-always`, "Always"),
		},
	};
}

type BranchCondition = NonNullable<Event["branch"]["if"]>["condition"];
type EffectReference = Extract<Effect, {type: "effect-ref"}>;
type BranchEffectEntry =
	| {reference: EffectReference; group: EffectGroup | null; effect: null}
	| {reference: null; group: null; effect: Effect};

function defaultCondition(): BranchCondition {
	return {type: "group", operation: "all", conditions: []};
}

function conditionEffectGroup(eventId: string, label: string) {
	return emptyEffectGroup(`${eventId}-${label}`, label);
}

function branchGroup(event: Event, branch: LogicBranchKey, elifIndex?: number) {
	if (branch === "perform") return event.branch.perform;
	if (branch === "if") return event.branch.if?.effect;
	if (branch === "else") return event.branch.else;
	return event.branch.elifs?.[elifIndex ?? -1]?.effect;
}

function referencedEffectGroups(group: EffectGroup | undefined, world: World) {
	if (!group) return [];
	return group.effects.map<BranchEffectEntry>((effect) => {
		if (effect.type !== "effect-ref") return {reference: null, group: null, effect};
		const id = idValue(effect.effectId);
		const found = world.effects.find((candidate) => idValue(candidate.id) === id) ?? null;
		return {reference: effect, group: found, effect: null};
	});
}

type EventBranchProps = {
	label: string;
	world: World;
	group: EffectGroup | undefined;
	condition?: BranchCondition;
	onSelectCondition?: () => void;
	onSelectGroup: (effectId: string) => void;
	onAddEffect: () => void;
	onRemoveEffect: (index: number) => void;
	onMoveEffect: (fromIndex: number, toIndex: number) => void;
	onDeleteBranch?: () => void;
};

function EventBranch({
	label,
	world,
	group,
	condition,
	onSelectCondition,
	onSelectGroup,
	onAddEffect,
	onRemoveEffect,
	onMoveEffect,
	onDeleteBranch,
}: EventBranchProps) {
	const entries = referencedEffectGroups(group, world);
	const draggedIndex = useRef<number | null>(null);
	const keyOccurrences = new Map<string, number>();

	function entryKey(entry: BranchEffectEntry) {
		const base = entry.reference
			? `reference-${idValue(entry.reference.effectId)}`
			: `legacy-${JSON.stringify(entry.effect)}`;
		const occurrence = keyOccurrences.get(base) ?? 0;
		keyOccurrences.set(base, occurrence + 1);
		return `${base}-${occurrence}`;
	}

	function startDragging(index: number, event: React.DragEvent) {
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", String(index));
		draggedIndex.current = index;
	}

	function dragOver(index: number, event: React.DragEvent) {
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";

		const fromIndex = draggedIndex.current;
		if (fromIndex == null || fromIndex === index) return;

		draggedIndex.current = index;
		onMoveEffect(fromIndex, index);
	}

	function stopDragging() {
		draggedIndex.current = null;
	}

	return (
		<section className="logicBranch">
			<header className="logicBranch__header">
				<div>
					<span className="logicBranch__label">{label}</span>
					{condition ? (
						<button type="button" className="logicBranch__condition" onClick={onSelectCondition}>
							{generateConditionSummary(condition)}
						</button>
					) : null}
				</div>
				<div className="logicBranch__actions">
					<button type="button" onClick={onAddEffect} aria-label={`Add effect to ${label}`}>
						<Plus size={15} aria-hidden="true" />
						Effect
					</button>
					{onDeleteBranch ? (
						<button type="button" onClick={onDeleteBranch} aria-label={`Delete ${label} branch`}>
							<Trash2 size={15} aria-hidden="true" />
						</button>
					) : null}
				</div>
			</header>

			<div className="logicBranch__effects">
				{entries.length === 0 ? (
					<button type="button" className="logicBranch__empty" onClick={onAddEffect}>
						Add an effect
					</button>
				) : (
					entries.map((entry, index) => {
						if (!entry.reference) {
							return (
								<div
									className="logicEffectGroup logicEffectGroup--legacy"
									key={entryKey(entry)}
									draggable={true}
									title="Drag to reorder"
									onDragStart={(event) => startDragging(index, event)}
									onDragOver={(event) => dragOver(index, event)}
									onDrop={stopDragging}
									onDragEnd={stopDragging}
								>
									{generateEffectSummary(entry.effect)}
								</div>
							);
						}

						const effectId = idValue(entry.reference.effectId);
						return (
							<div
								className="logicEffectGroup"
								key={entryKey(entry)}
								draggable={true}
								title="Drag to reorder"
								onDragStart={(event) => startDragging(index, event)}
								onDragOver={(event) => dragOver(index, event)}
								onDrop={stopDragging}
								onDragEnd={stopDragging}
							>
								<div className="logicEffectGroup__row">
									<button
										type="button"
										className="logicEffectGroup__select"
										onClick={() => onSelectGroup(effectId)}
									>
										<span>{entry.group?.name || effectId || "Missing effect group"}</span>
										<span className="logicEffectGroup__count">{entry.group?.effects.length ?? 0}</span>
									</button>
									<button
										type="button"
										className="logicEffectGroup__remove"
										onClick={() => onRemoveEffect(index)}
										aria-label={`Remove ${entry.group?.name || effectId}`}
									>
										<Trash2 size={14} aria-hidden="true" />
									</button>
								</div>
								{entry.group?.effects.map((effect, effectIndex) => (
									<button
										type="button"
										className="logicSubEffect"
										onClick={() => onSelectGroup(effectId)}
										key={effectIndex}
									>
										{generateEffectSummary(effect)}
									</button>
								))}
							</div>
						);
					})
				)}
			</div>
		</section>
	);
}

export function LogicEditor({
	world,
	updateWorld,
	selectedEventId,
	onSelectedEventIdChange,
	selection,
	onSelectionChange,
}: LogicEditorProps) {
	const events = world.events ?? [];
	const selectedEvent =
		events.find((event) => idValue(event.id) === selectedEventId) ?? events[0] ?? null;

	function selectEvent(event: Event) {
		const eventId = idValue(event.id);
		onSelectedEventIdChange(eventId);
		onSelectionChange({kind: "event", eventId});
	}

	function addEvent() {
		const event = defaultEvent(world);
		updateWorld((draft) => {
			(draft.events ??= []).push(event);
		});
		selectEvent(event);
	}

	function updateEvent(recipe: (event: Event) => void) {
		if (!selectedEvent) return;
		updateWorld((draft) => {
			const event = draft.events?.find(
				(candidate) => idValue(candidate.id) === idValue(selectedEvent.id),
			);
			if (event) recipe(event as Event);
		});
	}

	function addEffect(branch: LogicBranchKey, elifIndex?: number) {
		if (!selectedEvent) return;
		const effectId = uniqueId(
			"new-effect",
			world.effects.map((effect) => idValue(effect.id)),
		);
		const group: EffectGroup = {
			...emptyEffectGroup(effectId),
			effects: [{type: "message", operation: "show", message: ""}],
		};

		updateWorld((draft) => {
			draft.effects.push(group);
			const event = draft.events?.find(
				(candidate) => idValue(candidate.id) === idValue(selectedEvent.id),
			);
			const target = event ? branchGroup(event as Event, branch, elifIndex) : undefined;
			target?.effects.push({type: "effect-ref", effectId: toID("effect", effectId)});
		});
		onSelectionChange({kind: "effect-group", eventId: idValue(selectedEvent.id), effectId});
	}

	function removeEffect(branch: LogicBranchKey, index: number, elifIndex?: number) {
		updateEvent((event) => {
			branchGroup(event, branch, elifIndex)?.effects.splice(index, 1);
		});
		if (selection?.kind === "effect-group") onSelectionChange(null);
	}

	function moveEffect(
		branch: LogicBranchKey,
		fromIndex: number,
		toIndex: number,
		elifIndex?: number,
	) {
		updateEvent((event) => {
			const effects = branchGroup(event, branch, elifIndex)?.effects;
			if (!effects) return;
			const [effect] = effects.splice(fromIndex, 1);
			if (effect) effects.splice(toIndex, 0, effect);
		});
	}

	function addIf() {
		if (!selectedEvent) return;
		updateEvent((event) => {
			event.branch.if = {
				condition: defaultCondition(),
				effect: conditionEffectGroup(idValue(event.id), "if"),
			};
		});
		onSelectionChange({kind: "condition", eventId: idValue(selectedEvent.id), branch: "if"});
	}

	function addElseIf() {
		if (!selectedEvent) return;
		const index = selectedEvent.branch.elifs?.length ?? 0;
		updateEvent((event) => {
			(event.branch.elifs ??= []).push({
				condition: defaultCondition(),
				effect: conditionEffectGroup(idValue(event.id), `else-if-${index + 1}`),
			});
		});
		onSelectionChange({
			kind: "condition",
			eventId: idValue(selectedEvent.id),
			branch: "elif",
			elifIndex: index,
		});
	}

	function addElse() {
		updateEvent((event) => {
			event.branch.else = conditionEffectGroup(idValue(event.id), "else");
		});
	}

	if (!selectedEvent) {
		return (
			<div className="logicEmpty">
				<p>No events yet.</p>
				<button type="button" onClick={addEvent}>
					<Plus size={16} aria-hidden="true" />
					New event
				</button>
			</div>
		);
	}

	const eventId = idValue(selectedEvent.id);

	return (
		<div className="logicEditor">
			<aside className="logicEventRail">
				<div className="logicEventRail__title">Events</div>
				<CenteredScrollSelector
					items={events}
					activeId={eventId}
					onActiveChange={selectEvent}
					getId={(event) => idValue(event.id)}
					renderLabel={(event) => event.name || "Unnamed event"}
					ariaLabel="Events"
					className="logicEventSelector"
				/>
				<button type="button" className="logicEventRail__add" onClick={addEvent}>
					<Plus size={15} aria-hidden="true" />
					New event
				</button>
			</aside>

			<div className="logicTree">
				{selectedEvent.branch.perform ? (
					<EventBranch
						label="Always"
						world={world}
						group={selectedEvent.branch.perform}
						onSelectGroup={(effectId) => onSelectionChange({kind: "effect-group", eventId, effectId})}
						onAddEffect={() => addEffect("perform")}
						onRemoveEffect={(index) => removeEffect("perform", index)}
						onMoveEffect={(fromIndex, toIndex) => moveEffect("perform", fromIndex, toIndex)}
						onDeleteBranch={() => updateEvent((event) => delete event.branch.perform)}
					/>
				) : (
					<button
						type="button"
						className="logicTree__addSection"
						onClick={() =>
							updateEvent((event) => {
								event.branch.perform = conditionEffectGroup(eventId, "always");
							})
						}
					>
						<Plus size={15} aria-hidden="true" />
						Always
					</button>
				)}

				{selectedEvent.branch.if ? (
					<EventBranch
						label="If"
						world={world}
						group={selectedEvent.branch.if.effect}
						condition={selectedEvent.branch.if.condition}
						onSelectCondition={() => onSelectionChange({kind: "condition", eventId, branch: "if"})}
						onSelectGroup={(effectId) => onSelectionChange({kind: "effect-group", eventId, effectId})}
						onAddEffect={() => addEffect("if")}
						onRemoveEffect={(index) => removeEffect("if", index)}
						onMoveEffect={(fromIndex, toIndex) => moveEffect("if", fromIndex, toIndex)}
						onDeleteBranch={() => updateEvent((event) => delete event.branch.if)}
					/>
				) : (
					<button type="button" className="logicTree__addSection" onClick={addIf}>
						<Plus size={15} aria-hidden="true" />
						If
					</button>
				)}

				{selectedEvent.branch.elifs?.map((branch, index) => (
					<EventBranch
						key={index}
						label="Else if"
						world={world}
						group={branch.effect}
						condition={branch.condition}
						onSelectCondition={() =>
							onSelectionChange({
								kind: "condition",
								eventId,
								branch: "elif",
								elifIndex: index,
							})
						}
						onSelectGroup={(effectId) => onSelectionChange({kind: "effect-group", eventId, effectId})}
						onAddEffect={() => addEffect("elif", index)}
						onRemoveEffect={(effectIndex) => removeEffect("elif", effectIndex, index)}
						onMoveEffect={(fromIndex, toIndex) => moveEffect("elif", fromIndex, toIndex, index)}
						onDeleteBranch={() =>
							updateEvent((event) => {
								event.branch.elifs?.splice(index, 1);
							})
						}
					/>
				))}

				{selectedEvent.branch.else ? (
					<EventBranch
						label="Else"
						world={world}
						group={selectedEvent.branch.else}
						onSelectGroup={(effectId) => onSelectionChange({kind: "effect-group", eventId, effectId})}
						onAddEffect={() => addEffect("else")}
						onRemoveEffect={(index) => removeEffect("else", index)}
						onMoveEffect={(fromIndex, toIndex) => moveEffect("else", fromIndex, toIndex)}
						onDeleteBranch={() => updateEvent((event) => delete event.branch.else)}
					/>
				) : null}

				<div className="logicTree__branchActions">
					{selectedEvent.branch.if ? (
						<button type="button" onClick={addElseIf}>
							<Plus size={15} aria-hidden="true" />
							Else if
						</button>
					) : null}
					{selectedEvent.branch.if && !selectedEvent.branch.else ? (
						<button type="button" onClick={addElse}>
							<Plus size={15} aria-hidden="true" />
							Else
						</button>
					) : null}
				</div>
			</div>
		</div>
	);
}

export function LogicToolbar({
	event,
	updateWorld,
	onBack,
	onDelete,
}: {
	event: Event | null;
	updateWorld: UpdateWorld;
	onBack: () => void;
	onDelete: () => void;
}) {
	if (!event) {
		return (
			<div className="editorToolbar logicToolbar">
				<button
					type="button"
					className="logicToolbar__back"
					onClick={onBack}
					aria-label="Back to Logic"
				>
					<ArrowLeft size={16} aria-hidden="true" />
				</button>
				<p className="editorToolbarTitle">Events</p>
			</div>
		);
	}

	function updateField(
		field: "name" | "enabled" | "disposable" | "wait" | "priority",
		value: string | number | boolean,
	) {
		updateWorld((draft) => {
			const target = draft.events?.find((candidate) => idValue(candidate.id) === idValue(event!.id));
			if (target) Object.assign(target, {[field]: value});
		});
	}

	return (
		<div className="editorToolbar logicToolbar">
			<button type="button" className="logicToolbar__back" onClick={onBack} aria-label="Back to Logic">
				<ArrowLeft size={16} aria-hidden="true" />
			</button>
			<label className="logicToolbar__name">
				<span>Name</span>
				<input
					type="text"
					value={event.name}
					onChange={(change) => updateField("name", change.target.value)}
				/>
			</label>
			<label>
				<input
					type="checkbox"
					checked={event.enabled}
					onChange={(change) => updateField("enabled", change.target.checked)}
				/>
				Enabled
			</label>
			<label>
				<input
					type="checkbox"
					checked={event.disposable}
					onChange={(change) => updateField("disposable", change.target.checked)}
				/>
				Run once
			</label>
			<label>
				<span>Wait</span>
				<input
					type="number"
					min={0}
					value={event.wait}
					onChange={(change) => updateField("wait", Math.max(0, Number(change.target.value)))}
				/>
			</label>
			<label>
				<span>Priority</span>
				<input
					type="number"
					value={event.priority}
					onChange={(change) => updateField("priority", Number(change.target.value))}
				/>
			</label>
			<span className="logicToolbar__id">{idValue(event.id)}</span>
			<button type="button" className="logicToolbar__delete" onClick={onDelete}>
				<Trash2 size={15} aria-hidden="true" />
				Delete
			</button>
		</div>
	);
}

const LOGIC_SECTIONS = [
	{
		id: "events",
		title: "Events",
		description: "Run effects through conditional branches.",
		icon: GitBranch,
	},
	{
		id: "commands",
		title: "Commands",
		description: "Define the commands available to the player.",
		icon: Command,
	},
	{
		id: "conditions",
		title: "Build Complex Conditions",
		description: "Create reusable condition groups.",
		icon: Braces,
	},
	{
		id: "effects",
		title: "Build Complex Effects",
		description: "Create reusable effect groups.",
		icon: Sparkles,
	},
] satisfies Array<{
	id: Exclude<LogicSection, "home">;
	title: string;
	description: string;
	icon: typeof GitBranch;
}>;

export function LogicHome({onOpen}: {onOpen: (section: Exclude<LogicSection, "home">) => void}) {
	return (
		<div className="logicHome">
			<div className="logicHome__content">
				<h1>Logic</h1>
				<p>Choose what you want to build.</p>
				<div className="logicHome__grid">
					{LOGIC_SECTIONS.map((section) => {
						const Icon = section.icon;
						return (
							<button type="button" key={section.id} onClick={() => onOpen(section.id)}>
								<Icon size={20} aria-hidden="true" />
								<span>
									<strong>{section.title}</strong>
									<small>{section.description}</small>
								</span>
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}

export function LogicSectionPlaceholder({title, onBack}: {title: string; onBack: () => void}) {
	return (
		<div className="logicEmpty">
			<p>{title}</p>
			<button type="button" onClick={onBack}>
				<ArrowLeft size={15} aria-hidden="true" />
				Back to Logic
			</button>
		</div>
	);
}
