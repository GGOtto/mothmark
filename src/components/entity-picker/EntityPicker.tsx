"use client";

import {
	Archive,
	Box,
	CalendarClock,
	Check,
	ChevronDown,
	Compass,
	FileText,
	GitBranch,
	MapPin,
	MessageCircle,
	Package,
	PanelTop,
	Plus,
	ScanSearch,
	ScrollText,
	Search,
	Shapes,
	Terminal,
	User,
	Waypoints,
	X,
	Zap,
	type LucideIcon,
} from "lucide-react";
import {
	type CSSProperties,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {createPortal} from "react-dom";
import {useOptionalPopup} from "@/components/popup/Popup";
import type {EntityType} from "@/types/editor/editorRegistryTypes";
import {idValue, toID, type ID, type WorldIdEntityType} from "@/utils/idUtils";
import {entityColorFor} from "./entityPickerColors";
import {searchEntityEntries} from "./entityPickerSearch";
import type {
	EntityPickerEntry,
	EntityPickerPresentation,
	EntityPickerSelection,
} from "./entityPickerTypes";
import "./EntityPicker.scss";

const ENTITY_ICONS: Partial<Record<EntityType, LucideIcon>> = {
	room: MapPin,
	connection: Waypoints,
	item: Package,
	npc: User,
	character: User,
	topic: MessageCircle,
	quest: ScrollText,
	command: Terminal,
	event: CalendarClock,
	effect: Zap,
	feature: Shapes,
	condition: GitBranch,
	container: Archive,
	surface: PanelTop,
	object: Box,
	direction: Compass,
};

const ENTITY_LABELS: Partial<Record<EntityType, string>> = {
	room: "Room",
	connection: "Connection",
	item: "Item",
	npc: "NPC",
	character: "Character",
	topic: "Topic",
	quest: "Quest",
	command: "Command",
	event: "Event",
	effect: "Effect",
	feature: "Feature",
	condition: "Condition",
	container: "Container",
	surface: "Surface",
	object: "Object",
	direction: "Direction",
};

function entityLabel(type: EntityType, plural = false) {
	const label = ENTITY_LABELS[type] ?? type;
	if (!plural) return label;
	if (label === "NPC") return "NPCs";
	if (label.endsWith("y")) return `${label.slice(0, -1)}ies`;
	return `${label}s`;
}

function entityStyle(type: EntityType) {
	const color = entityColorFor(type);
	return {
		"--entity-color-dark": color.dark,
		"--entity-color-light": color.light,
	} as CSSProperties;
}

function EntityIcon({type, size = 15}: {type: EntityType; size?: number}) {
	const Icon = ENTITY_ICONS[type] ?? FileText;
	return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

export type EntityPickerProps = {
	value?: ID;
	entries: EntityPickerEntry[];
	entityTypes: readonly EntityType[];
	onChange: (selection: EntityPickerSelection | undefined) => void;
	title?: string;
	placeholder?: string;
	searchPlaceholder?: string;
	presentation?: EntityPickerPresentation;
	searchable?: boolean;
	clearable?: boolean;
	allowCreate?: boolean;
	showDescriptions?: boolean;
	showTags?: boolean;
	showBadges?: boolean;
	showPreview?: boolean;
	resultLimit?: number;
	disabled?: boolean;
	readonly?: boolean;
	autoFocus?: boolean;
	invalid?: boolean;
	className?: string;
};

type PickerPanelProps = {
	entries: EntityPickerEntry[];
	entityTypes: readonly EntityType[];
	selectedId?: string;
	searchPlaceholder: string;
	searchable: boolean;
	allowCreate: boolean;
	showDescriptions: boolean;
	showTags: boolean;
	showBadges: boolean;
	resultLimit: number;
	onChoose: (entry: EntityPickerEntry) => void;
	onActiveEntryChange?: (entry: EntityPickerEntry | undefined) => void;
	onCreate?: (id: string) => void;
	onCancel?: () => void;
	onOpenFullBrowser?: () => void;
	autoFocus?: boolean;
};

function entryBreadcrumb(entry: EntityPickerEntry) {
	return entry.hierarchy.map((segment) => segment.label).join(" › ");
}

function browseGroup(entry: EntityPickerEntry, multipleTypes: boolean) {
	if (multipleTypes) return entityLabel(entry.entityType, true);
	return entry.hierarchy.at(-1)?.label ?? entityLabel(entry.entityType, true);
}

function groupMatches(
	matches: ReturnType<typeof searchEntityEntries>,
	hasQuery: boolean,
	multipleTypes: boolean,
) {
	if (hasQuery) return [{key: "search-results", label: "", matches}];

	const groups = new Map<string, typeof matches>();
	for (const match of matches) {
		const label = browseGroup(match.entry, multipleTypes);
		const key = `${multipleTypes ? match.entry.entityType : "group"}:${label}`;
		groups.set(key, [...(groups.get(key) ?? []), match]);
	}

	return [...groups.entries()].map(([key, groupedMatches]) => ({
		key,
		label: browseGroup(groupedMatches[0].entry, multipleTypes),
		matches: groupedMatches,
	}));
}

function EntityPreview({entry}: {entry: EntityPickerEntry}) {
	const context = entryBreadcrumb(entry) || entityLabel(entry.entityType);
	const facts = [
		...(entry.kind && !entry.facts?.some((fact) => fact.label === "Kind")
			? [{label: "Kind", value: entry.kind}]
			: []),
		...(entry.facts ?? []),
		...(entry.deprecated ? [{label: "Status", value: "Deprecated"}] : []),
		...(entry.disabled ? [{label: "Availability", value: "Unavailable"}] : []),
	];

	return (
		<div className="entityPickerPreview__content" style={entityStyle(entry.entityType)}>
			<div className="entityPickerPreview__heading">
				<span className="entityPickerPreview__icon">
					<EntityIcon type={entry.entityType} size={18} />
				</span>
				<div>
					<h3>{entry.label}</h3>
					<p>{context}</p>
				</div>
			</div>

			{entry.summary || entry.description ? (
				<section className="entityPickerPreview__section">
					<h4>Description</h4>
					<p>{entry.description ?? entry.summary}</p>
				</section>
			) : null}

			{entry.aliases.length > 0 ? (
				<section className="entityPickerPreview__section">
					<h4>Aliases</h4>
					<div className="entityPickerPreview__values">
						{entry.aliases.map((alias) => (
							<span key={alias}>{alias}</span>
						))}
					</div>
				</section>
			) : null}

			{entry.tags.length > 0 ? (
				<section className="entityPickerPreview__section">
					<h4>Tags</h4>
					<div className="entityPickerPreview__values">
						{entry.tags.map((tag) => (
							<span key={tag}>{tag}</span>
						))}
					</div>
				</section>
			) : null}

			{facts.length > 0 ? (
				<dl className="entityPickerPreview__facts">
					{facts.map((fact) => (
						<div key={`${fact.label}:${fact.value}`}>
							<dt>{fact.label}</dt>
							<dd>{fact.value}</dd>
						</div>
					))}
				</dl>
			) : null}

			{entry.relations?.map((relation) => (
				<section key={relation.label} className="entityPickerPreview__relation">
					<header>
						<h4>{relation.label}</h4>
						<span>{relation.items.length}</span>
					</header>
					<ul>
						{relation.items.map((item) => (
							<li key={`${item.entityType ?? "entity"}:${item.id}`}>
								<span
									className="entityPickerPreview__relationIcon"
									style={item.entityType ? entityStyle(item.entityType) : undefined}
								>
									<EntityIcon type={item.entityType ?? "object"} size={14} />
								</span>
								<span className="entityPickerPreview__relationText">
									<strong>{item.label}</strong>
									{item.detail ? <small>{item.detail}</small> : null}
								</span>
								<code>{item.id}</code>
							</li>
						))}
					</ul>
				</section>
			))}

			<div className="entityPickerPreview__identity">
				<span>ID</span>
				<code>{entry.ref.id}</code>
			</div>
		</div>
	);
}

function EntityPickerPanel({
	entries,
	entityTypes,
	selectedId,
	searchPlaceholder,
	searchable,
	allowCreate,
	showDescriptions,
	showTags,
	showBadges,
	resultLimit,
	onChoose,
	onActiveEntryChange,
	onCreate,
	onCancel,
	onOpenFullBrowser,
	autoFocus,
}: PickerPanelProps) {
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const listId = useId();
	const matches = useMemo(
		() => searchEntityEntries(entries, query, resultLimit),
		[entries, query, resultLimit],
	);
	const groups = useMemo(
		() => groupMatches(matches, Boolean(query.trim()), entityTypes.length > 1),
		[entityTypes.length, matches, query],
	);
	const displayedMatches = useMemo(() => groups.flatMap((group) => group.matches), [groups]);
	const exactId = entries.some(
		(entry) => entry.ref.id.toLocaleLowerCase() === query.trim().toLocaleLowerCase(),
	);
	const canCreate = allowCreate && entityTypes.length === 1 && query.trim().length > 0 && !exactId;

	useEffect(() => {
		if (autoFocus !== false) inputRef.current?.focus();
	}, [autoFocus]);

	useEffect(() => {
		onActiveEntryChange?.(displayedMatches[activeIndex]?.entry);
	}, [activeIndex, displayedMatches, onActiveEntryChange]);

	function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((index) => Math.min(index + 1, Math.max(displayedMatches.length - 1, 0)));
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((index) => Math.max(index - 1, 0));
		}
		if (event.key === "Enter") {
			event.preventDefault();
			const match = displayedMatches[activeIndex];
			if (match && !match.entry.disabled && !match.entry.deprecated) onChoose(match.entry);
			else if (canCreate) onCreate?.(query.trim());
		}
		if (event.key === "Escape") {
			event.preventDefault();
			onCancel?.();
		}
	}

	let renderedIndex = 0;
	return (
		<div className="entityPickerPanel">
			{searchable ? (
				<div className="entityPickerSearch">
					<Search size={15} aria-hidden="true" />
					<input
						ref={inputRef}
						type="text"
						role="searchbox"
						inputMode="search"
						value={query}
						placeholder={searchPlaceholder}
						aria-label="Search entities"
						aria-controls={listId}
						aria-activedescendant={displayedMatches[activeIndex] ? `${listId}-${activeIndex}` : undefined}
						onChange={(event) => {
							setQuery(event.target.value);
							setActiveIndex(0);
						}}
						onKeyDown={handleSearchKeyDown}
					/>
					<span className="entityPickerSearch__count">{matches.length}</span>
					{query ? (
						<button type="button" aria-label="Clear search" onClick={() => setQuery("")}>
							<X size={14} aria-hidden="true" />
						</button>
					) : null}
				</div>
			) : null}

			<div id={listId} className="entityPickerResults" role="listbox" aria-label="Entities">
				{groups.map((group) => (
					<section key={group.key} className="entityPickerGroup">
						{group.label ? (
							<div className="entityPickerGroup__header">
								<span>{group.label}</span>
								<span>{group.matches.length}</span>
							</div>
						) : null}
						{group.matches.map((match) => {
							const index = renderedIndex++;
							const {entry} = match;
							const breadcrumb = entryBreadcrumb(entry);
							const isSelected = selectedId === `${entry.ref.type}:${entry.ref.id}`;
							const isUnavailable = entry.disabled || entry.deprecated;
							return (
								<button
									id={`${listId}-${index}`}
									key={`${entry.ref.type}:${entry.parentId ?? ""}:${entry.ref.id}`}
									type="button"
									role="option"
									aria-selected={isSelected}
									disabled={isUnavailable}
									data-active={index === activeIndex || undefined}
									data-selected={isSelected || undefined}
									className="entityPickerResult"
									style={entityStyle(entry.entityType)}
									onMouseEnter={() => setActiveIndex(index)}
									onClick={() => onChoose(entry)}
								>
									<span className="entityPickerResult__icon">
										<EntityIcon type={entry.entityType} />
									</span>
									<span className="entityPickerResult__content">
										<span className="entityPickerResult__label">{entry.label}</span>
										{breadcrumb ? <span className="entityPickerResult__breadcrumb">{breadcrumb}</span> : null}
										{showDescriptions && (entry.summary || entry.description) ? (
											<span className="entityPickerResult__summary">{entry.summary ?? entry.description}</span>
										) : null}
										{showTags && entry.tags.length > 0 ? (
											<span className="entityPickerResult__tags">
												{entry.tags.slice(0, 2).map((tag) => (
													<span key={tag}>{tag}</span>
												))}
												{entry.tags.length > 2 ? <span>+{entry.tags.length - 2}</span> : null}
											</span>
										) : null}
									</span>
									<span className="entityPickerResult__meta">
										{showBadges ? (
											<span className="entityPickerResult__type">
												{entry.kind ?? entityLabel(entry.entityType)}
											</span>
										) : null}
										<Check className="entityPickerResult__check" size={15} aria-hidden="true" />
									</span>
								</button>
							);
						})}
					</section>
				))}

				{matches.length === 0 ? (
					<div className="entityPickerState">
						<strong>No matching entities</strong>
						<span>Try a name, ID, alias, tag, room, or layer.</span>
					</div>
				) : null}

				{canCreate ? (
					<button className="entityPickerCreate" type="button" onClick={() => onCreate?.(query.trim())}>
						<Plus size={15} aria-hidden="true" />
						<span>
							Use “{query.trim()}” as the {entityLabel(entityTypes[0]).toLocaleLowerCase()} ID
						</span>
					</button>
				) : null}
			</div>

			{onOpenFullBrowser ? (
				<div className="entityPickerPanel__footer">
					<button type="button" onClick={onOpenFullBrowser}>
						Open full browser…
					</button>
				</div>
			) : null}
		</div>
	);
}

