"use client";

import {ArrowLeft, ArrowRight, Plus, Trash2} from "lucide-react";
import {useTheme} from "@/components/theme/ThemeProvider";
import {UniversalEditor} from "@/components/universal-editor/UniversalEditor";
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
} from "@/schemas/world/commandSchemas";
import type {World} from "@/schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {idValue, toID} from "@/utils/idUtils";
import type {CommandSelection} from "../shared";
import {blockDefinition, isStructuralBlock} from "./CommandEditor";
import {createBlockFallbackBehavior} from "./commandFallback";
import {buildCommandVariableCatalog} from "@/features/command-variables";
import {CommandConditionEditorSchema} from "../shared/logicEditorSchemas";

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

const TargetBlockDetailsSchema = TargetBlockSchema.omit({tags: true, tagMode: true});

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
					<span>Priority</span>
					<small>An advanced tie-breaker between equally specific commands.</small>
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
				<UniversalEditor
					schema={TargetBlockDetailsSchema}
					value={block}
					onChange={(nextBlock) =>
						updateSharedBlock({...block, ...nextBlock, tags: block.tags, tagMode: block.tagMode})
					}
					world={world}
					updateWorld={updateWorld}
					appearance={appearance}
					scrollOnExternalValueChange={false}
				/>
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
