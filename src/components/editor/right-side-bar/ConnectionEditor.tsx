import {useMemo} from "react";
import {ArrowLeft, ArrowLeftRight, ArrowRight, Minus} from "lucide-react";
import {type World} from "../../../schemas/worldSchema";
import {ConnectionSchema, type Connection, type Pathway} from "../../../schemas/roomSchema";
import {UniversalEditor} from "../universal/UniversalEditor";
import {compareIds, idValue, resolveWorldEntityName, toID} from "@/utils/idUtils";
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
			return <Minus className="connectionEditorPathwayIcon" aria-label="No-way connection" />;

		default:
			return null;
	}
}

type ConnectionEditorProps = {
	selectedConnection: Connection;
	connections?: Pick<Connection, "id">[];
	world?: World;
	onWorldChange?: (world: World) => void;
	onConnectionChange: (connection: Connection) => void;
};

export function ConnectionEditor({
	selectedConnection,
	connections = [],
	world,
	onWorldChange,
	onConnectionChange,
}: ConnectionEditorProps) {
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
				onChange={onConnectionChange}
				world={world}
				onWorldChange={onWorldChange}
				appearance={{
					theme: "auto",
					scheme: "dark",
					chrome: "field", // TODO: maybe an auto mode that adjusts based on the available space
				}}
				className="connectionEditorUniversal"
			/>
		</div>
	);
}
