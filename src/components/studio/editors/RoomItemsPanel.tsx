import type {Room, World} from "@/schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {RoomStartingItems} from "./RoomStartingItems";

type RoomItemsPanelProps = {
	room: Room;
	world: World;
	updateWorld: UpdateWorld;
	onOpenItem?: (itemId: string) => void;
};

export function RoomItemsPanel({room, world, updateWorld, onOpenItem}: RoomItemsPanelProps) {
	return (
		<div className="rightSideBarSection roomItemsPanel">
			<div className="roomEditorHeader">
				<p className="roomEditorEyebrow">Items in room</p>
				<h2 className="roomEditorTitle">{room.name || "Unnamed room"}</h2>
			</div>

			<RoomStartingItems room={room} world={world} updateWorld={updateWorld} onOpenItem={onOpenItem} />
		</div>
	);
}
