"use client";

import {Info, Plus, Trash2} from "lucide-react";
import {useState, type ReactNode} from "react";
import type {Draft} from "immer";
import type {z} from "zod";
import {useOptionalPopup} from "@/components/popup/Popup";
import {TokenListEditor} from "@/components/token-list/TokenListEditor";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {generateUniqueId, idValue, toID} from "@/utils/idUtils";
import {
	addItemBehaviorDraft,
	behaviorDependents,
	effectiveItemTags,
	isDefaultItemBehavior,
	itemBehaviorTypeForTag,
	ITEM_BEHAVIOR_DEFINITIONS,
	removeItemBehaviorDraft,
	replaceItemTagsAndBehaviorsDraft,
} from "@/features/items/itemBehaviors";
import {
	DefaultConditionGroup,
	ConditionGroupSchema,
	ConditionSchema,
} from "@/schemas/world/conditionSchema";
import {EffectGroupSchema} from "@/schemas/world/effectSchema";
import {
	ITEM_SIZE_UNITS,
	ItemExamineConditionalTextSchema,
	ItemParentConditionalTextSchema,
	ItemTakeAllowedWhenSchema,
	ItemSizeSchema,
	UseRecipeSchema,
	type Item,
	type ItemBehavior,
	type ItemLocation,
	type ItemSize,
} from "@/schemas/world/itemSchema";
import type {World} from "@/schemas/world/worldSchema";
import {getEditorMetadata} from "@/utils/editorMetadata";
import {ItemSuggestionList, useItemSuggestions} from "./ItemSuggestionPanel";

export type ItemAdvancedEditOptions = {
	kind: "condition" | "effect";
	title: string;
	schema: z.ZodTypeAny;
	value: unknown;
	onDone: (value: unknown) => void;
};

type UpdateItem = (recipe: (draft: Draft<Item>) => void) => void;

type ItemPanelProps = {
	item: Item;
	world: World;
	onUpdate: UpdateItem;
	onEditAdvanced: (options: ItemAdvancedEditOptions) => void;
};

const ITEM_SIZES: ReadonlyArray<{label: string; value: ItemSize}> =
	getEditorMetadata(ItemSizeSchema)?.options?.map((option) => {
		const value = option.value as ItemSize;
		const units = ITEM_SIZE_UNITS[value];
		return {label: `${option.label} · ${units} ${units === 1 ? "unit" : "units"}`, value};
	}) ?? [];

const BEHAVIOR_OPTIONS = ITEM_BEHAVIOR_DEFINITIONS;

function SectionHeading({
	accent = "identity",
	help,
	title,
}: {
	accent?: "identity" | "text";
	help?: string;
	title: string;
}) {
	return (
		<div className={`itemFormSectionHeading itemFormSectionHeading--${accent}`}>
			<h2>{title}</h2>
			{help ? (
				<details className="itemFormHelp">
					<summary aria-label={`About ${title}`}>
						<Info size={15} aria-hidden="true" />
					</summary>
					<p>{help}</p>
				</details>
			) : null}
		</div>
	);
}

function Field({children, label}: {children: ReactNode; label: string}) {
	return (
		<label className="itemFormField">
			<span>{label}</span>
			{children}
		</label>
	);
}

function AdvancedRow({
	count,
	label,
	onClick,
}: {
	count?: number;
	label: string;
	onClick: () => void;
}) {
	return (
		<div className="itemAdvancedRow">
			<div>
				<strong>{label}</strong>
				<span>{count ? `${count} configured` : "Not configured"}</span>
			</div>
			<button type="button" onClick={onClick}>
				{count ? "Edit" : "Add"}
			</button>
		</div>
	);
}

