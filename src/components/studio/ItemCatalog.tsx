import {useMemo, useState} from "react";
import {Box, Plus, Search} from "lucide-react";
import type {Item, World} from "@/schemas/world/worldSchema";
import {ItemSchema} from "@/schemas/world/itemSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {addItemDraft} from "@/app/editor/utils/worldDraftUtils";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {generateUniqueId, idValue} from "@/utils/idUtils";

type ItemCatalogProps = {
	world: World;
	updateWorld: UpdateWorld;
	selectedItemId: string | null;
	onSelectItem: (itemId: string) => void;
};

function startingLocationLabel(item: Item, world: World) {
	const location = item.initialState.location;
	if (location.type === "room") {
		return world.rooms.find((room) => idValue(room.id) === idValue(location.roomId))?.name ?? "Room";
	}
	if (location.type === "item") {
		const parent = world.items.find(
			(candidate) => idValue(candidate.id) === idValue(location.itemId),
		);
		return `${location.placement === "inside" ? "Inside" : "On"} ${parent?.name ?? "item"}`;
	}
	return location.type === "inventory" ? "Player inventory" : location.type;
}

export function ItemCatalog({world, updateWorld, selectedItemId, onSelectItem}: ItemCatalogProps) {
	const [query, setQuery] = useState("");
	const visibleItems = useMemo(() => {
		const normalized = query.trim().toLocaleLowerCase();
		if (!normalized) return world.items;
		return world.items.filter((item) =>
			[item.name, idValue(item.id), ...item.aliases, ...item.tags]
				.join(" ")
				.toLocaleLowerCase()
				.includes(normalized),
		);
	}, [query, world.items]);

	function addItem() {
		const nextId = generateUniqueId("item", world.items);
		const nextItem = createDefaultFieldObject(ItemSchema);
		nextItem.id = nextId;
		nextItem.name = "New item";
		nextItem.initialState.location = world.rooms[0]
			? {type: "room", roomId: world.rooms[0].id}
			: {type: "hidden"};
		updateWorld((draft) => void addItemDraft(draft, nextItem));
		onSelectItem(idValue(nextId));
	}

	return (
		<div className="itemCatalog">
			<div className="itemCatalogIntro">
				<div>
					<h1>Items</h1>
					<p>Scenery and portable objects share one system. Behaviors add standard capabilities.</p>
				</div>
				<button type="button" className="itemCatalogAdd" onClick={addItem}>
					<Plus size={16} /> Add item
				</button>
			</div>

			<label className="itemCatalogSearch">
				<Search size={15} />
				<input
					type="search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search items, aliases, and tags"
				/>
			</label>

			<div className="itemCatalogTable" role="list">
				<div className="itemCatalogTableHeader" aria-hidden="true">
					<span>Item</span>
					<span>Behaviors</span>
					<span>Starts</span>
				</div>
				{visibleItems.map((item) => {
					const behaviors = item.behaviors.map((behavior) => behavior.type);
					return (
						<button
							type="button"
							role="listitem"
							key={idValue(item.id)}
							className={`itemCatalogRow ${selectedItemId === idValue(item.id) ? "itemCatalogRowSelected" : ""}`}
							onClick={() => onSelectItem(idValue(item.id))}
						>
							<span className="itemCatalogIdentity">
								<Box size={16} />
								<span>
									<strong>{item.name}</strong>
									<small>{idValue(item.id)}</small>
								</span>
							</span>
							<span className="itemCatalogBehaviors">
								{behaviors.length ? behaviors.join(" · ") : "Fixed item"}
							</span>
							<span className="itemCatalogLocation">{startingLocationLabel(item, world)}</span>
						</button>
					);
				})}
				{visibleItems.length === 0 ? (
					<p className="itemCatalogEmpty">No items match this search.</p>
				) : null}
			</div>
		</div>
	);
}