function EntityPickerPopupContent({
	entries,
	entityTypes,
	selectedId,
	title,
	searchPlaceholder,
	searchable,
	allowCreate,
	showDescriptions,
	showTags,
	showBadges,
	resultLimit,
	onResolve,
	onCancel,
	onCreate,
}: Omit<PickerPanelProps, "onChoose" | "onActiveEntryChange"> & {
	title: string;
	onResolve: (entry: EntityPickerEntry) => void;
	onCancel: () => void;
}) {
	const [activeType, setActiveType] = useState<EntityType | "all">(
		entityTypes.length === 1 ? entityTypes[0] : "all",
	);
	const [candidate, setCandidate] = useState<EntityPickerEntry | undefined>(() =>
		entries.find((entry) => `${entry.ref.type}:${entry.ref.id}` === selectedId),
	);
	const visibleEntries =
		activeType === "all" ? entries : entries.filter((entry) => entry.entityType === activeType);

	return (
		<div className="entityPickerSurface entityPickerSurface--popup">
			<header className="entityPickerPopup__header">
				<div>
					<h2>{title}</h2>
					<p>Search names, IDs, aliases, tags, rooms, and layers.</p>
				</div>
				<button type="button" aria-label="Close entity browser" onClick={onCancel}>
					<X size={17} aria-hidden="true" />
				</button>
			</header>

			<div className="entityPickerExplorer" data-single-type={entityTypes.length === 1 || undefined}>
				{entityTypes.length > 1 ? (
					<nav className="entityPickerTypeRail" aria-label="Entity types">
						<button
							type="button"
							data-active={activeType === "all" || undefined}
							onClick={() => setActiveType("all")}
						>
							<ScanSearch size={15} aria-hidden="true" />
							<span>All entities</span>
						</button>
						{entityTypes.map((type) => (
							<button
								key={type}
								type="button"
								data-active={activeType === type || undefined}
								style={entityStyle(type)}
								onClick={() => setActiveType(type)}
							>
								<EntityIcon type={type} />
								<span>{entityLabel(type, true)}</span>
							</button>
						))}
					</nav>
				) : null}

				<EntityPickerPanel
					entries={visibleEntries}
					entityTypes={activeType === "all" ? entityTypes : [activeType]}
					selectedId={selectedId}
					searchPlaceholder={searchPlaceholder}
					searchable={searchable}
					allowCreate={allowCreate}
					showDescriptions={showDescriptions}
					showTags={showTags}
					showBadges={showBadges}
					resultLimit={resultLimit}
					onChoose={onResolve}
					onActiveEntryChange={setCandidate}
					onCreate={onCreate}
					onCancel={onCancel}
				/>

				<aside className="entityPickerPreview">
					{candidate ? (
						<EntityPreview entry={candidate} />
					) : (
						<div className="entityPickerState">
							<strong>Select an entity</strong>
							<span>Its context and description will appear here.</span>
						</div>
					)}
				</aside>
			</div>

			<footer className="entityPickerPopup__actions">
				<button
					className="entityPickerButton entityPickerButton--secondary"
					type="button"
					onClick={onCancel}
				>
					Cancel
				</button>
				<button
					className="entityPickerButton entityPickerButton--primary"
					type="button"
					disabled={!candidate}
					onClick={() => candidate && onResolve(candidate)}
				>
					Choose
				</button>
			</footer>
		</div>
	);
}

