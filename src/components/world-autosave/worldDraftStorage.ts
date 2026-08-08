import {z} from "zod";

import {WorldSchema, type World} from "@/schemas/world/worldSchema";

const DATABASE_NAME = "mothmark-editor";
const DATABASE_VERSION = 1;
const DRAFT_STORE_NAME = "world-drafts";
const MAIN_WORLD_DRAFT_KEY = "main-world";

const WorldDraftSchema = z.object({
	key: z.literal(MAIN_WORLD_DRAFT_KEY),
	schemaVersion: z.literal(1),
	world: WorldSchema,
	worldId: z.string().nullable(),
	baseServerRevision: z.number().int().positive().nullable(),
	updatedAt: z.number(),
});

export type WorldDraft = z.infer<typeof WorldDraftSchema>;

type DraftInput = {
	world: World;
	worldId: string | null;
	baseServerRevision: number | null;
};

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

export async function readMainWorldDraft(): Promise<WorldDraft | null> {
	if (!indexedDbAvailable()) return null;

	const storedDraft = await runDraftRequest<unknown>("readonly", (store) =>
		store.get(MAIN_WORLD_DRAFT_KEY),
	);
	const result = WorldDraftSchema.safeParse(storedDraft);
	return result.success ? result.data : null;
}

export async function writeMainWorldDraft(input: DraftInput): Promise<boolean> {
	if (!indexedDbAvailable()) return false;

	const draft: WorldDraft = {
		key: MAIN_WORLD_DRAFT_KEY,
		schemaVersion: 1,
		world: input.world,
		worldId: input.worldId,
		baseServerRevision: input.baseServerRevision,
		updatedAt: Date.now(),
	};

	await runDraftRequest<IDBValidKey>("readwrite", (store) => store.put(draft));
	return true;
}

export async function deleteMainWorldDraft(): Promise<void> {
	if (!indexedDbAvailable()) return;
	await runDraftRequest<undefined>("readwrite", (store) => store.delete(MAIN_WORLD_DRAFT_KEY));
}

export function draftMatchesServer(
	draft: WorldDraft,
	server: {worldId: string | null; revision: number | null},
): boolean {
	return draft.worldId === server.worldId && draft.baseServerRevision === server.revision;
}
