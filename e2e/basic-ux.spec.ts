import {expect, test, type Page} from "@playwright/test";

import {PERSISTED_SCHEMA_VERSION} from "../src/compat/migrations";
import {world as initialWorld} from "../src/data/worlds/initialWorld";
import {createUniqueWorldSlug} from "../src/utils/worldSlug";

type BootstrapRequest = {
	cookie: string | undefined;
	csrfToken: string | undefined;
	method: string;
};

type DeterministicWorld = {
	deletedAt?: string | null;
	editorSlug: string;
	id: string;
	name: string;
	ownerUserId: string;
	world: typeof initialWorld;
	revision: number;
	schemaVersion: number;
	updatedAt: string;
	lastOpenedAt: string;
	trashPurgeAfter?: string | null;
};

function collectBrowserErrors(page: Page) {
	const errors: string[] = [];

	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});

	return errors;
}

async function useHomePublications(page: Page) {
	await page.route("**/api/play/publications", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					publications: [
						{
							authorUsername: "archivekeeper",
							id: "publication-id-1",
							slug: "quiet-archive",
							title: "Quiet archive",
							summary: "A compact world for testing hosted play.",
							release: {
								number: 1,
								publishedAt: "2026-08-09T12:00:00.000Z",
							},
						},
						{
							authorUsername: "Mothmark",
							id: "publication-id-2",
							slug: "corner-shop",
							title: "Corner Shop",
							summary: "A small example world with a few useful directions.",
							release: {
								number: 2,
								publishedAt: "2026-08-10T12:00:00.000Z",
							},
						},
						{
							authorUsername: "mapmaker",
							id: "publication-id-3",
							slug: "signal-room",
							title: "Signal room",
							summary: "A radio room at the edge of a quiet coast.",
							release: {
								number: 1,
								publishedAt: "2026-08-10T14:00:00.000Z",
							},
						},
					],
				},
			}),
		}),
	);
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
	const trashedWorlds = new Map<string, DeterministicWorld>();
	const createEditorSlug = (name: string) =>
		createUniqueWorldSlug(
			name,
			[...storedWorlds.values(), ...trashedWorlds.values()].map((world) => world.editorSlug),
		);
	if (!storedWorlds.has(worldId)) {
		storedWorlds.set(worldId, {
			editorSlug: createEditorSlug("Private test world"),
			id: worldId,
			name: "Private test world",
			ownerUserId,
			world: initialWorld,
			revision: 1,
			schemaVersion: PERSISTED_SCHEMA_VERSION,
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
			body: JSON.stringify({data: storedWorlds.get(worldId), meta: {userId: ownerUserId}}),
		});
	});
	await page.route(/\/api\/world(?:\?.*)?$/, async (route) => {
		if (new URL(route.request().url()).searchParams.get("view") === "trash") {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({data: {worlds: [...trashedWorlds.values()]}}),
			});
			return;
		}
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
				source: "starter" | "blank" | "import";
				world?: typeof initialWorld;
			};
			const id = additionalIds[storedWorlds.size - 1];
			const createdWorld =
				input.source === "import" && input.world
					? {...input.world, metadata: {...input.world.metadata, title: input.name}}
					: input.source === "blank"
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
				editorSlug: createEditorSlug(input.name),
				id,
				name: input.name,
				ownerUserId,
				world: createdWorld,
				revision: 1,
				schemaVersion: PERSISTED_SCHEMA_VERSION,
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
	await page.route("**/api/world/**", async (route) => {
		const url = new URL(route.request().url());
		const segments = url.pathname.split("/").filter(Boolean);
		const requestedId = segments[2];
		const action = segments[3];
		const stored = requestedId
			? [...storedWorlds.values()].find(
					(world) => world.id === requestedId || world.editorSlug === requestedId,
				)
			: undefined;
		const trashed = requestedId ? trashedWorlds.get(requestedId) : undefined;

		if (stored && action === "duplicate") {
			if (storedWorlds.size >= maxWorlds) {
				await route.fulfill({
					status: 409,
					contentType: "application/json",
					body: JSON.stringify({
						error: {message: `This account has reached its limit of ${maxWorlds} worlds.`},
					}),
				});
				return;
			}
			const duplicateId = additionalIds.find((id) => !storedWorlds.has(id) && !trashedWorlds.has(id));
			if (!duplicateId) throw new Error("No deterministic world ID is available.");
			const duplicate = {
				...stored,
				editorSlug: createEditorSlug(`${stored.name} copy`),
				id: duplicateId,
				name: `${stored.name} copy`,
				world: {...stored.world, metadata: {...stored.world.metadata, title: `${stored.name} copy`}},
			};
			storedWorlds.set(duplicateId, duplicate);
			await route.fulfill({
				status: 201,
				contentType: "application/json",
				body: JSON.stringify({data: duplicate}),
			});
			return;
		}

		if (trashed && action === "restore") {
			if (storedWorlds.size >= maxWorlds) {
				await route.fulfill({
					status: 409,
					contentType: "application/json",
					body: JSON.stringify({
						error: {message: `This account has reached its limit of ${maxWorlds} worlds.`},
					}),
				});
				return;
			}
			trashedWorlds.delete(trashed.id);
			storedWorlds.set(trashed.id, {...trashed, deletedAt: null, trashPurgeAfter: null});
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({data: trashed}),
			});
			return;
		}

		if (stored && action === "export") {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				headers: {
					"content-disposition": `attachment; filename="${stored.editorSlug}.mothmark.json"`,
				},
				body: JSON.stringify({
					format: "mothmark-world",
					schemaVersion: PERSISTED_SCHEMA_VERSION,
					world: stored.world,
				}),
			});
			return;
		}

		if (route.request().method() === "DELETE" && stored) {
			storedWorlds.delete(stored.id);
			trashedWorlds.set(stored.id, {
				...stored,
				deletedAt: new Date().toISOString(),
				trashPurgeAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString(),
			});
			await route.fulfill({status: 204});
			return;
		}

		if (
			route.request().method() === "DELETE" &&
			trashed &&
			url.searchParams.get("permanent") === "1"
		) {
			trashedWorlds.delete(trashed.id);
			await route.fulfill({status: 204});
			return;
		}
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
				name?: string;
				world?: typeof initialWorld;
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
			if (body.world) stored.world = body.world;
			if (body.name) stored.name = body.name;
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
		worldSlug: storedWorlds.get(worldId)?.editorSlug ?? "private-test-world",
		bootstrapCount: () => bootstrapCount,
		bootstrapRequests: () => [...bootstrapRequests],
		saveCount: () => saveCount,
		worlds: () => [...storedWorlds.values()],
		worldStore: storedWorlds,
		trashedWorlds: () => [...trashedWorlds.values()],
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

