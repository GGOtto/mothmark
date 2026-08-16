"use client";

import {ArrowLeft, CalendarClock, Plus, Settings, Trash2} from "lucide-react";
import {produce} from "immer";
import {type CSSProperties, useLayoutEffect, useRef, useState} from "react";
import {entityColorFor} from "@/components/entity-picker/entityPickerColors";
import {useOptionalPopup} from "@/components/popup/Popup";
import {PopupTemplate} from "@/components/popup/template/PopupTemplate";
import {EventSchema, type Event} from "@/schemas/world/eventSchema";
import {resolveEditorMetadata} from "@/components/universal-editor/utils/resolveEditorMetadata";
import {EffectGroupSchema, type EffectGroup} from "@/schemas/world/effectSchema";
import type {World} from "@/schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {idValue, toID} from "@/utils/idUtils";
import {CenteredScrollSelector} from "@/components/ui/CenteredScrollSelector";
import {EffectBranch} from "../shared/EffectBranch";
import {EventConditionEditorSchema} from "../shared/logicEditorSchemas";
import type {LogicSelection, OpenLogicLibraryRequest} from "../shared/logicTypes";
import "./EventEditor.scss";

export type EventBranchKey = "always" | "if" | "elif" | "else";

type EventEditorProps = {
	world: World;
	updateWorld: UpdateWorld;
	selectedEventId: string | null;
	onSelectedEventIdChange: (eventId: string) => void;
	selection: LogicSelection | null;
	onSelectionChange: (selection: LogicSelection | null) => void;
	onOpenLogicLibrary?: (request: OpenLogicLibraryRequest) => void;
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

function defaultCondition(): BranchCondition {
	return {type: "group", operation: "all", conditions: []};
}

function conditionEffectGroup(eventId: string, label: string) {
	return emptyEffectGroup(`${eventId}-${label}`, label);
}

function branchGroup(event: Event, branch: EventBranchKey, elifIndex?: number) {
	if (branch === "always") return event.branch.always;
	if (branch === "if") return event.branch.if?.effect;
	if (branch === "else") return event.branch.else;
	return event.branch.elifs?.[elifIndex ?? -1]?.effect;
}

function branchCondition(event: Event, branch: "if" | "elif", elifIndex?: number) {
	return branch === "if"
		? event.branch.if?.condition
		: event.branch.elifs?.[elifIndex ?? -1]?.condition;
}

export function EventEditor({
	world,
	updateWorld,
	selectedEventId,
	onSelectedEventIdChange,
	selection,
	onSelectionChange,
	onOpenLogicLibrary,
}: EventEditorProps) {
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

	function worldWithEventUpdate(recipe: (event: Event) => void) {
		return produce(world, (draft) => {
			const event = draft.events?.find(
				(candidate) => selectedEvent && idValue(candidate.id) === idValue(selectedEvent.id),
			);
			if (event) recipe(event as Event);
		});
	}

	function editCondition(
		branch: "if" | "elif",
		elifIndex?: number,
		value = selectedEvent ? branchCondition(selectedEvent, branch, elifIndex) : undefined,
		_onCancel?: () => void,
	) {
		if (!selectedEvent || !value) return;
		const currentReference =
			value.conditions.length === 1 && value.conditions[0]?.type === "condition-ref"
				? idValue(value.conditions[0].conditionId)
				: null;
		onOpenLogicLibrary?.({
			kind: "condition",
			returnSection: "events",
			selectedId: currentReference,
			returnLabel: `${selectedEvent.name || "Event"} · ${branch === "if" ? "If" : "Else if"} condition`,
			onCancel: _onCancel,
			draftEditor: currentReference
				? undefined
				: {
						schema: EventConditionEditorSchema,
						value,
						onDone: (draftValue) => {
							const condition = EventConditionEditorSchema.parse(draftValue);
							updateEvent((event) => {
								if (branch === "if" && event.branch.if) event.branch.if.condition = condition;
								else if (branch === "elif" && event.branch.elifs?.[elifIndex ?? -1]) {
									event.branch.elifs[elifIndex ?? -1].condition = condition;
								}
							});
						},
					},
			onDone: (conditionId) => {
				updateEvent((event) => {
					const condition = {
						type: "group" as const,
						operation: "all" as const,
						conditions: [{type: "condition-ref" as const, conditionId: toID("condition", conditionId)}],
					};
					if (branch === "if" && event.branch.if) event.branch.if.condition = condition;
					else if (branch === "elif" && event.branch.elifs?.[elifIndex ?? -1]) {
						event.branch.elifs[elifIndex ?? -1].condition = condition;
					}
				});
			},
		});
	}

	function editEffectGroup(effectId: string) {
		if (!selectedEvent) return;
		onOpenLogicLibrary?.({
			kind: "effect",
			returnSection: "events",
			selectedId: effectId,
			returnLabel: `${selectedEvent.name || "Event"} · Effect`,
			onDone: () => undefined,
		});
	}

	function addEffect(branch: EventBranchKey, elifIndex?: number) {
		if (!selectedEvent) return;
		const group = branchGroup(selectedEvent, branch, elifIndex);
		if (!group) return;
		onOpenLogicLibrary?.({
			kind: "effect",
			returnSection: "events",
			selectedId: null,
			returnLabel: `${selectedEvent.name || "Event"} · ${branch === "elif" ? "Else if" : branch} effects`,
			draftEditor: {
				schema: EffectGroupSchema,
				value: group,
				onDone: (draftValue) => {
					const nextGroup = EffectGroupSchema.parse(draftValue);
					updateEvent((event) => {
						if (branch === "always") event.branch.always = nextGroup;
						else if (branch === "if" && event.branch.if) event.branch.if.effect = nextGroup;
						else if (branch === "else") event.branch.else = nextGroup;
						else if (branch === "elif" && event.branch.elifs?.[elifIndex ?? -1]) {
							event.branch.elifs[elifIndex ?? -1].effect = nextGroup;
						}
					});
				},
			},
		});
	}

	function editInlineEffect(branch: EventBranchKey, index: number, elifIndex?: number) {
		if (!selectedEvent) return;
		const group = branchGroup(selectedEvent, branch, elifIndex);
		if (!group) return;
		onOpenLogicLibrary?.({
			kind: "effect",
			returnSection: "events",
			selectedId: null,
			returnLabel: `${selectedEvent.name || "Event"} · Edit effects`,
			draftEditor: {
				schema: EffectGroupSchema,
				value: group,
				onDone: (draftValue) => {
					const nextGroup = EffectGroupSchema.parse(draftValue);
					updateEvent((event) => {
						if (branch === "always") event.branch.always = nextGroup;
						else if (branch === "if" && event.branch.if) event.branch.if.effect = nextGroup;
						else if (branch === "else") event.branch.else = nextGroup;
						else if (branch === "elif" && event.branch.elifs?.[elifIndex ?? -1]) {
							event.branch.elifs[elifIndex ?? -1].effect = nextGroup;
						}
					});
				},
			},
			onDone: (effectId) => {
				updateEvent((event) => {
					const effects = branchGroup(event, branch, elifIndex)?.effects;
					if (effects?.[index])
						effects[index] = {type: "effect-ref", effectId: toID("effect", effectId)};
				});
			},
		});
	}

	function removeEffect(branch: EventBranchKey, index: number, elifIndex?: number) {
		updateEvent((event) => {
			branchGroup(event, branch, elifIndex)?.effects.splice(index, 1);
		});
		if (selection?.kind === "effect-group") onSelectionChange(null);
	}

	function moveEffect(
		branch: EventBranchKey,
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
		const condition = defaultCondition();
		pendingBranchScrollRef.current = "if";
		const editorWorld = worldWithEventUpdate((event) => {
			event.branch.if = {
				condition,
				effect: conditionEffectGroup(idValue(event.id), "if"),
				delayTurns: 0,
				cancelIfConditionFails: true,
			};
		});
		updateWorld(editorWorld);
		editCondition("if", undefined, condition, () =>
			updateEvent((event) => {
				delete event.branch.if;
			}),
		);
	}

	function addElseIf() {
		if (!selectedEvent) return;
		const index = selectedEvent.branch.elifs?.length ?? 0;
		const condition = defaultCondition();
		pendingBranchScrollRef.current = `elif-${index}`;
		const editorWorld = worldWithEventUpdate((event) => {
			(event.branch.elifs ??= []).push({
				condition,
				effect: conditionEffectGroup(idValue(event.id), `else-if-${index + 1}`),
				delayTurns: 0,
				cancelIfConditionFails: true,
			});
		});
		updateWorld(editorWorld);
		editCondition("elif", index, condition, () =>
			updateEvent((event) => {
				event.branch.elifs?.splice(index, 1);
			}),
		);
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
					<EffectBranch
						scrollKey="always"
						label="Always"
						world={world}
						group={selectedEvent.branch.always}
						onSelectGroup={editEffectGroup}
						onSelectInlineEffect={(index) => editInlineEffect("always", index)}
						onAddEffect={() => addEffect("always")}
						onRemoveEffect={(index) => removeEffect("always", index)}
						onMoveEffect={(fromIndex, toIndex) => moveEffect("always", fromIndex, toIndex)}
						onDeleteBranch={() =>
							void requestBranchDelete("Always", () => updateEvent((event) => delete event.branch.always))
						}
					/>
				) : null}

				{selectedEvent.branch.if ? (
					<EffectBranch
						scrollKey="if"
						label="If"
						world={world}
						group={selectedEvent.branch.if.effect}
						condition={selectedEvent.branch.if.condition}
						delayTurns={selectedEvent.branch.if.delayTurns}
						cancelIfConditionFails={selectedEvent.branch.if.cancelIfConditionFails}
						onSelectCondition={() => editCondition("if")}
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
						onSelectGroup={editEffectGroup}
						onSelectInlineEffect={(index) => editInlineEffect("if", index)}
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
					<EffectBranch
						key={index}
						scrollKey={`elif-${index}`}
						label="Else if"
						world={world}
						group={branch.effect}
						condition={branch.condition}
						delayTurns={branch.delayTurns}
						cancelIfConditionFails={branch.cancelIfConditionFails}
						onSelectCondition={() => editCondition("elif", index)}
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
						onSelectGroup={editEffectGroup}
						onSelectInlineEffect={(effectIndex) => editInlineEffect("elif", effectIndex, index)}
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
					<EffectBranch
						scrollKey="else"
						label="Else"
						world={world}
						group={selectedEvent.branch.else}
						onSelectGroup={editEffectGroup}
						onSelectInlineEffect={(index) => editInlineEffect("else", index)}
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

export function EventToolbar({
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

	async function openSettings() {
		if (!popup) return;
		const nextEvent = await popup.open<Event>(
			({resolve, cancel}) => <EventSettingsDialog event={event!} onCancel={cancel} onSave={resolve} />,
			{
				ariaLabel: "Edit event settings",
				closeOnBackdropClick: false,
				className: "popupSurfaceLogicSettings",
			},
		);
		if (!nextEvent) return;
		updateWorld((draft) => {
			const index = draft.events?.findIndex(
				(candidate) => idValue(candidate.id) === idValue(nextEvent.id),
			);
			if (index != null && index >= 0 && draft.events) draft.events[index] = nextEvent;
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
			<div className="logicToolbar__identity">
				<p>{event.name || "Unnamed event"}</p>
				<span>{event.enabled ? "Enabled" : "Disabled"}</span>
			</div>
			<button
				type="button"
				className="commandToolbar__scope"
				onClick={() => void openSettings()}
				aria-label="Edit event"
			>
				<Settings size={14} aria-hidden="true" />
				<span>Edit event</span>
			</button>
			<button
				type="button"
				className="logicToolbar__delete"
				onClick={() => void requestDelete()}
				aria-label="Delete event"
			>
				<Trash2 size={15} aria-hidden="true" />
				<span>Delete</span>
			</button>
		</div>
	);
}

function EventSettingsDialog({
	event,
	onCancel,
	onSave,
}: {
	event: Event;
	onCancel: () => void;
	onSave: (event: Event) => void;
}) {
	const [draft, setDraft] = useState<Event>(() => produce(event, () => undefined));
	const fields = Object.entries(EventSchema.shape).filter(([, schema]) => {
		return resolveEditorMetadata(schema).type !== "hidden";
	});

	function updateField(field: string, value: string | number | boolean) {
		setDraft((current) => ({...current, [field]: value}));
	}

	return (
		<PopupTemplate
			title="Event settings"
			message="Control when this event can run. Branches and their logic stay in the event workspace."
			actions={
				<>
					<button type="button" className="popupButton popupButtonSecondary" onClick={onCancel}>
						Cancel
					</button>
					<button type="button" className="popupButton popupButtonPrimary" onClick={() => onSave(draft)}>
						Save
					</button>
				</>
			}
		>
			<div className="logicSettingsForm logicSettingsForm--schema">
				{fields.map(([field, schema]) => {
					const metadata = resolveEditorMetadata(schema);
					const value = draft[field as keyof Event];
					const title = metadata?.title ?? field;
					if (typeof value === "boolean") {
						return (
							<label className="logicSettingsForm__toggle" key={field}>
								<input
									type="checkbox"
									aria-label={title}
									checked={value}
									onChange={(change) => updateField(field, change.target.checked)}
								/>
								<span>{title}</span>
							</label>
						);
					}
					return (
						<label key={field}>
							<span>{title}</span>
							<input
								aria-label={title}
								type={typeof value === "number" ? "number" : "text"}
								min={field === "wait" ? 0 : undefined}
								value={String(value)}
								onChange={(change) =>
									updateField(
										field,
										typeof value === "number"
											? field === "wait"
												? Math.max(0, Number(change.target.value))
												: Number(change.target.value)
											: change.target.value,
									)
								}
							/>
							{metadata?.description ? <small>{metadata.description}</small> : null}
						</label>
					);
				})}
			</div>
		</PopupTemplate>
	);
}
