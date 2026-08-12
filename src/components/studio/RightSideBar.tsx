import type {ReactNode} from "react";
import type {Room, Connection} from "../../schemas/world/roomSchema";
import type {World} from "@/schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {AdjustableBox} from "../ui/AdjustableBox";
import {RoomEditor} from "./editors/RoomEditor";
import {ConnectionEditor} from "./editors/ConnectionEditor";
import "./RightSideBar.scss";

type RightSideBarProps = {
	contained?: boolean;
	world?: World;
	updateWorld?: UpdateWorld;
	selectedRoom: Room | null;
	selectedConnection: Connection | null;
	onSelectedIdChange?: (selectedId: string) => void;
	onOpenItem?: (itemId: string) => void;
	onSelectionDeleted?: () => void;
	onConnectionDeleted?: () => void;
	title?: string;
	description?: string;
	children?: ReactNode;
};

export function RightSideBar({
	contained = false,
	world,
	updateWorld,
	selectedRoom,
	selectedConnection,
	onSelectedIdChange,
	onOpenItem,
	onSelectionDeleted,
	onConnectionDeleted,
	title,
	description,
	children,
}: RightSideBarProps) {
	return (
		<AdjustableBox
			width={contained ? "100%" : "35%"}
			maxWidth="100%"
			minWidth={contained ? 0 : "220px"}
			className="rightSideBar"
			adjustableEdges={contained ? [] : ["left"]}
		>
			{children ? (
				children
			) : selectedRoom ? (
				<RoomEditor
					selectedRoom={selectedRoom}
					world={world}
					updateWorld={updateWorld}
					onSelectedIdChange={onSelectedIdChange}
					onOpenItem={onOpenItem}
					onDelete={onSelectionDeleted}
				/>
			) : selectedConnection ? (
				<ConnectionEditor
					selectedConnection={selectedConnection}
					connections={world?.connections}
					world={world}
					updateWorld={updateWorld}
					onSelectedIdChange={onSelectedIdChange}
					onDelete={onConnectionDeleted}
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