test("the home page continues without an account into the world library", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	await useHomePublications(page);

	await page.goto("/");
	const pageSelector = page
		.getByRole("navigation", {name: "Primary navigation"})
		.getByRole("button", {name: "Choose page, current: Home"});
	await pageSelector.click();
	await expect(page.getByRole("menuitem", {name: "Play"})).toHaveAttribute("href", "/play");
	expect(editor.bootstrapCount()).toBe(0);
	await expect(
		page.getByRole("heading", {name: "A place to build and play text adventures."}),
	).toBeVisible();
	await expect(page.getByRole("link", {name: "Mothmark home"})).toHaveAttribute(
		"aria-current",
		"page",
	);

	await page.getByRole("link", {name: "Start building"}).click();

	await expect(page).toHaveURL(/\/worlds$/);
	await expect(page.getByRole("heading", {name: "My worlds"})).toBeVisible();
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

test("the home page example plays through the real command path", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	await useHomePublications(page);

	await page.goto("/");
	const exampleMap = page.getByLabel("Pan and zoom map of the Corner Shop example world");
	await expect(exampleMap).toBeVisible();
	await expect
		.poll(() => exampleMap.evaluate((map) => getComputedStyle(map).backgroundColor))
		.toBe("rgb(167, 156, 134)");
	await expect
		.poll(() => exampleMap.evaluate((map) => getComputedStyle(map).colorScheme))
		.toBe("light");
	const mapViewport = exampleMap.locator(".mapViewport");
	const initialMapTransform = await mapViewport.getAttribute("style");
	await exampleMap.hover();
	await page.mouse.wheel(0, -240);
	await expect.poll(() => mapViewport.getAttribute("style")).not.toBe(initialMapTransform);
	await page.getByRole("textbox", {name: "Game command"}).fill("east");
	await page.getByRole("textbox", {name: "Game command"}).press("Enter");
	await expect(page.locator(".game-player__output").getByText(/^Stockroom/)).toBeVisible();
	const publicationCarousel = page.getByLabel("Featured publication carousel");
	await expect(publicationCarousel).toBeVisible();
	await expect(
		publicationCarousel.locator(".homeFeaturedPage--current").getByRole("heading", {
			name: "Corner Shop",
		}),
	).toBeVisible();
	await expect(publicationCarousel.locator(".homeFeaturedPage--previous")).toContainText(
		"Quiet archive",
	);
	await expect(publicationCarousel.locator(".homeFeaturedPage--next")).toContainText("Signal room");
	await page.getByRole("button", {name: "Next featured publication"}).click();
	await expect(
		publicationCarousel.locator(".homeFeaturedPage--current").getByRole("heading", {
			name: "Signal room",
		}),
	).toBeVisible();
	const videoButtons = page.getByRole("button", {name: "Watch video"});
	await expect(videoButtons).toHaveCount(2);
	for (const button of await videoButtons.all()) await expect(button).toBeDisabled();
	expect(editor.bootstrapCount()).toBe(0);
	expect(browserErrors).toEqual([]);
});

