import {expect, test, type Page} from "@playwright/test";

import {world as initialWorld} from "../src/data/worlds/initialWorld";

type BootstrapRequest = {
	cookie: string | undefined;
	csrfToken: string | undefined;
	method: string;
};

type DeterministicWorld = {
	id: string;
	name: string;
	ownerUserId: string;
	world: typeof initialWorld;
	revision: number;
	updatedAt: string;
	lastOpenedAt: string;
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
	maxWorlds = 5,
	sharedWorlds?: Map<string, DeterministicWorld>,
) {
	const ownerUserId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
	const additionalIds = [
		"f76f909d-5c82-4b04-aec6-85c9a175e1a2",
		"cdccb714-eb35-40b3-a7c3-75ef60175c45",
		"8ebc3f3f-b9ca-4f75-898f-e196bae50be4",
		"7973548a-9957-40f4-8146-64d3ff7fb017",
	];
	const storedWorlds = sharedWorlds ?? new Map<string, DeterministicWorld>();
	if (!storedWorlds.has(worldId)) {
		storedWorlds.set(worldId, {
			id: worldId,
			name: "Private test world",
			ownerUserId,
			world: initialWorld,
			revision: 1,
			updatedAt: new Date().toISOString(),
			lastOpenedAt: new Date().toISOString(),
		});
	}
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
			body: JSON.stringify({data: storedWorlds.get(worldId)}),
		});
	});
	await page.route("**/api/world", async (route) => {
		if (route.request().method() === "POST") {
			if (storedWorlds.size >= maxWorlds) {
				await route.fulfill({
					status: 409,
					contentType: "application/json",
					body: JSON.stringify({
						error: {
							code: "WORLD_LIMIT_REACHED",
							message: `This account has reached its limit of ${maxWorlds} worlds.`,
						},
					}),
				});
				return;
			}
			const input = route.request().postDataJSON() as {
				name: string;
				source: "starter" | "blank";
			};
			const id = additionalIds[storedWorlds.size - 1];
			const createdWorld =
				input.source === "blank"
					? {
							...initialWorld,
							metadata: {...initialWorld.metadata, title: input.name, layers: []},
							startRoomId: {type: "room" as const, id: "room-1"},
							rooms: [],
							items: [],
							connections: [],
							conditions: [],
							effects: [],
							events: [],
						}
					: {...initialWorld, metadata: {...initialWorld.metadata, title: input.name}};
			const created = {
				id,
				name: input.name,
				ownerUserId,
				world: createdWorld,
				revision: 1,
				updatedAt: new Date().toISOString(),
				lastOpenedAt: new Date().toISOString(),
			};
			storedWorlds.set(id, created);
			await route.fulfill({
				status: 201,
				contentType: "application/json",
				body: JSON.stringify({data: created}),
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					worlds: [...storedWorlds.values()].reverse(),
					usage: {count: storedWorlds.size, max: maxWorlds},
				},
			}),
		});
	});
	await page.route("**/api/world/*", async (route) => {
		const requestedId = new URL(route.request().url()).pathname.split("/").at(-1);
		const stored = requestedId ? storedWorlds.get(requestedId) : undefined;
		if (!stored) {
			await route.fulfill({
				status: 404,
				contentType: "application/json",
				body: JSON.stringify({error: {code: "WORLD_NOT_FOUND"}}),
			});
			return;
		}

		if (route.request().method() === "PUT") {
			const body = route.request().postDataJSON() as {
				world: typeof initialWorld;
				expectedRevision?: number;
			};
			if (body.expectedRevision !== undefined && body.expectedRevision !== stored.revision) {
				await route.fulfill({
					status: 409,
					contentType: "application/json",
					body: JSON.stringify({
						error: {
							code: "WORLD_REVISION_CONFLICT",
							message: "This world was changed by another editor. Reload before saving again.",
						},
					}),
				});
				return;
			}
			stored.world = body.world;
			stored.revision += 1;
			stored.updatedAt = new Date().toISOString();
			saveCount += 1;
		}
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: stored}),
		});
	});

	return {
		worldId,
		bootstrapCount: () => bootstrapCount,
		bootstrapRequests: () => [...bootstrapRequests],
		saveCount: () => saveCount,
		worlds: () => [...storedWorlds.values()],
		worldStore: storedWorlds,
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
						key: `world-draft:3e816c4d-b957-45dc-8523-d53ec04c8d0f:${worldId}`,
						schemaVersion: 2,
						userId: "3e816c4d-b957-45dc-8523-d53ec04c8d0f",
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

test("the home page opens the world library without choosing a world", async ({page}) => {
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

	await expect(page).toHaveURL(/\/worlds$/);
	await expect(page.getByRole("heading", {name: "Your worlds"})).toBeVisible();
	await expect(page.getByRole("link", {name: /Private test world/})).toBeVisible();
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

	await page.getByRole("link", {name: "Return to your worlds"}).click();
	await expect(page).toHaveURL(/\/worlds$/);
	await expect(page.getByRole("heading", {name: "Your worlds"})).toBeVisible();
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
	expect(createResponse.status()).toBe(403);
	expect((await createResponse.json()).error.code).toBe("INVALID_ORIGIN");
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
	await page.goto(`/worlds/${inaccessibleWorldId}`);

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

	await firstPage.goto(`/worlds/${first.worldId}`);
	await secondPage.goto(`/worlds/${second.worldId}`);
	await expect(firstPage).toHaveURL(new RegExp(`/worlds/${first.worldId}$`));
	await expect(secondPage).toHaveURL(new RegExp(`/worlds/${second.worldId}$`));

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

	await secondPage.goto(`/worlds/${first.worldId}`);
	await expect(secondPage.getByLabel("Current world")).toHaveText("Loading world…");
	await expect(secondPage.getByRole("button", {name: "A private entrance"})).not.toBeVisible();
	await expect(secondPage.getByRole("textbox", {name: "Game command"})).toBeDisabled();

	expect(firstErrors).toEqual([]);
	expect(secondErrors.filter((error) => !error.includes("status of 404"))).toEqual([]);
	await firstContext.close();
	await secondContext.close();
});

test("two tabs surface a revision conflict before switching away", async ({browser}) => {
	const context = await browser.newContext();
	const firstPage = await context.newPage();
	const secondPage = await context.newPage();
	const firstErrors = collectBrowserErrors(firstPage);
	const secondErrors = collectBrowserErrors(secondPage);
	const first = await useDeterministicEditorWorld(firstPage);
	await useDeterministicEditorWorld(secondPage, first.worldId, 5, first.worldStore);

	await firstPage.goto(`/worlds/${first.worldId}`);
	await secondPage.goto(`/worlds/${first.worldId}`);
	const firstName = firstPage.getByRole("textbox", {name: "Name", exact: true});
	const secondName = secondPage.getByRole("textbox", {name: "Name", exact: true});
	await firstName.fill("First tab revision");
	await firstPage.getByRole("button", {name: /Current world: Private test world/}).click();
	await firstPage.getByRole("menuitem", {name: "View all worlds"}).click();
	await expect(firstPage).toHaveURL(/\/worlds$/);
	expect(first.saveCount()).toBe(1);

	await secondName.fill("Second tab revision");
	await expect
		.poll(() => secondErrors.some((error) => error.includes("status of 409")), {timeout: 15_000})
		.toBe(true);

	await secondPage.getByRole("button", {name: /Current world: Private test world/}).click();
	await secondPage.getByRole("menuitem", {name: "View all worlds"}).click();
	await expect(
		secondPage.getByText("Save this world before switching.", {exact: true}),
	).toBeVisible();
	await expect(secondPage).toHaveURL(new RegExp(`/worlds/${first.worldId}$`));
	expect(first.worlds()[0].world.rooms[0].name).toBe("First tab revision");
	expect(firstErrors).toEqual([]);
	expect(secondErrors.filter((error) => !error.includes("status of 409"))).toEqual([]);
	await context.close();
});

test("the world library creates, switches, isolates, and limits private worlds", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page, undefined, 3);

	await page.goto("/worlds");
	await expect(page.getByRole("heading", {name: "Your worlds"})).toBeVisible();
	await expect(page.getByText("1 of 3 worlds")).toBeVisible();

	const createWorld = async (
		name: string,
		roomName: string,
		source: "Starter world" | "Blank world",
	) => {
		await page.getByRole("button", {name: "New world"}).click();
		const dialog = page.getByRole("dialog", {name: "New world"});
		await dialog.getByRole("textbox", {name: "World name"}).fill(name);
		await dialog.getByRole("radio", {name: source}).check();
		await dialog.getByRole("button", {name: "Create world"}).click();
		await expect(page).toHaveURL(/\/worlds\/[0-9a-f-]+$/);
		if (source === "Blank world") {
			await expect(page.getByText("No rooms available. Add a room to begin exploring.")).toBeVisible();
			await expect(page.getByRole("button", {name: "Shop Floor"})).not.toBeVisible();
			await page.locator("[data-map]").click({position: {x: 180, y: 180}});
			await expect(page.getByRole("button", {name: "Room 1"})).toBeVisible();
		}
		const roomNameField = page.getByRole("textbox", {name: "Name", exact: true});
		await roomNameField.fill(roomName);
		await page.getByRole("button", {name: new RegExp(`Current world: ${name}`)}).click();
		await page.getByRole("menuitem", {name: "View all worlds"}).click();
		await expect(page).toHaveURL(/\/worlds$/);
		await expect(page.getByRole("link", {name: new RegExp(name)})).toBeVisible();
	};

	await createWorld("Ash archive", "Ash landing", "Blank world");
	await createWorld("Bell archive", "Bell landing", "Starter world");

	await expect(page.getByText("3 of 3 worlds")).toBeVisible();
	await expect(page.getByText("Delete a world before creating another.")).toBeVisible();
	await expect(page.getByRole("button", {name: "New world"})).toBeDisabled();

	await page.getByRole("link", {name: /Ash archive/}).click();
	await expect(page.getByRole("textbox", {name: "Name", exact: true})).toHaveValue("Ash landing");
	await page.reload();
	await expect(page.getByRole("textbox", {name: "Name", exact: true})).toHaveValue("Ash landing");
	await page.getByRole("button", {name: /Current world: Ash archive/}).click();
	await page.getByRole("menuitem", {name: "Bell archive"}).click();
	await expect(page.getByRole("textbox", {name: "Name", exact: true})).toHaveValue("Bell landing");

	await page.goto("/worlds");
	await page.setViewportSize({width: 390, height: 844});
	await expect(page.getByRole("heading", {name: "Your worlds"})).toBeVisible();
	await expect(page.getByRole("link", {name: /Private test world/})).toBeVisible();

	const apiLimitStatus = await page.evaluate(async () => {
		const response = await fetch("/api/world", {
			method: "POST",
			headers: {"content-type": "application/json", "x-csrf-token": "test-csrf"},
			body: JSON.stringify({name: "Fourth archive", source: "blank"}),
		});
		return response.status;
	});
	expect(apiLimitStatus).toBe(409);
	expect(editor.worlds()).toHaveLength(3);
	expect(browserErrors.filter((error) => !error.includes("status of 409"))).toEqual([]);
});

test("primary editor workspaces are directly reachable", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	await page.goto(`/worlds/${editor.worldId}`);
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

	await page.goto(`/editor/${editor.worldId}`);
	await expect(page).toHaveURL(new RegExp(`/worlds/${editor.worldId}$`));
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
