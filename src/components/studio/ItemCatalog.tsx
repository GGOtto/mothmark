import {useEffect, useMemo, useRef, useState} from "react";
import {LayoutGrid, ListOrdered, Plus, Rows3, Search, Shapes} from "lucide-react";
import {readOptionalJson} from "@/auth/apiResponse";
import {readBrowserCsrfToken} from "@/auth/browserCsrf";
import {ItemIcon, resolveItemIcon} from "@/itemIcons";
import type {Item, World} from "@/schemas/world/worldSchema";
import {ItemSchema} from "@/schemas/world/itemSchema";
import {
	DEFAULT_EDITOR_PREFERENCES,
	EditorPreferencesResponseSchema,
	type EditorPreferences,
	type ItemActivity,
	type ItemListSort,
	type ItemListView,
} from "@/editor/editorPreferences";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {addItemDraft} from "@/app/editor/utils/worldDraftUtils";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {generateUniqueId, idValue} from "@/utils/idUtils";

type ItemCatalogProps = {
	world: World;
	worldId: string | null;
	updateWorld: UpdateWorld;
	selectedItemId: string | null;
	onSelectItem: (itemId: string) => void;
};

type LocationFilter = "all" | "nested" | "unplaced" | `room:${string}`;

const PREFERENCES_STORAGE_KEY = "mothmark-editor-item-library";

const VIEW_OPTIONS: readonly {
	value: ItemListView;
	label: string;
	Icon: typeof LayoutGrid;
}[] = [
	{value: "cards", label: "Cards", Icon: LayoutGrid},
	{value: "rows", label: "Rows", Icon: Rows3},
	{value: "marks", label: "Marks", Icon: Shapes},
	{value: "index", label: "Index", Icon: ListOrdered},
];

const SORT_OPTIONS: readonly {value: ItemListSort; label: string}[] = [
	{value: "updated-desc", label: "Recently updated"},
	{value: "updated-asc", label: "Least recently updated"},
	{value: "name-asc", label: "Name A–Z"},
	{value: "name-desc", label: "Name Z–A"},
	{value: "created-desc", label: "Recently created"},
	{value: "place-asc", label: "Starting place"},
];

function startingLocationLabel(item: Item, world: World) {
	const location = item.initialState.location;
	if (location.type === "room") {
		return world.rooms.find((room) => idValue(room.id) === idValue(location.roomId))?.name ?? "Room";
	}
	if (location.type === "item") {
		const parent = world.items.find(
			(candidate) => idValue(candidate.id) === idValue(location.itemId),
		);
		return `${location.placement === "inside" ? "Inside" : "On"} ${parent?.name ?? "item"}`;
	}
	return location.type === "inventory" ? "Player inventory" : "Unplaced";
}

function startingLocationFilter(item: Item): LocationFilter {
	const location = item.initialState.location;
	if (location.type === "room") return `room:${idValue(location.roomId)}`;
	if (location.type === "item" || location.type === "inventory") return "nested";
	return "unplaced";
}

function behaviorLabel(item: Item) {
	if (!item.behaviors.length) return "Fixed item";
	return item.behaviors
		.map((behavior) => `${behavior.type.charAt(0).toLocaleUpperCase()}${behavior.type.slice(1)}`)
		.join(" · ");
}