test("the home tutorial and videos share a desktop row and stack on mobile", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await useHomePublications(page);

	await page.setViewportSize({width: 1280, height: 900});
	await page.goto("/");
	const tutorial = page.locator(".homeTutorial");
	const videos = page.locator(".homeVideos");
	const [desktopTutorial, desktopVideos] = await Promise.all([
		tutorial.boundingBox(),
		videos.boundingBox(),
	]);
	expect(Math.abs((desktopTutorial?.y ?? 0) - (desktopVideos?.y ?? 0))).toBeLessThan(2);
	const desktopPublication = await page.locator(".homeFeaturedPage--current").boundingBox();
	expect(desktopPublication?.width ?? 0).toBeLessThanOrEqual(900);
	await expect(page.getByRole("contentinfo").getByText("Notes from Mothmark")).toBeVisible();

	await page.setViewportSize({width: 390, height: 844});
	await page.locator(".homePage").evaluate((element) => {
		element.scrollTop = 640;
	});
	await page.reload();
	await expect
		.poll(() => page.locator(".homePage").evaluate((element) => element.scrollTop))
		.toBe(0);
	const commandInputFontSize = await page
		.getByRole("textbox", {name: "Game command"})
		.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
	expect(commandInputFontSize).toBeGreaterThanOrEqual(16);
	const [mobileTutorial, mobileVideos] = await Promise.all([
		tutorial.boundingBox(),
		videos.boundingBox(),
	]);
	expect(mobileVideos?.y ?? 0).toBeGreaterThan(
		(mobileTutorial?.y ?? 0) + (mobileTutorial?.height ?? 0) - 2,
	);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
	expect(browserErrors).toEqual([]);
});

test("temporary account guidance does not create an account until editor entry", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);

	await page.goto("/account");
	await expect(
		page.getByRole("heading", {name: "Your worlds stay with this browser"}),
	).toBeVisible();
	await expect(
		page.getByText(/moving to another browser can make these worlds inaccessible/),
	).toBeVisible();
	expect(editor.bootstrapCount()).toBe(0);

	await page.getByRole("link", {name: "Open your worlds"}).click();
	await expect(page).toHaveURL(/\/worlds$/);
	await expect(page.getByRole("heading", {name: "My worlds"})).toBeVisible();
	expect(editor.bootstrapCount()).toBe(1);
	expect(browserErrors).toEqual([]);
});

test("registered account forms preserve generic responses, autofill semantics, and narrow layouts", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.route("**/api/auth/username-availability?*", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {available: true, message: "Username is available.", valid: true},
			}),
		}),
	);
	await page.route("**/api/auth/csrf", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			headers: {"set-cookie": "mothmark_editor_csrf=csrf; Path=/; SameSite=Lax"},
			body: JSON.stringify({data: {csrfToken: "csrf"}}),
		}),
	);
	await page.route("**/api/auth/register", (route) =>
		route.fulfill({
			status: 202,
			contentType: "application/json",
			body: JSON.stringify({
				data: {message: "If the address can be registered, a verification message is on its way."},
			}),
		}),
	);
	await page.route("**/api/auth/resend-verification", (route) =>
		route.fulfill({
			status: 202,
			contentType: "application/json",
			body: JSON.stringify({
				data: {message: "If a verification is pending, a new message is on its way."},
			}),
		}),
	);
	await page.route("**/api/auth/verify-email", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					status: "verified",
					upgradedAnonymous: false,
					userId: "3e816c4d-b957-45dc-8523-d53ec04c8d0f",
				},
			}),
		}),
	);
	await page.route("**/api/auth/forgot-password", (route) =>
		route.fulfill({
			status: 202,
			contentType: "application/json",
			body: JSON.stringify({
				data: {message: "If the address belongs to an account, a recovery message is on its way."},
			}),
		}),
	);
	await page.route("**/api/auth/reset-password", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {passwordReset: true}}),
		}),
	);
	await page.route("**/api/auth/sign-in", (route) =>
		route.fulfill({
			status: 401,
			contentType: "application/json",
			body: JSON.stringify({
				error: {message: "The email or password is incorrect. Try again or reset your password."},
			}),
		}),
	);

	await page.setViewportSize({width: 390, height: 844});
	await page.goto("/register");
	await expect(page.getByLabel("Username")).toHaveAttribute("autocomplete", "username");
	await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");
	await expect(page.getByLabel("Password", {exact: true})).toHaveAttribute(
		"autocomplete",
		"new-password",
	);
	await page.getByLabel("Username").fill("archivekeeper");
	await page.getByLabel("Email").fill("author@example.com");
	await page.getByLabel("Password", {exact: true}).fill("a durable registration password");
	await page.getByLabel("Confirm password").fill("a durable registration password");
	await page.getByRole("button", {name: "Send verification email"}).click();
	await expect(page.getByText(/If the address can be registered/)).toBeVisible();
	await page.getByRole("button", {name: "Resend verification email"}).click();
	await expect(page.getByText(/If a verification is pending/)).toBeVisible();

	await page.goto("/verify-email?token=one-time-token");
	await expect(page).toHaveURL(/\/$/);
	await page.goto("/forgot-password");
	await page.getByLabel("Email").fill("unknown@example.com");
	await page.getByRole("button", {name: "Send recovery email"}).click();
	await expect(page.getByText(/If the address belongs to an account/)).toBeVisible();

	await page.goto("/reset-password?token=reset-token");
	await page.getByLabel("New password", {exact: true}).fill("a new durable password value");
	await page.getByLabel("Confirm password").fill("a new durable password value");
	await page.getByRole("button", {name: "Reset password"}).click();
	await expect(page.getByText(/all existing sessions were revoked/)).toBeVisible();

	await page.goto("/sign-in");
	await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "current-password");
	await page.getByLabel("Email").fill("unknown@example.com");
	await page.getByLabel("Password").fill("a plausible password value");
	await page.getByRole("button", {name: "Sign in"}).click();
	await expect(page.getByText(/The email or password is incorrect/)).toBeVisible();
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
		),
	).toBe(true);
	expect(browserErrors.filter((error) => !error.includes("status of 401"))).toEqual([]);
});

