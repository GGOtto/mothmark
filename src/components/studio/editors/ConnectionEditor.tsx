import {useMemo} from "react";
import {produce} from "immer";
import {ArrowLeft, ArrowLeftRight, ArrowRight, X} from "lucide-react";
import {type World} from "../../../schemas/world/worldSchema";
import {ConnectionSchema, type Connection, type Pathway} from "../../../schemas/world/roomSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {replaceConnectionDraft} from "@/app/editor/utils/worldDraftUtils";
import {UniversalEditor} from "../../universal-editor/UniversalEditor";
import {
	compareIds,
	idValue,
	resolveWorldEntityName,
	toID,
	updateWorldEntityId,
} from "@/utils/idUtils";
import {useTheme} from "@/components/theme/ThemeProvider";
import "./ConnectionEditor.scss";

type PathwayIndicatorProps = {
	pathway: Pathway;
};

export function PathwayIndicator({pathway}: PathwayIndicatorProps) {
	switch (pathway) {
		case "forwards":
			return <ArrowRight className="connectionEditorPathwayIcon" aria-label="Forwards connection" />;

		case "backwards":
			return <ArrowLeft className="connectionEditorPathwayIcon" aria-label="Backwards connection" />;

		case "two-way":
			return (
				<ArrowLeftRight className="connectionEditorPathwayIcon" aria-label="Two-way connection" />
			);

		case "no-way":
			return <X className="connectionEditorPathwayIcon" aria-label="No-way connection" />;

		default:
			return null;
	}
}

type ConnectionEditorProps = {
	selectedConnection: Connection;
	connections?: Pick<Connection, "id">[];
	world?: World;
	updateWorld?: UpdateWorld;
	onSelectedIdChange?: (selectedId: string) => void;
};

export function ConnectionEditor({
	selectedConnection,
	connections = [],
	world,
	updateWorld,
	onSelectedIdChange,
}: ConnectionEditorProps) {
	const {theme} = useTheme();
	const duplicateConnectionId = useMemo(() => {
		return (
			connections.filter((connection) => compareIds(connection.id, selectedConnection.id)).length > 1
		);
	}, [connections, selectedConnection.id]);

	const connectionTitle =
		selectedConnection.name && selectedConnection.name !== "" ? selectedConnection.name : null;
	const fromRoomLabel =
		(world
			? resolveWorldEntityName(world, toID("room", selectedConnection.fromRoomId))
			: undefined) ?? idValue(selectedConnection.fromRoomId);
	const toRoomLabel =
		(world ? resolveWorldEntityName(world, toID("room", selectedConnection.toRoomId)) : undefined) ??
		idValue(selectedConnection.toRoomId);

	function handleConnectionChange(updatedConnection: Connection) {
		const selectedConnectionId = idValue(selectedConnection.id);
		const updatedConnectionId = idValue(updatedConnection.id);

		if (world && updatedConnectionId !== selectedConnectionId) {
			const worldWithConnectionChanges = produce(world, (draft) => {
				replaceConnectionDraft(draft, selectedConnection.id, {
					...updatedConnection,
					id: selectedConnection.id,
				});
			});
			const renamedWorld = updateWorldEntityId(
				worldWithConnectionChanges,
				toID("connection", selectedConnection.id),
				updatedConnection.id,
			);

			updateWorld?.(renamedWorld);
			if (renamedWorld !== worldWithConnectionChanges) onSelectedIdChange?.(updatedConnectionId);
			return;
		}

		updateWorld?.((world) => {
			replaceConnectionDraft(world, selectedConnection.id, updatedConnection);
		});
	}

	return (
		<div className="rightSideBarSection connectionEditor">
			<div className="roomEditorHeader">
				<p className="roomEditorEyebrow">Selected Connection</p>

				<h2 className="roomEditorTitle">
					{connectionTitle ?? (
						<span className="connectionEditorPathwayTitle">
							<span>{fromRoomLabel}</span>
							<PathwayIndicator pathway={selectedConnection.pathway} />
							<span>{toRoomLabel}</span>
						</span>
					)}
				</h2>
			</div>

			{duplicateConnectionId ? (
				<p className="rightSideBarWarningText">
					This connection is already using the same internal identifier.
				</p>
			) : null}

			<UniversalEditor
				schema={ConnectionSchema}
				value={selectedConnection}
				onChange={handleConnectionChange}
				world={world}
				updateWorld={updateWorld}
				appearance={{
					theme: "auto",
					scheme: theme,
				}}
				className="connectionEditorUniversal"
				allowDelete={true}
			/>
		</div>
	);
}
