"use client";

import {produce} from "immer";
import {useTheme} from "@/components/theme/ThemeProvider";
import {UniversalEditor} from "@/components/universal-editor/UniversalEditor";
import {ConditionSchema} from "@/schemas/world/conditionSchema";
import {EffectGroupSchema, type EffectGroup} from "@/schemas/world/effectSchema";
import {editor} from "@/schemas/utils/editorSchemaHelpers";
import type {World} from "@/schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {idValue} from "@/utils/idUtils";
import type {LogicSelection} from "./LogicEditor";

type LogicInspectorProps = {
	world: World;
	updateWorld: UpdateWorld;
	selection: LogicSelection | null;
};

const BranchConditionEditorSchema = editor.conditionControl(ConditionSchema, {title: "Condition"});

export function LogicInspector({world, updateWorld, selection}: LogicInspectorProps) {
	const {theme} = useTheme();
	const appearance = {theme: "auto" as const, scheme: theme};

	if (!selection) {
		return <p className="rightSideBarEmptyText">Select an event, condition, or effect</p>;
	}

	const event = world.events?.find((candidate) => idValue(candidate.id) === selection.eventId);
	if (!event) return <p className="rightSideBarEmptyText">Select an event</p>;

	if (selection.kind === "event") {
		return <p className="rightSideBarEmptyText">Select a condition or effect</p>;
	}

	if (selection.kind === "condition") {
		type BranchCondition = NonNullable<(typeof event)["branch"]["if"]>["condition"];
		const condition =
			selection.branch === "if"
				? event.branch.if?.condition
				: event.branch.elifs?.[selection.elifIndex ?? -1]?.condition;
		if (!condition) return <p className="rightSideBarEmptyText">Condition not found</p>;

		function changeCondition(nextCondition: BranchCondition) {
			updateWorld(
				produce(world, (draft) => {
					const target = draft.events?.find((candidate) => idValue(candidate.id) === selection!.eventId);
					if (!target || selection!.kind !== "condition") return;
					if (selection!.branch === "if" && target.branch.if) {
						target.branch.if.condition = nextCondition;
					} else if (selection!.branch === "elif") {
						const branch = target.branch.elifs?.[selection!.elifIndex ?? -1];
						if (branch) branch.condition = nextCondition;
					}
				}),
			);
		}

		return (
			<div className="rightSideBarSection">
				<UniversalEditor
					schema={BranchConditionEditorSchema}
					value={condition}
					onChange={changeCondition}
					world={world}
					updateWorld={updateWorld}
					appearance={appearance}
				/>
			</div>
		);
	}

	const group = world.effects.find((candidate) => idValue(candidate.id) === selection.effectId);
	if (!group) return <p className="rightSideBarEmptyText">Effect group not found</p>;
	const selectedEffectId = selection.effectId;

	function changeEffectGroup(nextGroup: EffectGroup) {
		updateWorld((draft) => {
			const index = draft.effects.findIndex((candidate) => idValue(candidate.id) === selectedEffectId);
			if (index >= 0) draft.effects[index] = nextGroup;
		});
	}

	return (
		<div className="rightSideBarSection">
			<UniversalEditor
				schema={EffectGroupSchema}
				value={group}
				onChange={changeEffectGroup}
				world={world}
				updateWorld={updateWorld}
				appearance={appearance}
			/>
		</div>
	);
}