export function ItemDetailsPanel({item, world, onUpdate, onEditAdvanced}: ItemPanelProps) {
	const popup = useOptionalPopup();
	const suggestions = useItemSuggestions(item, world);

	async function replaceTags(values: string[]) {
		const requested = new Set(values.map(itemBehaviorTypeForTag).filter(Boolean));
		for (const behavior of item.behaviors) {
			if (requested.has(behavior.type)) continue;
			const dependents = behaviorDependents(item, behavior.type);
			if (dependents.length) {
				if (popup) {
					await popup.alert({
						title: `Keep ${behavior.type}`,
						message: `${dependents.join(" and ")} requires this capability. Remove the dependent capability first.`,
						buttonLabel: "Done",
					});
				}
				return;
			}
			if (isDefaultItemBehavior(behavior)) continue;
			const confirmed = popup
				? await popup.confirm({
						title: `Remove ${behavior.type}?`,
						message: "This capability has custom settings. Removing its tag also removes those settings.",
						confirmLabel: "Remove capability",
						danger: true,
					})
				: globalThis.confirm(`Remove ${behavior.type} and its custom settings?`);
			if (!confirmed) return;
		}
		onUpdate((draft) => replaceItemTagsAndBehaviorsDraft(draft, values));
	}

	return (
		<div className="itemDetailsForm">
			<section className="itemFormSection">
				<SectionHeading
					title="Identity"
					help="The name and words players can use to target and organize this item."
				/>
				<Field label="Name">
					<input
						type="text"
						value={item.name}
						onChange={(event) => onUpdate((draft) => void (draft.name = event.target.value))}
					/>
				</Field>
				<div className="itemFormField">
					<span>Aliases</span>
					<TokenListEditor
						addLabel="Add alias"
						footer={<ItemSuggestionList mode="aliases" onUpdate={onUpdate} suggestions={suggestions} />}
						values={item.aliases}
						onChange={(aliases) => onUpdate((draft) => void (draft.aliases = aliases))}
					/>
				</div>
				<div className="itemFormField">
					<span>Tags</span>
					<TokenListEditor
						addLabel="Add tag"
						footer={<ItemSuggestionList mode="tags" onUpdate={onUpdate} suggestions={suggestions} />}
						tone="tags"
						values={[...effectiveItemTags(item)]}
						onChange={(tags) => void replaceTags(tags)}
					/>
				</div>
				<details className="itemFormDisclosure">
					<summary>Internal identity</summary>
					<Field label="Item ID">
						<input
							type="text"
							value={idValue(item.id)}
							onChange={(event) => onUpdate((draft) => void (draft.id = toID("item", event.target.value)))}
						/>
					</Field>
				</details>
			</section>

			<section className="itemFormSection itemFormSection--text">
				<SectionHeading
					accent="text"
					title="Player-facing text"
					help="How the item appears beneath its parent and when the player examines it."
				/>
				<label className="itemFormToggle">
					<span>List in parent</span>
					<input
						type="checkbox"
						checked={item.presentation.listedInRoom}
						onChange={(event) =>
							onUpdate((draft) => void (draft.presentation.listedInRoom = event.target.checked))
						}
					/>
				</label>
				<Field label="Parent listing text">
					<textarea
						value={item.presentation.listingText}
						onChange={(event) =>
							onUpdate((draft) => void (draft.presentation.listingText = event.target.value))
						}
					/>
				</Field>
				<Field label="Examine text">
					<textarea
						value={item.examine.text}
						onChange={(event) => onUpdate((draft) => void (draft.examine.text = event.target.value))}
					/>
				</Field>
				<details className="itemFormDisclosure itemFormDisclosure--advanced">
					<summary>Conditional text and outcomes</summary>
					<div className="itemAdvancedRows">
						<AdvancedRow
							label="Conditional parent text"
							count={item.presentation.conditionalText.length}
							onClick={() =>
								onEditAdvanced({
									kind: "condition",
									title: `${item.name} · Conditional parent text`,
									schema: ItemParentConditionalTextSchema,
									value: item.presentation.conditionalText,
									onDone: (value) =>
										onUpdate(
											(draft) =>
												void (draft.presentation.conditionalText =
													ItemParentConditionalTextSchema.parse(value)),
										),
								})
							}
						/>
						<AdvancedRow
							label="Conditional examine text"
							count={item.examine.conditionalText.length}
							onClick={() =>
								onEditAdvanced({
									kind: "condition",
									title: `${item.name} · Conditional examine text`,
									schema: ItemExamineConditionalTextSchema,
									value: item.examine.conditionalText,
									onDone: (value) =>
										onUpdate(
											(draft) =>
												void (draft.examine.conditionalText = ItemExamineConditionalTextSchema.parse(value)),
										),
								})
							}
						/>
						<AdvancedRow
							label="After examine"
							count={item.examine.afterExamine?.effects.length}
							onClick={() =>
								onEditAdvanced({
									kind: "effect",
									title: `${item.name} · After examine`,
									schema: EffectGroupSchema,
									value: item.examine.afterExamine ?? createDefaultFieldObject(EffectGroupSchema),
									onDone: (value) =>
										onUpdate((draft) => void (draft.examine.afterExamine = EffectGroupSchema.parse(value))),
								})
							}
						/>
					</div>
				</details>
			</section>
		</div>
	);
}

