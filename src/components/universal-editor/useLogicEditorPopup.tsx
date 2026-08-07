"use client";

import {produce} from "immer";
import {useState} from "react";
import type {z} from "zod";
import type {CommandVariableCatalog} from "@/features/command-variables";
import type {World} from "@/schemas/world/worldSchema";
import type {UpdateWorld, WorldUpdate} from "@/types/worldUpdaterTypes";
import {useOptionalPopup} from "@/components/popup/Popup";
import {LogicEditorPopupSurface, type LogicKind} from "./LogicControlPopup";
import {UniversalEditor} from "./UniversalEditor";

export type LogicEditorPopupRequest<TValue> = {
	kind: LogicKind;
	title?: string;
	schema: z.ZodTypeAny;
	value: TValue;
	onChange: (value: TValue) => void;
	world: World;
	updateWorld: UpdateWorld;
	summary: (value: TValue) => string;
	commandVariableCatalog?: CommandVariableCatalog;
};

function applyWorldUpdate(world: World, update: WorldUpdate) {
	return typeof update === "function" ? produce(world, update) : update;
}

function LiveLogicEditor<TValue>({
	request,
	onClose,
}: {
	request: LogicEditorPopupRequest<TValue>;
	onClose: () => void;
}) {
	const [value, setValue] = useState(request.value);
	const [world, setWorld] = useState(request.world);

	function changeValue(nextValue: TValue) {
		setValue(nextValue);
		request.onChange(nextValue);
	}

	function updateWorld(update: WorldUpdate) {
		setWorld((current) => applyWorldUpdate(current, update));
		request.updateWorld(update);
	}

	return (
		<LogicEditorPopupSurface
			kind={request.kind}
			title={request.title ?? `Edit ${request.kind}`}
			summary={request.summary(value)}
			onClose={onClose}
		>
			<UniversalEditor
				className="logicControlPopup__editor"
				schema={request.schema}
				value={value}
				onChange={changeValue}
				world={world}
				updateWorld={updateWorld}
				commandVariableCatalog={request.commandVariableCatalog}
				logicEditorPresentation="inline"
				hideRootShellHeader
				scrollOnExternalValueChange={false}
			/>
		</LogicEditorPopupSurface>
	);
}

export function useLogicEditorPopup() {
	const popup = useOptionalPopup();

	return function openLogicEditor<TValue>(request: LogicEditorPopupRequest<TValue>) {
		if (!popup) return Promise.resolve();
		return popup.open<void>(
			({resolve}) => <LiveLogicEditor request={request} onClose={() => resolve()} />,
			{className: "popupSurfaceLogicControl", closeOnBackdropClick: false},
		);
	};
}
