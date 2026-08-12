import {fireEvent, render, screen, waitFor} from "@testing-library/react";

import {PopupProvider} from "@/components/popup/Popup";
import {
	WorldAutosaveProvider,
	useWorldAutosaveRegistration,
} from "@/components/world-autosave/WorldAutosave";
import {world as initialWorld} from "@/data/worlds/initialWorld";
import type {World} from "@/schemas/world/worldSchema";

import {PublishingPanel} from "./PublishingPanel";

const worldId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const handlePersisted = () => undefined;
const handleReset = () => undefined;

const response = (body: unknown, status = 200) =>
	({
		ok: status >= 200 && status < 300,
		status,
		text: jest.fn().mockResolvedValue(body === undefined ? "" : JSON.stringify(body)),
	}) as unknown as Response;

function PublishingHarness({world}: {world: World}) {
	useWorldAutosaveRegistration({
		ready: true,
		world,
		worldId,
		worldName: "Private test world",
		revision: 1,
		onPersisted: handlePersisted,
		onReset: handleReset,
	});

	return <PublishingPanel worldId={worldId} worldName="Private test world" revision={1} />;
}

describe("PublishingPanel save coordination", () => {
	beforeEach(() => {
		document.cookie = "mothmark_editor_csrf=csrf-token; Path=/";
	});

	afterEach(() => {
		jest.restoreAllMocks();
		Reflect.deleteProperty(globalThis, "fetch");
		document.cookie = "mothmark_editor_csrf=; Max-Age=0; Path=/";
	});

	it("finishes a confirmed publish only after the edited revision is server-confirmed", async () => {
		let finishSave: ((value: Response) => void) | undefined;
		const pendingSave = new Promise<Response>((resolve) => {
			finishSave = resolve;
		});
		const publication = {
			id: "publication-id",
			slug: "private-test-world",
			title: "Private test world",
			summary: "A saved test world.",
			visibility: "listed",
			status: "published",
			release: {number: 1, publishedAt: "2026-08-12T12:00:00.000Z"},
			worldRevision: 2,
			currentWorldRevision: 2,
			unpublishedChanges: false,
		};
		const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
			const path = String(input);
			if (path === "/api/account") {
				return Promise.resolve(response({data: {accountType: "registered"}}));
			}
			if (path === `/api/world/${worldId}/publication` && !init?.method) {
				return Promise.resolve(response({data: null}));
			}
			if (path === `/api/world/${worldId}` && init?.method === "PUT") return pendingSave;
			if (path === `/api/world/${worldId}/publication` && init?.method === "POST") {
				return Promise.resolve(response({data: publication}));
			}
			throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${path}`);
		});
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: fetchMock,
		});
		const view = render(
			<PopupProvider>
				<WorldAutosaveProvider>
					<PublishingHarness world={initialWorld} />
				</WorldAutosaveProvider>
			</PopupProvider>,
		);
		await screen.findByRole("button", {name: "Publish current version"});

		const editedWorld = {
			...initialWorld,
			metadata: {...initialWorld.metadata, title: "Edited before publish"},
		};
		view.rerender(
			<PopupProvider>
				<WorldAutosaveProvider>
					<PublishingHarness world={editedWorld} />
				</WorldAutosaveProvider>
			</PopupProvider>,
		);
		fireEvent.change(screen.getByLabelText("Short summary"), {
			target: {value: "A saved test world."},
		});
		fireEvent.click(screen.getByRole("button", {name: "Publish current version"}));

		await screen.findByRole("button", {name: "Saving before publishing…"});
		expect(
			fetchMock.mock.calls.some(
				([input, init]) =>
					String(input) === `/api/world/${worldId}/publication` && init?.method === "POST",
			),
		).toBe(false);

		finishSave?.(response({data: {id: worldId, revision: 2}}));

		await waitFor(() =>
			expect(screen.getByText(/Release 1 uses saved revision 2/)).toBeInTheDocument(),
		);
		const publicationRequest = fetchMock.mock.calls.find(
			([input, init]) =>
				String(input) === `/api/world/${worldId}/publication` && init?.method === "POST",
		);
		expect(publicationRequest).toBeDefined();
		expect(JSON.parse(String(publicationRequest?.[1]?.body))).toEqual(
			expect.objectContaining({expectedRevision: 2, summary: "A saved test world."}),
		);
	});
});
