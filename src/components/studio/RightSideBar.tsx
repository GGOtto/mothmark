import type {Room, Connection} from "../../schemas/world/roomSchema";
import type {World} from "@/schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {AdjustableBox} from "../ui/AdjustableBox";
import {RoomEditor} from "./editors/RoomEditor";
import {ConnectionEditor} from "./editors/ConnectionEditor";
import "./RightSideBar.scss";

type RightSideBarProps = {
	world?: World;
	updateWorld?: UpdateWorld;
	selectedRoom: Room | null;
	selectedConnection: Connection | null;
	onSelectedIdChange?: (selectedId: string) => void;
	title?: string;
	description?: string;
};

export function RightSideBar({
	world,
	updateWorld,
	selectedRoom,
	selectedConnection,
	onSelectedIdChange,
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
					world={world}
					updateWorld={updateWorld}
					onSelectedIdChange={onSelectedIdChange}
				/>
			) : selectedConnection ? (
				<ConnectionEditor
					selectedConnection={selectedConnection}
					connections={world?.connections}
					world={world}
					updateWorld={updateWorld}
					onSelectedIdChange={onSelectedIdChange}
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
