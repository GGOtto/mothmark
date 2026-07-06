import type {Room, Connection, Pathway} from "../../schemas/worldSchema";
import {AdjustableBox} from "../ui/AdjustableBox";
import "./RightSideBar.scss";

type RightSideBarProps = {
	selectedRoom: Room | null;
	selectedConnection: Connection | null;
	onRoomChange: (room: Room) => void;
	onConnectionChange: (connection: Connection) => void;
	title?: string;
	description?: string;
};

const PATHWAY_OPTIONS: Pathway[] = ["two-way", "forwards", "backwards", "no-way"];

type FieldLabelProps = {
	children: React.ReactNode;
};

function FieldLabel({children}: FieldLabelProps) {
	return <label className="rightSideBarFieldLabel">{children}</label>;
}

export function RightSideBar({
	selectedRoom,
	selectedConnection,
	onRoomChange,
	onConnectionChange,
	title,
	description,
}: RightSideBarProps) {
	return (
		<AdjustableBox
			width="33%"
			maxWidth="100%"
			minWidth="220px"
			className="rightSideBar"
			adjustableEdges={["left"]}
		>
			{selectedRoom ? (
				<RoomEditor selectedRoom={selectedRoom} onRoomChange={onRoomChange} />
			) : selectedConnection ? (
				<ConnectionEditor
					selectedConnection={selectedConnection}
					onConnectionChange={onConnectionChange}
				/>
			) : title ? (
				<EmptyTabPanel title={title} description={description} />
			) : (
				<p className="rightSideBarEmptyText">Select a room or connection</p>
			)}
		</AdjustableBox>
	);
}

type EmptyTabPanelProps = {
	title: string;
	description?: string;
};

function EmptyTabPanel({title, description}: EmptyTabPanelProps) {
	return (
		<div className="rightSideBarEmptyPanel">
			<p className="rightSideBarEmptyTitle">{title}</p>

			{description ? <p className="rightSideBarEmptyDescription">{description}</p> : null}
		</div>
	);
}

type RoomEditorProps = {
	selectedRoom: Room;
	onRoomChange: (room: Room) => void;
};

function RoomEditor({selectedRoom, onRoomChange}: RoomEditorProps) {
	return (
		<div className="rightSideBarSection">
			<FieldLabel>Room Name</FieldLabel>

			<input
				className="rightSideBarInput"
				value={selectedRoom.name}
				onChange={(event) =>
					onRoomChange({
						...selectedRoom,
						name: event.target.value,
					})
				}
			/>
		</div>
	);
}

type ConnectionEditorProps = {
	selectedConnection: Connection;
	onConnectionChange: (connection: Connection) => void;
};

function ConnectionEditor({selectedConnection, onConnectionChange}: ConnectionEditorProps) {
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
		</div>
	);
}
