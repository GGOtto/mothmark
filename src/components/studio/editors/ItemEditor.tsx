import {useMemo} from "react";
import {produce} from "immer";
import type {Item, World} from "@/schemas/world/worldSchema";
import {ItemSchema} from "@/schemas/world/itemSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {replaceItemDraft} from "@/app/editor/utils/worldDraftUtils";
import {UniversalEditor} from "@/components/universal-editor/UniversalEditor";
import {compareIds, idValue, toID, updateWorldEntityId} from "@/utils/idUtils";
import {useTheme} from "@/components/theme/ThemeProvider";

type ItemEditorProps = {
	selectedItem: Item;
	world: World;
	updateWorld: UpdateWorld;
	onSelectedIdChange?: (selectedId: string) => void;
};

export function ItemEditor({
	selectedItem,
	world,
	updateWorld,
	onSelectedIdChange,
}: ItemEditorProps) {
	const {theme} = useTheme();
	const duplicateItemId = useMemo(
		() => world.items.filter((item) => compareIds(item.id, selectedItem.id)).length > 1,
		[selectedItem.id, world.items],
	);

	function handleItemChange(updatedItem: Item) {
		const selectedId = idValue(selectedItem.id);
		const updatedId = idValue(updatedItem.id);
		if (updatedId !== selectedId) {
			const worldWithChanges = produce(world, (draft) => {
				replaceItemDraft(draft, selectedItem.id, {...updatedItem, id: selectedItem.id});
			});
			const renamedWorld = updateWorldEntityId(
				worldWithChanges,
				toID("item", selectedItem.id),
				updatedItem.id,
			);
			updateWorld(renamedWorld);
			if (renamedWorld !== worldWithChanges) onSelectedIdChange?.(updatedId);
			return;
		}

		updateWorld((draft) => {
			replaceItemDraft(draft, selectedItem.id, updatedItem);
		});
	}

	return (
		<div className="rightSideBarSection itemEditor">
			<div className="roomEditorHeader">
				<p className="roomEditorEyebrow">Selected item</p>
				<h2 className="roomEditorTitle">{selectedItem.name || "Unnamed item"}</h2>
			</div>

			{duplicateItemId ? (
				<p className="rightSideBarWarningText">
					This item is already using the same internal identifier.
				</p>
			) : null}

			<UniversalEditor
				schema={ItemSchema}
				value={selectedItem}
				onChange={handleItemChange}
				world={world}
				updateWorld={updateWorld}
				appearance={{theme: "auto", scheme: theme}}
				className="itemEditorUniversal"
				allowDelete={true}
			/>
		</div>
	);
}
