import type {Connection, Pathway} from "../../../schemas/worldSchema";
import {FieldLabel} from "./FieldLabel";

const PATHWAY_OPTIONS: Pathway[] = ["two-way", "forwards", "backwards", "no-way"];

type ConnectionEditorProps = {
	selectedConnection: Connection;
	onConnectionChange: (connection: Connection) => void;
	deleteConnection: (connection: Connection) => void;
};

export function ConnectionEditor({
	selectedConnection,
	onConnectionChange,
	deleteConnection,
}: ConnectionEditorProps) {
	return (
		<div className="rightSideBarSection">
			<FieldLabel>Connection</FieldLabel>

			<div className="rightSideBarConnectionMeta">
				<div>
					<strong>From:</strong> {selectedConnection.fromRoomId} {selectedConnection.direction}
				</div>

				<div>
					<strong>To:</strong> {selectedConnection.toRoomId} {selectedConnection.returnDirection}
				</div>
			</div>

			<FieldLabel>Pathway</FieldLabel>

			<select
				className="rightSideBarInput"
				value={selectedConnection.pathway}
				onChange={(event) =>
					onConnectionChange({
						...selectedConnection,
						pathway: event.target.value as Pathway,
					})
				}
			>
				{PATHWAY_OPTIONS.map((pathway) => (
					<option key={pathway} value={pathway}>
						{pathway}
					</option>
				))}
			</select>

			<FieldLabel>Delete Connection</FieldLabel>

			<button
				type="button"
				className="rightSideBarButton rightSideBarButtonDanger"
				onClick={() => deleteConnection(selectedConnection)}
			>
				Delete
			</button>
		</div>
	);
}