test("the temporary account page shows retention, exports data, and confirms deletion", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	await useDeterministicEditorWorld(page);
	let deleted = false;
	await page.route("**/api/account/export", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			headers: {"content-disposition": 'attachment; filename="mothmark-account-export.json"'},
			body: JSON.stringify({format: "mothmark-account", worlds: []}),
		});
	});
	await page.route("**/api/account", async (route) => {
		if (route.request().method() === "DELETE") {
			deleted = true;
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({data: {deleted: true}}),
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					accountType: "anonymous",
					cleanupAfter: null,
					cleanupCancelledAt: new Date().toISOString(),
					cleanupWasRecentlyCancelled: true,
					createdAt: "2026-08-01T12:00:00.000Z",
					retentionClass: "authored_editor",
					usage: {activeWorlds: 1, maxWorlds: 5, trashedWorlds: 0},
					userId: "3e816c4d-b957-45dc-8523-d53ec04c8d0f",
				},
			}),
		});
	});

	await page.goto("/account");
	await expect(page.getByText("1 of 5")).toBeVisible();
	await expect(page.getByText(/180 days of inactivity/)).toBeVisible();
	await expect(page.getByText(/pending cleanup was cancelled/)).toBeVisible();
	const exportPromise = page.waitForEvent("download");
	await page.getByRole("link", {name: "Export all data"}).click();
	expect((await exportPromise).suggestedFilename()).toBe("mothmark-account-export.json");

	const deleteButton = page.getByRole("button", {name: "Delete account"});
	await deleteButton.click();
	await expect(page.getByRole("dialog", {name: "Delete this account?"})).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(deleteButton).toBeFocused();
	await deleteButton.click();
	await page
		.getByRole("dialog", {name: "Delete this account?"})
		.getByRole("button", {name: "Delete account"})
		.click();
	await expect(page).toHaveURL(/\/$/);
	expect(deleted).toBe(true);
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

	await expect(page.getByRole("banner").getByLabel("Current world")).toHaveText("Loading world…");
	await expect(page.getByRole("button", {name: "Leaked private draft"})).not.toBeVisible();
	await expect(page.getByRole("textbox", {name: "Game command"})).toBeDisabled();
	expect(browserErrors.filter((error) => !error.includes("status of 404"))).toEqual([]);
});

test("a stale local draft is reconciled explicitly instead of being discarded", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const worldId = "57c635aa-7792-4a13-9595-58cd1ef05fd6";
	const editor = await useDeterministicEditorWorld(page, worldId);
	await page.goto("/");
	await writeLocalWorldDraft(page, {
		world: {...initialWorld, metadata: {...initialWorld.metadata, title: "Older local draft"}},
		worldId,
		revision: 1,
	});
	const server = editor.worldStore.get(worldId);
	if (!server) throw new Error("The deterministic server world is missing.");
	server.revision = 2;
	server.world = {
		...initialWorld,
		metadata: {...initialWorld.metadata, title: "Newer server world"},
	};

	await page.goto(`/worlds/${editor.worldSlug}`);
	const dialog = page.getByRole("dialog", {name: "This browser has an older local draft"});
	await expect(dialog).toContainText("server is now at revision 2");
	await expect(dialog).toContainText("based on revision 1");
	await expect(dialog.getByRole("button", {name: "Open draft as a copy"})).toBeVisible();
	await expect(dialog.getByRole("button", {name: "Export draft"})).toBeVisible();
	await dialog.getByRole("button", {name: "Use server version"}).click();
	await expect(dialog).not.toBeVisible();
	await expect(page.getByRole("textbox", {name: "Game command"})).toBeEnabled();
	expect(browserErrors).toEqual([]);
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

	await firstPage.goto(`/worlds/${first.worldSlug}`);
	await secondPage.goto(`/worlds/${second.worldSlug}`);
	await expect(firstPage).toHaveURL(new RegExp(`/worlds/${first.worldSlug}$`));
	await expect(secondPage).toHaveURL(new RegExp(`/worlds/${second.worldSlug}$`));

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
	await expect(secondPage.getByRole("banner").getByLabel("Current world")).toHaveText(
		"Loading world…",
	);
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

	await firstPage.goto(`/worlds/${first.worldSlug}`);
	await secondPage.goto(`/worlds/${first.worldSlug}`);
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
	await expect(secondPage).toHaveURL(new RegExp(`/worlds/${first.worldSlug}$`));
	expect(first.worlds()[0].world.rooms[0].name).toBe("First tab revision");
	expect(firstErrors).toEqual([]);
	expect(secondErrors.filter((error) => !error.includes("status of 409"))).toEqual([]);
	await context.close();
});

