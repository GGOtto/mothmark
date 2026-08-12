import {act, fireEvent, render, screen} from "@testing-library/react";
import Link from "next/link";

import {world as initialWorld} from "@/data/worlds/initialWorld";
import type {World} from "@/schemas/world/worldSchema";

import {
	WorldAutosaveIndicator,
	WorldAutosaveProvider,
	WorldResetButton,
	WorldSaveButton,
	WorldSwitcher,
	type WorldSaveConfirmation,
	useWorldAutosave,
	useWorldAutosaveRegistration,
} from "./WorldAutosave";

const worldId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const handlePersisted = jest.fn();
const handleReset = jest.fn();

function AutosaveHarness({
	world,
	revision = 1,
	onConfirmed,
}: {
	world: World;
	revision?: number;
	onConfirmed?: (result: WorldSaveConfirmation) => void;
}) {
	const {confirmCurrentRevision} = useWorldAutosave();
	useWorldAutosaveRegistration({
		ready: true,
		world,
		worldId,
		worldName: "Main world",
		revision,
		onPersisted: handlePersisted,
		onReset: handleReset,
	});

	return (
		<>
			<WorldAutosaveIndicator />
			<WorldSaveButton />
			<WorldSwitcher />
			<WorldResetButton />
			<Link href="/worlds">Leave editor</Link>
			{onConfirmed ? (
				<button type="button" onClick={() => void confirmCurrentRevision().then(onConfirmed)}>
					Confirm revision
				</button>
			) : null}
		</>
	);
}

const renderAutosaveHarness = (world: World = initialWorld) =>
	render(
		<WorldAutosaveProvider>
			<AutosaveHarness world={world} />
		</WorldAutosaveProvider>,
	);

