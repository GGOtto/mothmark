"use client";

import {ArrowLeft, ExternalLink, Play, Trash2} from "lucide-react";
import {produce, type Draft} from "immer";
import {useMemo, useState, type KeyboardEvent} from "react";
import {replaceItemDraft} from "@/app/editor/utils/worldDraftUtils";
import type {OpenLogicLibraryRequest} from "@/components/logic/shared";
import {useOptionalPopup} from "@/components/popup/Popup";
import {ItemIcon, resolveItemIcon} from "@/itemIcons";
import type {Item, ItemBehavior} from "@/schemas/world/itemSchema";
import type {World} from "@/schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {
	compareIds,
	deleteWorldEntity,
	idValue,
	isID,
	toID,
	updateWorldEntityId,
} from "@/utils/idUtils";
import {
	ItemBehaviorsPanel,
	ItemDetailsPanel,
	ItemPlacementPanel,
	type ItemAdvancedEditOptions,
} from "./ItemWorkspaceForm";
import "./ItemWorkspace.scss";

type ItemWorkspaceProps = {
	item: Item;
	world: World;
	updateWorld: UpdateWorld;
	onBack: () => void;
	onItemIdChange: (itemId: string) => void;
	onItemDeleted: () => void;
	onOpenCommand: (commandId: string) => void;
	onOpenLogicLibrary: (request: OpenLogicLibraryRequest) => void;
	onOpenPlay: () => void;
};

type ItemWorkspaceTab = "details" | "behaviors" | "placement" | "commands";

const ITEM_WORKSPACE_TABS: ReadonlyArray<{
	id: ItemWorkspaceTab;
	label: string;
	shortLabel?: string;
}> = [
	{id: "details", label: "Details"},
	{id: "behaviors", label: "Behavior"},
	{id: "placement", label: "Placement", shortLabel: "Place"},
	{id: "commands", label: "Commands"},
];

const BEHAVIOR_LABELS: Record<ItemBehavior["type"], string> = {
	takeable: "Takeable",
	container: "Container",
	surface: "Surface",
	openable: "Openable",
	lockable: "Lockable",
	door: "Door",
	usable: "Usable",
};

function compactLocationLabel(item: Item, world: World): string {
	const location = item.initialState.location;
	if (location.type === "inventory") return "Player inventory";
	if (location.type === "destroyed") return "Absent";
	if (location.type === "hidden") {
		const room = location.roomId
			? world.rooms.find((candidate) => compareIds(candidate.id, location.roomId!))
			: null;
		return room ? `Hidden in ${room.name}` : "Hidden";
	}
	if (location.type === "room") {
		return world.rooms.find((candidate) => compareIds(candidate.id, location.roomId))?.name ?? "Room";
	}

	const parent = world.items.find((candidate) => compareIds(candidate.id, location.itemId));
	return parent
		? `${location.placement === "inside" ? "Inside" : "On"} ${parent.name}`
		: "Contained item";
}

function behaviorSummary(item: Item): string {
	if (!item.behaviors.length) return "Fixed";
	const labels = item.behaviors.map((behavior) => BEHAVIOR_LABELS[behavior.type]);
	return labels.length <= 2
		? labels.join(" · ")
		: `${labels.slice(0, 2).join(" · ")} · +${labels.length - 2}`;
}

function valueReferencesItem(value: unknown, itemId: string, seen = new Set<object>()): boolean {
	if (!value || typeof value !== "object") return false;
	if (seen.has(value)) return false;
	seen.add(value);
	if (isID(value)) return value.type === "item" && idValue(value) === itemId;
	if (Array.isArray(value)) return value.some((child) => valueReferencesItem(child, itemId, seen));
	return Object.values(value).some((child) => valueReferencesItem(child, itemId, seen));
}

