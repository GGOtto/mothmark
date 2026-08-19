"use client";

import {ArrowLeft, Copy, ExternalLink, Play, Trash2} from "lucide-react";
import {produce, type Draft} from "immer";
import {useMemo, type KeyboardEvent} from "react";
import {replaceItemDraft} from "@/app/editor/utils/worldDraftUtils";
import type {OpenLogicLibraryRequest} from "@/components/logic/shared";
import {useOptionalPopup} from "@/components/popup/Popup";
import {PopupTemplate} from "@/components/popup/template/PopupTemplate";
import {ItemIcon} from "@/itemIcons";
import {
	findEntityReferenceUsages,
	findItemCommandRelationships,
} from "@/components/logic/shared/editorRelationships";
import {ITEM_BEHAVIOR_SCHEMAS, type Item} from "@/schemas/world/itemSchema";
import type {World} from "@/schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {compareIds, deleteWorldEntity, idValue, toID, updateWorldEntityId} from "@/utils/idUtils";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {getEditorMetadata} from "@/utils/editorMetadata";
import {
	createItemCommandCustomization,
	findItemMatchingTargetBlocks,
} from "@/features/items/itemCommandCustomization";
import type {Command} from "@/schemas/world/commandSchemas";
import {
	ItemBehaviorsPanel,
	ItemDetailsPanel,
	ItemPlacementPanel,
	type ItemAdvancedEditOptions,
} from "./ItemWorkspaceForm";
import {useItemSuggestions} from "./ItemSuggestionPanel";
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
	activeTab: ItemWorkspaceTab;
	onActiveTabChange: (tab: ItemWorkspaceTab) => void;
};

export type ItemWorkspaceTab = "details" | "behaviors" | "placement" | "commands";

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