const editedWorld = (title: string): World => ({
	...initialWorld,
	metadata: {...initialWorld.metadata, title},
});

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
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
		jest.restoreAllMocks();
		Reflect.deleteProperty(globalThis, "fetch");
		document.cookie = "mothmark_editor_csrf=; Max-Age=0; Path=/";
	});

	it("saves the latest world after three seconds without edits", async () => {
		const updatedWorld = editedWorld("Updated title");
		const fetchMock = jest.fn().mockResolvedValue(successfulSave(2));
		Object.defineProperty(globalThis, "fetch", {configurable: true, value: fetchMock});
		const view = renderAutosaveHarness();

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={updatedWorld} />
			</WorldAutosaveProvider>,
		);
		await act(async () => {
			jest.advanceTimersByTime(2_999);
			await flushPromises();
		});
		expect(fetchMock).not.toHaveBeenCalled();

		await act(async () => {
			jest.advanceTimersByTime(1);
			await flushPromises();
		});
		expect(fetchMock).toHaveBeenCalledWith(
			`/api/world/${worldId}`,
			expect.objectContaining({
				method: "PUT",
				body: JSON.stringify({world: updatedWorld, expectedRevision: 1}),
			}),
		);
		expect(handlePersisted).toHaveBeenCalledWith(worldId, 2);
	});

	it("saves immediately from the Save button and Ctrl+S", async () => {
		const fetchMock = jest
			.fn()
			.mockResolvedValueOnce(successfulSave(2))
			.mockResolvedValueOnce(successfulSave(3));
		Object.defineProperty(globalThis, "fetch", {configurable: true, value: fetchMock});
		const view = renderAutosaveHarness();

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={editedWorld("Button save")} />
			</WorldAutosaveProvider>,
		);
		fireEvent.click(screen.getByRole("button", {name: "Save"}));
		await act(flushPromises);
		expect(fetchMock).toHaveBeenCalledTimes(1);

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={editedWorld("Keyboard save")} revision={2} />
			</WorldAutosaveProvider>,
		);
		const allowed = fireEvent.keyDown(window, {key: "s", ctrlKey: true});
		await act(flushPromises);
		expect(allowed).toBe(false);
		expect(fetchMock).toHaveBeenCalledTimes(2);
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
		Object.defineProperty(globalThis, "fetch", {configurable: true, value: fetchMock});
		const view = renderAutosaveHarness();

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={editedWorld("First edit")} />
			</WorldAutosaveProvider>,
		);
		fireEvent.click(screen.getByRole("button", {name: "Save"}));
		await act(flushPromises);
		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={editedWorld("Latest edit")} />
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
				body: JSON.stringify({world: editedWorld("Latest edit"), expectedRevision: 2}),
			}),
		);
	});

	it("reports pending synchronization until a slow request is confirmed", async () => {
		let finishSave: ((value: ReturnType<typeof successfulSave>) => void) | undefined;
		const pendingSave = new Promise<ReturnType<typeof successfulSave>>((resolve) => {
			finishSave = resolve;
		});
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			value: jest.fn().mockReturnValue(pendingSave),
		});
		const view = renderAutosaveHarness();
		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={editedWorld("Slow save")} />
			</WorldAutosaveProvider>,
		);
		fireEvent.click(screen.getByRole("button", {name: "Save"}));
		expect(screen.getByRole("status")).toHaveTextContent("Saving…");

		act(() => jest.advanceTimersByTime(749));
		expect(screen.getByRole("status")).toHaveTextContent("Saving…");
		act(() => jest.advanceTimersByTime(1));
		expect(screen.getByRole("status")).toHaveTextContent("Saving…");

		await act(async () => {
			finishSave?.(successfulSave(2));
			await flushPromises();
		});
		expect(screen.getByText("Saved")).toBeInTheDocument();
	});

	it("retries transient failures quietly before surfacing a sustained problem", async () => {
		jest.spyOn(console, "warn").mockImplementation(() => {});
		let connectionRestored = false;
		const fetchMock = jest.fn(() =>
			connectionRestored
				? Promise.resolve(successfulSave(2))
				: Promise.reject(new TypeError("offline")),
		);
		Object.defineProperty(globalThis, "fetch", {configurable: true, value: fetchMock});
		const view = renderAutosaveHarness();
		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={editedWorld("Offline edit")} />
			</WorldAutosaveProvider>,
		);

		await act(async () => {
			jest.advanceTimersByTime(3_000);
			await flushPromises();
		});
		expect(screen.queryByText("Changes not saved")).not.toBeInTheDocument();

		await act(async () => {
			jest.advanceTimersByTime(10_000);
			await flushPromises();
		});
		expect(screen.getByText("Changes not saved")).toBeInTheDocument();
		const callsBeforeManualSave = fetchMock.mock.calls.length;
		connectionRestored = true;
		await act(async () => {
			fireEvent.click(screen.getByRole("button", {name: "Save now"}));
			await flushPromises();
			await flushPromises();
		});
		expect(fetchMock).toHaveBeenCalledTimes(callsBeforeManualSave + 1);
		expect(screen.getByText("Saved")).toBeInTheDocument();
	});

	it("surfaces non-retryable validation details immediately", async () => {
		jest.spyOn(console, "warn").mockImplementation(() => {});
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			value: jest.fn().mockResolvedValue(
				response(
					{
						error: {
							message: "The request data is invalid.",
							issues: [{path: ["world", "rooms", 16, "id"], message: "Duplicate room id."}],
						},
					},
					400,
				),
			),
		});
		const view = renderAutosaveHarness();
		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={editedWorld("Invalid save")} />
			</WorldAutosaveProvider>,
		);
		fireEvent.click(screen.getByRole("button", {name: "Save"}));
		await act(flushPromises);
		expect(screen.getByText("Changes not saved")).toHaveAttribute(
			"title",
			"The request data is invalid. world.rooms.16.id: Duplicate room id.",
		);
	});

	it("warns before unloading until the server confirms the latest world", async () => {
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			value: jest.fn().mockResolvedValue(successfulSave(2)),
		});
		const view = renderAutosaveHarness();
		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={editedWorld("Unsaved title")} />
			</WorldAutosaveProvider>,
		);
		const dirtyUnload = new Event("beforeunload", {cancelable: true});
		window.dispatchEvent(dirtyUnload);
		expect(dirtyUnload.defaultPrevented).toBe(true);

		fireEvent.click(screen.getByRole("button", {name: "Save"}));
		await act(flushPromises);
		const savedUnload = new Event("beforeunload", {cancelable: true});
		window.dispatchEvent(savedUnload);
		expect(savedUnload.defaultPrevented).toBe(false);
	});

	it("asks before internal navigation without waiting for a save", async () => {
		const confirm = jest.spyOn(globalThis, "confirm").mockReturnValue(false);
		const fetchMock = jest.fn();
		Object.defineProperty(globalThis, "fetch", {configurable: true, value: fetchMock});
		const view = renderAutosaveHarness();
		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={editedWorld("Unsaved navigation")} />
			</WorldAutosaveProvider>,
		);
		fireEvent.click(screen.getByRole("link", {name: "Leave editor"}));
		await act(flushPromises);
		expect(confirm).toHaveBeenCalledWith(
			"This world has changes that have not been saved. Leave and discard those changes?",
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("resets the registered world after confirmation", () => {
		jest.spyOn(globalThis, "confirm").mockReturnValue(true);
		renderAutosaveHarness();
		fireEvent.click(screen.getByRole("button", {name: "Reset to starter world"}));
		expect(handleReset).toHaveBeenCalledTimes(1);
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
		Object.defineProperty(globalThis, "fetch", {configurable: true, value: fetchMock});
		const confirmed = jest.fn();
		const view = render(
			<WorldAutosaveProvider>
				<AutosaveHarness world={initialWorld} onConfirmed={confirmed} />
			</WorldAutosaveProvider>,
		);

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={editedWorld("First queued edit")} onConfirmed={confirmed} />
			</WorldAutosaveProvider>,
		);
		fireEvent.click(screen.getByRole("button", {name: "Save"}));
		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={editedWorld("Newest queued edit")} onConfirmed={confirmed} />
			</WorldAutosaveProvider>,
		);
		fireEvent.click(screen.getByRole("button", {name: "Confirm revision"}));
		expect(confirmed).not.toHaveBeenCalled();

		await act(async () => {
			finishFirstSave?.(successfulSave(2));
			for (let index = 0; index < 8; index += 1) await Promise.resolve();
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(confirmed).toHaveBeenCalledWith({ok: true, id: worldId, revision: 3});
	});
});