function EffectRow({
	group,
	label,
	onDone,
	onEditAdvanced,
}: {
	group?: z.infer<typeof EffectGroupSchema>;
	label: string;
	onDone: (group: z.infer<typeof EffectGroupSchema>) => void;
	onEditAdvanced: ItemPanelProps["onEditAdvanced"];
}) {
	return (
		<AdvancedRow
			label={label}
			count={group?.effects.length}
			onClick={() =>
				onEditAdvanced({
					kind: "effect",
					title: label,
					schema: EffectGroupSchema,
					value: group ?? createDefaultFieldObject(EffectGroupSchema),
					onDone: (value) => onDone(EffectGroupSchema.parse(value)),
				})
			}
		/>
	);
}

function CapacityFields({
	behavior,
	onChange,
}: {
	behavior: Extract<ItemBehavior, {type: "container" | "surface"}>;
	onChange: (behavior: ItemBehavior) => void;
}) {
	return (
		<>
			<div className="itemFormFieldGrid">
				<Field label="Total capacity">
					<input
						type="number"
						min={1}
						value={behavior.capacity.capacity}
						onChange={(event) =>
							onChange({
								...behavior,
								capacity: {...behavior.capacity, capacity: Math.max(1, Number(event.target.value))},
							})
						}
					/>
				</Field>
				<Field label="Largest item">
					<select
						value={behavior.capacity.maximumItemSize}
						onChange={(event) =>
							onChange({
								...behavior,
								capacity: {
									...behavior.capacity,
									maximumItemSize: event.target.value as ItemSize,
								},
							})
						}
					>
						{ITEM_SIZES.map((size) => (
							<option value={size.value} key={size.value}>
								{size.label}
							</option>
						))}
					</select>
				</Field>
			</div>
			<Field label="Contents lead-in">
				<input
					type="text"
					value={behavior.contentsListingText ?? ""}
					placeholder={behavior.type === "container" ? "Inside the chest:" : "On the table:"}
					onChange={(event) => onChange({...behavior, contentsListingText: event.target.value})}
				/>
			</Field>
		</>
	);
}

