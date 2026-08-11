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
	await expect(page.getByRole("link", {name: "archivekeeper"})).toHaveAttribute(
		"href",
		"/users/archivekeeper",
	);
	await expect(page.getByRole("link", {name: "Play Quiet archive"})).toHaveAttribute(
		"href",
		"/play/quiet-archive",
	);
	expect(bootstrapRequests).toBe(0);
	expect(browserErrors).toEqual([]);
});

test("a public user profile falls back to the username and lists published worlds", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.route("**/api/users/archivekeeper", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					bio: "Makes quiet worlds.",
					createdAt: "2026-08-08T12:00:00.000Z",
					displayName: null,
					publications: [publication],
					username: "archivekeeper",
					website: null,
				},
			}),
		}),
	);

	await page.goto("/users/archivekeeper");
	await expect(page.getByRole("heading", {name: "archivekeeper", level: 1})).toBeVisible();
	await expect(page.getByText("@archivekeeper")).toBeVisible();
	await expect(page.getByRole("heading", {name: "Quiet archive"})).toBeVisible();
	await expect(page.getByRole("link", {name: "Play"})).toHaveAttribute(
		"href",
		"/play/quiet-archive",
	);
	await page.setViewportSize({width: 310, height: 844});
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
		),
	).toBe(true);
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

test("the hosted command line stays usable on short, tall, and landscape phones", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	const helpText =
		"Useful commands:\nhelp — Show useful commands.\nlist exits — Show directions you can currently travel.\ngo <direction> — Travel through an available exit.\nlook — Describe your current surroundings.\ntake <item> — Pick up a reachable item.\ndrop <item> — Put down an item you are carrying.\n\nMore commands:\nexamine <item> — Inspect a visible item.\nput <item> in <container> — Place a carried item inside a container.";
	let revision = 3;
	let commands = "look\nnorth";
	let messages = Array.from({length: 48}, (_, index) => ({
		id: `opening-${index}`,
		type: index % 9 === 0 ? "system" : "room",
		text: index === 12 ? helpText : `Archive line ${index + 1}.`,
	}));

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
						id: "playthrough-id",
						revision,
						commandCount: 2,
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
		const body = route.request().postDataJSON() as {command: string};
		commands = `${commands}\n${body.command}`;
		messages = [
			...messages,
			{id: `command-${revision}`, type: "command", text: body.command},
			{id: `result-${revision}`, type: "system", text: "The narrow aisle remains readable."},
		];
		revision += 1;
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					id: "playthrough-id",
					revision,
					commandCount: 3,
					commands,
					status: "active",
					release: {id: "release-id", number: 1},
					state: {messages},
					outputMessages: messages.slice(-2),
				},
			}),
		});
	});

	await page.setViewportSize({width: 320, height: 480});
	await page.goto("/play/quiet-archive");
	const input = page.getByRole("textbox", {name: "Game command"});
	await expect(input).toBeEnabled();
	await expect(input).toHaveAttribute("enterkeyhint", "send");
	await expect(page.getByRole("log", {name: "Game transcript"})).toHaveAttribute(
		"aria-live",
		"polite",
	);
	const helpMessage = page.locator(".output-log__message", {hasText: "Useful commands:"});
	await expect(helpMessage).toHaveCount(1);
	const helpWrapping = await helpMessage.evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			fitsWidth: element.scrollWidth <= element.clientWidth + 1,
			overflowWrap: style.overflowWrap,
			whiteSpace: style.whiteSpace,
		};
	});
	expect(helpWrapping).toEqual({fitsWidth: true, overflowWrap: "anywhere", whiteSpace: "pre-wrap"});

	for (const viewport of [
		{width: 320, height: 480},
		{width: 390, height: 844},
		{width: 844, height: 390},
	]) {
		await page.setViewportSize(viewport);
		const geometry = await page.evaluate(() => {
			const header = document.querySelector<HTMLElement>(".hostedPlayerHeader")!;
			const prompt = document.querySelector<HTMLElement>(".command-input")!;
			return {
				headerBottom: header.getBoundingClientRect().bottom,
				promptBottom: prompt.getBoundingClientRect().bottom,
				promptTop: prompt.getBoundingClientRect().top,
				viewportHeight: window.innerHeight,
				viewportWidth: window.innerWidth,
				documentWidth: document.documentElement.scrollWidth,
			};
		});
		expect(geometry.promptTop).toBeGreaterThanOrEqual(geometry.headerBottom);
		expect(geometry.promptBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
		expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
	}

	await page.setViewportSize({width: 320, height: 480});
	await page.getByRole("button", {name: "Previous command"}).click();
	await expect(input).toHaveValue("north");
	await expect(input).toBeFocused();

	await page.getByRole("button", {name: "World menu"}).click();
	const dialog = page.getByRole("dialog", {name: "Quiet archive"});
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole("link", {name: "Return to published worlds"})).toHaveAttribute(
		"href",
		"/play",
	);
	const sheet = await dialog.boundingBox();
	expect(sheet).not.toBeNull();
	expect(sheet!.x).toBeLessThanOrEqual(1);
	expect(sheet!.x + sheet!.width).toBeGreaterThanOrEqual(319);
	expect(sheet!.y + sheet!.height).toBeLessThanOrEqual(481);
	await page.keyboard.press("Escape");
	await expect(dialog).toHaveCount(0);
	await expect(page.getByRole("button", {name: "World menu"})).toBeFocused();

	const output = page.locator(".game-player__output");
	await output.evaluate((element) => {
		element.scrollTop = 0;
		element.dispatchEvent(new Event("scroll"));
	});
	await input.fill("look along the narrow aisle");
	await input.press("Enter");
	await expect(page.getByText("The narrow aisle remains readable.")).toBeVisible();
	expect(await output.evaluate((element) => element.scrollTop)).toBeLessThan(4);
	await expect(input).toBeFocused();
	expect(browserErrors).toEqual([]);
});