function relativeTime(isoDate?: string) {
	if (!isoDate) return "Update time unavailable";
	const elapsedSeconds = Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 1_000));
	if (elapsedSeconds < 60) return "Just now";
	const minutes = Math.floor(elapsedSeconds / 60);
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} hr ago`;
	const days = Math.floor(hours / 24);
	if (days === 1) return "Yesterday";
	if (days < 14) return `${days} days ago`;
	const weeks = Math.floor(days / 7);
	if (weeks < 9) return `${weeks} weeks ago`;
	const months = Math.floor(days / 30);
	return `${months} months ago`;
}

function readStoredPreferences(): EditorPreferences {
	if (typeof window === "undefined") return DEFAULT_EDITOR_PREFERENCES;
	try {
		const value = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
		if (!value) return DEFAULT_EDITOR_PREFERENCES;
		const parsed = EditorPreferencesResponseSchema.shape.data.shape.preferences.safeParse(
			JSON.parse(value),
		);
		return parsed.success ? parsed.data : DEFAULT_EDITOR_PREFERENCES;
	} catch {
		return DEFAULT_EDITOR_PREFERENCES;
	}
}

function responseMessage(body: unknown, fallback: string) {
	if (!body || typeof body !== "object") return fallback;
	const error = (body as {error?: unknown}).error;
	if (!error || typeof error !== "object") return fallback;
	const message = (error as {message?: unknown}).message;
	return typeof message === "string" ? message : fallback;
}

async function loadPreferences(worldId: string, signal: AbortSignal) {
	const response = await fetch(`/api/editor/preferences?worldId=${encodeURIComponent(worldId)}`, {
		signal,
	});
	const body = await readOptionalJson<unknown>(response);
	if (!response.ok)
		throw new Error(responseMessage(body, "The item library preferences could not be loaded."));
	if (body === undefined) return undefined;
	return EditorPreferencesResponseSchema.parse(body).data;
}

async function savePreferences(preferences: EditorPreferences) {
	const csrfToken = readBrowserCsrfToken();
	if (!csrfToken) throw new Error("The editor security token is missing.");
	const response = await fetch("/api/editor/preferences", {
		method: "PATCH",
		headers: {"content-type": "application/json", "x-csrf-token": csrfToken},
		body: JSON.stringify(preferences),
	});
	const body = await readOptionalJson<unknown>(response);
	if (!response.ok)
		throw new Error(responseMessage(body, "The item library preferences could not be saved."));
	if (body !== undefined) EditorPreferencesResponseSchema.parse(body);
}

function newestActivity(
	current: Record<string, ItemActivity>,
	incoming: Record<string, ItemActivity>,
) {
	const merged = {...incoming};
	for (const [itemId, activity] of Object.entries(current)) {
		const other = merged[itemId];
		if (!other || new Date(activity.updatedAt) > new Date(other.updatedAt)) merged[itemId] = activity;
	}
	return merged;
}

export function ItemCatalog({
	world,
	worldId,
	updateWorld,
	selectedItemId,
	onSelectItem,
}: ItemCatalogProps) {
	const [query, setQuery] = useState("");
	const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
	const [preferences, setPreferences] = useState<EditorPreferences>(DEFAULT_EDITOR_PREFERENCES);
	const [itemActivity, setItemActivity] = useState<Record<string, ItemActivity>>({});
	const [preferenceProblem, setPreferenceProblem] = useState<string | null>(null);
	const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
	const itemSnapshotsRef = useRef<Map<string, string> | null>(null);

	useEffect(() => {
		const stored = readStoredPreferences();
		queueMicrotask(() => setPreferences(stored));
	}, []);

	useEffect(() => {
		if (!worldId) return;
		const controller = new AbortController();
		void loadPreferences(worldId, controller.signal)
			.then((loaded) => {
				if (!loaded) return;
				setPreferences(loaded.preferences);
				setItemActivity((current) => newestActivity(current, loaded.itemActivity));
				window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(loaded.preferences));
				setPreferenceProblem(null);
			})
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				setPreferenceProblem(error instanceof Error ? error.message : "Preferences unavailable.");
			});
		return () => controller.abort();
	}, [worldId]);

	useEffect(() => {
		const nextSnapshots = new Map(
			world.items.map((item) => [idValue(item.id), JSON.stringify(item)]),
		);
		const previous = itemSnapshotsRef.current;
		itemSnapshotsRef.current = nextSnapshots;
		if (!previous) return;
		const now = new Date().toISOString();
		setItemActivity((current) => {
			const next = {...current};
			for (const item of world.items) {
				const itemId = idValue(item.id);
				const oldSnapshot = previous.get(itemId);
				if (oldSnapshot === undefined) next[itemId] = {createdAt: now, updatedAt: now};
				else if (oldSnapshot !== nextSnapshots.get(itemId)) {
					next[itemId] = {createdAt: next[itemId]?.createdAt ?? now, updatedAt: now};
				}
			}
			for (const itemId of Object.keys(next)) {
				if (!nextSnapshots.has(itemId)) delete next[itemId];
			}
			return next;
		});
	}, [world.items]);

	function changePreferences(next: EditorPreferences) {
		setPreferences(next);
		window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next));
		setPreferenceProblem(null);
		saveQueueRef.current = saveQueueRef.current
			.catch(() => undefined)
			.then(() => savePreferences(next))
			.catch((error: unknown) => {
				setPreferenceProblem(
					error instanceof Error ? error.message : "Preferences could not be saved.",
				);
			});
	}

	const records = useMemo(() => {
		const normalized = query.trim().toLocaleLowerCase();
		return world.items
			.filter((item) => {
				const matchesQuery =
					!normalized ||
					[item.name, idValue(item.id), ...item.aliases, ...item.tags]
						.join(" ")
						.toLocaleLowerCase()
						.includes(normalized);
				const matchesLocation =
					locationFilter === "all" || startingLocationFilter(item) === locationFilter;
				return matchesQuery && matchesLocation;
			})
			.map((item) => ({
				item,
				activity: itemActivity[idValue(item.id)],
				location: startingLocationLabel(item, world),
			}))
			.sort((left, right) => {
				const name = left.item.name.localeCompare(right.item.name, undefined, {sensitivity: "base"});
				if (preferences.itemListSort === "name-asc") return name;
				if (preferences.itemListSort === "name-desc") return -name;
				if (preferences.itemListSort === "place-asc") {
					return left.location.localeCompare(right.location, undefined, {sensitivity: "base"}) || name;
				}
				const field = preferences.itemListSort === "created-desc" ? "createdAt" : "updatedAt";
				const leftTime = left.activity ? new Date(left.activity[field]).getTime() : 0;
				const rightTime = right.activity ? new Date(right.activity[field]).getTime() : 0;
				const direction = preferences.itemListSort === "updated-asc" ? 1 : -1;
				return direction * (leftTime - rightTime) || name;
			});
	}, [itemActivity, locationFilter, preferences.itemListSort, query, world]);

	function addItem() {
		const nextId = generateUniqueId("item", world.items);
		const nextItem = createDefaultFieldObject(ItemSchema);
		nextItem.id = nextId;
		nextItem.name = "New item";
		nextItem.initialState.location = world.rooms[0]
			? {type: "room", roomId: world.rooms[0].id}
			: {type: "hidden"};
		updateWorld((draft) => void addItemDraft(draft, nextItem));
		onSelectItem(idValue(nextId));
	}

	const countLabel =
		records.length === world.items.length
			? `${records.length} ${records.length === 1 ? "object" : "objects"}`
			: `${records.length} of ${world.items.length} objects`;
	const selectedSortLabel =
		SORT_OPTIONS.find((option) => option.value === preferences.itemListSort)?.label ?? "Sorted";

	return (
		<div className="itemCatalog">
			<header className="itemCatalogHeader">
				<div className="itemCatalogHeading">
					<div>
						<h1>Items</h1>
						<span className="itemCatalogCount" aria-live="polite">
							{countLabel}
						</span>
					</div>
					<button type="button" className="itemCatalogAdd" onClick={addItem}>
						<Plus size={16} aria-hidden="true" /> <span>Add item</span>
					</button>
				</div>

				<div className="itemCatalogToolbar">
					<label className="itemCatalogSearch">
						<Search size={15} aria-hidden="true" />
						<span className="srOnly">Search items</span>
						<input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder="Search names, aliases, and tags"
						/>
					</label>

					<label className="itemCatalogSelectLabel">
						<span className="srOnly">Starting place</span>
						<select
							value={locationFilter}
							onChange={(event) => setLocationFilter(event.target.value as LocationFilter)}
						>
							<option value="all">Everywhere</option>
							{world.rooms.map((room) => (
								<option key={idValue(room.id)} value={`room:${idValue(room.id)}`}>
									{room.name}
								</option>
							))}
							<option value="nested">Nested and carried</option>
							<option value="unplaced">Unplaced</option>
						</select>
					</label>

					<label className="itemCatalogSelectLabel">
						<span className="srOnly">Sort items</span>
						<select
							value={preferences.itemListSort}
							onChange={(event) =>
								changePreferences({...preferences, itemListSort: event.target.value as ItemListSort})
							}
						>
							{SORT_OPTIONS.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>

					<div className="itemCatalogViewSwitcher" aria-label="Item view">
						{VIEW_OPTIONS.map(({value, label, Icon}) => (
							<button
								type="button"
								key={value}
								aria-label={label}
								aria-pressed={preferences.itemListView === value}
								onClick={() => changePreferences({...preferences, itemListView: value})}
							>
								<Icon size={14} aria-hidden="true" /> <span>{label}</span>
							</button>
						))}
					</div>
				</div>
				{preferenceProblem ? (
					<p className="itemCatalogPreferenceProblem" role="status">
						{preferenceProblem}
					</p>
				) : null}
			</header>

			<div className="itemCatalogBody">
				<div className="itemCatalogStatus">
					<span>
						{VIEW_OPTIONS.find((option) => option.value === preferences.itemListView)?.label} ·{" "}
						{selectedSortLabel}
					</span>
					<span>Category marks</span>
				</div>
				{preferences.itemListView === "rows" ? (
					<div className="itemCatalogRowHeader" aria-hidden="true">
						<span /> <span>Item</span> <span>Starting place</span> <span>Behavior</span> <span>Tags</span>{" "}
						<span>Updated</span>
					</div>
				) : null}
				<ol className="itemCatalogResults" data-view={preferences.itemListView}>
					{records.map(({item, activity, location}) => {
						const itemId = idValue(item.id);
						const behavior = behaviorLabel(item);
						const tags = item.tags.length ? item.tags.join(", ") : "No tags";
						const updated = relativeTime(activity?.updatedAt);
						const category = resolveItemIcon(item).category;
						const iconSize =
							preferences.itemListView === "cards" || preferences.itemListView === "marks"
								? 128
								: preferences.itemListView === "rows"
									? 64
									: 32;
						return (
							<li key={itemId}>
								<button
									type="button"
									className="itemCatalogItem"
									aria-pressed={selectedItemId === itemId}
									aria-label={`${item.name}. ${location}. ${behavior}. Tags: ${tags}. Updated ${updated}.`}
									onClick={() => onSelectItem(itemId)}
								>
									<span className="itemCatalogMark" data-code={category.slice(0, 2).toLocaleUpperCase()}>
										<ItemIcon category={category} size={iconSize} />
									</span>
									<span className="itemCatalogCopy">
										<strong className="itemCatalogName">{item.name}</strong>
										<span className="itemCatalogPlace">{location}</span>
									</span>
									<span className="itemCatalogDescription">
										{item.examine.text || "No examine text yet."}
									</span>
									<span className="itemCatalogBehavior">{behavior}</span>
									{item.tags.length ? (
										<ul className="itemCatalogTags" aria-label={`Tags for ${item.name}`}>
											{item.tags.map((tag, index) => (
												<li key={`${tag}-${index}`}>#{tag}</li>
											))}
										</ul>
									) : (
										<span className="itemCatalogTags itemCatalogTagsEmpty">No tags</span>
									)}
									<span className="itemCatalogMeta">
										<span className="itemCatalogMetaBehavior">{behavior}</span>
										<span className="itemCatalogUpdated">{updated}</span>
										<span className="itemCatalogOpen">Open ↗</span>
									</span>
								</button>
							</li>
						);
					})}
				</ol>
				{records.length === 0 ? (
					<p className="itemCatalogEmpty">No items match these filters.</p>
				) : null}
			</div>
		</div>
	);
}