function BehaviorSettings({
	behavior,
	item,
	onChange,
	onEditAdvanced,
	world,
}: {
	behavior: ItemBehavior;
	item: Item;
	onChange: (behavior: ItemBehavior) => void;
	onEditAdvanced: ItemPanelProps["onEditAdvanced"];
	world: World;
}) {
	switch (behavior.type) {
		case "takeable":
			return (
				<div className="itemBehaviorFields">
					<Field label="Carrying size">
						<select
							value={behavior.size}
							onChange={(event) => onChange({...behavior, size: event.target.value as ItemSize})}
						>
							{ITEM_SIZES.map((size) => (
								<option value={size.value} key={size.value}>
									{size.label}
								</option>
							))}
						</select>
					</Field>
					<Field label="Blocked message">
						<input
							type="text"
							value={behavior.blockedMessage}
							onChange={(event) => onChange({...behavior, blockedMessage: event.target.value})}
						/>
					</Field>
					<div className="itemAdvancedRows">
						<AdvancedRow
							label="Take condition"
							count={behavior.allowedWhen ? 1 : 0}
							onClick={() =>
								onEditAdvanced({
									kind: "condition",
									title: `${item.name} · Take condition`,
									schema: ItemTakeAllowedWhenSchema,
									value: behavior.allowedWhen ?? DefaultConditionGroup,
									onDone: (value) => onChange({...behavior, allowedWhen: ConditionGroupSchema.parse(value)}),
								})
							}
						/>
						<EffectRow
							label={`${item.name} · After take`}
							group={behavior.afterTake}
							onDone={(afterTake) => onChange({...behavior, afterTake})}
							onEditAdvanced={onEditAdvanced}
						/>
						<EffectRow
							label={`${item.name} · After drop`}
							group={behavior.afterDrop}
							onDone={(afterDrop) => onChange({...behavior, afterDrop})}
							onEditAdvanced={onEditAdvanced}
						/>
					</div>
				</div>
			);
		case "container":
		case "surface":
			return (
				<div className="itemBehaviorFields">
					<CapacityFields behavior={behavior} onChange={onChange} />
				</div>
			);
		case "openable":
			return (
				<div className="itemBehaviorFields">
					<div className="itemFormFieldGrid">
						<Field label="Open message">
							<input
								value={behavior.openMessage}
								onChange={(event) => onChange({...behavior, openMessage: event.target.value})}
							/>
						</Field>
						<Field label="Close message">
							<input
								value={behavior.closeMessage}
								onChange={(event) => onChange({...behavior, closeMessage: event.target.value})}
							/>
						</Field>
					</div>
					<Field label="Blocked message">
						<input
							value={behavior.blockedMessage}
							onChange={(event) => onChange({...behavior, blockedMessage: event.target.value})}
						/>
					</Field>
					<div className="itemAdvancedRows">
						<EffectRow
							label={`${item.name} · After open`}
							group={behavior.afterOpen}
							onDone={(afterOpen) => onChange({...behavior, afterOpen})}
							onEditAdvanced={onEditAdvanced}
						/>
						<EffectRow
							label={`${item.name} · After close`}
							group={behavior.afterClose}
							onDone={(afterClose) => onChange({...behavior, afterClose})}
							onEditAdvanced={onEditAdvanced}
						/>
					</div>
				</div>
			);
		case "lockable": {
			const availableItems = world.items.filter(
				(candidate) => idValue(candidate.id) !== idValue(item.id),
			);
			return (
				<div className="itemBehaviorFields">
					<div className="itemUnlockRequirements">
						<strong>Unlock with</strong>
						{behavior.unlockWith.map((requirement, index) => (
							<div className="itemUnlockRequirement" key={index}>
								<select
									aria-label={`Unlock requirement ${index + 1} type`}
									value={requirement.type}
									onChange={(event) => {
										const unlockWith = [...behavior.unlockWith];
										unlockWith[index] =
											event.target.value === "item" && availableItems[0]
												? {type: "item", itemId: availableItems[0].id}
												: {type: "tag", tag: "key"};
										onChange({...behavior, unlockWith});
									}}
								>
									<option value="item">Specific item</option>
									<option value="tag">Item tag</option>
								</select>
								{requirement.type === "item" ? (
									<select
										aria-label={`Unlock requirement ${index + 1} item`}
										value={idValue(requirement.itemId)}
										onChange={(event) => {
											const unlockWith = [...behavior.unlockWith];
											unlockWith[index] = {type: "item", itemId: toID("item", event.target.value)};
											onChange({...behavior, unlockWith});
										}}
									>
										{availableItems.map((candidate) => (
											<option value={idValue(candidate.id)} key={idValue(candidate.id)}>
												{candidate.name}
											</option>
										))}
									</select>
								) : (
									<input
										aria-label={`Unlock requirement ${index + 1} tag`}
										value={requirement.tag}
										onChange={(event) => {
											const unlockWith = [...behavior.unlockWith];
											unlockWith[index] = {type: "tag", tag: event.target.value};
											onChange({...behavior, unlockWith});
										}}
									/>
								)}
								<button
									type="button"
									aria-label={`Remove unlock requirement ${index + 1}`}
									onClick={() =>
										onChange({
											...behavior,
											unlockWith: behavior.unlockWith.filter((_, candidate) => candidate !== index),
										})
									}
								>
									<Trash2 size={14} aria-hidden="true" />
								</button>
							</div>
						))}
						<button
							type="button"
							className="itemInlineAdd"
							onClick={() =>
								onChange({
									...behavior,
									unlockWith: [
										...behavior.unlockWith,
										availableItems[0]
											? {type: "item", itemId: availableItems[0].id}
											: {type: "tag", tag: "key"},
									],
								})
							}
						>
							<Plus size={14} aria-hidden="true" /> Add key
						</button>
					</div>
					<label className="itemFormToggle">
						<span>Consume matching key</span>
						<input
							type="checkbox"
							checked={behavior.consumesKey}
							onChange={(event) => onChange({...behavior, consumesKey: event.target.checked})}
						/>
					</label>
					<div className="itemFormFieldGrid">
						<Field label="Unlock message">
							<input
								value={behavior.unlockMessage}
								onChange={(event) => onChange({...behavior, unlockMessage: event.target.value})}
							/>
						</Field>
						<Field label="Wrong key message">
							<input
								value={behavior.wrongKeyMessage}
								onChange={(event) => onChange({...behavior, wrongKeyMessage: event.target.value})}
							/>
						</Field>
					</div>
					<div className="itemAdvancedRows">
						<EffectRow
							label={`${item.name} · After unlock`}
							group={behavior.afterUnlock}
							onDone={(afterUnlock) => onChange({...behavior, afterUnlock})}
							onEditAdvanced={onEditAdvanced}
						/>
						<EffectRow
							label={`${item.name} · After lock`}
							group={behavior.afterLock}
							onDone={(afterLock) => onChange({...behavior, afterLock})}
							onEditAdvanced={onEditAdvanced}
						/>
					</div>
				</div>
			);
		}
		case "door":
			return (
				<div className="itemBehaviorFields itemFormFieldGrid">
					<Field label="Connection">
						<select
							value={idValue(behavior.connectionId)}
							onChange={(event) =>
								onChange({...behavior, connectionId: toID("connection", event.target.value)})
							}
						>
							{world.connections.map((connection) => (
								<option value={idValue(connection.id)} key={idValue(connection.id)}>
									{connection.name || idValue(connection.id)}
								</option>
							))}
						</select>
					</Field>
					<Field label="Controls">
						<select
							value={behavior.controls}
							onChange={(event) =>
								onChange({...behavior, controls: event.target.value as typeof behavior.controls})
							}
						>
							<option value="both-directions">Both directions</option>
							<option value="forward">Forward</option>
							<option value="backward">Backward</option>
						</select>
					</Field>
				</div>
			);
		case "usable":
			return (
				<div className="itemBehaviorFields">
					{behavior.recipes.map((recipe, index) => (
						<details className="itemRecipe" key={idValue(recipe.id)}>
							<summary>Recipe {index + 1}</summary>
							<div className="itemRecipeBody">
								<Field label="Target">
									<select
										value={recipe.target.type}
										onChange={(event) => {
											const recipes = [...behavior.recipes];
											const type = event.target.value;
											const target =
												type === "item" && world.items[0]
													? {type: "item" as const, itemId: world.items[0].id}
													: type === "tag"
														? {type: "tag" as const, tag: ""}
														: type === "any"
															? {type: "any" as const}
															: {type: "none" as const};
											recipes[index] = {...recipe, target};
											onChange({...behavior, recipes});
										}}
									>
										<option value="none">No target</option>
										<option value="any">Any reachable target</option>
										<option value="item">Specific item</option>
										<option value="tag">Item tag</option>
									</select>
								</Field>
								{recipe.target.type === "item" ? (
									<Field label="Target item">
										<select
											value={idValue(recipe.target.itemId)}
											onChange={(event) => {
												const recipes = [...behavior.recipes];
												recipes[index] = {
													...recipe,
													target: {type: "item", itemId: toID("item", event.target.value)},
												};
												onChange({...behavior, recipes});
											}}
										>
											{world.items.map((candidate) => (
												<option value={idValue(candidate.id)} key={idValue(candidate.id)}>
													{candidate.name}
												</option>
											))}
										</select>
									</Field>
								) : null}
								{recipe.target.type === "tag" ? (
									<Field label="Target tag">
										<input
											value={recipe.target.tag}
											onChange={(event) => {
												const recipes = [...behavior.recipes];
												recipes[index] = {...recipe, target: {type: "tag", tag: event.target.value}};
												onChange({...behavior, recipes});
											}}
										/>
									</Field>
								) : null}
								<div className="itemAdvancedRows">
									<AdvancedRow
										label="Recipe condition"
										count={recipe.when ? 1 : 0}
										onClick={() =>
											onEditAdvanced({
												kind: "condition",
												title: `${item.name} · Recipe ${index + 1} condition`,
												schema: ConditionSchema,
												value: recipe.when ?? DefaultConditionGroup,
												onDone: (value) => {
													const recipes = [...behavior.recipes];
													recipes[index] = {...recipe, when: ConditionGroupSchema.parse(value)};
													onChange({...behavior, recipes});
												},
											})
										}
									/>
									<EffectRow
										label={`${item.name} · Recipe ${index + 1} outcome`}
										group={recipe.outcome}
										onDone={(outcome) => {
											const recipes = [...behavior.recipes];
											recipes[index] = {...recipe, outcome};
											onChange({...behavior, recipes});
										}}
										onEditAdvanced={onEditAdvanced}
									/>
								</div>
								<button
									type="button"
									className="itemDangerLink"
									onClick={() =>
										onChange({
											...behavior,
											recipes: behavior.recipes.filter((_, candidate) => candidate !== index),
										})
									}
								>
									Remove recipe
								</button>
							</div>
						</details>
					))}
					<button
						type="button"
						className="itemInlineAdd"
						onClick={() => {
							const recipe = createDefaultFieldObject(UseRecipeSchema);
							recipe.id = generateUniqueId("condition-branch", behavior.recipes);
							onChange({...behavior, recipes: [...behavior.recipes, recipe]});
						}}
					>
						<Plus size={14} aria-hidden="true" /> Add recipe
					</button>
					<Field label="Fallback message">
						<input
							value={behavior.fallbackMessage}
							onChange={(event) => onChange({...behavior, fallbackMessage: event.target.value})}
						/>
					</Field>
				</div>
			);
	}
}

