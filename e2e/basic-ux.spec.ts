import {expect, test, type Page} from "@playwright/test";

import {world as initialWorld} from "../src/data/worlds/initialWorld";

type BootstrapRequest = {
	cookie: string | undefined;
	csrfToken: string | undefined;
	method: string;
};

function collectBrowserErrors(page: Page) {
	const errors: string[] = [];

	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});

	return errors;
}

async function useDeterministicEditorWorld(
	page: Page,
	worldId = "57c635aa-7792-4a13-9595-58cd1ef05fd6",
) {
	let storedWorld = initialWorld;
	let revision = 1;
	let bootstrapCount = 0;
	let saveCount = 0;
	const bootstrapRequests: BootstrapRequest[] = [];
	await page.route("**/api/auth/csrf", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			headers: {"set-cookie": "mothmark_editor_csrf=test-csrf; Path=/; SameSite=Lax"},
			body: JSON.stringify({data: {csrfToken: "test-csrf"}}),
		});
	});
	await page.route("**/api/editor/bootstrap", async (route) => {
		bootstrapCount += 1;
		bootstrapRequests.push({
			cookie: route.request().headers().cookie,
			csrfToken: route.request().headers()["x-csrf-token"],
			method: route.request().method(),
		});
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					id: worldId,
					name: "Private test world",
					world: storedWorld,
					revision,
				},
			}),
		});
	});
	await page.route("**/api/world/*", async (route) => {
		const requestedId = new URL(route.request().url()).pathname.split("/").at(-1);
		if (requestedId !== worldId) {
			await route.fulfill({
				status: 404,
				contentType: "application/json",
				body: JSON.stringify({error: {code: "WORLD_NOT_FOUND"}}),
			});
			return;
		}

		if (route.request().method() === "PUT") {
			const body = route.request().postDataJSON() as {world: typeof initialWorld};
			storedWorld = body.world;
			revision += 1;
			saveCount += 1;
		}
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {id: worldId, name: "Private test world", world: storedWorld, revision},
			}),
		});
	});

	return {
		worldId,
		bootstrapCount: () => bootstrapCount,
		bootstrapRequests: () => [...bootstrapRequests],
		saveCount: () => saveCount,
	};
}

async function writeLocalWorldDraft(
	page: Page,
	input: {world: typeof initialWorld; worldId: string; revision: number},
) {
	await page.evaluate(
		async ({world, worldId, revision}) =>
			new Promise<void>((resolve, reject) => {
				const openRequest = indexedDB.open("mothmark-editor", 1);
				openRequest.onupgradeneeded = () => {
					const database = openRequest.result;
					if (!database.objectStoreNames.contains("world-drafts")) {
						database.createObjectStore("world-drafts", {keyPath: "key"});
					}
				};
				openRequest.onerror = () => reject(openRequest.error);
				openRequest.onsuccess = () => {
					const database = openRequest.result;
					const transaction = database.transaction("world-drafts", "readwrite");
					transaction.objectStore("world-drafts").put({
						key: "main-world",
						schemaVersion: 1,
						world,
						worldId,
						baseServerRevision: revision,
						updatedAt: Date.now(),
					});
					transaction.oncomplete = () => {
						database.close();
						resolve();
					};
					transaction.onerror = () => reject(transaction.error);
				};
			}),
		input,
	);
}

test("the home page opens the editor in one action", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);

	await page.goto("/");
	expect(editor.bootstrapCount()).toBe(0);
	await expect(page.getByRole("heading", {name: "Build a world that answers back."})).toBeVisible();
	await expect(page.getByRole("link", {name: "Home", exact: true})).toHaveAttribute(
		"aria-current",
		"page",
	);

	await page.getByRole("link", {name: "Start building"}).click();

	await expect(page).toHaveURL(/\/editor\/57c635aa-7792-4a13-9595-58cd1ef05fd6$/);
	await expect(page.getByLabel("Current world")).toHaveText("The Barrow Below");
	await expect(page.getByRole("button", {name: "Map"})).toHaveAttribute("aria-current", "page");
	await expect(page.getByRole("textbox", {name: "Game command"})).toBeEnabled();
	expect(editor.bootstrapCount()).toBe(1);
	expect(editor.bootstrapRequests()).toEqual([
		{
			cookie: expect.stringContaining("mothmark_editor_csrf=test-csrf"),
			csrfToken: "test-csrf",
			method: "POST",
		},
	]);
	expect(browserErrors).toEqual([]);
});

test("temporary account guidance does not create an account until editor entry", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);

	await page.goto("/account");
	await expect(
		page.getByRole("heading", {name: "Your worlds stay with this browser"}),
	).toBeVisible();
	await expect(page.getByText(/There is not yet a sign-in or account-recovery flow/)).toBeVisible();
	expect(editor.bootstrapCount()).toBe(0);

	await page.getByRole("link", {name: "Return to your world"}).click();
	await expect(page).toHaveURL(new RegExp(`/editor/${editor.worldId}$`));
	await expect(page.getByRole("textbox", {name: "Game command"})).toBeEnabled();
	expect(editor.bootstrapCount()).toBe(1);
	expect(browserErrors).toEqual([]);
});

test("legacy shared-world routes stay closed to a public browser", async ({request}) => {
	const listResponse = await request.get("/api/world");
	const slugResponse = await request.get("/api/world/slug/main");
	const createResponse = await request.post("/api/world", {data: {}});
	const defaultResponse = await request.post("/api/world/default", {data: {}});

	expect(listResponse.status()).toBe(401);
	expect((await listResponse.json()).error.code).toBe("AUTH_REQUIRED");
	expect(slugResponse.status()).toBe(404);
	expect((await slugResponse.json()).error.code).toBe("WORLD_NOT_FOUND");
	expect(createResponse.status()).toBe(405);
	expect((await createResponse.json()).error.code).toBe("WORLD_CREATION_UNAVAILABLE");
	expect(defaultResponse.status()).toBe(404);
});

