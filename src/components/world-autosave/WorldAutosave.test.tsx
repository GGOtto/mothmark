import {act, fireEvent, render, screen} from "@testing-library/react";

import {world as initialWorld} from "@/data/worlds/initialWorld";
import type {World} from "@/schemas/world/worldSchema";
import {deleteWorldDraft, writeWorldDraft} from "./worldDraftStorage";

import {
	WorldAutosaveIndicator,
	WorldAutosaveProvider,
	WorldResetButton,
	WorldSwitcher,
	type WorldSaveConfirmation,
	useWorldAutosave,
	useWorldAutosaveRegistration,
} from "./WorldAutosave";

jest.mock("./worldDraftStorage", () => ({
	deleteWorldDraft: jest.fn().mockResolvedValue(undefined),
	writeWorldDraft: jest.fn().mockResolvedValue(true),
}));

const worldId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const userId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
const handlePersisted = jest.fn();
const handleReset = jest.fn();

function AutosaveHarness({
	world,
	revision = 1,
	restoredFromLocalDraft = false,
	onConfirmed,
}: {
	world: World;
	revision?: number;
	restoredFromLocalDraft?: boolean;
	onConfirmed?: (result: WorldSaveConfirmation) => void;
}) {
	const {confirmCurrentRevision} = useWorldAutosave();
	useWorldAutosaveRegistration({
		ready: true,
		world,
		worldId,
		userId,
		worldName: "Main world",
		revision,
		restoredFromLocalDraft,
		onPersisted: handlePersisted,
		onReset: handleReset,
	});

	return (
		<>
			<WorldAutosaveIndicator />
			<WorldSwitcher />
			<WorldResetButton />
			{onConfirmed ? (
				<button type="button" onClick={() => void confirmCurrentRevision().then(onConfirmed)}>
					Confirm revision
				</button>
			) : null}
		</>
	);
}

const renderAutosaveHarness = (world: World) =>
	render(
		<WorldAutosaveProvider>
			<AutosaveHarness world={world} />
		</WorldAutosaveProvider>,
	);

const response = (body: unknown, status = 200) =>
	({
		ok: status >= 200 && status < 300,
		status,
		text: jest.fn().mockResolvedValue(body === undefined ? "" : JSON.stringify(body)),
	}) as unknown as Response;

const successfulSave = (revision: number) => response({data: {id: worldId, revision}});

const flushPromises = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