export function ItemBehaviorsPanel({item, world, onUpdate, onEditAdvanced}: ItemPanelProps) {
	const popup = useOptionalPopup();
	const [expandedBehavior, setExpandedBehavior] = useState<ItemBehavior["type"] | null>(
		item.behaviors[0]?.type ?? null,
	);
	const selectedTypes = new Set(item.behaviors.map((behavior) => behavior.type));

	async function toggleBehavior(type: ItemBehavior["type"], checked: boolean) {
		const behavior = item.behaviors.find((entry) => entry.type === type);
		if (!checked && behavior && !isDefaultItemBehavior(behavior)) {
			const confirmed = popup
				? await popup.confirm({
						title: `Remove ${type}?`,
						message: "This capability has custom settings. Removing it also removes those settings.",
						confirmLabel: "Remove capability",
						danger: true,
					})
				: globalThis.confirm(`Remove ${type} and its custom settings?`);
			if (!confirmed) return;
		}
		onUpdate((draft) => {
			if (checked) {
				addItemBehaviorDraft(draft, type);
				return;
			}
			removeItemBehaviorDraft(draft, type);
		});
		if (checked) setExpandedBehavior(type);
		else if (expandedBehavior === type) setExpandedBehavior(null);
	}

	function replaceBehavior(nextBehavior: ItemBehavior) {
		onUpdate((draft) => {
			const index = draft.behaviors.findIndex((behavior) => behavior.type === nextBehavior.type);
			if (index >= 0) draft.behaviors[index] = nextBehavior;
		});
	}

	return (
		<div className="itemBehaviorLayout">
			<section className="itemFormSection">
				<SectionHeading title="Capabilities" help="Standard player actions supplied by this item." />
				<div className="itemBehaviorOptions">
					{BEHAVIOR_OPTIONS.map((option) => {
						const checked = selectedTypes.has(option.type);
						const openableRequired =
							option.type === "openable" && (selectedTypes.has("lockable") || selectedTypes.has("door"));
						return (
							<label
								className={`itemBehaviorOption ${checked ? "itemBehaviorOption--checked" : ""}`}
								key={option.type}
							>
								<input
									type="checkbox"
									checked={checked}
									disabled={openableRequired}
									onChange={(event) => void toggleBehavior(option.type, event.target.checked)}
								/>
								<span>
									<strong>{option.label}</strong>
									<small>{openableRequired ? "Required by another capability" : option.description}</small>
								</span>
							</label>
						);
					})}
				</div>
				{item.behaviors.length ? (
					<div className="itemBehaviorEditors">
						{item.behaviors.map((behavior) => (
							<details
								className="itemBehaviorEditor"
								key={behavior.type}
								open={expandedBehavior === behavior.type}
								onToggle={(event) => event.currentTarget.open && setExpandedBehavior(behavior.type)}
							>
								<summary>{BEHAVIOR_OPTIONS.find((option) => option.type === behavior.type)?.label}</summary>
								<div className="itemBehaviorEditorBody">
									<BehaviorSettings
										behavior={behavior}
										item={item}
										world={world}
										onChange={replaceBehavior}
										onEditAdvanced={onEditAdvanced}
									/>
								</div>
							</details>
						))}
					</div>
				) : (
					<div className="itemFormEmpty">
						<strong>Fixed item</strong>
						<span>Add a capability only when the player needs a standard action.</span>
					</div>
				)}
			</section>
			<ItemFlagsSection item={item} onUpdate={onUpdate} />
		</div>
	);
}

