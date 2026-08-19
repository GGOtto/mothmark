"use client";

import {ArrowLeft, ArrowRight, Plus, Trash2} from "lucide-react";
import {useMemo} from "react";
import {EntityPicker} from "@/components/entity-picker/EntityPicker";
import type {EntityPickerEntry} from "@/components/entity-picker/entityPickerTypes";
import {useTheme} from "@/components/theme/ThemeProvider";
import {UniversalEditor} from "@/components/universal-editor/UniversalEditor";
import {buildEditorRegistries} from "@/components/universal-editor/utils/buildEditorRegistries";
import {
	CommandEffectGroupSchema,
	type CommandConditionBranch,
	type CommandEffectGroup,
} from "@/schemas/world/commandLogicSchemas";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import {
	BooleanBlockSchema,
	ChoiceBlockSchema,
	DirectionBlockSchema,
	NumberBlockSchema,
	PhraseBlockSchema,
	RelationBlockSchema,
	TargetBlockSchema,
	TextBlockSchema,
	type Command,
	type CommandBlock,
	CommandSchema,
} from "@/schemas/world/commandSchemas";
import type {World} from "@/schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {compareIds, idValue, toID, type ID} from "@/utils/idUtils";
import type {CommandSelection} from "../shared";
import {blockDefinition, isStructuralBlock} from "./CommandEditor";
import {createBlockFallbackBehavior} from "./commandFallback";
import {buildCommandVariableCatalog} from "@/features/command-variables";
import {CommandConditionEditorSchema} from "../shared/logicEditorSchemas";
import {resolveEditorMetadata} from "@/components/universal-editor/utils/resolveEditorMetadata";

const TargetTagsSchema = editor.object(
	{
		tags: TargetBlockSchema.shape.tags,
		tagMode: TargetBlockSchema.shape.tagMode,
	},
	{
		title: "Target tags",
		description: "Limit this target to entities carrying specific tags.",
	},
);

const TargetBlockDetailsSchema = TargetBlockSchema.omit({
	tags: true,
	tagMode: true,
	entityIds: true,
});
const ItemCustomizedTargetBlockDetailsSchema = TargetBlockDetailsSchema.omit({entityTypes: true});

type TargetBlock = Extract<CommandBlock, {type: "target"}>;
type TargetEntityType = TargetBlock["entityTypes"][number];

function targetPickerEntry(
	option: ReturnType<typeof buildEditorRegistries>["items"][number],
	type: TargetEntityType,
): EntityPickerEntry {
	return {
		ref: toID(type, option.id),
		entityType: type,
		label: option.label,
		description: option.description,
		aliases: option.aliases ?? [],
		tags: option.tags ?? [],
		kind: option.kind,
		hierarchy: option.hierarchy ?? [],
		facts: option.facts,
		relations: option.relations,
		path: option.path,
		parentId: option.parentId,
		disabled: option.disabled,
		deprecated: option.deprecated,
	};
}

function targetTypeLabel(type: TargetEntityType) {
	return type === "room" ? "Room" : "Item";
}

function readableTargetList(labels: string[]) {
	if (labels.length < 2) return labels[0] ?? "";
	if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
	return `${labels.slice(0, -1).join(", ")}, or ${labels.at(-1)}`;
}

