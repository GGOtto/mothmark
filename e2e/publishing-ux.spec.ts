import {expect, test, type Page} from "@playwright/test";

function collectBrowserErrors(page: Page) {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});
	return errors;
}

const publication = {
	authorUsername: "archivekeeper",
	id: "publication-id",
	slug: "quiet-archive",
	title: "Quiet archive",
	summary: "A compact world for testing hosted play.",
	visibility: "listed" as const,
	release: {id: "release-id", number: 1, publishedAt: "2026-08-09T12:00:00.000Z"},
};

test("the public catalog lists world cards without creating a play account", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	let bootstrapRequests = 0;
	await page.route("**/api/play/publications?*", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {publications: [publication]}}),
		}),
	);
	await page.route("**/api/play/publications/*/bootstrap", async (route) => {
		bootstrapRequests += 1;
		await route.fulfill({status: 500});
	});

	await page.goto("/play");
	await expect(page.getByRole("heading", {name: "Published worlds"})).toBeVisible();
	await expect(page.getByRole("heading", {name: "Quiet archive"})).toBeVisible();
	await expect(page.getByText("by archivekeeper")).toBeVisible();
	await expect(page.getByRole("link", {name: "Play Quiet archive"})).toHaveAttribute(
		"href",
		"/play/quiet-archive",
	);
	expect(bootstrapRequests).toBe(0);
	expect(browserErrors).toEqual([]);
});

test("hosted play saves an inert transcript and resumes it after refresh", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	let revision = 1;
	let commands = "";
	let messages = [{id: "opening", type: "room", text: "A quiet archive waits."}];

	await page.route("**/api/auth/csrf?audience=play", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			headers: {"set-cookie": "mothmark_play_csrf=csrf; Path=/; SameSite=Lax"},
			body: JSON.stringify({data: {csrfToken: "csrf"}}),
		}),
	);
	await page.route("**/api/play/publications/quiet-archive/bootstrap", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					publication,
					playthrough: {
						id: "playthrough-id",
						revision,
						commandCount: commands ? commands.split("\n").length : 0,
						commands,
						status: "active",
						release: {id: "release-id", number: 1},
						state: {messages},
					},
					newerReleaseAvailable: false,
				},
			}),
		}),
	);
	await page.route("**/api/play/publications/quiet-archive/command", async (route) => {
		const body = route.request().postDataJSON() as {command: string; expectedRevision: number};
		expect(body.expectedRevision).toBe(revision);
		commands = commands ? `${commands}\n${body.command}` : body.command;
		messages = [
			...messages,
			{id: `command-${revision}`, type: "command", text: body.command},
			{id: `output-${revision}`, type: "system", text: "The archive remains still."},
		];
		revision += 1;
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					id: "playthrough-id",
					revision,
					commandCount: 1,
					commands,
					status: "active",
					release: {id: "release-id", number: 1},
					state: {messages},
					outputMessages: messages.slice(-2),
				},
			}),
		});
	});

	await page.goto("/play/quiet-archive");
	await expect(page.getByText("Quiet archive · by archivekeeper")).toBeVisible();
	await expect(page.getByText("A quiet archive waits.")).toBeVisible();
	await page.getByLabel("Game command").fill('<img src=x onerror="alert(1)">');
	await page.getByLabel("Game command").press("Enter");
	await expect(page.getByText('<img src=x onerror="alert(1)">')).toBeVisible();
	await expect(page.locator(".output-log img")).toHaveCount(0);
	await expect(page.getByText("The archive remains still.")).toBeVisible();
	await expect(page.getByText("Saved", {exact: true})).toBeVisible();
	await expect(page.getByLabel("Game command")).toBeFocused();

	await page.reload();
	await expect(page.getByText('<img src=x onerror="alert(1)">')).toBeVisible();
	await expect(page.getByText("The archive remains still.")).toBeVisible();
	expect(browserErrors).toEqual([]);
});

test("a returning player sees an update choice and restarts into the current release", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.route("**/api/auth/csrf?audience=play", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {csrfToken: "csrf"}}),
		}),
	);
	await page.route("**/api/play/publications/quiet-archive/bootstrap", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					publication,
					playthrough: {
						id: "old-playthrough",
						revision: 2,
						commandCount: 1,
						commands: "look",
						status: "active",
						release: {id: "release-id", number: 1},
						state: {messages: [{id: "old", type: "room", text: "The old release."}]},
					},
					newerReleaseAvailable: true,
				},
			}),
		}),
	);
	await page.route("**/api/play/publications/quiet-archive/restart", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					publication: {...publication, release: {...publication.release, number: 2}},
					playthrough: {
						id: "new-playthrough",
						revision: 1,
						commandCount: 0,
						commands: "",
						status: "active",
						release: {id: "release-2", number: 2},
						state: {messages: [{id: "new", type: "room", text: "The new release."}]},
					},
					newerReleaseAvailable: false,
				},
			}),
		}),
	);
	page.on("dialog", (dialog) => dialog.accept());
	await page.goto("/play/quiet-archive");
	await expect(page.getByText("A new version is available.", {exact: false})).toBeVisible();
	await page.getByRole("button", {name: "Restart with new version"}).click();
	await expect(page.getByText("The new release.")).toBeVisible();
	await expect(page.getByText("A new version is available.", {exact: false})).toHaveCount(0);
	expect(browserErrors).toEqual([]);
});