test("the world library creates, switches, isolates, and limits private worlds", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page, undefined, 3);

	await page.goto("/worlds");
	await expect(page.getByRole("heading", {name: "My worlds"})).toBeVisible();
	await expect(page.getByText("1 of 3 worlds")).toBeVisible();
	const initialWorldLink = page.getByRole("link", {name: /Private test world/});
	await expect(
		initialWorldLink.getByRole("group", {
			name: `${initialWorld.metadata.layers.length} map layers`,
		}),
	).toBeVisible();
	const layerPreview = initialWorldLink.locator("[data-layer-preview]").first();
	await expect(layerPreview).toBeVisible();
	await expect
		.poll(() => layerPreview.evaluate((map) => getComputedStyle(map).backgroundColor))
		.toBe("rgb(167, 156, 134)");
	await initialWorldLink.hover();
	await expect(initialWorldLink.locator(".worldFolioSheet--active .worldFolioLabel")).toHaveCSS(
		"opacity",
		"1",
	);

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
		await expect(page).toHaveURL(new RegExp(`/worlds/${name.toLowerCase().replaceAll(" ", "-")}$`));
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
	await expect(
		page.getByText("Move a world to trash before creating or restoring another."),
	).toBeVisible();
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
	await expect(page.getByRole("heading", {name: "My worlds"})).toBeVisible();
	const privateWorldRow = page.getByRole("link", {name: /Private test world/});
	await expect(privateWorldRow).toBeVisible();
	await expect(
		privateWorldRow.getByText(
			`${initialWorld.rooms.length} rooms · ${initialWorld.items.length} items`,
		),
	).toBeVisible();
	const actionTrigger = page.getByRole("button", {name: "Actions for Private test world"});
	const [triggerBox, iconBox] = await Promise.all([
		actionTrigger.boundingBox(),
		actionTrigger.locator("svg").boundingBox(),
	]);
	expect(triggerBox).not.toBeNull();
	expect(iconBox).not.toBeNull();
	if (triggerBox && iconBox) {
		expect(
			Math.abs(triggerBox.x + triggerBox.width / 2 - (iconBox.x + iconBox.width / 2)),
		).toBeLessThan(1);
		expect(
			Math.abs(triggerBox.y + triggerBox.height / 2 - (iconBox.y + iconBox.height / 2)),
		).toBeLessThan(1);
	}

	const libraryScroll = page.locator(".worldLibraryScroll");
	await libraryScroll.evaluate((element) => {
		element.scrollTop = element.scrollHeight;
	});
	const footer = page.getByRole("contentinfo");
	await expect(footer.getByRole("heading", {name: "Notes from Mothmark"})).toBeVisible();
	await expect(page.getByRole("heading", {name: "My worlds"})).toBeVisible();

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

test("a new world can start from an exported JSON file", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await useDeterministicEditorWorld(page);
	const importedWorld = {
		...initialWorld,
		rooms: [{...initialWorld.rooms[0], name: "Imported landing"}, ...initialWorld.rooms.slice(1)],
	};

	await page.goto("/worlds");
	await page.getByRole("button", {name: "New world"}).click();
	const dialog = page.getByRole("dialog", {name: "New world"});
	await dialog.getByRole("radio", {name: "Import JSON file"}).check();
	await dialog.getByLabel("World JSON file").setInputFiles({
		name: "imported-archive.mothmark.json",
		mimeType: "application/json",
		buffer: Buffer.from(
			JSON.stringify({
				format: "mothmark-world",
				schemaVersion: PERSISTED_SCHEMA_VERSION,
				worldName: "Imported archive",
				world: importedWorld,
			}),
		),
	});
	await expect(dialog.getByRole("textbox", {name: "World name"})).toHaveValue("Imported archive");
	await dialog.getByRole("button", {name: "Create world"}).click();

	await expect(page).toHaveURL(/\/worlds\/imported-archive$/);
	await expect(page.getByRole("button", {name: "Imported landing"})).toBeVisible();
	expect(browserErrors).toEqual([]);
});