test("an inaccessible world cannot be restored from an old local draft", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const accessibleWorldId = "b84151a0-ce68-4aa9-984f-b0306bcfa2c7";
	const inaccessibleWorldId = "57c635aa-7792-4a13-9595-58cd1ef05fd6";
	await useDeterministicEditorWorld(page, accessibleWorldId);
	const leakedDraftWorld = {
		...initialWorld,
		rooms: [{...initialWorld.rooms[0], name: "Leaked private draft"}, ...initialWorld.rooms.slice(1)],
	};

	await page.goto("/");
	await writeLocalWorldDraft(page, {
		world: leakedDraftWorld,
		worldId: inaccessibleWorldId,
		revision: 1,
	});
	await page.goto(`/editor/${inaccessibleWorldId}`);

	await expect(page.getByLabel("Current world")).toHaveText("Loading world…");
	await expect(page.getByRole("button", {name: "Leaked private draft"})).not.toBeVisible();
	await expect(page.getByRole("textbox", {name: "Game command"})).toBeDisabled();
	expect(browserErrors.filter((error) => !error.includes("status of 404"))).toEqual([]);
});

test("private worlds persist for one browser and remain unresolved for another", async ({
	browser,
}) => {
	const firstContext = await browser.newContext();
	const secondContext = await browser.newContext();
	const firstPage = await firstContext.newPage();
	const secondPage = await secondContext.newPage();
	const firstErrors = collectBrowserErrors(firstPage);
	const secondErrors = collectBrowserErrors(secondPage);
	const first = await useDeterministicEditorWorld(firstPage, "57c635aa-7792-4a13-9595-58cd1ef05fd6");
	const second = await useDeterministicEditorWorld(
		secondPage,
		"b84151a0-ce68-4aa9-984f-b0306bcfa2c7",
	);

	await firstPage.goto("/editor");
	await secondPage.goto("/editor");
	await expect(firstPage).toHaveURL(new RegExp(`/editor/${first.worldId}$`));
	await expect(secondPage).toHaveURL(new RegExp(`/editor/${second.worldId}$`));

	const nameField = firstPage.getByRole("textbox", {name: "Name", exact: true});
	await expect(nameField).toBeVisible();
	await nameField.fill("A private entrance");
	await expect.poll(first.saveCount, {timeout: 15_000}).toBe(1);
	await expect(firstPage.getByText("Saving...")).not.toBeVisible({timeout: 5_000});
	await firstPage.reload();
	await expect(firstPage.getByRole("textbox", {name: "Name", exact: true})).toHaveValue(
		"A private entrance",
	);
	expect(first.bootstrapCount()).toBe(2);

	await secondPage.goto(`/editor/${first.worldId}`);
	await expect(secondPage.getByLabel("Current world")).toHaveText("Loading world…");
	await expect(secondPage.getByRole("button", {name: "A private entrance"})).not.toBeVisible();
	await expect(secondPage.getByRole("textbox", {name: "Game command"})).toBeDisabled();

	expect(firstErrors).toEqual([]);
	expect(secondErrors.filter((error) => !error.includes("status of 404"))).toEqual([]);
	await firstContext.close();
	await secondContext.close();
});

test("primary editor workspaces are directly reachable", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await useDeterministicEditorWorld(page);
	await page.goto("/editor");
	await expect(page.getByRole("textbox", {name: "Game command"})).toBeEnabled();

	await page.getByRole("button", {name: "Items"}).click();
	await expect(page.getByRole("heading", {name: "Items"})).toBeVisible();
	await expect(page.getByPlaceholder("Search items, aliases, and tags")).toBeVisible();
	await expect(page.getByRole("button", {name: "Add item"})).toBeVisible();

	await page.getByRole("button", {name: "Logic"}).click();
	await expect(page.getByRole("heading", {name: "Logic"})).toBeVisible();
	await expect(page.getByRole("button", {name: /Commands/})).toBeVisible();

	await page.getByRole("button", {name: /Commands/}).click();
	await expect(page.getByRole("heading", {name: "Commands"})).toBeVisible();

	await page.getByRole("button", {name: "World Config"}).click();
	await expect(page.getByRole("button", {name: "Reset example"})).toBeVisible();
	expect(browserErrors).toEqual([]);
});

test("the theme control communicates and applies its state", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.addInitScript(() => window.localStorage.setItem("mothmark-theme", "light"));
	await page.goto("/");

	const themeToggle = page.getByRole("button", {name: "Switch to dark theme"});
	await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
	await expect(themeToggle).toHaveAttribute("aria-pressed", "false");
	await themeToggle.click();

	await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
	await expect(page.getByRole("button", {name: "Switch to light theme"})).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	expect(browserErrors).toEqual([]);
});

test("the starter world copy action provides immediate confirmation", async ({page, context}) => {
	const browserErrors = collectBrowserErrors(page);
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.goto("/starter");

	await expect(page.getByRole("heading", {name: "Starter World", exact: true})).toBeVisible();
	await page.getByRole("button", {name: "Copy"}).click();

	await expect(page.getByRole("button", {name: "Copied!"})).toBeVisible();
	const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
	expect(JSON.parse(clipboardText)).toMatchObject({metadata: expect.any(Object)});
	expect(browserErrors).toEqual([]);
});