test("a failed hosted command remains in the prompt and can be retried", async ({page}) => {
	let attempts = 0;
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
						id: "playthrough-id",
						revision: 1,
						commandCount: 0,
						commands: "",
						status: "active",
						release: {id: "release-id", number: 1},
						state: {messages: [{id: "opening", type: "room", text: "A quiet archive waits."}]},
					},
					newerReleaseAvailable: false,
				},
			}),
		}),
	);
	await page.route("**/api/play/publications/quiet-archive/command", (route) => {
		attempts += 1;
		if (attempts === 1) return route.fulfill({status: 503, body: "gateway unavailable"});
		return route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					id: "playthrough-id",
					revision: 2,
					commandCount: 1,
					commands: "look",
					status: "active",
					release: {id: "release-id", number: 1},
					state: {
						messages: [
							{id: "opening", type: "room", text: "A quiet archive waits."},
							{id: "result", type: "system", text: "The retry succeeds."},
						],
					},
					outputMessages: [{id: "result", type: "system", text: "The retry succeeds."}],
				},
			}),
		});
	});

	await page.goto("/play/quiet-archive");
	const input = page.getByRole("textbox", {name: "Game command"});
	await input.fill("look");
	await input.press("Enter");
	await expect(page.locator(".hostedPlayerError")).toHaveText("The command could not be saved.");
	await expect(input).toHaveValue("look");
	await expect(input).toBeFocused();
	await input.press("Enter");
	await expect(page.getByText("The retry succeeds.")).toBeVisible();
	await expect(input).toHaveValue("");
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
	await page.goto("/play/quiet-archive");
	await expect(page.getByText("A new version is available.", {exact: false})).toBeVisible();
	await page.getByRole("button", {name: "Restart with new version"}).click();
	const restartDialog = page.getByRole("dialog", {name: "Restart playthrough?"});
	await expect(restartDialog).toContainText("newer published release");
	await restartDialog.getByRole("button", {name: "Restart playthrough"}).click();
	await expect(page.getByText("The new release.")).toBeVisible();
	await expect(page.getByText("A new version is available.", {exact: false})).toHaveCount(0);
	expect(browserErrors).toEqual([]);
});
