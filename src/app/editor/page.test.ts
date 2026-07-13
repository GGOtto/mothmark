import {getConnectionDraftStatus} from "./page";

describe("map toolbar node status", () => {
	it("describes the hovered node when no connection draft is active", () => {
		const nodeStatus = {
			kind: "node",
			label: "Northwest passage node · Click to connect",
		} as const;

		expect(getConnectionDraftStatus({state: "idle"}, [], nodeStatus, null)).toEqual(nodeStatus);
	});

	it("returns to a notice after a hover ends", () => {
		const noticeStatus = {kind: "cancelled", label: "Cancelled"} as const;

		expect(getConnectionDraftStatus({state: "idle"}, [], null, noticeStatus)).toEqual(noticeStatus);
	});

	it("keeps an active connection draft status ahead of hover status", () => {
		expect(
			getConnectionDraftStatus(
				{state: "choosing-destination", fromRoomId: "room-1", fromDirection: "n"},
				[],
				{kind: "node", label: "Northwest passage node · Click to connect"},
				{kind: "cancelled", label: "Cancelled"},
			),
		).toEqual({kind: "destination", label: "Choose destination"});
	});
});