function SpecificTargetsEditor({
	block,
	world,
	customizedItemId,
	onChange,
}: {
	block: TargetBlock;
	world: World;
	customizedItemId?: ID<"item">;
	onChange: (nextBlock: TargetBlock) => void;
}) {
	const registries = useMemo(() => buildEditorRegistries(world), [world]);
	const allowedTypes: TargetEntityType[] = block.entityTypes.length
		? block.entityTypes
		: ["room", "item"];
	const entries = [
		...registries.rooms.map((option) => targetPickerEntry(option, "room")),
		...registries.items.map((option) => targetPickerEntry(option, "item")),
	];
	const selectedTargets = block.entityIds.map((reference) => {
		const entry = entries.find((candidate) => compareIds(candidate.ref, reference));
		return {
			reference,
			entry,
			label:
				entry?.label ||
				`Missing ${targetTypeLabel(reference.type).toLocaleLowerCase()}${idValue(reference) ? ` · ${idValue(reference)}` : ""}`,
			allowed: allowedTypes.includes(reference.type),
		};
	});
	const availableEntries = entries.filter(
		(entry) =>
			allowedTypes.includes(entry.ref.type as TargetEntityType) &&
			!block.entityIds.some((reference) => compareIds(reference, entry.ref)),
	);
	const labels = selectedTargets.map(({label}) => label);
	const customizedItem = customizedItemId
		? selectedTargets.find(({reference}) => compareIds(reference, customizedItemId))
		: undefined;

	return (
		<section className="commandInspector__specificTargets" aria-labelledby="specific-targets-heading">
			<header>
				<div>
					<h3 id="specific-targets-heading">Specific targets</h3>
					<p>
						{selectedTargets.length
							? `Only ${readableTargetList(labels)} can fill this target block.`
							: "No named entity restriction. Any entity matching the type, tags, and availability rules can fill this target block."}
					</p>
				</div>
				{customizedItem ? <span>Item-specific scope</span> : null}
			</header>
			{customizedItem ? (
				<p className="commandInspector__specificTargetsNotice">
					This customized command is limited to <strong>{customizedItem.label}</strong> here. The
					remaining target rules still apply.
				</p>
			) : null}
			{selectedTargets.length ? (
				<ul>
					{selectedTargets.map(({reference, entry, label, allowed}) => (
						<li key={`${reference.type}:${idValue(reference)}`}>
							<div>
								<strong>{label}</strong>
								<span>
									{targetTypeLabel(reference.type)}
									{!entry ? " · No longer in this world" : ""}
									{!allowed ? " · Excluded by Entity types" : ""}
								</span>
							</div>
							{customizedItemId && compareIds(reference, customizedItemId) ? (
								<span className="commandInspector__specificTargetFixed">Fixed</span>
							) : (
								<button
									type="button"
									aria-label={`Remove ${label} from specific targets`}
									onClick={() =>
										onChange({
											...block,
											entityIds: block.entityIds.filter((candidate) => !compareIds(candidate, reference)),
										})
									}
								>
									<Trash2 size={14} aria-hidden="true" />
								</button>
							)}
						</li>
					))}
				</ul>
			) : null}
			{customizedItem ? null : (
				<EntityPicker
					entries={availableEntries}
					entityTypes={allowedTypes}
					onChange={(selection) => {
						if (!selection) return;
						onChange({
							...block,
							entityIds: [...block.entityIds, selection.ref as TargetBlock["entityIds"][number]],
						});
					}}
					title="Add a specific target"
					placeholder={availableEntries.length ? "Add a specific target" : "No more eligible targets"}
					presentation="popover"
					showPreview
					disabled={availableEntries.length === 0}
				/>
			)}
		</section>
	);
}

type CommandInspectorProps = {
	world: World;
	updateWorld: UpdateWorld;
	selection: CommandSelection | null;
	onSelectionChange: (selection: CommandSelection) => void;
};

function findCommand(world: World, commandId: string) {
	return world.commands.find((command) => idValue(command.id) === commandId);
}

function findBlock(command: Command, blockId: string, patternIndex: number) {
	const pattern = command.patterns[patternIndex];
	const blockIndex = pattern?.blocks.findIndex((block) => idValue(block.id) === blockId) ?? -1;
	if (pattern && blockIndex >= 0)
		return {block: pattern.blocks[blockIndex], patternIndex, blockIndex};
}

function schemaForBlock(block: CommandBlock) {
	switch (block.type) {
		case "phrase":
			return PhraseBlockSchema;
		case "relation":
			return RelationBlockSchema;
		case "target":
			return TargetBlockSchema;
		case "number":
			return NumberBlockSchema;
		case "boolean":
			return BooleanBlockSchema;
		case "direction":
			return DirectionBlockSchema;
		case "choice":
			return ChoiceBlockSchema;
		case "text":
			return TextBlockSchema;
	}
}