const BEHAVIOR_LABELS = Object.fromEntries(
	ITEM_BEHAVIOR_SCHEMAS.map((schema) => {
		const behavior = createDefaultFieldObject(schema);
		return [behavior.type, getEditorMetadata(schema)?.title ?? behavior.type];
	}),
) as Record<Item["behaviors"][number]["type"], string>;

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
	activeTab,
	onActiveTabChange,
}: ItemWorkspaceProps) {
	const popup = useOptionalPopup();
	const itemId = idValue(item.id);
	const suggestions = useItemSuggestions(item, world);
	const category = suggestions.iconCategory;
	const duplicateItemId =
		world.items.filter((candidate) => compareIds(candidate.id, item.id)).length > 1;
	const commandRelationships = useMemo(
		() => findItemCommandRelationships(world, item),
		[item, world],
	);
	const commandSections = useMemo(
		() => ({
			specific: commandRelationships.filter((relationship) => relationship.kind === "specific"),
			shared: commandRelationships.filter((relationship) => relationship.kind === "shared"),
			related: commandRelationships.filter((relationship) => relationship.kind === "related"),
		}),
		[commandRelationships],
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
		const directUsages = findEntityReferenceUsages(world, item.id);
		const confirmed = popup
			? await popup.confirm({
					title: `Delete ${item.name || "this item"}?`,
					message: (
						<div>
							<p>This removes the item and repairs or removes records that directly depend on it.</p>
							{commandRelationships.length || directUsages.length ? (
								<ul>
									{commandRelationships.map(({command}) => (
										<li key={`command:${idValue(command.id)}`}>{command.name} · Command</li>
									))}
									{directUsages
										.filter(
											(usage) =>
												!commandRelationships.some(
													({command}) => usage.key === `command:${idValue(command.id)}`,
												),
										)
										.map((usage) => (
											<li key={usage.key}>
												{usage.label} · {usage.detail}
											</li>
										))}
								</ul>
							) : null}
						</div>
					),
					confirmLabel: "Delete item",
					danger: true,
				})
			: globalThis.confirm(`Delete ${item.name || "this item"}?`);
		if (!confirmed) return;

		const nextWorld = produce(deleteWorldEntity(world, item.id), (draft) => {
			draft.commands = draft.commands.filter(
				(command) =>
					command.customization?.type !== "item-command-customization" ||
					!compareIds(command.customization.itemId, item.id),
			);
		});
		if (nextWorld === world) return;
		updateWorld(nextWorld);
		onItemDeleted();
	}

	async function chooseCustomizationTarget(command: Command) {
		const targets = findItemMatchingTargetBlocks(command, item);
		if (targets.length === 0) {
			await popup?.alert({
				title: "This command cannot be customized here",
				message: "It does not have a target that currently matches this item.",
			});
			return undefined;
		}
		if (targets.length === 1 || !popup) return targets[0];

		return popup.open<(typeof targets)[number]>(
			({resolve, cancel}) => (
				<PopupTemplate
					title={`Customize ${command.name} for ${item.name}`}
					message="Choose which part of the command should refer only to this item."
					actions={
						<button type="button" className="popupButton popupButtonSecondary" onClick={cancel}>
							Cancel
						</button>
					}
				>
					<div className="itemCommandTargetChoices">
						{targets.map((target) => (
							<button type="button" key={idValue(target.id)} onClick={() => resolve(target)}>
								<strong>{target.role}</strong>
								<span>
									{target.tags.length
										? `Currently matched through ${target.tags.join(", ")}`
										: "Currently matches this item directly"}
								</span>
							</button>
						))}
					</div>
				</PopupTemplate>
			),
			{
				ariaLabel: `Customize ${command.name} for ${item.name}`,
				closeOnBackdropClick: false,
				className: "popupSurfaceConfirm",
			},
		);
	}

	async function customizeCommand(command: Command) {
		const existing = world.commands.find(
			(candidate) =>
				candidate.customization?.type === "item-command-customization" &&
				compareIds(candidate.customization.sourceCommandId, command.id) &&
				compareIds(candidate.customization.itemId, item.id),
		);
		if (existing) {
			onOpenCommand(idValue(existing.id));
			return;
		}

		const target = await chooseCustomizationTarget(command);
		if (!target) return;
		const customized = createItemCommandCustomization(world, item, command, target.id);
		updateWorld((draft) => {
			draft.commands.push(customized);
		});
		onOpenCommand(idValue(customized.id));
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
		onActiveTabChange(nextTab.id);
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
							onClick={() => onActiveTabChange(tab.id)}
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
							key={idValue(item.id)}
							item={item}
							world={world}
							suggestions={suggestions}
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
								<div>
									<h2 id="item-workspace-commands-title">Commands</h2>
									<p>Customize how commands work for this item without changing their shared versions.</p>
								</div>
							</div>
							{commandRelationships.length ? (
								<div className="itemCommandSections">
									{(
										[
											{
												id: "specific",
												title: "Commands for this item",
												description: "Commands explicitly scoped to or referencing this item.",
												entries: commandSections.specific,
											},
											{
												id: "shared",
												title: "Shared commands",
												description: "Commands inherited through this item's tags and capabilities.",
												entries: commandSections.shared,
											},
											{
												id: "related",
												title: "Related logic",
												description: "Commands that can query or affect this item indirectly.",
												entries: commandSections.related,
											},
										] as const
									).map((section) =>
										section.entries.length ? (
											<section
												className="itemCommandSection"
												aria-labelledby={`item-command-section-${section.id}`}
												key={section.id}
											>
												<header>
													<h3 id={`item-command-section-${section.id}`}>{section.title}</h3>
													<p>{section.description}</p>
												</header>
												<ul>
													{section.entries.map(({command, reasons}) => {
														const source = command.customization
															? world.commands.find((candidate) =>
																	compareIds(candidate.id, command.customization?.sourceCommandId),
																)
															: null;
														const itemVersion =
															section.id === "shared"
																? world.commands.find(
																		(candidate) =>
																			candidate.customization?.type === "item-command-customization" &&
																			compareIds(candidate.customization.sourceCommandId, command.id) &&
																			compareIds(candidate.customization.itemId, item.id),
																	)
																: null;
														return (
															<li key={idValue(command.id)}>
																<div className="itemCommandCopy">
																	<div className="itemCommandTitle">
																		<strong>{command.name || "Unnamed command"}</strong>
																		<span>{command.enabled ? "Enabled" : "Disabled"}</span>
																	</div>
																	<span>{command.helpPattern || "No player-facing command example"}</span>
																	<small>
																		{source ? `Customized from ${source.name}. ` : ""}
																		{reasons.join(" · ")}
																	</small>
																</div>
																<div className="itemCommandActions">
																	{section.id === "shared" ? (
																		<button
																			type="button"
																			className="itemCommandCustomize"
																			onClick={() =>
																				itemVersion
																					? onOpenCommand(idValue(itemVersion.id))
																					: void customizeCommand(command)
																			}
																		>
																			<Copy size={13} aria-hidden="true" />
																			{itemVersion ? "Edit item version" : `Customize for ${item.name}`}
																		</button>
																	) : null}
																	<button type="button" onClick={() => onOpenCommand(idValue(command.id))}>
																		{section.id === "shared" ? "Open shared command" : "Edit command"}{" "}
																		<ExternalLink size={13} aria-hidden="true" />
																	</button>
																</div>
															</li>
														);
													})}
												</ul>
											</section>
										) : null,
									)}
								</div>
							) : (
								<div className="itemFormEmpty">
									<strong>No matching commands</strong>
									<span>No command currently targets, references, queries, or changes this item.</span>
								</div>
							)}
						</section>
					)}
				</div>
			</div>
		</article>
	);
}
