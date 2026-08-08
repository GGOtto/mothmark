import {Box, Plus} from "lucide-react";
import {ItemSchema} from "@/schemas/world/itemSchema";
import type {Room, World} from "@/schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {compareIds, generateUniqueId, idValue} from "@/utils/idUtils";
import {addItemDraft} from "@/app/editor/utils/worldDraftUtils";

type RoomStartingItemsProps = {
	room: Room;
	world: World;
	updateWorld: UpdateWorld;
	onOpenItem?: (itemId: string) => void;
};

export function startingItemsForRoom(world: World, room: Room) {
	return world.items.filter(
		(item) =>
			item.initialState.location.type === "room" &&
			compareIds(item.initialState.location.roomId, room.id),
	);
}

export function RoomStartingItems({room, world, updateWorld, onOpenItem}: RoomStartingItemsProps) {
	const startingItems = startingItemsForRoom(world, room);

	function addItem() {
		const nextId = generateUniqueId("item", world.items);
		const nextItem = createDefaultFieldObject(ItemSchema);
		nextItem.id = nextId;
		nextItem.name = "New item";
		nextItem.initialState.location = {type: "room", roomId: room.id};

		updateWorld((draft) => void addItemDraft(draft, nextItem));
	}

	return (
		<section className="roomEditorStartingItems" aria-labelledby="room-starting-items-title">
			<div className="roomEditorStartingItemsHeader">
				<div>
					<h3 id="room-starting-items-title">Starting items</h3>
					<p>Items placed directly in this room when the game begins.</p>
				</div>
				<button type="button" onClick={addItem}>
					<Plus size={14} aria-hidden="true" />
					Add item
				</button>
			</div>

			{startingItems.length > 0 ? (
				<ul className="roomEditorStartingItemsList">
					{startingItems.map((item) => (
						<li key={idValue(item.id)}>
							<button type="button" onClick={() => onOpenItem?.(idValue(item.id))}>
								<Box size={14} aria-hidden="true" />
								<span>
									<strong>{item.name || "Unnamed item"}</strong>
									<small>{idValue(item.id)}</small>
								</span>
								<em>Edit</em>
							</button>
						</li>
					))}
				</ul>
			) : (
				<p className="roomEditorStartingItemsEmpty">No items start in this room.</p>
			)}
		</section>
	);
}