function suggestedHelpPattern(command: Command): string {
	return command.patterns[0].blocks
		.map((block) => {
			switch (block.type) {
				case "phrase":
					return block.matches[0] ?? "command";
				case "relation":
					return block.relation;
				case "target":
					return `<${block.role || "target"}>`;
				case "direction":
					return "<direction>";
				case "number":
					return "<number>";
				case "boolean":
				case "choice":
					return "<choice>";
				case "text":
					return "<text>";
			}
		})
		.join(" ");
}

function selectedBehavior(command: Command, selection: CommandSelection) {
	if (selection.kind !== "behavior-condition" && selection.kind !== "behavior-effect") return;
	if (selection.behavior === "command") return command.behavior;
	return command.fallbacks.find(
		(fallback) => selection.blockId && idValue(fallback.blockId) === selection.blockId,
	)?.behavior;
}

function selectedEffectGroup(
	behavior: CommandConditionBranch,
	selection: Extract<CommandSelection, {kind: "behavior-effect"}>,
) {
	if (selection.branch === "always") return behavior.always;
	if (selection.branch === "if") return behavior.if?.effect;
	if (selection.branch === "else") return behavior.else;
	return behavior.elifs?.[selection.elifIndex ?? -1]?.effect;
}

export function CommandInspector({
	world,
	updateWorld,
	selection,
	onSelectionChange,
}: CommandInspectorProps) {
	const {theme} = useTheme();
	const appearance = {theme: "auto" as const, scheme: theme};

	if (!selection) {
		return <p className="rightSideBarEmptyText">Select a command or block</p>;
	}

	const command = findCommand(world, selection.commandId);
	if (!command) return <p className="rightSideBarEmptyText">Select a command</p>;
	const failedBlockId =
		(selection.kind === "behavior-condition" || selection.kind === "behavior-effect") &&
		selection.behavior === "fallback" &&
		selection.blockId
			? toID("command-block", selection.blockId)
			: undefined;
	const commandVariableCatalog = buildCommandVariableCatalog(command, failedBlockId);
	const commandFieldMetadata = {
		name: resolveEditorMetadata(CommandSchema.shape.name),
		enabled: resolveEditorMetadata(CommandSchema.shape.enabled),
		showInHelp: resolveEditorMetadata(CommandSchema.shape.showInHelp),
		helpPattern: resolveEditorMetadata(CommandSchema.shape.helpPattern),
		helpDescription: resolveEditorMetadata(CommandSchema.shape.helpDescription),
		priority: resolveEditorMetadata(CommandSchema.shape.priority),
	};

	function updateCommand(recipe: (command: Command) => void) {
		updateWorld((draft) => {
			const target = draft.commands.find(
				(candidate) => idValue(candidate.id) === selection!.commandId,
			);
			if (target) recipe(target as Command);
		});
	}

	if (selection.kind === "command") {
		return (
			<div className="rightSideBarSection commandInspector">
				<header className="commandInspector__header">
					<p>Command</p>
					<h2>{command.name}</h2>
				</header>
				<section className="commandInspector__basics" aria-label="General command settings">
					<label>
						<span>{commandFieldMetadata.name.title}</span>
						<input
							type="text"
							value={command.name}
							onChange={(event) => updateCommand((target) => void (target.name = event.target.value))}
						/>
					</label>
					<label className="commandInspector__enabled">
						<input
							type="checkbox"
							checked={command.enabled}
							onChange={(event) => updateCommand((target) => void (target.enabled = event.target.checked))}
						/>
						<span>{commandFieldMetadata.enabled.title}</span>
					</label>
				</section>
				<section className="commandInspector__help" aria-labelledby="command-help-heading">
					<h3 id="command-help-heading">Player help</h3>
					<label className="commandInspector__helpToggle">
						<input
							type="checkbox"
							checked={command.showInHelp}
							onChange={(event) => {
								const checked = event.target.checked;
								updateCommand((target) => {
									target.showInHelp = checked;
									if (checked && !target.helpPattern.trim()) {
										target.helpPattern = suggestedHelpPattern(target);
									}
								});
							}}
						/>
						<span>{commandFieldMetadata.showInHelp.title}</span>
					</label>
					<p>
						Help appears only while the command is enabled and available in the current scope. Use wording
						that does not reveal hidden targets or alternate patterns.
					</p>
					{command.showInHelp ? (
						<div className="commandInspector__helpFields">
							<label>
								<span>{commandFieldMetadata.helpPattern.title}</span>
								<input
									type="text"
									placeholder="read <document>"
									value={command.helpPattern}
									onChange={(event) =>
										updateCommand((target) => void (target.helpPattern = event.target.value))
									}
								/>
							</label>
							<label>
								<span>{commandFieldMetadata.helpDescription.title}</span>
								<input
									type="text"
									placeholder="Read a visible document."
									value={command.helpDescription}
									onChange={(event) =>
										updateCommand((target) => void (target.helpDescription = event.target.value))
									}
								/>
							</label>
						</div>
					) : null}
				</section>
				<div className="commandInspector__scope">
					<label>
						<span>Available in</span>
						<select
							value={command.scope.scope}
							onChange={(event) => {
								const scope = event.target.value;
								updateCommand((target) => {
									target.scope =
										scope === "rooms"
											? {scope: "rooms", roomIds: [world.startRoomId]}
											: scope === "layers"
												? {scope: "layers", layers: [0]}
												: {scope: "global"};
								});
							}}
						>
							<option value="global">Everywhere</option>
							<option value="rooms">Selected rooms</option>
							<option value="layers">Selected layers</option>
						</select>
					</label>
					{command.scope.scope === "rooms" ? (
						<fieldset>
							<legend>Rooms</legend>
							{world.rooms.map((room) => {
								const checked =
									command.scope.scope === "rooms" &&
									command.scope.roomIds.some((roomId) => idValue(roomId) === idValue(room.id));
								return (
									<label key={idValue(room.id)}>
										<input
											type="checkbox"
											checked={checked}
											onChange={(event) =>
												updateCommand((target) => {
													if (target.scope.scope !== "rooms") return;
													target.scope.roomIds = event.target.checked
														? [...target.scope.roomIds, room.id]
														: target.scope.roomIds.filter((candidate) => idValue(candidate) !== idValue(room.id));
												})
											}
										/>
										{room.name}
									</label>
								);
							})}
						</fieldset>
					) : null}
					{command.scope.scope === "layers" ? (
						<label>
							<span>Layer numbers</span>
							<input
								type="text"
								value={command.scope.layers.join(", ")}
								onChange={(event) => {
									const layers = event.target.value
										.split(",")
										.map((value) => Number(value.trim()))
										.filter((value) => Number.isInteger(value));
									updateCommand((target) => {
										if (target.scope.scope === "layers") target.scope.layers = layers;
									});
								}}
							/>
						</label>
					) : null}
				</div>
				<label className="commandInspector__priority">
					<span>{commandFieldMetadata.priority.title}</span>
					<small>{commandFieldMetadata.priority.description}</small>
					<input
						type="number"
						value={command.priority}
						onChange={(event) =>
							updateCommand((target) => void (target.priority = Number(event.target.value)))
						}
					/>
				</label>
			</div>
		);
	}

	if (selection.kind === "behavior" || selection.kind === "fallback") {
		return (
			<p className="rightSideBarEmptyText">
				Select a branch condition or effect in the behavior workspace.
			</p>
		);
	}

	if (selection.kind === "behavior-condition") {
		const behavior = selectedBehavior(command, selection);
		const condition =
			selection.branch === "if"
				? behavior?.if?.condition
				: behavior?.elifs?.[selection.elifIndex ?? -1]?.condition;
		if (!behavior || !condition) return <p className="rightSideBarEmptyText">Condition not found</p>;
		return (
			<div className="rightSideBarSection commandInspector">
				<UniversalEditor
					schema={CommandConditionEditorSchema}
					value={condition}
					onChange={(nextCondition) =>
						updateCommand((target) => {
							const nextBehavior = selectedBehavior(target, selection);
							if (selection.branch === "if" && nextBehavior?.if) {
								nextBehavior.if.condition = nextCondition;
							} else {
								const branch = nextBehavior?.elifs?.[selection.elifIndex ?? -1];
								if (branch) branch.condition = nextCondition;
							}
						})
					}
					world={world}
					updateWorld={updateWorld}
					appearance={appearance}
					scrollOnExternalValueChange={false}
					commandVariableCatalog={commandVariableCatalog}
				/>
			</div>
		);
	}

	if (selection.kind === "behavior-effect") {
		const behavior = selectedBehavior(command, selection);
		const group = behavior ? selectedEffectGroup(behavior, selection) : undefined;
		if (!behavior || !group) return <p className="rightSideBarEmptyText">Effect group not found</p>;
		return (
			<div className="rightSideBarSection commandInspector">
				<UniversalEditor
					schema={CommandEffectGroupSchema}
					value={group}
					onChange={(nextGroup: CommandEffectGroup) =>
						updateCommand((target) => {
							const nextBehavior = selectedBehavior(target, selection);
							if (!nextBehavior) return;
							if (selection.branch === "always") nextBehavior.always = nextGroup;
							else if (selection.branch === "if" && nextBehavior.if) nextBehavior.if.effect = nextGroup;
							else if (selection.branch === "else") nextBehavior.else = nextGroup;
							else {
								const branch = nextBehavior.elifs?.[selection.elifIndex ?? -1];
								if (branch) branch.effect = nextGroup;
							}
						})
					}
					world={world}
					updateWorld={updateWorld}
					appearance={appearance}
					scrollOnExternalValueChange={false}
					commandVariableCatalog={commandVariableCatalog}
				/>
			</div>
		);
	}

	const located = findBlock(command, selection.blockId, selection.patternIndex);
	if (!located) return <p className="rightSideBarEmptyText">Block not found</p>;
	const {block, patternIndex, blockIndex} = located;
	const definition = blockDefinition(block.type);
	const fallbackIndex = command.fallbacks.findIndex(
		(fallback) => idValue(fallback.blockId) === idValue(block.id),
	);
	const fallback = fallbackIndex >= 0 ? command.fallbacks[fallbackIndex] : undefined;
	const customizedItemId =
		command.customization?.type === "item-command-customization" &&
		block.type === "target" &&
		(command.customization.targetBlockId
			? compareIds(block.id, command.customization.targetBlockId)
			: block.entityIds.some((reference) => compareIds(reference, command.customization?.itemId)))
			? command.customization.itemId
			: undefined;

	function updateSharedBlock(nextBlock: CommandBlock) {
		updateCommand((target) => {
			const next = {...nextBlock, id: block.id} as CommandBlock;
			target.patterns.forEach((pattern) => {
				pattern.blocks.forEach((candidate, candidateIndex) => {
					if (idValue(candidate.id) === idValue(block.id)) {
						pattern.blocks[candidateIndex] = {...next} as CommandBlock;
					}
				});
			});
			if (isStructuralBlock(next)) {
				target.fallbacks = target.fallbacks.filter(
					(candidate) => idValue(candidate.blockId) !== idValue(block.id),
				);
			}
		});
	}

	const Icon = definition.icon;
	return (
		<div className="rightSideBarSection commandInspector">
			{!isStructuralBlock(block) ? (
				<section className="commandInspector__fallback">
					<div>
						<strong>Fallback behavior</strong>
						<small>Used when this block only partially matches.</small>
					</div>
					{fallback ? (
						<>
							<button
								type="button"
								className="commandInspector__fallbackEdit"
								onClick={() =>
									onSelectionChange({
										kind: "fallback",
										commandId: selection.commandId,
										blockId: idValue(block.id),
									})
								}
							>
								Edit fallback
							</button>
							<button
								type="button"
								className="commandInspector__fallbackRemove"
								aria-label="Remove fallback behavior"
								onClick={() =>
									updateCommand((target) => {
										target.fallbacks = target.fallbacks.filter(
											(candidate) => idValue(candidate.blockId) !== idValue(block.id),
										);
									})
								}
							>
								<Trash2 size={14} aria-hidden="true" />
							</button>
						</>
					) : (
						<button
							type="button"
							className="commandInspector__fallbackAdd"
							onClick={() => {
								updateCommand((target) => {
									target.fallbacks.push({
										blockId: block.id,
										behavior: createBlockFallbackBehavior(block),
									});
								});
								onSelectionChange({
									kind: "fallback",
									commandId: selection.commandId,
									blockId: idValue(block.id),
								});
							}}
						>
							<Plus size={14} aria-hidden="true" />
							Add fallback behavior
						</button>
					)}
				</section>
			) : null}
			<header className={`commandInspector__header commandColor--${block.type}`}>
				<p>
					<Icon size={14} aria-hidden="true" />
					{definition.label} block
				</p>
				<h2>{definition.description}</h2>
			</header>
			{block.type === "target" ? (
				<section className="commandInspector__tags">
					<UniversalEditor
						schema={TargetTagsSchema}
						value={{tags: block.tags, tagMode: block.tagMode}}
						onChange={(nextTags) => updateSharedBlock({...block, ...nextTags})}
						world={world}
						updateWorld={updateWorld}
						appearance={appearance}
						scrollOnExternalValueChange={false}
					/>
				</section>
			) : null}
			<div className="commandInspector__move" aria-label="Reorder block">
				<button
					type="button"
					disabled={blockIndex === 0}
					onClick={() =>
						updateCommand((target) => {
							const blocks = target.patterns[patternIndex].blocks;
							const [moved] = blocks.splice(blockIndex, 1);
							if (moved) blocks.splice(blockIndex - 1, 0, moved);
						})
					}
				>
					<ArrowLeft size={14} aria-hidden="true" />
					Move Earlier
				</button>
				<button
					type="button"
					disabled={blockIndex === command.patterns[patternIndex].blocks.length - 1}
					onClick={() =>
						updateCommand((target) => {
							const blocks = target.patterns[patternIndex].blocks;
							const [moved] = blocks.splice(blockIndex, 1);
							if (moved) blocks.splice(blockIndex + 1, 0, moved);
						})
					}
				>
					Move Later
					<ArrowRight size={14} aria-hidden="true" />
				</button>
			</div>
			{block.type === "target" ? (
				<>
					<SpecificTargetsEditor
						block={block}
						world={world}
						customizedItemId={customizedItemId}
						onChange={updateSharedBlock}
					/>
					<UniversalEditor
						schema={customizedItemId ? ItemCustomizedTargetBlockDetailsSchema : TargetBlockDetailsSchema}
						value={block}
						onChange={(nextBlock) =>
							updateSharedBlock({
								...block,
								...nextBlock,
								entityIds: block.entityIds,
								entityTypes: block.entityTypes,
								tags: block.tags,
								tagMode: block.tagMode,
							})
						}
						world={world}
						updateWorld={updateWorld}
						appearance={appearance}
						scrollOnExternalValueChange={false}
					/>
				</>
			) : (
				<UniversalEditor
					schema={schemaForBlock(block)}
					value={block}
					onChange={(nextBlock: CommandBlock) => updateSharedBlock(nextBlock)}
					world={world}
					updateWorld={updateWorld}
					appearance={appearance}
					scrollOnExternalValueChange={false}
				/>
			)}
		</div>
	);
}