test("world lifecycle actions rename, export, duplicate, trash, restore, and permanently delete", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	await page.goto("/worlds");

	const actions = page.getByRole("button", {name: "Actions for Private test world"});
	await actions.click();
	await page.getByRole("menuitem", {name: "Rename"}).click();
	const renameDialog = page.getByRole("dialog", {name: "Rename world"});
	await renameDialog.getByRole("textbox", {name: "World name"}).fill("Renamed archive");
	await renameDialog.getByRole("button", {name: "Rename"}).click();
	await expect(page.getByRole("link", {name: /Renamed archive/})).toBeVisible();

	await page.getByRole("button", {name: "Actions for Renamed archive"}).click();
	const downloadPromise = page.waitForEvent("download");
	await page.getByRole("menuitem", {name: "Export"}).click();
	expect((await downloadPromise).suggestedFilename()).toBe(`${editor.worldSlug}.mothmark.json`);

	await page.getByRole("button", {name: "Actions for Renamed archive"}).click();
	await page.getByRole("menuitem", {name: "Duplicate"}).click();
	await expect(page.getByRole("link", {name: /Renamed archive copy/})).toBeVisible();

	const renamedActions = page.getByRole("button", {
		name: "Actions for Renamed archive",
		exact: true,
	});
	await renamedActions.click();
	await page.getByRole("menuitem", {name: "Move to trash"}).click();
	await expect(page.getByRole("dialog", {name: "Move world to trash?"})).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(renamedActions).toBeFocused();

	await renamedActions.click();
	await page.getByRole("menuitem", {name: "Move to trash"}).click();
	await page
		.getByRole("dialog", {name: "Move world to trash?"})
		.getByRole("button", {name: "Move to trash"})
		.click();
	await expect(page.getByRole("link", {name: /Renamed archive$/})).not.toBeVisible();

	await page.getByRole("button", {name: /^Trash/}).click();
	await expect(page.getByRole("heading", {name: "Trash"})).toBeVisible();
	await expect(page.getByText("Renamed archive", {exact: true})).toBeVisible();
	await page.getByRole("button", {name: "Restore"}).click();
	await expect(page.getByText("Trash is empty.")).toBeVisible();

	await page.getByRole("button", {name: "Worlds", exact: true}).click();
	await page.getByRole("button", {name: "Actions for Renamed archive copy"}).click();
	await page.getByRole("menuitem", {name: "Move to trash"}).click();
	await page
		.getByRole("dialog", {name: "Move world to trash?"})
		.getByRole("button", {name: "Move to trash"})
		.click();
	await page.getByRole("button", {name: /^Trash/}).click();

	const permanent = page.getByRole("button", {name: "Delete permanently"});
	await permanent.click();
	await expect(page.getByRole("dialog", {name: "Delete world permanently?"})).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(permanent).toBeFocused();
	await permanent.click();
	await page
		.getByRole("dialog", {name: "Delete world permanently?"})
		.getByRole("button", {name: "Delete permanently"})
		.click();
	await expect(page.getByText("Trash is empty.")).toBeVisible();

	await page.setViewportSize({width: 390, height: 844});
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
		),
	).toBe(true);
	expect(browserErrors).toEqual([]);
});

test("primary editor workspaces are directly reachable", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	await page.goto("/worlds/undefined");
	await expect(page).toHaveURL(new RegExp(`/worlds/${editor.worldSlug}$`));
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
	await page.getByRole("button", {name: /Help/}).first().click();
	const playerHelp = page.getByRole("region", {name: "Player help"});
	await expect(playerHelp).toBeVisible();
	await expect(playerHelp.getByRole("checkbox", {name: "Show this command in help"})).toBeChecked();
	await expect(playerHelp.getByRole("textbox", {name: "Player command"})).toHaveValue("help");

	for (const width of [447, 310]) {
		await page.setViewportSize({width, height: 844});
		expect(
			await playerHelp.evaluate(
				(element) =>
					element.scrollWidth <= element.clientWidth &&
					document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);
	}

	await page.setViewportSize({width: 447, height: 844});
	await page.getByRole("button", {name: "Back to Commands"}).click();
	await page
		.getByRole("button", {name: /Travel/})
		.first()
		.click();
	const directionBlock = page.getByRole("button", {name: "Direction <direction>"});
	await directionBlock.focus();
	await page.keyboard.press("Enter");
	const relativeDirectionsLabel = page.getByText("Allow relative directions");
	await expect(relativeDirectionsLabel).toBeVisible();
	for (const width of [447, 310]) {
		await page.setViewportSize({width, height: 844});
		const measurements = await relativeDirectionsLabel.evaluate((element) => {
			const field = element.closest<HTMLElement>(".universalField")!;
			return {
				field: [field.scrollWidth, field.clientWidth],
				document: [document.documentElement.scrollWidth, window.innerWidth],
			};
		});
		expect(measurements.document).toEqual([width, width]);
		expect(measurements.field[0]).toBeLessThanOrEqual(measurements.field[1]);
	}
	await page.setViewportSize({width: 447, height: 844});
	const relativeDirections = page.getByRole("switch", {name: "On"});
	await expect(relativeDirections).toBeChecked();
	await relativeDirections.click();
	await expect(page.getByRole("switch", {name: "Off"})).not.toBeChecked();

	await page.getByRole("button", {name: "World settings"}).click();
	await expect(page.getByRole("button", {name: "Reset to starter world"})).toBeVisible();

	await page.goto(`/editor/${editor.worldId}`);
	await expect(page).toHaveURL(new RegExp(`/worlds/${editor.worldSlug}$`));
	expect(browserErrors).toEqual([]);
});