describe("world autosave", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		document.cookie = "mothmark_editor_csrf=csrf-token; Path=/";
		handlePersisted.mockReset();
		handleReset.mockReset();
		jest.mocked(deleteWorldDraft).mockClear();
		jest.mocked(writeWorldDraft).mockClear();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
		jest.restoreAllMocks();
		Reflect.deleteProperty(globalThis, "fetch");
		document.cookie = "mothmark_editor_csrf=; Max-Age=0; Path=/";
	});

	it("saves the latest world after editing settles", async () => {
		const updatedWorld = {
			...initialWorld,
			metadata: {...initialWorld.metadata, title: "Updated title"},
		};
		const fetchMock = jest.fn().mockResolvedValue(successfulSave(2));
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});
		const view = renderAutosaveHarness(initialWorld);

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={updatedWorld} />
			</WorldAutosaveProvider>,
		);

		await act(async () => {
			jest.advanceTimersByTime(999);
			await flushPromises();
		});
		expect(fetchMock).not.toHaveBeenCalled();

		await act(async () => {
			jest.advanceTimersByTime(1);
			await flushPromises();
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			`/api/world/${worldId}`,
			expect.objectContaining({
				method: "PUT",
				headers: {"content-type": "application/json", "x-csrf-token": "csrf-token"},
				body: JSON.stringify({world: updatedWorld, expectedRevision: 1}),
			}),
		);
		expect(handlePersisted).toHaveBeenCalledWith(worldId, 2);
		expect(deleteWorldDraft).toHaveBeenCalledWith(userId, worldId);
	});

	it("opens an accessibly named switcher, focuses a recent world, and closes with Escape", async () => {
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			json: jest.fn().mockResolvedValue({
				data: {
					worlds: [
						{editorSlug: "main-world", id: worldId, name: "Main world"},
						{
							editorSlug: "second-world",
							id: "f76f909d-5c82-4b04-aec6-85c9a175e1a2",
							name: "Second world",
						},
					],
				},
			}),
		});
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});
		renderAutosaveHarness(initialWorld);

		const trigger = screen.getByRole("button", {name: "Current world: Main world"});
		fireEvent.click(trigger);
		await act(flushPromises);

		const recentWorld = screen.getByRole("menuitem", {name: "Second world"});
		expect(recentWorld).toHaveFocus();
		fireEvent.keyDown(recentWorld, {key: "Escape"});
		expect(screen.queryByRole("menu", {name: "Switch worlds"})).not.toBeInTheDocument();
		expect(trigger).toHaveFocus();

		fireEvent.click(trigger);
		await act(flushPromises);
		expect(screen.getByRole("menu", {name: "Switch worlds"})).toBeInTheDocument();
		fireEvent.pointerDown(document.body);
		expect(screen.queryByRole("menu", {name: "Switch worlds"})).not.toBeInTheDocument();
	});

	it("checkpoints edits to IndexedDB before syncing them to the server", async () => {
		const updatedWorld = {
			...initialWorld,
			metadata: {...initialWorld.metadata, title: "Local checkpoint"},
		};
		const fetchMock = jest.fn().mockResolvedValue(successfulSave(2));
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});
		const view = renderAutosaveHarness(initialWorld);

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={updatedWorld} />
			</WorldAutosaveProvider>,
		);

		await act(async () => {
			jest.advanceTimersByTime(500);
			await flushPromises();
		});

		expect(writeWorldDraft).toHaveBeenCalledWith({
			userId,
			world: updatedWorld,
			worldId,
			baseServerRevision: 1,
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("syncs a restored local draft back to the server", async () => {
		const restoredWorld = {
			...initialWorld,
			metadata: {...initialWorld.metadata, title: "Recovered draft"},
		};
		const fetchMock = jest.fn().mockResolvedValue(successfulSave(2));
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});

		render(
			<WorldAutosaveProvider>
				<AutosaveHarness world={restoredWorld} restoredFromLocalDraft />
			</WorldAutosaveProvider>,
		);

		await act(async () => {
			jest.advanceTimersByTime(1_000);
			await flushPromises();
		});

		expect(fetchMock).toHaveBeenCalledWith(
			`/api/world/${worldId}`,
			expect.objectContaining({
				body: JSON.stringify({world: restoredWorld, expectedRevision: 1}),
			}),
		);
	});

	it("resets a registered world after confirmation even when it has no edits", () => {
		jest.spyOn(globalThis, "confirm").mockReturnValue(true);
		renderAutosaveHarness(initialWorld);

		fireEvent.click(screen.getByRole("button", {name: "Reset to starter world"}));

		expect(handleReset).toHaveBeenCalledTimes(1);
	});

	it("coalesces edits made during a save into one follow-up request", async () => {
		let finishFirstSave: ((value: ReturnType<typeof successfulSave>) => void) | undefined;
		const firstSave = new Promise<ReturnType<typeof successfulSave>>((resolve) => {
			finishFirstSave = resolve;
		});
		const fetchMock = jest
			.fn()
			.mockReturnValueOnce(firstSave)
			.mockResolvedValueOnce(successfulSave(3));
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});
		const firstEdit = {
			...initialWorld,
			metadata: {...initialWorld.metadata, title: "First edit"},
		};
		const latestEdit = {
			...initialWorld,
			metadata: {...initialWorld.metadata, title: "Latest edit"},
		};
		const view = renderAutosaveHarness(initialWorld);

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={firstEdit} />
			</WorldAutosaveProvider>,
		);
		await act(async () => {
			jest.advanceTimersByTime(10_000);
			await flushPromises();
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={latestEdit} />
			</WorldAutosaveProvider>,
		);

		await act(async () => {
			finishFirstSave?.(successfulSave(2));
			await flushPromises();
		});

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock).toHaveBeenLastCalledWith(
			`/api/world/${worldId}`,
			expect.objectContaining({
				body: JSON.stringify({world: latestEdit, expectedRevision: 2}),
			}),
		);
	});

	it("shows the header indicator for at least two seconds", async () => {
		let finishSave: ((value: ReturnType<typeof successfulSave>) => void) | undefined;
		const pendingSave = new Promise<ReturnType<typeof successfulSave>>((resolve) => {
			finishSave = resolve;
		});
		const fetchMock = jest.fn().mockReturnValue(pendingSave);
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});
		const updatedWorld = {
			...initialWorld,
			metadata: {...initialWorld.metadata, title: "Indicator test"},
		};
		const view = renderAutosaveHarness(initialWorld);
		expect(screen.queryByText("Saving…")).not.toBeInTheDocument();

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={updatedWorld} />
			</WorldAutosaveProvider>,
		);
		await act(async () => {
			jest.advanceTimersByTime(10_000);
			await flushPromises();
		});
		expect(screen.getByText("Saving…")).toBeInTheDocument();

		await act(async () => {
			finishSave?.(successfulSave(2));
			await flushPromises();
		});
		expect(screen.getByText("Saved")).toBeInTheDocument();

		await act(async () => {
			jest.advanceTimersByTime(1_999);
			await flushPromises();
		});
		expect(screen.getByText("Saved")).toBeInTheDocument();

		await act(async () => {
			jest.advanceTimersByTime(1);
			await flushPromises();
		});
		expect(screen.queryByText("Saved")).not.toBeInTheDocument();
	});

	it("warns before unloading until the queued save succeeds", async () => {
		const updatedWorld = {
			...initialWorld,
			metadata: {...initialWorld.metadata, title: "Unsaved title"},
		};
		const fetchMock = jest.fn().mockResolvedValue(successfulSave(2));
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});
		const view = renderAutosaveHarness(initialWorld);
		const cleanUnload = new Event("beforeunload", {cancelable: true});
		window.dispatchEvent(cleanUnload);
		expect(cleanUnload.defaultPrevented).toBe(false);

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={updatedWorld} />
			</WorldAutosaveProvider>,
		);
		const queuedUnload = new Event("beforeunload", {cancelable: true});
		window.dispatchEvent(queuedUnload);
		expect(queuedUnload.defaultPrevented).toBe(true);

		await act(async () => {
			jest.advanceTimersByTime(10_000);
			await flushPromises();
		});
		const savedUnload = new Event("beforeunload", {cancelable: true});
		window.dispatchEvent(savedUnload);
		expect(savedUnload.defaultPrevented).toBe(false);
	});

	it("reports validation details without triggering a blocking console error", async () => {
		const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
		const error = jest.spyOn(console, "error").mockImplementation(() => {});
		const fetchMock = jest.fn().mockResolvedValue(
			response(
				{
					error: {
						message: "The request data is invalid.",
						issues: [{path: ["world", "rooms", 16, "id"], message: "Duplicate room id."}],
					},
				},
				400,
			),
		);
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});
		const updatedWorld = {
			...initialWorld,
			metadata: {...initialWorld.metadata, title: "Invalid save response test"},
		};
		const view = renderAutosaveHarness(initialWorld);

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={updatedWorld} />
			</WorldAutosaveProvider>,
		);
		await act(async () => {
			jest.advanceTimersByTime(10_000);
			await flushPromises();
		});

		expect(warning).toHaveBeenCalledWith(
			"Could not autosave the world",
			"The request data is invalid. world.rooms.16.id: Duplicate room id.",
		);
		expect(error).not.toHaveBeenCalled();
	});

	it("reports retryable server failures without triggering a blocking console error", async () => {
		const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
		const error = jest.spyOn(console, "error").mockImplementation(() => {});
		const fetchMock = jest
			.fn()
			.mockResolvedValue(response({error: {message: "The world request failed."}}, 500));
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});
		const updatedWorld = {
			...initialWorld,
			metadata: {...initialWorld.metadata, title: "Retryable failure test"},
		};
		const view = renderAutosaveHarness(initialWorld);

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={updatedWorld} />
			</WorldAutosaveProvider>,
		);
		await act(async () => {
			jest.advanceTimersByTime(10_000);
			await flushPromises();
		});

		expect(warning).toHaveBeenCalledWith("Could not autosave the world", "The world request failed.");
		expect(error).not.toHaveBeenCalled();
	});

	it("keeps a failed save actionable and clears the draft only after a manual retry succeeds", async () => {
		jest.spyOn(console, "warn").mockImplementation(() => {});
		const fetchMock = jest
			.fn()
			.mockRejectedValueOnce(new TypeError("offline"))
			.mockResolvedValueOnce(successfulSave(2));
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});
		const updatedWorld = {
			...initialWorld,
			metadata: {...initialWorld.metadata, title: "Offline edit"},
		};
		const view = renderAutosaveHarness(initialWorld);

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={updatedWorld} />
			</WorldAutosaveProvider>,
		);
		await act(async () => {
			jest.advanceTimersByTime(1_000);
			await flushPromises();
		});

		expect(screen.getByText("Save failed")).toBeInTheDocument();
		expect(screen.getByRole("button", {name: "Retry"})).toBeInTheDocument();
		expect(deleteWorldDraft).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", {name: "Retry"}));
		await act(flushPromises);

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(screen.getByText("Saved")).toBeInTheDocument();
		expect(deleteWorldDraft).toHaveBeenCalledWith(userId, worldId);
	});

	it("uses a stable actionable error for an empty successful save response", async () => {
		jest.spyOn(console, "warn").mockImplementation(() => {});
		const fetchMock = jest.fn().mockResolvedValue(response(undefined));
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});
		const updatedWorld = {
			...initialWorld,
			metadata: {...initialWorld.metadata, title: "Empty response edit"},
		};
		const view = renderAutosaveHarness(initialWorld);

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={updatedWorld} />
			</WorldAutosaveProvider>,
		);
		await act(async () => {
			jest.advanceTimersByTime(1_000);
			await flushPromises();
		});

		expect(screen.getByText("Save failed")).toHaveAttribute(
			"title",
			"The server returned an incomplete save response. Your changes are still stored on this device.",
		);
		expect(deleteWorldDraft).not.toHaveBeenCalled();
	});

	it("keeps an expired-session draft and explains how to resume saving", async () => {
		jest.spyOn(console, "warn").mockImplementation(() => {});
		const fetchMock = jest.fn().mockResolvedValue(response(undefined, 401));
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});
		const updatedWorld = {
			...initialWorld,
			metadata: {...initialWorld.metadata, title: "Session recovery edit"},
		};
		const view = renderAutosaveHarness(initialWorld);

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={updatedWorld} />
			</WorldAutosaveProvider>,
		);
		await act(async () => {
			jest.advanceTimersByTime(1_000);
			await flushPromises();
		});

		expect(screen.getByText("Save failed")).toHaveAttribute(
			"title",
			"Your session expired. Sign in again, then retry saving.",
		);
		expect(deleteWorldDraft).not.toHaveBeenCalled();
	});

	it("waits for the newest queued save before confirming a revision", async () => {
		let finishFirstSave: ((value: ReturnType<typeof successfulSave>) => void) | undefined;
		const firstSave = new Promise<ReturnType<typeof successfulSave>>((resolve) => {
			finishFirstSave = resolve;
		});
		const fetchMock = jest
			.fn()
			.mockReturnValueOnce(firstSave)
			.mockResolvedValueOnce(successfulSave(3));
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});
		const confirmed = jest.fn();
		const firstEdit = {
			...initialWorld,
			metadata: {...initialWorld.metadata, title: "First queued edit"},
		};
		const latestEdit = {
			...initialWorld,
			metadata: {...initialWorld.metadata, title: "Newest queued edit"},
		};
		const view = renderAutosaveHarness(initialWorld);

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={firstEdit} onConfirmed={confirmed} />
			</WorldAutosaveProvider>,
		);
		await act(async () => {
			jest.advanceTimersByTime(1_000);
			await flushPromises();
		});
		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={latestEdit} onConfirmed={confirmed} />
			</WorldAutosaveProvider>,
		);
		fireEvent.click(screen.getByRole("button", {name: "Confirm revision"}));
		expect(confirmed).not.toHaveBeenCalled();

		await act(async () => {
			finishFirstSave?.(successfulSave(2));
			await flushPromises();
			await flushPromises();
		});

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(confirmed).toHaveBeenCalledWith({ok: true, id: worldId, revision: 3});
	});
});
