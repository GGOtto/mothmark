import {useMemo} from "react";
import {produce} from "immer";
import {type World} from "../../../schemas/world/worldSchema";
import {RoomSchema, type Room} from "../../../schemas/world/roomSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {replaceRoomDraft} from "@/app/editor/utils/worldDraftUtils";
import {UniversalEditor} from "../../universal-editor/UniversalEditor";
import {compareIds, idValue, toID, updateWorldEntityId} from "@/utils/idUtils";
import {useTheme} from "@/components/theme/ThemeProvider";

type RoomEditorProps = {
	selectedRoom: Room;
	world?: World;
	updateWorld?: UpdateWorld;
	onSelectedIdChange?: (selectedId: string) => void;
};

export function RoomEditor({
	selectedRoom,
	world,
	updateWorld,
	onSelectedIdChange,
}: RoomEditorProps) {
	const {theme} = useTheme();
	const duplicateRoomId = useMemo(() => {
		return world
			? world.rooms.filter((room) => compareIds(room.id, selectedRoom.id)).length > 1
			: false;
	}, [selectedRoom.id, world]);

	function handleRoomChange(updatedRoom: Room) {
		const selectedRoomId = idValue(selectedRoom.id);
		const updatedRoomId = idValue(updatedRoom.id);

		if (world && updatedRoomId !== selectedRoomId) {
			const worldWithRoomChanges = produce(world, (draft) => {
				replaceRoomDraft(draft, selectedRoom.id, {...updatedRoom, id: selectedRoom.id});
			});
			const renamedWorld = updateWorldEntityId(
				worldWithRoomChanges,
				toID("room", selectedRoom.id),
				updatedRoom.id,
			);

			updateWorld?.(renamedWorld);
			if (renamedWorld !== worldWithRoomChanges) onSelectedIdChange?.(updatedRoomId);
			return;
		}

		updateWorld?.((world) => {
			replaceRoomDraft(world, selectedRoom.id, updatedRoom);
		});
	}

	return (
		<div className="rightSideBarSection roomEditor">
			<div className="roomEditorHeader">
				<p className="roomEditorEyebrow">Selected Room</p>
				<h2 className="roomEditorTitle">{selectedRoom.name || "Unnamed Room"}</h2>
			</div>

			{duplicateRoomId ? (
				<p className="rightSideBarWarningText">
					This room is already using the same internal identifier.
				</p>
			) : null}

			<UniversalEditor
				schema={RoomSchema}
				value={selectedRoom}
				onChange={handleRoomChange}
				world={world}
				updateWorld={updateWorld}
				appearance={{
					theme: "auto",
					scheme: theme,
				}}
				className="roomEditorUniversal"
				allowDelete={true}
			/>
		</div>
	);
}