test("a registered owner publishes the current saved world from world settings", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const environment = await useDeterministicEditorWorld(page);
	let publishRequest: unknown;

	await page.route("**/api/account", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {accountType: "registered"}}),
		}),
	);
	await page.route(`**/api/world/${environment.worldId}/publication`, async (route) => {
		if (route.request().method() === "GET") {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({data: null}),
			});
			return;
		}
		publishRequest = route.request().postDataJSON();
		await route.fulfill({
			status: 201,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					id: "publication-id",
					slug: "quiet-archive",
					title: "Quiet archive",
					summary: "A compact public world.",
					visibility: "listed",
					status: "published",
					release: {number: 1, publishedAt: "2026-08-09T12:00:00.000Z"},
					worldRevision: 1,
					currentWorldRevision: 1,
					unpublishedChanges: false,
				},
			}),
		});
	});

	await page.goto(`/worlds/${environment.worldSlug}`);
	await page.getByRole("button", {name: "World settings"}).click();
	await expect(page.getByRole("heading", {name: "Publishing"})).toBeVisible();
	await page.getByLabel("Public title").fill("Quiet archive");
	await page.getByLabel("Stable public slug").fill("quiet-archive");
	await page.getByLabel("Short summary").fill("A compact public world.");
	await page.getByRole("button", {name: "Publish current version"}).click();

	await expect(page.getByText("Release 1 uses saved revision 1.", {exact: false})).toBeVisible();
	await expect(page.getByRole("link", {name: "Open published world"})).toHaveAttribute(
		"href",
		"/play/quiet-archive",
	);
	expect(publishRequest).toEqual({
		expectedRevision: 1,
		title: "Quiet archive",
		slug: "quiet-archive",
		summary: "A compact public world.",
		visibility: "listed",
	});
	expect(browserErrors).toEqual([]);
});

