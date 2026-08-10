import {expect, test, type Page} from "@playwright/test";

const playthroughId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const message = {id: "message-1", type: "command", text: '<img src=x onerror="alert(1)">'};

function collectBrowserErrors(page: Page) {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (entry) => {
		if (entry.type() === "error") errors.push(entry.text());
	});
	return errors;
}

test("administrator filters, inspects, and replays recorded play without rendering player text as HTML", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.route("**/api/admin/playthroughs?*", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					playthroughs: [
						{
							id: playthroughId,
							publicationId: "publication-id",
							publicationTitle: "Quiet archive",
							publicationSlug: "quiet-archive",
							releaseId: "release-id",
							releaseNumber: 1,
							playerReference: "Player 4a8b12cd",
							status: "errored",
							commandCount: 1,
							startedAt: "2026-08-09T12:00:00.000Z",
							lastActivityAt: "2026-08-09T12:01:00.000Z",
							endedAt: "2026-08-09T12:01:00.000Z",
							anonymizedAt: null,
							purgeAfter: null,
						},
					],
				},
			}),
		}),
	);
	await page.route(`**/api/admin/playthroughs/${playthroughId}`, (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					id: playthroughId,
					publicationId: "publication-id",
					publicationTitle: "Quiet archive",
					publicationSlug: "quiet-archive",
					releaseId: "release-id",
					releaseNumber: 1,
					playerReference: "Player 4a8b12cd",
					status: "errored",
					commandCount: 1,
					startedAt: "2026-08-09T12:00:00.000Z",
					lastActivityAt: "2026-08-09T12:01:00.000Z",
					endedAt: "2026-08-09T12:01:00.000Z",
					anonymizedAt: null,
					purgeAfter: null,
					commands: message.text,
					transcript: [message],
					initialState: {},
					currentState: {safe: true},
					engineVersion: "mothmark-engine-0.1.0",
					worldId: "world-id",
					worldVersionId: "version-id",
					stateSummary: {
						currentRoom: "Archive",
						turns: 1,
						inventory: [],
						importantFlags: [],
						playerStatus: "alive",
					},
				},
			}),
		}),
	);
	await page.route("**/api/auth/csrf?audience=admin", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {csrfToken: "csrf"}}),
		}),
	);
	await page.route(`**/api/admin/playthroughs/${playthroughId}/diagnostics`, (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					available: true,
					label: "Original release 1",
					engineVersion: "mothmark-engine-0.1.0",
					commandCount: 1,
					firstDifference: null,
					steps: [
						{
							sequence: 1,
							command: message.text,
							recordedOutput: [message],
							replayedOutput: [message],
							outputDiffers: false,
							stateDiffers: false,
							stateSummary: null,
						},
					],
				},
			}),
		}),
	);

	await page.goto("/admin/playthroughs");
	await expect(page.getByRole("heading", {name: "Playthroughs"})).toBeVisible();
	await page.getByRole("link", {name: "Quiet archive"}).click();
	await expect(page.getByText(message.text, {exact: true}).first()).toBeVisible();
	await expect(page.locator(".adminRecordedTerminal img")).toHaveCount(0);
	await page.getByRole("button", {name: "Replay with original engine"}).click();
	await expect(page.getByRole("heading", {name: "No observable difference"})).toBeVisible();

	await page.setViewportSize({width: 390, height: 780});
	await page.getByRole("tab", {name: "State"}).click();
	await expect(page.getByRole("heading", {name: "Current state"})).toBeVisible();
	expect(browserErrors).toEqual([]);
});