function EditableFlagName({name, onRename}: {name: string; onRename: (name: string) => void}) {
	const [draftName, setDraftName] = useState(name);
	return (
		<input
			aria-label="Flag name"
			value={draftName}
			onChange={(event) => setDraftName(event.target.value)}
			onBlur={() => {
				const nextName = draftName.trim();
				if (nextName) onRename(nextName);
				else setDraftName(name);
			}}
		/>
	);
}

function ItemFlagsSection({item, onUpdate}: {item: Item; onUpdate: UpdateItem}) {
	const linkedFlags = [
		...(item.behaviors.some((behavior) => behavior.type === "openable")
			? [{name: "open", value: item.initialState.open}]
			: []),
		...(item.behaviors.some((behavior) => behavior.type === "lockable")
			? [{name: "locked", value: item.initialState.locked}]
			: []),
	];
	const reservedFlags = new Set(["examined", "open", "locked"]);
	const customFlags = Object.entries(item.initialState.flags).filter(
		([name]) => name !== "examined",
	);

	function addFlag() {
		let suffix = 1;
		let name = "flag";
		while (Object.hasOwn(item.initialState.flags, name) || reservedFlags.has(name))
			name = `flag${++suffix}`;
		onUpdate((draft) => void (draft.initialState.flags[name] = false));
	}

	return (
		<section className="itemFormSection itemFlagsSection">
			<SectionHeading
				accent="text"
				title="Flags"
				help="Initial item state used by conditions and effects."
			/>
			<div className="itemFlagTable">
				<div className="itemFlagRow itemFlagRow--readonly">
					<span>examined</span>
					<label>
						<input type="checkbox" checked={Boolean(item.initialState.flags.examined)} disabled />{" "}
						{item.initialState.flags.examined ? "True" : "False"}
					</label>
				</div>
				{linkedFlags.map((flag) => (
					<div className="itemFlagRow itemFlagRow--linked" key={flag.name}>
						<span>{flag.name}</span>
						<label>
							<input
								type="checkbox"
								checked={flag.value}
								onChange={(event) =>
									onUpdate((draft) => {
										if (flag.name === "open") {
											draft.initialState.open = event.target.checked;
											if (event.target.checked) draft.initialState.locked = false;
										} else {
											draft.initialState.locked = event.target.checked;
											if (event.target.checked) draft.initialState.open = false;
										}
									})
								}
							/>{" "}
							{flag.value ? "True" : "False"}
						</label>
					</div>
				))}
				{customFlags.map(([name, value]) => (
					<div className="itemFlagRow" key={name}>
						<EditableFlagName
							name={name}
							onRename={(nextName) =>
								onUpdate((draft) => {
									if (
										nextName === name ||
										reservedFlags.has(nextName) ||
										Object.hasOwn(draft.initialState.flags, nextName)
									)
										return;
									const currentValue = draft.initialState.flags[name] ?? false;
									delete draft.initialState.flags[name];
									draft.initialState.flags[nextName] = currentValue;
								})
							}
						/>
						<label>
							<input
								type="checkbox"
								checked={value}
								onChange={(event) =>
									onUpdate((draft) => void (draft.initialState.flags[name] = event.target.checked))
								}
							/>{" "}
							{value ? "True" : "False"}
						</label>
						<button
							type="button"
							aria-label={`Delete ${name}`}
							onClick={() => onUpdate((draft) => void delete draft.initialState.flags[name])}
						>
							<Trash2 size={14} aria-hidden="true" />
						</button>
					</div>
				))}
			</div>
			<button type="button" className="itemInlineAdd" onClick={addFlag}>
				<Plus size={14} aria-hidden="true" /> Add flag
			</button>
		</section>
	);
}