test("a stored theme applies without adding another signed-out header control", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.addInitScript(() => window.localStorage.setItem("mothmark-theme", "light"));
	await page.goto("/");

	await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
	await expect
		.poll(() =>
			page.locator(".header").evaluate((header) => getComputedStyle(header).backgroundColor),
		)
		.toBe("rgb(237, 228, 213)");
	await expect(page.getByRole("button", {name: /Switch to (dark|light) theme/})).toHaveCount(0);
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

test("administrator sign-in and granular controls support deep links and back navigation", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	const userId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
	const worldId = "57c635aa-7792-4a13-9595-58cd1ef05fd6";
	const now = "2026-08-08T12:00:00.000Z";
	const world = {
		createdAt: now,
		deletedAt: null,
		editorSlug: "private-test-world",
		id: worldId,
		lifecycle: "active",
		name: "Private test world",
		owner: {accountType: "anonymous", displayName: null, id: userId, username: null},
		revision: 3,
		schemaVersion: PERSISTED_SCHEMA_VERSION,
		trashPurgeAfter: null,
		updatedAt: now,
		worldSizeBytes: 4096,
	};
	const user = {
		accountType: "anonymous",
		cleanupAfter: null,
		cleanupReason: null,
		cleanupScheduledAt: null,
		createdAt: now,
		displayName: null,
		id: userId,
		lastSeenAt: now,
		maxWorlds: 5,
		siteRole: "user",
		status: "active",
		suspendedAt: null,
		suspensionReason: null,
		trashedWorldCount: 0,
		username: null,
		worldCount: 1,
	};
	const registeredUser = {
		...user,
		accountType: "registered",
		displayName: "author@example.com",
		id: "6f56ddaf-a999-49d7-a4b2-5b0281ccce3f",
		username: "archivekeeper",
	};
	let permissionState: "deny" | "inherited" = "inherited";
	let permissionMutation: unknown;
	await page.route("**/api/admin/auth/password", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {secondFactorRequired: true}}),
		}),
	);
	await page.route("**/api/admin/auth/second-factor", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {authenticated: true}}),
		}),
	);
	await page.route(/\/api\/admin\/users$/, (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {users: [user, registeredUser]}}),
		}),
	);
	await page.route(new RegExp(`/api/admin/users/${userId}$`), (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					...user,
					credentialChangedAt: null,
					email: null,
					emailVerifiedAt: null,
					mfaEnrolled: false,
					permissions: [
						{
							allowed: permissionState !== "deny",
							expiresAt: null,
							override: permissionState,
							permission: "editor.access",
							source: permissionState === "deny" ? "explicit deny" : "account default",
						},
					],
					registeredAt: null,
					sessions: [],
					worlds: [world],
				},
			}),
		}),
	);
	await page.route(new RegExp(`/api/admin/users/${userId}/permissions$`), async (route) => {
		permissionMutation = route.request().postDataJSON();
		permissionState = "deny";
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {permissions: []}}),
		});
	});
	await page.route(/\/api\/admin\/worlds$/, (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {worlds: [world]}}),
		}),
	);
	await page.route(new RegExp(`/api/admin/worlds/${worldId}$`), (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {...world, world: initialWorld}}),
		}),
	);
	await page.route(new RegExp(`/api/admin/worlds/${worldId}/edit$`), (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {revision: 4}}),
		}),
	);
	await page.route("**/api/auth/csrf?audience=admin", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {csrfToken: "admin-csrf"}}),
		}),
	);
	await page.route("**/api/admin/auth/sign-out", (route) => route.fulfill({status: 204}));

	await page.goto("/admin/sign-in");
	await expect(page.getByRole("heading", {name: "Administrator sign-in"})).toBeVisible();
	await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "username");
	await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "current-password");
	await expect(page.getByRole("link", {name: "Mothmark home"})).not.toBeVisible();
	await page.getByLabel("Email").fill("administrator@example.com");
	await page.getByLabel("Password").fill("a strong administrator password");
	await page.getByRole("button", {name: "Continue"}).click();
	await expect(page.getByLabel("Authentication code")).toHaveAttribute(
		"autocomplete",
		"one-time-code",
	);
	await page.getByLabel("Authentication code").fill("123456");
	await page.getByRole("button", {name: "Sign in"}).click();
	await expect(page).toHaveURL(/\/admin\/users$/);
	await expect(page.getByRole("heading", {name: "Users"})).toBeVisible();
	await expect(page.getByRole("link", {name: "archivekeeper"})).toBeVisible();

	await page.getByRole("link", {name: `Anonymous ${userId.slice(0, 8)}`}).click();
	await expect(page.getByRole("heading", {name: `Anonymous ${userId.slice(0, 8)}`})).toBeVisible();
	await expect(page.getByText("Effective: allowed · account default")).toBeVisible();
	await page.getByLabel("Override for editor.access").selectOption("deny");
	await expect(page.getByText("Permission update completed.")).toBeVisible();
	expect(permissionMutation).toEqual({permission: "editor.access", state: "deny"});
	await expect(page.getByText("Effective: denied · explicit deny")).toBeVisible();
	await page.getByRole("link", {name: "← Users"}).click();
	await expect(page.getByRole("heading", {name: "Users"})).toBeVisible();

	await page.goto(`/admin/worlds/${worldId}`);
	await expect(page.getByRole("heading", {name: "Private test world"})).toBeVisible();
	await page.goBack();
	await expect(page.getByRole("heading", {name: "Users"})).toBeVisible();
	await page.goto(`/admin/worlds/${worldId}`);
	await expect(page.getByText("Inspection only")).toBeVisible();
	await page.getByRole("button", {name: "Enter administrative edit mode"}).click();
	await expect(page.getByRole("status")).toContainText("Administrative editing");
	await expect(page.getByRole("button", {name: "Save administrative edit"})).toBeDisabled();
	await page.getByLabel("Administrative reason").fill("Repair a malformed maintained document");
	await expect(page.getByRole("button", {name: "Save administrative edit"})).toBeEnabled();
	await page.setViewportSize({width: 390, height: 844});
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
		),
	).toBe(true);

	await page.getByRole("button", {name: "Sign out"}).click();
	await expect(page).toHaveURL(/\/admin\/sign-in$/);
	expect(browserErrors).toEqual([]);
});

test("an expired administrator session returns a direct deep link to sign-in", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.route(/\/api\/admin\/users$/, (route) =>
		route.fulfill({
			status: 401,
			contentType: "application/json",
			body: JSON.stringify({error: {code: "ADMIN_AUTH_REQUIRED"}}),
		}),
	);
	await page.goto("/admin/users");
	await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin%2Fusers$/);
	await expect(page.getByRole("heading", {name: "Administrator sign-in"})).toBeVisible();
	expect(browserErrors.filter((error) => !error.includes("status of 401"))).toEqual([]);
});
