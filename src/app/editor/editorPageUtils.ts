import type {ConnectionDraft} from "@/components/map/Map";
import type {ToolBarStatus} from "@/components/studio/ToolBar";
import type {Room} from "@/schemas/worldSchema";

export function getConnectionDraftStatus(
	draft: ConnectionDraft,
	rooms: Room[],
	hoverStatus: ToolBarStatus | null,
	noticeStatus: ToolBarStatus | null,
): ToolBarStatus {
	if (draft.state === "choosing-destination") {
		return {kind: "destination", label: "Choose destination"};
	}
	if (draft.state === "choosing-return") return {kind: "return", label: "Choose return"};
	if (hoverStatus) return hoverStatus;
	if (noticeStatus) return noticeStatus;
	return {kind: "idle", label: `${rooms.length} rooms`};
}