export function ItemWorkspace({
	item,
	world,
	updateWorld,
	onBack,
	onItemIdChange,
	onItemDeleted,
	onOpenCommand,
	onOpenLogicLibrary,
	onOpenPlay,
}: ItemWorkspaceProps) {
	const popup = useOptionalPopup();
	const [activeTab, setActiveTab] = useState<ItemWorkspaceTab>("details");
	const itemId = idValue(item.id);
	const category = resolveItemIcon(item).category;
	const duplicateItemId =
		world.items.filter((candidate) => compareIds(candidate.id, item.id)).length > 1;
	const attachedCommands = useMemo(
		() => world.commands.filter((command) => valueReferencesItem(command, itemId)),
		[itemId, world.commands],
	);

	function handleItemChange(updatedItem: Item) {
		const updatedId = idValue(updatedItem.id);
		if (updatedId !== itemId) {
			const worldWithChanges = produce(world, (draft) => {
				replaceItemDraft(draft, item.id, {...updatedItem, id: item.id});
			});
			const renamedWorld = updateWorldEntityId(
				worldWithChanges,
				toID("item", item.id),
				updatedItem.id,
			);
			updateWorld(renamedWorld);
			if (renamedWorld !== worldWithChanges) onItemIdChange(updatedId);
			return;
		}

		updateWorld((draft) => {
			replaceItemDraft(draft, item.id, updatedItem);
		});
	}

	function updateItem(recipe: (draft: Draft<Item>) => void) {
		handleItemChange(produce(item, recipe));
	}

	function editAdvanced(options: ItemAdvancedEditOptions) {
		onOpenLogicLibrary({
			kind: options.kind,
			returnSection: "items",
			selectedId: null,
			returnLabel: options.title,
			draftEditor: {
				schema: options.schema,
				value: options.value,
				onDone: options.onDone,
			},
		});
	}

	async function deleteItem() {
		const confirmed = popup
			? await popup.confirm({
					title: `Delete ${item.name || "this item"}?`,
					message:
						"This removes the item and clears references to it from rooms, commands, and other authored logic.",
					confirmLabel: "Delete item",
					danger: true,
				})
			: globalThis.confirm(`Delete ${item.name || "this item"}?`);
		if (!confirmed) return;

		const nextWorld = deleteWorldEntity(world, item.id);
		if (nextWorld === world) return;
		updateWorld(nextWorld);
		onItemDeleted();
	}

	function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, tab: ItemWorkspaceTab) {
		const currentIndex = ITEM_WORKSPACE_TABS.findIndex((candidate) => candidate.id === tab);
		let nextIndex = currentIndex;
		if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % ITEM_WORKSPACE_TABS.length;
		else if (event.key === "ArrowLeft") {
			nextIndex = (currentIndex - 1 + ITEM_WORKSPACE_TABS.length) % ITEM_WORKSPACE_TABS.length;
		} else if (event.key === "Home") nextIndex = 0;
		else if (event.key === "End") nextIndex = ITEM_WORKSPACE_TABS.length - 1;
		else return;

		event.preventDefault();
		const nextTab = ITEM_WORKSPACE_TABS[nextIndex]!;
		setActiveTab(nextTab.id);
		document.getElementById(`item-workspace-tab-${nextTab.id}`)?.focus();
	}

	return (
		<article className="itemWorkspace" aria-labelledby="item-workspace-title">
			<header className="itemWorkspaceHeader">
				<div className="itemWorkspaceContextBar">
					<button
						type="button"
						className="itemWorkspaceBack"
						aria-label="Back to items"
						title="Back to items"
						onClick={onBack}
					>
						<ArrowLeft size={18} aria-hidden="true" />
					</button>
					<div className="itemWorkspaceMark" aria-hidden="true">
						<ItemIcon category={category} size={32} />
					</div>
					<div className="itemWorkspaceHeading">
						<h1 id="item-workspace-title">{item.name || "Unnamed item"}</h1>
						<div className="itemWorkspaceMeta">
							<span>{compactLocationLabel(item, world)}</span>
							<span>{behaviorSummary(item)}</span>
						</div>
					</div>
					<button type="button" className="itemWorkspacePlay" onClick={onOpenPlay}>
						<Play size={14} fill="currentColor" aria-hidden="true" />
						Play
					</button>
					<button type="button" className="itemWorkspaceDelete" onClick={() => void deleteItem()}>
						<Trash2 size={14} aria-hidden="true" />
						Delete
					</button>
				</div>
				{duplicateItemId ? (
					<p className="itemWorkspaceWarning" role="status">
						This item is already using the same internal identifier.
					</p>
				) : null}
				<div className="itemWorkspaceTabs" role="tablist" aria-label="Item editor sections">
					{ITEM_WORKSPACE_TABS.map((tab) => (
						<button
							key={tab.id}
							type="button"
							role="tab"
							id={`item-workspace-tab-${tab.id}`}
							aria-controls={`item-workspace-panel-${tab.id}`}
							aria-label={tab.label}
							aria-selected={activeTab === tab.id}
							tabIndex={activeTab === tab.id ? 0 : -1}
							onClick={() => setActiveTab(tab.id)}
							onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
						>
							<span className="itemWorkspaceTabLabel">{tab.label}</span>
							{tab.shortLabel ? (
								<span className="itemWorkspaceTabShortLabel" aria-hidden="true">
									{tab.shortLabel}
								</span>
							) : null}
						</button>
					))}
				</div>
			</header>

			<div className="itemWorkspaceBody">
				<div
					className="itemWorkspaceTabPanel"
					role="tabpanel"
					id={`item-workspace-panel-${activeTab}`}
					aria-labelledby={`item-workspace-tab-${activeTab}`}
				>
					{activeTab === "details" ? (
						<ItemDetailsPanel
							item={item}
							world={world}
							onUpdate={updateItem}
							onEditAdvanced={editAdvanced}
						/>
					) : activeTab === "behaviors" ? (
						<ItemBehaviorsPanel
							item={item}
							world={world}
							onUpdate={updateItem}
							onEditAdvanced={editAdvanced}
						/>
					) : activeTab === "placement" ? (
						<ItemPlacementPanel
							item={item}
							world={world}
							onUpdate={updateItem}
							onEditAdvanced={editAdvanced}
						/>
					) : (
						<section className="itemWorkspaceCommands" aria-labelledby="item-workspace-commands-title">
							<div className="itemFormSectionHeading itemFormSectionHeading--text">
								<h2 id="item-workspace-commands-title">Commands</h2>
							</div>
							{attachedCommands.length ? (
								<ul>
									{attachedCommands.map((command) => (
										<li key={idValue(command.id)}>
											<div>
												<strong>{command.name || "Unnamed command"}</strong>
												<span>
													{command.helpPattern || "No player-facing command example"} ·{" "}
													{command.enabled ? "Enabled" : "Disabled"}
												</span>
											</div>
											<button type="button" onClick={() => onOpenCommand(idValue(command.id))}>
												Open command <ExternalLink size={14} aria-hidden="true" />
											</button>
										</li>
									))}
								</ul>
							) : (
								<div className="itemFormEmpty">
									<strong>No direct commands</strong>
									<span>Standard behavior does not require custom commands.</span>
								</div>
							)}
						</section>
					)}
				</div>
			</div>
		</article>
	);
}
