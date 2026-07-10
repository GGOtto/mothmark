import type {Room, Connection, World} from "../../../schemas/worldSchema";
import {AdjustableBox} from "../../ui/AdjustableBox";
import {RoomEditor} from "./RoomEditor";
import {ConnectionEditor} from "./ConnectionEditor";
import "./RightSideBar.scss";

type RightSideBarProps = {
	world?: World;
	rooms?: Room[];
	selectedRoom: Room | null;
	selectedConnection: Connection | null;
	onRoomChange: (room: Room) => void;
	onConnectionChange: (connection: Connection) => void;
	deleteConnection: (connection: Connection) => void;
	title?: string;
	description?: string;
};

export function RightSideBar({
	world,
	rooms = [],
	selectedRoom,
	selectedConnection,
	onRoomChange,
	onConnectionChange,
	deleteConnection,
	title,
	description,
}: RightSideBarProps) {
	return (
		<AdjustableBox
			width="35%"
			maxWidth="100%"
			minWidth="220px"
			className="rightSideBar"
			adjustableEdges={["left"]}
		>
			{selectedRoom ? (
				<RoomEditor
					selectedRoom={selectedRoom}
					rooms={rooms}
					world={world}
					onRoomChange={onRoomChange}
				/>
			) : selectedConnection ? (
				<ConnectionEditor
					selectedConnection={selectedConnection}
					onConnectionChange={onConnectionChange}
					deleteConnection={deleteConnection}
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
