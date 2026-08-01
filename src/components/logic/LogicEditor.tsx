"use client";

import {
	ArrowLeft,
	Braces,
	CalendarClock,
	Command,
	GitBranch,
	GripVertical,
	Plus,
	Sparkles,
	Trash2,
} from "lucide-react";
import {type CSSProperties, useLayoutEffect, useRef} from "react";
import {entityColorFor} from "@/components/entity-picker/entityPickerColors";
import {useOptionalPopup} from "@/components/popup/Popup";
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

export type LogicBranchKey = "always" | "if" | "elif" | "else";
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
		lastSuccess: 0,
		branch: {
			id: toID("condition-branch", `${id}-branch`),
			always: emptyEffectGroup(`${id}-always`, "Always"),
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
	if (branch === "always") return event.branch.always;
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
	scrollKey: string;
	label: string;
	world: World;
	group: EffectGroup | undefined;
	condition?: BranchCondition;
	delayTurns?: number;
	cancelIfConditionFails?: boolean;
	onSelectCondition?: () => void;
	onDelayEnabledChange?: (enabled: boolean) => void;
	onDelayTurnsChange?: (turns: number) => void;
	onCancelIfConditionFailsChange?: (cancel: boolean) => void;
	onSelectGroup: (effectId: string) => void;
	onAddEffect: () => void;
	onRemoveEffect: (index: number) => void;
	onMoveEffect: (fromIndex: number, toIndex: number) => void;
	onDeleteBranch?: () => void;
};

