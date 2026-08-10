import {world as initialWorld} from "@/data/worlds/initialWorld";

import {
	deleteWorldDraft,
	draftMatchesServer,
	listWorldDrafts,
	readWorldDraft,
	worldDraftKey,
	writeWorldDraft,
	type WorldDraft,
} from "./worldDraftStorage";

const userA = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const userB = "e3f575a4-5797-4514-915b-533059123347";
const worldA = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const worldB = "f76f909d-5c82-4b04-aec6-85c9a175e1a2";

const draft: WorldDraft = {
	key: worldDraftKey(userA, worldA),
	schemaVersion: 2,
	userId: userA,
	worldId: worldA,
	world: initialWorld,
	baseServerRevision: 4,
	updatedAt: 1,
};

describe("world draft identity", () => {
	it("uses both user and world IDs so several accounts and worlds cannot share a draft", () => {
		expect(
			new Set([
				worldDraftKey(userA, worldA),
				worldDraftKey(userA, worldB),
				worldDraftKey(userB, worldA),
			]).size,
		).toBe(3);
	});

	it("restores only when user, world, and server revision all match", () => {
		expect(draftMatchesServer(draft, {userId: userA, worldId: worldA, revision: 4})).toBe(true);
		expect(draftMatchesServer(draft, {userId: userB, worldId: worldA, revision: 4})).toBe(false);
		expect(draftMatchesServer(draft, {userId: userA, worldId: worldB, revision: 4})).toBe(false);
		expect(draftMatchesServer(draft, {userId: userA, worldId: worldA, revision: 5})).toBe(false);
	});

	it("degrades safely when browser storage is unavailable", async () => {
		expect(await readWorldDraft(userA, worldA)).toBeNull();
		expect(await listWorldDrafts(userA)).toEqual([]);
		expect(
			await writeWorldDraft({
				userId: userA,
				worldId: worldA,
				world: initialWorld,
				baseServerRevision: 4,
			}),
		).toBe(false);
		await expect(deleteWorldDraft(userA, worldA)).resolves.toBeUndefined();
	});
});