function defaultLocation(type: ItemLocation["type"], item: Item, world: World): ItemLocation {
	if (type === "inventory") return {type: "inventory"};
	if (type === "destroyed") return {type: "destroyed"};
	if (type === "hidden") return {type: "hidden"};
	if (type === "room" && world.rooms[0]) return {type: "room", roomId: world.rooms[0].id};
	const parent = world.items.find((candidate) => idValue(candidate.id) !== idValue(item.id));
	if (type === "item" && parent) return {type: "item", itemId: parent.id, placement: "inside"};
	return {type: "hidden"};
}

export function ItemPlacementPanel({item, world, onUpdate}: ItemPanelProps) {
	const location = item.initialState.location;
	const parentItems = world.items.filter((candidate) => idValue(candidate.id) !== idValue(item.id));
	return (
		<section className="itemFormSection itemPlacementForm">
			<SectionHeading
				title="Starting position"
				help="The single authoritative place where this item begins."
			/>
			<div className="itemFormFieldGrid">
				<Field label="Location">
					<select
						value={location.type}
						onChange={(event) =>
							onUpdate(
								(draft) =>
									void (draft.initialState.location = defaultLocation(
										event.target.value as ItemLocation["type"],
										item,
										world,
									)),
							)
						}
					>
						<option value="hidden">Hidden</option>
						<option value="room" disabled={!world.rooms.length}>
							In a room
						</option>
						<option value="inventory">Player inventory</option>
						<option value="item" disabled={!parentItems.length}>
							Inside or on an item
						</option>
						<option value="destroyed">Absent from world</option>
					</select>
				</Field>
				{location.type === "room" ? (
					<Field label="Room">
						<select
							value={idValue(location.roomId)}
							onChange={(event) =>
								onUpdate(
									(draft) =>
										void (draft.initialState.location = {
											type: "room",
											roomId: toID("room", event.target.value),
										}),
								)
							}
						>
							{world.rooms.map((room) => (
								<option value={idValue(room.id)} key={idValue(room.id)}>
									{room.name}
								</option>
							))}
						</select>
					</Field>
				) : null}
				{location.type === "hidden" ? (
					<Field label="Associated room">
						<select
							value={location.roomId ? idValue(location.roomId) : ""}
							onChange={(event) =>
								onUpdate(
									(draft) =>
										void (draft.initialState.location = {
											type: "hidden",
											...(event.target.value ? {roomId: toID("room", event.target.value)} : {}),
										}),
								)
							}
						>
							<option value="">None</option>
							{world.rooms.map((room) => (
								<option value={idValue(room.id)} key={idValue(room.id)}>
									{room.name}
								</option>
							))}
						</select>
					</Field>
				) : null}
				{location.type === "item" ? (
					<>
						<Field label="Containing item">
							<select
								value={idValue(location.itemId)}
								onChange={(event) =>
									onUpdate(
										(draft) =>
											void (draft.initialState.location = {
												...location,
												itemId: toID("item", event.target.value),
											}),
									)
								}
							>
								{parentItems.map((candidate) => (
									<option value={idValue(candidate.id)} key={idValue(candidate.id)}>
										{candidate.name}
									</option>
								))}
							</select>
						</Field>
						<Field label="Placement">
							<select
								value={location.placement}
								onChange={(event) =>
									onUpdate(
										(draft) =>
											void (draft.initialState.location = {
												...location,
												placement: event.target.value as "inside" | "on",
											}),
									)
								}
							>
								<option value="inside">Inside</option>
								<option value="on">On top</option>
							</select>
						</Field>
					</>
				) : null}
			</div>
			<div className="itemPlacementSummary">
				<strong>
					{location.type === "hidden"
						? "Starts hidden"
						: location.type === "destroyed"
							? "Starts absent"
							: location.type === "inventory"
								? "Starts in player inventory"
								: location.type === "room"
									? `Starts in ${world.rooms.find((room) => idValue(room.id) === idValue(location.roomId))?.name ?? "a room"}`
									: `Starts ${location.placement === "inside" ? "inside" : "on"} ${parentItems.find((candidate) => idValue(candidate.id) === idValue(location.itemId))?.name ?? "an item"}`}
				</strong>
				<span>This starting state is used whenever a new playthrough begins.</span>
			</div>
		</section>
	);
}
