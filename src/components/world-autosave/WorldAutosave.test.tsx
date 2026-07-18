import {act, render, screen} from "@testing-library/react";

import {world as exampleWorld} from "@/data/worlds/exampleWorld";
import type {World} from "@/schemas/worldSchema";

import {
	WorldAutosaveIndicator,
	WorldAutosaveProvider,
	useWorldAutosaveRegistration,
} from "./WorldAutosave";

const worldId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const handlePersisted = jest.fn();

function AutosaveHarness({world, revision = 1}: {world: World; revision?: number}) {
	useWorldAutosaveRegistration({
		ready: true,
		world,
		worldId,
		revision,
		onPersisted: handlePersisted,
	});

	return <WorldAutosaveIndicator />;
}

const renderAutosaveHarness = (world: World) =>
	render(
		<WorldAutosaveProvider>
			<AutosaveHarness world={world} />
		</WorldAutosaveProvider>,
	);

const successfulSave = (revision: number) => ({
	ok: true,
	json: jest.fn().mockResolvedValue({data: {id: worldId, revision}}),
});

const flushPromises = async () => {
	await Promise.resolve();
	await Promise.resolve();
};

describe("world autosave", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		handlePersisted.mockReset();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
		jest.restoreAllMocks();
		Reflect.deleteProperty(globalThis, "fetch");
	});

	it("saves the latest world after editing settles", async () => {
		const updatedWorld = {
			...exampleWorld,
			metadata: {...exampleWorld.metadata, title: "Updated title"},
		};
		const fetchMock = jest.fn().mockResolvedValue(successfulSave(2));
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});
		const view = renderAutosaveHarness(exampleWorld);

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={updatedWorld} />
			</WorldAutosaveProvider>,
		);

		await act(async () => {
			jest.advanceTimersByTime(1_999);
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
				body: JSON.stringify({world: updatedWorld, expectedRevision: 1}),
			}),
		);
		expect(handlePersisted).toHaveBeenCalledWith(worldId, 2);
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
			...exampleWorld,
			metadata: {...exampleWorld.metadata, title: "First edit"},
		};
		const latestEdit = {
			...exampleWorld,
			metadata: {...exampleWorld.metadata, title: "Latest edit"},
		};
		const view = renderAutosaveHarness(exampleWorld);

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={firstEdit} />
			</WorldAutosaveProvider>,
		);
		await act(async () => {
			jest.advanceTimersByTime(2_000);
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
			...exampleWorld,
			metadata: {...exampleWorld.metadata, title: "Indicator test"},
		};
		const view = renderAutosaveHarness(exampleWorld);
		expect(screen.queryByText("Saving...")).not.toBeInTheDocument();

		view.rerender(
			<WorldAutosaveProvider>
				<AutosaveHarness world={updatedWorld} />
			</WorldAutosaveProvider>,
		);
		await act(async () => {
			jest.advanceTimersByTime(2_000);
			await flushPromises();
		});
		expect(screen.getByText("Saving...")).toBeInTheDocument();

		await act(async () => {
			finishSave?.(successfulSave(2));
			await flushPromises();
		});
		expect(screen.getByText("Saving...")).toBeInTheDocument();

		await act(async () => {
			jest.advanceTimersByTime(1_999);
			await flushPromises();
		});
		expect(screen.getByText("Saving...")).toBeInTheDocument();

		await act(async () => {
			jest.advanceTimersByTime(1);
			await flushPromises();
		});
		expect(screen.queryByText("Saving...")).not.toBeInTheDocument();
	});

	it("warns before unloading until the queued save succeeds", async () => {
		const updatedWorld = {
			...exampleWorld,
			metadata: {...exampleWorld.metadata, title: "Unsaved title"},
		};
		const fetchMock = jest.fn().mockResolvedValue(successfulSave(2));
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});
		const view = renderAutosaveHarness(exampleWorld);
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
			jest.advanceTimersByTime(2_000);
			await flushPromises();
		});
		const savedUnload = new Event("beforeunload", {cancelable: true});
		window.dispatchEvent(savedUnload);
		expect(savedUnload.defaultPrevented).toBe(false);
	});
});
