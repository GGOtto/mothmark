import {world} from "@/data/worlds/initialWorld";
import type {ConnectionDraft} from "@/components/map/Map";
import {idValue} from "@/utils/idUtils";
import {getConnectionDraftStatus} from "./editorPageUtils";

describe("getConnectionDraftStatus", () => {
	const idleDraft = {state: "idle"} satisfies ConnectionDraft;

	it("prompts for the next room while choosing a destination", () => {
		expect(
			getConnectionDraftStatus(
				{
					state: "choosing-destination",
					fromRoomId: idValue(world.rooms[0].id),
					fromDirection: "n",
				},
				world.rooms,
				null,
				null,
			),
		).toEqual({kind: "destination", label: "Choose destination"});
	});

	it("prompts for the return direction after choosing a destination", () => {
		expect(
			getConnectionDraftStatus(
				{
					state: "choosing-return",
					fromRoomId: idValue(world.rooms[0].id),
					toRoomId: idValue(world.rooms[1].id),
					fromDirection: "n",
				},
				world.rooms,
				null,
				null,
			),
		).toEqual({kind: "return", label: "Choose return"});
	});

	it("keeps connection prompts above transient hover and notice messages", () => {
		const hover = {kind: "node", label: "Room under pointer"} as const;
		const notice = {kind: "cancelled", label: "Saved"} as const;

		expect(
			getConnectionDraftStatus(
				{
					state: "choosing-destination",
					fromRoomId: idValue(world.rooms[0].id),
					fromDirection: "e",
				},
				world.rooms,
				hover,
				notice,
			),
		).toEqual({kind: "destination", label: "Choose destination"});
	});

	it("prefers hover feedback over a notice", () => {
		const hover = {kind: "node", label: "Room under pointer"} as const;
		const notice = {kind: "cancelled", label: "Saved"} as const;

		expect(getConnectionDraftStatus(idleDraft, world.rooms, hover, notice)).toBe(hover);
	});

	it("falls back through notice and room-count idle states", () => {
		const notice = {kind: "cancelled", label: "Saved"} as const;

		expect(getConnectionDraftStatus(idleDraft, world.rooms, null, notice)).toBe(notice);
		expect(getConnectionDraftStatus(idleDraft, world.rooms, null, null)).toEqual({
			kind: "idle",
			label: `${world.rooms.length} rooms`,
		});
		expect(getConnectionDraftStatus(idleDraft, [], null, null)).toEqual({
			kind: "idle",
			label: "0 rooms",
		});
	});
});