function usePopoverPosition(open: boolean, triggerRef: React.RefObject<HTMLButtonElement | null>) {
	const [position, setPosition] = useState<CSSProperties>({});

	useLayoutEffect(() => {
		if (!open) return;
		function updatePosition() {
			const trigger = triggerRef.current;
			if (!trigger) return;
			const rect = trigger.getBoundingClientRect();
			const viewportPadding = 12;
			const triggerGap = 6;
			const preferredHeight = 520;
			const width = Math.min(420, window.innerWidth - 24);
			const left = Math.min(
				Math.max(viewportPadding, rect.left),
				window.innerWidth - width - viewportPadding,
			);
			const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - triggerGap;
			const spaceAbove = rect.top - viewportPadding - triggerGap;
			const placeBelow = spaceBelow >= Math.min(300, preferredHeight) || spaceBelow >= spaceAbove;
			const availableHeight = Math.max(0, placeBelow ? spaceBelow : spaceAbove);
			setPosition({
				position: "fixed",
				width,
				left,
				maxHeight: Math.min(preferredHeight, availableHeight),
				top: placeBelow ? rect.bottom + triggerGap : undefined,
				bottom: placeBelow ? undefined : window.innerHeight - rect.top + triggerGap,
			});
		}
		updatePosition();
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);
		return () => {
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [open, triggerRef]);

	return position;
}

export function EntityPicker({
	value,
	entries,
	entityTypes,
	onChange,
	title,
	placeholder,
	searchPlaceholder,
	presentation = "auto",
	searchable = true,
	clearable = false,
	allowCreate = false,
	showDescriptions = true,
	showTags = true,
	showBadges = true,
	resultLimit = 100,
	disabled,
	readonly,
	autoFocus,
	invalid,
	className,
}: EntityPickerProps) {
	const popup = useOptionalPopup();
	const [popoverOpen, setPopoverOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);
	const popoverPosition = usePopoverPosition(popoverOpen, triggerRef);
	const selectedEntry = entries.find(
		(entry) => entry.ref.type === value?.type && entry.ref.id === idValue(value),
	);
	const primaryType = entityTypes[0] ?? selectedEntry?.entityType ?? "object";
	const selectedKey = selectedEntry
		? `${selectedEntry.ref.type}:${selectedEntry.ref.id}`
		: value
			? `${value.type}:${idValue(value)}`
			: undefined;
	const resolvedPresentation =
		presentation === "auto" ? (entityTypes.length > 1 ? "popup" : "popover") : presentation;
	const canEdit = !disabled && !readonly;
	const displayTitle = title ?? `Choose ${entityLabel(primaryType).toLocaleLowerCase()}`;

	function chooseEntry(entry: EntityPickerEntry) {
		onChange({ref: entry.ref, entry});
		setPopoverOpen(false);
	}

	function createdEntry(id: string) {
		const ref = toID(primaryType as WorldIdEntityType, id);
		return {
			ref,
			entityType: primaryType,
			label: id,
			aliases: [],
			tags: [],
			hierarchy: [],
		} satisfies EntityPickerEntry;
	}

	function createEntry(id: string) {
		chooseEntry(createdEntry(id));
	}

	async function openPopup() {
		if (!popup || !canEdit) return;
		setPopoverOpen(false);
		const result = await popup.open<EntityPickerEntry>(
			({resolve, cancel}) => (
				<EntityPickerPopupContent
					entries={entries}
					entityTypes={entityTypes}
					selectedId={selectedKey}
					title={displayTitle}
					searchPlaceholder={
						searchPlaceholder ?? `Search ${entityLabel(primaryType, true).toLocaleLowerCase()}…`
					}
					searchable={searchable}
					allowCreate={allowCreate}
					showDescriptions={showDescriptions}
					showTags={showTags}
					showBadges={showBadges}
					resultLimit={resultLimit}
					onCreate={(id) => resolve(createdEntry(id))}
					onResolve={resolve}
					onCancel={cancel}
				/>
			),
			{className: "popupSurfaceEntityPicker", closeOnBackdropClick: false},
		);
		if (result) chooseEntry(result);
	}

	useEffect(() => {
		if (!popoverOpen) return;
		function handlePointerDown(event: PointerEvent) {
			const target = event.target as Node;
			if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
			setPopoverOpen(false);
		}
		document.addEventListener("pointerdown", handlePointerDown);
		return () => document.removeEventListener("pointerdown", handlePointerDown);
	}, [popoverOpen]);

	function openPicker() {
		if (!canEdit) return;
		if (resolvedPresentation === "popup" && popup) void openPopup();
		else setPopoverOpen((open) => !open);
	}

	return (
		<div className={["entityPicker", className].filter(Boolean).join(" ")}>
			<div
				className="entityPicker__fieldRow"
				style={entityStyle(selectedEntry?.entityType ?? primaryType)}
				data-invalid={invalid || undefined}
			>
				<button
					ref={triggerRef}
					type="button"
					className="entityPickerTrigger"
					aria-label={displayTitle}
					aria-haspopup={resolvedPresentation === "popup" ? "dialog" : "listbox"}
					aria-expanded={popoverOpen}
					disabled={disabled || readonly}
					autoFocus={autoFocus}
					onClick={openPicker}
				>
					<span className="entityPickerTrigger__icon">
						<ScanSearch size={16} aria-hidden="true" />
					</span>
					<span className="entityPickerTrigger__content">
						<span className="entityPickerTrigger__label">
							{selectedEntry?.label ??
								(value && idValue(value) ? idValue(value) : (placeholder ?? displayTitle))}
						</span>
					</span>
					<ChevronDown className="entityPickerTrigger__chevron" size={15} aria-hidden="true" />
				</button>
				{clearable ? (
					<button
						className="entityPicker__clear"
						type="button"
						disabled={!canEdit || !value || !idValue(value)}
						aria-label={`Clear ${title ?? "entity"}`}
						onClick={() => onChange(undefined)}
					>
						<X size={14} aria-hidden="true" />
					</button>
				) : null}
			</div>

			{popoverOpen && typeof document !== "undefined"
				? createPortal(
						<div
							ref={popoverRef}
							className="entityPickerSurface entityPickerSurface--popover"
							style={{...popoverPosition, ...entityStyle(primaryType)}}
						>
							<div className="entityPickerPopover__header">
								<span className="entityPickerPopover__typeIcon">
									<EntityIcon type={primaryType} />
								</span>
								<strong>{displayTitle}</strong>
								<button
									type="button"
									aria-label="Close entity picker"
									onClick={() => setPopoverOpen(false)}
								>
									<X size={15} aria-hidden="true" />
								</button>
							</div>
							<EntityPickerPanel
								entries={entries}
								entityTypes={entityTypes}
								selectedId={selectedKey}
								searchPlaceholder={
									searchPlaceholder ?? `Search ${entityLabel(primaryType, true).toLocaleLowerCase()}…`
								}
								searchable={searchable}
								allowCreate={allowCreate}
								showDescriptions={showDescriptions}
								showTags={showTags}
								showBadges={showBadges}
								resultLimit={resultLimit}
								onChoose={chooseEntry}
								onCreate={createEntry}
								onCancel={() => setPopoverOpen(false)}
								onOpenFullBrowser={popup ? () => void openPopup() : undefined}
							/>
						</div>,
						document.body,
					)
				: null}
		</div>
	);
}