function EventBranch({
	scrollKey,
	label,
	world,
	group,
	condition,
	delayTurns = 0,
	cancelIfConditionFails = true,
	onSelectCondition,
	onDelayEnabledChange,
	onDelayTurnsChange,
	onCancelIfConditionFailsChange,
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
		<section className="logicBranch" data-branch-scroll-key={scrollKey}>
			<header className="logicBranch__header">
				<div className="logicBranch__summary">
					<span className="logicBranch__label">
						<span className="logicBranch__marker" aria-hidden="true" />
						{label}
					</span>
					{condition ? (
						<button type="button" className="logicBranch__condition" onClick={onSelectCondition}>
							{generateConditionSummary(condition)}
						</button>
					) : null}
					{condition && onDelayEnabledChange ? (
						<span className="logicBranch__delay">
							<label>
								<input
									type="checkbox"
									checked={delayTurns > 0}
									onChange={(event) => onDelayEnabledChange(event.target.checked)}
								/>
								Delay
							</label>
							{delayTurns > 0 ? (
								<>
									<label>
										<input
											type="number"
											min={1}
											aria-label={`${label} delay turns`}
											value={delayTurns}
											onChange={(event) => onDelayTurnsChange?.(Math.max(1, Number(event.target.value) || 1))}
										/>
										turns
									</label>
									<label>
										<input
											type="checkbox"
											checked={cancelIfConditionFails}
											onChange={(event) => onCancelIfConditionFailsChange?.(event.target.checked)}
										/>
										Cancel if condition fails
									</label>
								</>
							) : null}
						</span>
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
									<span className="logicEffectGroup__drag" aria-hidden="true">
										<GripVertical size={14} />
									</span>
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
	const popup = useOptionalPopup();
	const events = world.events ?? [];
	const selectedEvent =
		events.find((event) => idValue(event.id) === selectedEventId) ?? events[0] ?? null;
	const logicTreeRef = useRef<HTMLDivElement>(null);
	const pendingBranchScrollRef = useRef<string | null>(null);

	useLayoutEffect(() => {
		const scrollKey = pendingBranchScrollRef.current;
		const tree = logicTreeRef.current;
		if (!scrollKey || !tree) return;

		const branch = tree.querySelector<HTMLElement>(`[data-branch-scroll-key="${scrollKey}"]`);
		const toolbar = tree.querySelector<HTMLElement>(".logicTree__branchToolbar");
		if (!branch) return;

		const treeRect = tree.getBoundingClientRect();
		const branchRect = branch.getBoundingClientRect();
		const toolbarHeight = toolbar?.getBoundingClientRect().height ?? 0;
		const top = tree.scrollTop + branchRect.top - treeRect.top - toolbarHeight - 12;

		pendingBranchScrollRef.current = null;
		tree.scrollTo({top: Math.max(0, top), behavior: "smooth"});
	}, [
		selectedEvent?.branch.always,
		selectedEvent?.branch.if,
		selectedEvent?.branch.elifs?.length,
		selectedEvent?.branch.else,
	]);

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

	function addAlways() {
		pendingBranchScrollRef.current = "always";
		updateEvent((event) => {
			event.branch.always = conditionEffectGroup(eventId, "always");
		});
	}

	function addIf() {
		if (!selectedEvent) return;
		pendingBranchScrollRef.current = "if";
		updateEvent((event) => {
			event.branch.if = {
				condition: defaultCondition(),
				effect: conditionEffectGroup(idValue(event.id), "if"),
				delayTurns: 0,
				cancelIfConditionFails: true,
			};
		});
		onSelectionChange({kind: "condition", eventId: idValue(selectedEvent.id), branch: "if"});
	}

	function addElseIf() {
		if (!selectedEvent) return;
		const index = selectedEvent.branch.elifs?.length ?? 0;
		pendingBranchScrollRef.current = `elif-${index}`;
		updateEvent((event) => {
			(event.branch.elifs ??= []).push({
				condition: defaultCondition(),
				effect: conditionEffectGroup(idValue(event.id), `else-if-${index + 1}`),
				delayTurns: 0,
				cancelIfConditionFails: true,
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
		pendingBranchScrollRef.current = "else";
		updateEvent((event) => {
			event.branch.else = conditionEffectGroup(idValue(event.id), "else");
		});
	}

	async function requestBranchDelete(
		label: string,
		deleteBranch: () => void,
		options: {title?: string; message?: string; confirmLabel?: string} = {},
	) {
		const confirmed = popup
			? await popup.confirm({
					title: options.title ?? `Delete ${label.toLocaleLowerCase()} branch?`,
					message:
						options.message ??
						`Remove this branch from “${selectedEvent?.name || "this event"}”? Referenced effect groups will remain available.`,
					confirmLabel: options.confirmLabel ?? "Delete branch",
					danger: true,
				})
			: true;

		if (confirmed) deleteBranch();
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
	const eventColor = entityColorFor("event");
	const eventStyle = {
		"--logic-event-color-dark": eventColor.dark,
		"--logic-event-color-light": eventColor.light,
	} as CSSProperties;

	return (
		<div className="logicEditor" style={eventStyle}>
			<aside className="logicEventRail">
				<div className="logicEventRail__title">
					<span>
						<CalendarClock size={15} aria-hidden="true" />
						Events
					</span>
					<span className="logicEventRail__count">{events.length}</span>
				</div>
				<CenteredScrollSelector
					items={events}
					activeId={eventId}
					onActiveChange={selectEvent}
					getId={(event) => idValue(event.id)}
					renderLabel={(event) => (
						<span className="logicEventSelector__label">
							<span className="logicEventSelector__marker" aria-hidden="true" />
							<span>{event.name || "Unnamed event"}</span>
						</span>
					)}
					ariaLabel="Events"
					className="logicEventSelector"
				/>
				<button type="button" className="logicEventRail__add" onClick={addEvent}>
					<Plus size={15} aria-hidden="true" />
					New event
				</button>
			</aside>

			<div className="logicTree" ref={logicTreeRef}>
				<div className="logicTree__branchToolbar" role="toolbar" aria-label="Add a branch">
					<span className="logicTree__branchToolbarLabel">Add branch</span>
					<div className="logicTree__branchToolbarActions">
						{!selectedEvent.branch.always ? (
							<button type="button" onClick={addAlways}>
								<Plus size={15} aria-hidden="true" />
								<span>
									<strong>Always</strong>
									<small>Runs every time</small>
								</span>
							</button>
						) : null}
						{!selectedEvent.branch.if ? (
							<button type="button" onClick={addIf}>
								<Plus size={15} aria-hidden="true" />
								<span>
									<strong>If</strong>
									<small>When a condition passes</small>
								</span>
							</button>
						) : (
							<button type="button" onClick={addElseIf}>
								<Plus size={15} aria-hidden="true" />
								<span>
									<strong>Else if</strong>
									<small>Try another condition</small>
								</span>
							</button>
						)}
						{selectedEvent.branch.if && !selectedEvent.branch.else ? (
							<button type="button" onClick={addElse}>
								<Plus size={15} aria-hidden="true" />
								<span>
									<strong>Else</strong>
									<small>When no conditions pass</small>
								</span>
							</button>
						) : null}
					</div>
				</div>

				{selectedEvent.branch.always ? (
					<EventBranch
						scrollKey="always"
						label="Always"
						world={world}
						group={selectedEvent.branch.always}
						onSelectGroup={(effectId) => onSelectionChange({kind: "effect-group", eventId, effectId})}
						onAddEffect={() => addEffect("always")}
						onRemoveEffect={(index) => removeEffect("always", index)}
						onMoveEffect={(fromIndex, toIndex) => moveEffect("always", fromIndex, toIndex)}
						onDeleteBranch={() =>
							void requestBranchDelete("Always", () => updateEvent((event) => delete event.branch.always))
						}
					/>
				) : null}

				{selectedEvent.branch.if ? (
					<EventBranch
						scrollKey="if"
						label="If"
						world={world}
						group={selectedEvent.branch.if.effect}
						condition={selectedEvent.branch.if.condition}
						delayTurns={selectedEvent.branch.if.delayTurns}
						cancelIfConditionFails={selectedEvent.branch.if.cancelIfConditionFails}
						onSelectCondition={() => onSelectionChange({kind: "condition", eventId, branch: "if"})}
						onDelayEnabledChange={(enabled) =>
							updateEvent((event) => {
								if (!event.branch.if) return;
								event.branch.if.delayTurns = enabled ? 1 : 0;
								if (!enabled) event.branch.if.cancelIfConditionFails = true;
							})
						}
						onDelayTurnsChange={(turns) =>
							updateEvent((event) => {
								if (event.branch.if) event.branch.if.delayTurns = turns;
							})
						}
						onCancelIfConditionFailsChange={(cancel) =>
							updateEvent((event) => {
								if (event.branch.if) event.branch.if.cancelIfConditionFails = cancel;
							})
						}
						onSelectGroup={(effectId) => onSelectionChange({kind: "effect-group", eventId, effectId})}
						onAddEffect={() => addEffect("if")}
						onRemoveEffect={(index) => removeEffect("if", index)}
						onMoveEffect={(fromIndex, toIndex) => moveEffect("if", fromIndex, toIndex)}
						onDeleteBranch={() =>
							void requestBranchDelete(
								"If",
								() =>
									updateEvent((event) => {
										delete event.branch.if;
										delete event.branch.elifs;
										delete event.branch.else;
									}),
								{
									title: "Delete If and all dependent branches?",
									message: `Deleting If also deletes every Else if and Else branch from “${selectedEvent.name}”. Always will be kept, and referenced effect groups will remain available.`,
									confirmLabel: "Delete branches",
								},
							)
						}
					/>
				) : null}

				{selectedEvent.branch.elifs?.map((branch, index) => (
					<EventBranch
						key={index}
						scrollKey={`elif-${index}`}
						label="Else if"
						world={world}
						group={branch.effect}
						condition={branch.condition}
						delayTurns={branch.delayTurns}
						cancelIfConditionFails={branch.cancelIfConditionFails}
						onSelectCondition={() =>
							onSelectionChange({
								kind: "condition",
								eventId,
								branch: "elif",
								elifIndex: index,
							})
						}
						onDelayEnabledChange={(enabled) =>
							updateEvent((event) => {
								const target = event.branch.elifs?.[index];
								if (!target) return;
								target.delayTurns = enabled ? 1 : 0;
								if (!enabled) target.cancelIfConditionFails = true;
							})
						}
						onDelayTurnsChange={(turns) =>
							updateEvent((event) => {
								const target = event.branch.elifs?.[index];
								if (target) target.delayTurns = turns;
							})
						}
						onCancelIfConditionFailsChange={(cancel) =>
							updateEvent((event) => {
								const target = event.branch.elifs?.[index];
								if (target) target.cancelIfConditionFails = cancel;
							})
						}
						onSelectGroup={(effectId) => onSelectionChange({kind: "effect-group", eventId, effectId})}
						onAddEffect={() => addEffect("elif", index)}
						onRemoveEffect={(effectIndex) => removeEffect("elif", effectIndex, index)}
						onMoveEffect={(fromIndex, toIndex) => moveEffect("elif", fromIndex, toIndex, index)}
						onDeleteBranch={() =>
							void requestBranchDelete("Else if", () =>
								updateEvent((event) => {
									event.branch.elifs?.splice(index, 1);
								}),
							)
						}
					/>
				))}

				{selectedEvent.branch.else ? (
					<EventBranch
						scrollKey="else"
						label="Else"
						world={world}
						group={selectedEvent.branch.else}
						onSelectGroup={(effectId) => onSelectionChange({kind: "effect-group", eventId, effectId})}
						onAddEffect={() => addEffect("else")}
						onRemoveEffect={(index) => removeEffect("else", index)}
						onMoveEffect={(fromIndex, toIndex) => moveEffect("else", fromIndex, toIndex)}
						onDeleteBranch={() =>
							void requestBranchDelete("Else", () => updateEvent((event) => delete event.branch.else))
						}
					/>
				) : null}
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
	const popup = useOptionalPopup();

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

	async function requestDelete() {
		const confirmed = popup
			? await popup.confirm({
					title: "Delete event?",
					message: `Delete “${event!.name || idValue(event!.id)}” and all of its branches? This cannot be undone.`,
					confirmLabel: "Delete event",
					danger: true,
				})
			: true;

		if (confirmed) onDelete();
	}

	return (
		<div className="editorToolbar logicToolbar">
			<button type="button" className="logicToolbar__back" onClick={onBack} aria-label="Back to Logic">
				<ArrowLeft size={16} aria-hidden="true" />
			</button>
			<label className="logicToolbar__field logicToolbar__name">
				<span>Name</span>
				<input
					type="text"
					value={event.name}
					onChange={(change) => updateField("name", change.target.value)}
				/>
			</label>
			<div className="logicToolbar__settings">
				<label className="logicToolbar__toggle">
					<span>Enabled</span>
					<input
						type="checkbox"
						checked={event.enabled}
						onChange={(change) => updateField("enabled", change.target.checked)}
					/>
				</label>
				<label className="logicToolbar__toggle">
					<span>Run once</span>
					<input
						type="checkbox"
						checked={event.disposable}
						onChange={(change) => updateField("disposable", change.target.checked)}
					/>
				</label>
				<label className="logicToolbar__field logicToolbar__number">
					<span>Wait</span>
					<input
						type="number"
						min={0}
						value={event.wait}
						onChange={(change) => updateField("wait", Math.max(0, Number(change.target.value)))}
					/>
				</label>
				<label className="logicToolbar__field logicToolbar__number">
					<span>Priority</span>
					<input
						type="number"
						value={event.priority}
						onChange={(change) => updateField("priority", Number(change.target.value))}
					/>
				</label>
			</div>
			<button type="button" className="logicToolbar__delete" onClick={() => void requestDelete()}>
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
