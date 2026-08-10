import {z} from "zod";

import {WorldSchema, type World} from "@/schemas/world/worldSchema";

const DATABASE_NAME = "mothmark-editor";
const DATABASE_VERSION = 1;
const DRAFT_STORE_NAME = "world-drafts";
const DRAFT_KEY_PREFIX = "world-draft";

const WorldDraftSchema = z.object({
	key: z.string().startsWith(`${DRAFT_KEY_PREFIX}:`),
	schemaVersion: z.literal(2),
	userId: z.string().min(1),
	worldId: z.string().min(1),
	world: WorldSchema,
	baseServerRevision: z.number().int().positive(),
	updatedAt: z.number(),
});

export type WorldDraft = z.infer<typeof WorldDraftSchema>;

type DraftInput = {
	userId: string | null;
	world: World;
	worldId: string | null;
	baseServerRevision: number | null;
};

export const worldDraftKey = (userId: string, worldId: string) =>
	`${DRAFT_KEY_PREFIX}:${userId}:${worldId}`;

const indexedDbAvailable = () => typeof indexedDB !== "undefined";

const openDraftDatabase = (): Promise<IDBDatabase> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

		request.onupgradeneeded = () => {
			const database = request.result;
			if (!database.objectStoreNames.contains(DRAFT_STORE_NAME)) {
				database.createObjectStore(DRAFT_STORE_NAME, {keyPath: "key"});
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("Could not open draft storage."));
	});

const runDraftRequest = async <T>(
	mode: IDBTransactionMode,
	startRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
	const database = await openDraftDatabase();

	return new Promise((resolve, reject) => {
		const transaction = database.transaction(DRAFT_STORE_NAME, mode);
		const request = startRequest(transaction.objectStore(DRAFT_STORE_NAME));
		let result: T;

		request.onsuccess = () => {
			result = request.result;
		};
		request.onerror = () => reject(request.error ?? new Error("Draft storage request failed."));
		transaction.oncomplete = () => {
			database.close();
			resolve(result);
		};
		transaction.onerror = () => {
			database.close();
			reject(transaction.error ?? new Error("Draft storage transaction failed."));
		};
		transaction.onabort = transaction.onerror;
	});
};

export async function readWorldDraft(userId: string, worldId: string): Promise<WorldDraft | null> {
	if (!indexedDbAvailable()) return null;
	const storedDraft = await runDraftRequest<unknown>("readonly", (store) =>
		store.get(worldDraftKey(userId, worldId)),
	);
	const result = WorldDraftSchema.safeParse(storedDraft);
	return result.success ? result.data : null;
}

export async function listWorldDrafts(userId: string): Promise<WorldDraft[]> {
	if (!indexedDbAvailable()) return [];
	const storedDrafts = await runDraftRequest<unknown[]>("readonly", (store) => store.getAll());
	return storedDrafts.flatMap((stored) => {
		const result = WorldDraftSchema.safeParse(stored);
		return result.success && result.data.userId === userId ? [result.data] : [];
	});
}

export async function writeWorldDraft(input: DraftInput): Promise<boolean> {
	if (
		!indexedDbAvailable() ||
		!input.userId ||
		!input.worldId ||
		input.baseServerRevision === null
	) {
		return false;
	}

	const draft: WorldDraft = {
		key: worldDraftKey(input.userId, input.worldId),
		schemaVersion: 2,
		userId: input.userId,
		worldId: input.worldId,
		world: input.world,
		baseServerRevision: input.baseServerRevision,
		updatedAt: Date.now(),
	};
	await runDraftRequest<IDBValidKey>("readwrite", (store) => store.put(draft));
	return true;
}

export async function deleteWorldDraft(userId: string, worldId: string): Promise<void> {
	if (!indexedDbAvailable()) return;
	await runDraftRequest<undefined>("readwrite", (store) =>
		store.delete(worldDraftKey(userId, worldId)),
	);
}

export async function deleteWorldDraftsForUser(userId: string): Promise<void> {
	for (const draft of await listWorldDrafts(userId)) {
		await deleteWorldDraft(userId, draft.worldId);
	}
}

/** Removes drafts left behind by an inaccessible browser-bound account. */
export async function deleteWorldDraftsExceptUser(userId: string): Promise<void> {
	if (!indexedDbAvailable()) return;
	const storedDrafts = await runDraftRequest<unknown[]>("readonly", (store) => store.getAll());
	for (const stored of storedDrafts) {
		const parsed = WorldDraftSchema.safeParse(stored);
		if (parsed.success && parsed.data.userId !== userId) {
			await deleteWorldDraft(parsed.data.userId, parsed.data.worldId);
		}
	}
}

export function draftMatchesServer(
	draft: WorldDraft,
	server: {userId: string; worldId: string; revision: number},
): boolean {
	return (
		draft.userId === server.userId &&
		draft.worldId === server.worldId &&
		draft.baseServerRevision === server.revision
	);
}
