import {expect, test, type Page} from "@playwright/test";

import {PERSISTED_SCHEMA_VERSION} from "../src/compat/migrations";
import {world as initialWorld} from "../src/data/worlds/initialWorld";
import {ItemSchema} from "../src/schemas/world/itemSchema";
import {createDefaultFieldObject} from "../src/utils/createDefaultFieldObject";
import {toID} from "../src/utils/idUtils";
import {createUniqueWorldSlug} from "../src/utils/worldSlug";
import {expectMobileLayoutIntegrity} from "./mobile-layout";

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

async function itemWorkspaceTextContrast(page: Page) {
	return page.evaluate(() => {
		const toRgb = (value: string) =>
			(value.match(/[\d.]+/g) ?? []).slice(0, 3).map((channel) => Number(channel) / 255);
		const luminance = (value: string) => {
			const channels = toRgb(value).map((channel) =>
				channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
			);
			return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
		};
		const ratio = (foreground: Element, background: Element) => {
			const foregroundLuminance = luminance(getComputedStyle(foreground).color);
			const backgroundLuminance = luminance(getComputedStyle(background).backgroundColor);
			return (
				(Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
				(Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
			);
		};
		const inactiveTab = document.querySelector(
			'.itemWorkspaceTabs [role="tab"][aria-selected="false"]',
		)!;
		const tabRail = document.querySelector(".itemWorkspaceTabs")!;
		const fieldLabel = document.querySelector(".itemFormField > span")!;
		const body = document.querySelector(".itemWorkspaceBody")!;
		return {
			inactiveTab: ratio(inactiveTab, tabRail),
			fieldLabel: ratio(fieldLabel, body),
		};
	});
}

async function useHomePublications(page: Page) {
	await page.route("**/api/play/publications?surface=homepage", (route) =>
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
							playAction: "continue",
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
	let saveFailuresRemaining = 0;
	let preferenceSaveCount = 0;
	let editorPreferences = {itemListView: "cards", itemListSort: "updated-desc"};
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
	await page.route(/\/api\/editor\/preferences(?:\?.*)?$/, async (route) => {
		if (route.request().method() === "PATCH") {
			editorPreferences = {...editorPreferences, ...route.request().postDataJSON()};
			preferenceSaveCount += 1;
		}
		const selectedWorld = storedWorlds.get(worldId)?.world;
		const itemActivity = Object.fromEntries(
			(selectedWorld?.items ?? []).map((item, index) => [
				item.id.id,
				{
					createdAt: new Date(Date.UTC(2026, 7, 1, 12, index)).toISOString(),
					updatedAt: new Date(Date.UTC(2026, 7, 12, 12, index)).toISOString(),
				},
			]),
		);
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {preferences: editorPreferences, itemActivity}}),
		});
	});
	await page.route("**/api/editor/item-suggestions", async (route) => {
		const request = JSON.parse(route.request().postData() ?? "{}") as {name?: string};
		const concepts =
			request.name === "Toast"
				? [
						{
							tag: "food",
							label: "food",
							depth: 1,
							evidence: "The tag system classifies this as food.",
							synsetId: "n:food",
						},
					]
				: request.name === "Sardines"
					? [
							{
								tag: "fish",
								label: "fish",
								depth: 1,
								evidence: "The tag system classifies this as fish.",
								synsetId: "n:fish",
							},
							{
								tag: "food",
								label: "food",
								depth: 2,
								evidence: "The tag system classifies this as food.",
								synsetId: "n:food",
							},
						]
					: [
							{
								tag: "furniture",
								label: "furniture",
								depth: 1,
								evidence: "The item belongs to this WordNet category.",
								synsetId: "n:1",
							},
						];
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					aliases: [{value: "countertop", relation: "synonym", evidence: "WordNet synonym."}],
					concepts,
					version: "e2e-test",
				},
			}),
		});
	});
	await page.route("**/api/editor/item-icon-suggestions", async (route) => {
		const request = JSON.parse(route.request().postData() ?? "{}") as {
			items?: Array<{name?: string; iconCategory?: string}>;
		};
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					categories: (request.items ?? []).map(({name, iconCategory}) =>
						name === "Toast" ? "food" : name === "Sardines" ? "meal" : (iconCategory ?? "generic"),
					),
				},
			}),
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
			if (saveFailuresRemaining > 0) {
				saveFailuresRemaining -= 1;
				await route.fulfill({status: 503, body: ""});
				return;
			}
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
		failNextSave: () => {
			saveFailuresRemaining += 1;
		},
		preferenceSaveCount: () => preferenceSaveCount,
		preferences: () => ({...editorPreferences}),
		saveCount: () => saveCount,
		worlds: () => [...storedWorlds.values()],
		worldStore: storedWorlds,
		trashedWorlds: () => [...trashedWorlds.values()],
	};
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
			name: "Quiet archive",
		}),
	).toBeVisible();
	await expect(publicationCarousel.locator(".homeFeaturedPage--previous")).toContainText(
		"Signal room",
	);
	await expect(publicationCarousel.locator(".homeFeaturedPage--next")).toContainText("Corner Shop");
	await expect(page.getByRole("link", {name: 'Play "Quiet archive"'})).toBeVisible();
	await page.getByRole("button", {name: "Next featured publication"}).click();
	await expect(
		publicationCarousel.locator(".homeFeaturedPage--current").getByRole("heading", {
			name: "Corner Shop",
		}),
	).toBeVisible();
	await expect(page.getByRole("link", {name: 'Continue "Corner Shop"'})).toBeVisible();
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

test("private worlds persist for one browser and remain unresolved for another", async ({
	browser,
}) => {
	test.setTimeout(60_000);
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
	await expect(firstPage).toHaveURL(
		new RegExp(`/worlds/${first.worldSlug}\\?view=map&room=shop-floor$`),
	);
	await expect(secondPage).toHaveURL(
		new RegExp(`/worlds/${second.worldSlug}\\?view=map&room=shop-floor$`),
	);

	const nameField = firstPage.getByRole("textbox", {name: "Name", exact: true});
	await expect(nameField).toBeVisible();
	await nameField.fill("A private entrance");
	await expect.poll(first.saveCount, {timeout: 15_000}).toBe(1);
	await expect(firstPage.getByRole("button", {name: "Retry"})).toHaveCount(0);
	await expect(firstPage.locator(".worldAutosaveIndicator")).toContainText("Saved");
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
	await secondPage.getByRole("tab", {name: "Play"}).click();
	await expect(secondPage.getByRole("textbox", {name: "Game command"})).toBeDisabled();

	expect(firstErrors).toEqual([]);
	expect(secondErrors.filter((error) => !error.includes("status of 404"))).toEqual([]);
	await firstContext.close();
	await secondContext.close();
});

test("the editor player uses unsaved world edits, preserves play state, and restarts explicitly", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	await page.goto(`/worlds/${editor.worldSlug}`);

	await page.getByRole("tab", {name: "Play"}).click();
	const commandInput = page.getByRole("textbox", {name: "Game command"});
	await commandInput.fill("east");
	await page.getByRole("button", {name: "Send command"}).click();
	await expect(page.locator(".game-player__output").getByText(/^Stockroom/)).toBeVisible();
	await expect(commandInput).toBeFocused();

	await page.getByRole("tab", {name: "Edit"}).click();
	await page.getByRole("button", {name: "Stockroom"}).click();
	await page.getByRole("textbox", {name: "Name", exact: true}).fill("Live stockroom");
	await page.getByRole("tab", {name: "Play"}).click();
	expect(editor.saveCount()).toBe(0);
	await commandInput.fill("look");
	await commandInput.press("Enter");
	await expect(page.locator(".game-player__output").getByText(/^Live stockroom/)).toBeVisible();

	await page.getByRole("button", {name: "Restart"}).click();
	await expect(page.locator(".game-player__output").getByText(/^Shop Floor/)).toBeVisible();
	await page.keyboard.press("Control+s");
	await expect.poll(editor.saveCount).toBe(1);
	await expect(page.locator(".worldAutosaveIndicator")).toContainText("Saved");
	expect(browserErrors).toEqual([]);
});

test("a transient save failure retries quietly and publishes only after saving", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	let publishedRevision: number | null = null;
	editor.failNextSave();
	await page.route("**/api/account", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {accountType: "registered"}}),
		}),
	);
	await page.route(`**/api/world/${editor.worldId}/publication`, async (route) => {
		if (route.request().method() === "GET") {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({data: null}),
			});
			return;
		}
		const input = route.request().postDataJSON() as {expectedRevision: number};
		publishedRevision = input.expectedRevision;
		expect(editor.saveCount()).toBe(1);
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					id: "publication-id",
					slug: "recovered-world",
					title: "Recovered world",
					summary: "Recovered safely before publishing.",
					visibility: "listed",
					status: "published",
					release: {number: 1, publishedAt: "2026-08-12T12:00:00.000Z"},
					worldRevision: input.expectedRevision,
					currentWorldRevision: input.expectedRevision,
					unpublishedChanges: false,
				},
			}),
		});
	});

	await page.goto(`/worlds/${editor.worldSlug}`);
	await page.getByRole("textbox", {name: "Name", exact: true}).fill("Recovered entrance");
	await expect.poll(editor.saveCount, {timeout: 15_000}).toBe(1);
	await expect(page.locator(".worldAutosaveIndicator")).toContainText("Saved");
	await page.getByRole("button", {name: "World settings"}).click();
	await page.getByLabel("Short summary").fill("Recovered safely before publishing.");
	await page.getByRole("button", {name: "Publish current version"}).click();

	await expect(page.getByText(/Release 1 uses saved revision/)).toBeVisible();
	expect(publishedRevision).toBe(editor.worlds()[0].revision);
	await page.reload();
	await expect(page.getByRole("button", {name: "Reset to starter world"})).toBeVisible();
	await page.getByRole("button", {name: "Map"}).click();
	await page.getByRole("button", {name: "Recovered entrance"}).click();
	await expect(page.getByRole("textbox", {name: "Name", exact: true})).toHaveValue(
		"Recovered entrance",
	);
	expect(browserErrors.filter((error) => !error.includes("status of 503"))).toEqual([]);
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
	await firstPage.keyboard.press("Control+s");
	await expect.poll(first.saveCount).toBeGreaterThanOrEqual(1);
	await firstPage.getByRole("button", {name: /Current world: Private test world/}).click();
	await firstPage.getByRole("menuitem", {name: "View all worlds"}).click();
	await expect(firstPage).toHaveURL(/\/worlds$/);
	expect(first.saveCount()).toBeGreaterThanOrEqual(1);
	expect(first.worlds()[0].world.rooms[0].name).toBe("First tab revision");

	await secondName.fill("Second tab revision");
	await secondPage.keyboard.press("Control+s");
	await expect
		.poll(() => secondErrors.some((error) => error.includes("status of 409")), {timeout: 15_000})
		.toBe(true);

	await secondPage.getByRole("button", {name: /Current world: Private test world/}).click();
	secondPage.once("dialog", (dialog) => dialog.dismiss());
	await secondPage.getByRole("menuitem", {name: "View all worlds"}).click();
	await expect(
		secondPage.getByText("Unsaved changes were kept in this editor.", {exact: true}),
	).toBeVisible();
	await expect(secondPage).toHaveURL(
		new RegExp(`/worlds/${first.worldSlug}\\?view=map&room=shop-floor$`),
	);
	expect(first.worlds()[0].world.rooms[0].name).toBe("First tab revision");
	expect(firstErrors).toEqual([]);
	expect(secondErrors.filter((error) => !error.includes("status of 409"))).toEqual([]);
	await context.close();
});

test("the world library creates, switches, isolates, and limits private worlds", async ({page}) => {
	test.setTimeout(60_000);
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
		await expect(page).toHaveURL(
			new RegExp(
				`/worlds/${name.toLowerCase().replaceAll(" ", "-")}\\?view=map(?:&room=shop-floor)?$`,
			),
		);
		if (source === "Blank world") {
			await page.getByRole("button", {name: "Layers · Ground"}).click();
			await expect(page.getByRole("button", {name: "Clear layer"})).toBeVisible();
			await page.getByRole("button", {name: "Close layer menu"}).click();
			await page.getByRole("tab", {name: "Play"}).click();
			await expect(page.getByText("No rooms available. Add a room to begin exploring.")).toBeVisible();
			await expect(page.getByRole("button", {name: "Shop Floor"})).not.toBeVisible();
			await page.locator("[data-map]").click({position: {x: 140, y: 140}});
			await expect(page.getByRole("button", {name: "Room 1"})).not.toBeVisible();
			const mapToolbar = page.getByRole("group", {name: "Map actions"});
			await expect(mapToolbar.getByRole("button", {name: "Edit"})).not.toBeVisible();
			await expect(mapToolbar.getByRole("button", {name: "Pan"})).not.toBeVisible();
			await page.getByRole("button", {name: "Add room"}).click();
			await expect(page.getByRole("button", {name: "Cancel room placement"})).toBeVisible();
			await page.locator("[data-map]").hover({position: {x: 180, y: 180}});
			await expect(page.locator(".mapRoomPlacementPreview")).toBeVisible();
			await page.locator("[data-map]").click({position: {x: 180, y: 180}});
			await expect(page.getByRole("button", {name: "Room 1"})).toBeVisible();
			await expect(page.getByRole("button", {name: "Add room"})).toBeVisible();
			await page.getByRole("tab", {name: "Edit"}).click();
		}
		const roomNameField = page.getByRole("textbox", {name: "Name", exact: true});
		if (source === "Blank world") await expect(roomNameField).not.toBeFocused();
		await roomNameField.fill(roomName);
		await page.keyboard.press("Control+s");
		await expect(page.getByRole("button", {name: "Retry"})).toHaveCount(0);
		await expect(page.locator(".worldAutosaveIndicator")).toContainText("Saved");
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

	await expect(page).toHaveURL(/\/worlds\/imported-archive\?view=map&room=shop-floor$/);
	await expect(page.getByRole("button", {name: "Imported landing", exact: true})).toBeVisible();
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
	test.setTimeout(60_000);
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	await page.goto("/worlds/undefined");
	await expect(page).toHaveURL(
		new RegExp(`/worlds/${editor.worldSlug}\\?view=map&room=shop-floor$`),
	);
	await page.setViewportSize({width: 901, height: 720});
	const mapToolbar = page.getByLabel("Map tools");
	await expect(mapToolbar).toBeVisible();
	expect(
		await mapToolbar.evaluate(
			(element) =>
				element.scrollWidth <= element.clientWidth &&
				element.getBoundingClientRect().right <= window.innerWidth,
		),
	).toBe(true);
	await page.getByRole("tab", {name: "Play"}).click();
	await expect(page.getByRole("textbox", {name: "Game command"})).toBeEnabled();

	await page.getByRole("button", {name: "Items"}).click();
	await expect(page.getByRole("heading", {name: "Items"})).toBeVisible();
	await expect(page.getByPlaceholder("Search names, aliases, and tags")).toBeVisible();
	await expect(page.getByRole("button", {name: "Add item"})).toBeVisible();

	await page.getByRole("button", {name: "Logic"}).click();
	await expect(page.getByRole("heading", {name: "Logic"})).toBeVisible();
	await expect(page.getByRole("button", {name: /Commands/})).toBeVisible();

	await page.getByRole("button", {name: /Conditions/}).click();
	await expect(page.getByRole("heading", {name: "Conditions", exact: true})).toBeVisible();
	await expect(page.getByRole("searchbox", {name: "Search conditions"})).toBeVisible();
	await page.setViewportSize({width: 310, height: 720});
	await expectMobileLayoutIntegrity(page, {root: ".logicLibraryWorkspace"});
	const conditionTools = await page.locator(".logicLibraryTools").boundingBox();
	const conditionResults = await page.locator(".logicLibraryBody").boundingBox();
	expect(conditionTools?.height).toBeLessThanOrEqual(130);
	expect(conditionResults?.height).toBeGreaterThanOrEqual(250);
	await page.setViewportSize({width: 1280, height: 720});
	await expect(page.getByRole("button", {name: "By parent"})).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(page.getByRole("combobox", {name: "Sort by"})).toBeVisible();
	const takeUsage = page.getByRole("button", {name: "Take Command · 1 condition"});
	await takeUsage.click();
	await expect(page.getByRole("heading", {name: "Take", exact: true})).toBeVisible();
	await expect(page.getByRole("button", {name: "See Command"})).toBeVisible();
	await expect(page).toHaveURL(/\?view=logic&section=conditions$/);
	const takeCondition = page.locator(".logicOccurrenceList > button").first();
	await expect(takeCondition).toBeVisible();
	await takeCondition.click();
	await expect(page.getByRole("button", {name: "Save"})).toBeVisible();
	await expect(page.getByText("Group logic")).toBeVisible();
	await expect(page.getByText("[object Object]")).toHaveCount(0);
	await expect(page.getByRole("button", {name: "See Command"})).toHaveCount(0);
	await page.setViewportSize({width: 310, height: 720});
	await expectMobileLayoutIntegrity(page, {root: ".logicLibraryWorkspace"});
	await page.getByRole("button", {name: /Back Take/}).click();
	await page.getByRole("button", {name: "See Command"}).click();
	await expect(page.getByText("Take", {exact: true}).first()).toBeVisible();
	await expect(page.getByRole("button", {name: "Back to Commands"})).toBeVisible();
	await page.setViewportSize({width: 1280, height: 720});
	await page.getByRole("button", {name: "Back to Commands"}).click();
	await page.getByRole("button", {name: "Back to Logic"}).click();
	await page.getByRole("button", {name: /Conditions/}).click();
	await page.getByRole("button", {name: "Conditions", exact: true}).click();
	await expect(page.getByRole("button", {name: "Conditions", exact: true})).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	const inlineCondition = page
		.locator(".logicLibraryList > button")
		.filter({hasText: "Take"})
		.first();
	await expect(inlineCondition).toBeVisible();
	await inlineCondition.click();
	await expect(page.getByText("Group logic")).toBeVisible();
	await expect(page.getByText("[object Object]")).toHaveCount(0);
	await page.getByRole("button", {name: /Back Take/}).click();
	await expect(page.getByRole("button", {name: "Conditions", exact: true})).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(page.getByRole("button", {name: "Done"})).toHaveCount(0);
	await page.locator(".logicLibraryBack").click();

	await page.getByRole("button", {name: /Effects/}).click();
	await expect(page.getByRole("heading", {name: "Effects", exact: true})).toBeVisible();
	await expect(page.getByRole("searchbox", {name: "Search effects"})).toBeVisible();
	await page.setViewportSize({width: 310, height: 720});
	await expectMobileLayoutIntegrity(page, {root: ".logicLibraryWorkspace"});
	const effectTools = await page.locator(".logicLibraryTools").boundingBox();
	const effectResults = await page.locator(".logicLibraryBody").boundingBox();
	expect(effectTools?.height).toBeLessThanOrEqual(130);
	expect(effectResults?.height).toBeGreaterThanOrEqual(250);
	await page.setViewportSize({width: 1280, height: 720});
	await expect(page.getByRole("button", {name: "Done"})).toHaveCount(0);
	await page.locator(".logicLibraryBack").click();

	await page.getByRole("button", {name: /Commands/}).click();
	await expect(page.getByRole("heading", {name: "Commands", exact: true})).toBeVisible();
	await page.getByRole("button", {name: /Help/}).first().click();
	await page.getByRole("button", {name: "Edit command"}).click();
	const commandSettings = page.getByRole("dialog", {name: "Edit command settings"});
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
	await commandSettings.getByRole("button", {name: "Cancel"}).click();
	await page.getByRole("button", {name: "Back to Commands"}).click();
	await page
		.getByRole("button", {name: /Travel/})
		.first()
		.click();
	const directionBlock = page.getByRole("button", {name: "Direction <direction>"});
	await directionBlock.focus();
	await page.keyboard.press("Enter");
	const blockSettings = page.getByRole("dialog", {name: "Edit command block"});
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
	await blockSettings.getByRole("button", {name: "Save"}).click();

	await page.getByRole("button", {name: "Logic", expanded: false}).click();
	await page.getByRole("menuitem", {name: "World settings"}).click();
	await expect(page.getByRole("button", {name: "Reset to starter world"})).toBeVisible();

	await page.goto(`/editor/${editor.worldId}`);
	await expect(page).toHaveURL(
		new RegExp(`/worlds/${editor.worldSlug}\\?view=map&room=shop-floor$`),
	);
	expect(browserErrors).toEqual([]);
});

test("the Items selector keeps its controls pinned and restores compact view preferences", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	const worldId = "57c635aa-7792-4a13-9595-58cd1ef05fd6";
	const ownerUserId = "3e816c4d-b957-45dc-8523-d53ec04c8d0f";
	const largeWorld = structuredClone(initialWorld);
	for (let index = 0; index < 24; index += 1) {
		const nextItem = createDefaultFieldObject(ItemSchema);
		nextItem.id = toID("item", `archive-object-${index + 1}`);
		nextItem.name = `Archive object ${String(index + 1).padStart(2, "0")}`;
		nextItem.aliases = [`catalogue-${index + 1}`];
		nextItem.tags = index % 2 === 0 ? ["document", "archive"] : ["key", "iron"];
		nextItem.examine.text = `A catalogued object numbered ${index + 1}.`;
		nextItem.initialState.location = {type: "room", roomId: largeWorld.rooms[0]!.id};
		largeWorld.items.push(nextItem);
	}
	const sharedWorlds = new Map<string, DeterministicWorld>([
		[
			worldId,
			{
				editorSlug: "private-test-world",
				id: worldId,
				name: "Private test world",
				ownerUserId,
				world: largeWorld,
				revision: 1,
				schemaVersion: PERSISTED_SCHEMA_VERSION,
				updatedAt: "2026-08-13T12:00:00.000Z",
				lastOpenedAt: "2026-08-13T12:00:00.000Z",
			},
		],
	]);
	const editor = await useDeterministicEditorWorld(page, worldId, 5, sharedWorlds);

	await page.goto(`/worlds/${editor.worldSlug}?view=items`);
	const header = page.locator(".itemCatalogHeader");
	const body = page.locator(".itemCatalogBody");
	await expect(header).toHaveCSS("position", "sticky");
	await expect(body).toHaveCSS("overflow-y", "auto");
	const headerTop = (await header.boundingBox())!.y;
	await body.evaluate((element) => {
		element.scrollTop = element.scrollHeight;
	});
	expect((await header.boundingBox())!.y).toBe(headerTop);
	await body.evaluate((element) => {
		element.scrollTop = 0;
	});

	const cardMark = page.locator('.itemCatalogResults[data-view="cards"] .itemCatalogMark').first();
	expect((await cardMark.boundingBox())!.width).toBe(128);
	await expect(cardMark.locator("svg")).toHaveAttribute("width", "128");

	await page.getByRole("button", {name: "Rows"}).click();
	const rowItem = page.locator('.itemCatalogResults[data-view="rows"] .itemCatalogItem').first();
	expect((await rowItem.boundingBox())!.height).toBeGreaterThanOrEqual(80);
	const rowMark = rowItem.locator(".itemCatalogMark");
	expect((await rowMark.boundingBox())!.width).toBe(64);
	await expect(rowMark.locator("svg")).toHaveAttribute("width", "64");
	await expect(rowItem.locator(".itemCatalogName")).toHaveCSS("font-size", "14px");

	await page.getByRole("button", {name: "Marks"}).click();
	const mark = page.locator('.itemCatalogResults[data-view="marks"] .itemCatalogMark').first();
	expect((await mark.boundingBox())!.width).toBe(128);
	await expect(mark.locator("svg")).toHaveAttribute("width", "128");

	await page.getByRole("button", {name: "Index"}).click();
	const indexItem = page.locator('.itemCatalogResults[data-view="index"] .itemCatalogItem').first();
	await expect(indexItem.locator(".itemCatalogName")).toHaveCSS("font-size", "13px");
	const indexBackground = await indexItem.evaluate(
		(element) => getComputedStyle(element).backgroundColor,
	);
	await indexItem.hover();
	await expect
		.poll(() => indexItem.evaluate((element) => getComputedStyle(element).backgroundColor))
		.not.toBe(indexBackground);

	await page.getByRole("button", {name: "Marks"}).click();
	await page.getByRole("combobox", {name: "Sort items"}).selectOption("name-desc");
	await expect.poll(editor.preferenceSaveCount).toBe(5);
	expect(editor.preferences()).toEqual({itemListView: "marks", itemListSort: "name-desc"});

	await page.reload();
	await expect(page.getByRole("button", {name: "Marks"})).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByRole("combobox", {name: "Sort items"})).toHaveValue("name-desc");
	await page.getByRole("searchbox", {name: "Search items"}).fill("catalogue-12");
	await expect(page.getByText("1 of 26 objects")).toBeVisible();

	await page.setViewportSize({width: 390, height: 844});
	await expectMobileLayoutIntegrity(page, {root: ".editorPage"});
	await expect(page.getByRole("button", {name: "Cards"})).toBeVisible();
	await expect(page.getByRole("button", {name: "Rows"})).toBeVisible();
	await expect(page.getByRole("button", {name: "Marks"})).toBeVisible();
	await expect(page.getByRole("button", {name: "Index"})).toBeVisible();
	expect(browserErrors).toEqual([]);
});

test("an item opens as a full-workspace document and keeps its URL context", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.addInitScript(() => window.localStorage.setItem("mothmark-theme", "light"));
	const editor = await useDeterministicEditorWorld(page);

	await page.goto(`/worlds/${editor.worldSlug}?view=items`);
	await page.getByRole("button", {name: /Shop Counter/}).click();
	await expect(page).toHaveURL(
		new RegExp(`/worlds/${editor.worldSlug}\\?view=items&item=shop-counter$`),
	);

	await expect(page.getByRole("heading", {name: "Shop Counter", level: 1})).toBeVisible();
	await expect(page.locator(".itemWorkspaceMark svg")).toHaveAttribute("width", "32");
	await expect(page.locator(".itemWorkspaceMark svg")).toHaveAttribute(
		"data-icon-category",
		"table",
	);
	expect((await page.locator(".itemWorkspaceMark").boundingBox())!.width).toBe(32);
	const itemBody = page.locator(".itemWorkspaceBody");
	const itemHeader = page.locator(".itemWorkspaceHeader");
	await expect(itemBody).toHaveCSS("overflow-y", "auto");
	const itemHeaderTop = (await itemHeader.boundingBox())!.y;
	await itemBody.evaluate((element) => {
		element.scrollTop = element.scrollHeight;
	});
	expect((await itemHeader.boundingBox())!.y).toBe(itemHeaderTop);
	await itemBody.evaluate((element) => {
		element.scrollTop = 0;
	});
	await expect(page.locator(".editorUtilityPanel")).toHaveClass(/editorUtilityPanel--collapsed/);
	await expect(page.locator(".editorUtilityPanel")).toHaveClass(
		/editorUtilityPanel--itemDocumentHidden/,
	);
	await expect(page.getByRole("tab", {name: "Details"})).toHaveAttribute("aria-selected", "true");
	await expect(page.getByRole("tab", {name: "Behavior"})).toHaveCSS("font-size", "13px");
	await expect(page.getByRole("heading", {name: "Identity"})).toBeVisible();
	await expect(page.locator(".universalEditor")).toHaveCount(0);
	await expect(page.getByRole("region", {name: "Suggested aliases"})).toBeVisible();
	await expect(page.getByRole("region", {name: "Suggested tags"})).toBeVisible();
	await expect(page.getByRole("button", {name: "Suggest aliases and tags"})).toHaveCount(0);
	const aliasSuggestion = page
		.getByRole("listitem")
		.filter({has: page.getByRole("button", {name: "Add alias countertop", exact: true})});
	const surfaceSuggestion = page.getByRole("listitem").filter({hasText: "#surface"});
	await expect(aliasSuggestion).toBeVisible();
	await expect(surfaceSuggestion).toBeVisible();
	await page.setViewportSize({width: 390, height: 844});
	await expectMobileLayoutIntegrity(page, {root: ".editorPage"});
	await expect(aliasSuggestion.getByRole("button", {name: "Add alias countertop"})).toBeVisible();
	await expect(surfaceSuggestion.getByRole("button", {name: "Enable surface"})).toBeVisible();
	expect(await itemBody.evaluate((element) => element.scrollTop)).toBe(0);
	await page.setViewportSize({width: 1280, height: 720});
	await expect(page.getByRole("button", {name: "Remove countertop"})).toHaveCount(0);
	await aliasSuggestion.getByRole("button", {name: "Add alias countertop"}).click();
	await expect(page.getByRole("button", {name: "Remove countertop"})).toBeVisible();
	await expect(surfaceSuggestion.getByText(/placed on (?:this item|it)/i)).toBeVisible();
	await surfaceSuggestion.getByRole("button", {name: "Enable surface"}).click();
	await expect(page.getByRole("button", {name: "Remove surface"})).toBeVisible();
	const lightContrast = await itemWorkspaceTextContrast(page);
	expect(lightContrast.inactiveTab).toBeGreaterThanOrEqual(4.5);
	expect(lightContrast.fieldLabel).toBeGreaterThanOrEqual(4.5);
	await expect(page.getByRole("heading", {name: "Player-facing text"})).toBeVisible();
	await expect(page.getByRole("tab", {name: "Behavior"})).toBeVisible();
	await page.getByRole("tab", {name: "Behavior"}).click();
	await expect(page.getByRole("heading", {name: "Capabilities"})).toBeVisible();
	await expect(page.getByRole("heading", {name: "Flags"})).toBeVisible();
	await expect(page.getByRole("textbox", {name: "Contents lead-in"})).toBeVisible();
	await expect(page.getByRole("checkbox", {name: /^Surface /})).toBeChecked();
	await page.getByRole("checkbox", {name: /^Takeable /}).check();
	const takeConditionRow = page.locator(".itemAdvancedRow").filter({hasText: "Take condition"});
	await takeConditionRow.getByRole("button", {name: "Add"}).click();
	await expect(page.getByRole("heading", {name: "Edit condition group"})).toBeVisible();
	await expect(page.getByText("Shop Counter · Take condition", {exact: true})).toBeVisible();
	await expect(page.getByRole("button", {name: "Save"})).toBeVisible();
	await page.getByRole("button", {name: "Cancel"}).click();
	await expect(page.getByRole("heading", {name: "Shop Counter", level: 1})).toBeVisible();
	await expect(page.getByRole("heading", {name: "Capabilities"})).toBeVisible();
	await page.getByRole("checkbox", {name: /^Readable /}).check();
	const readAction = page.getByRole("group", {name: "read", exact: true});
	await expect(readAction.getByRole("textbox", {name: "Success message"})).toBeVisible();
	await readAction.getByRole("textbox", {name: "Success message"}).fill("The ledger is blank.");
	await readAction.getByRole("checkbox", {name: "Available to players"}).uncheck();
	await expect(readAction.getByRole("checkbox", {name: "Available to players"})).not.toBeChecked();
	const surfaceEditor = page
		.locator("details.itemBehaviorEditor")
		.filter({has: page.locator("summary").filter({hasText: /^Surface$/})});
	await surfaceEditor.locator("summary").click();
	await expect(surfaceEditor.getByRole("textbox", {name: "Contents lead-in"})).toBeVisible();
	await surfaceEditor.getByRole("textbox", {name: "Contents lead-in"}).fill("On the counter:");
	await page.getByRole("checkbox", {name: /^Door /}).check();
	await expect(page.getByRole("checkbox", {name: /^Door /})).toBeChecked();
	await expect(page.getByRole("checkbox", {name: /^Openable /})).toBeChecked();
	await expect(page.getByRole("combobox", {name: "Connection"})).toHaveValue("shop-office");
	await page.getByRole("tab", {name: "Placement"}).click();
	await expect(page.getByRole("heading", {name: "Starting position"})).toBeVisible();
	await expect(page.getByRole("heading", {name: "Flags"})).toHaveCount(0);
	await page.getByRole("tab", {name: "Commands"}).click();
	await expect(page.getByRole("heading", {name: "Commands", exact: true})).toBeVisible();
	const examineCommand = page
		.getByRole("listitem")
		.filter({has: page.getByText("Examine", {exact: true})});
	await expect(examineCommand).toBeVisible();
	await expect(examineCommand.getByText("Can target this item", {exact: true})).toBeVisible();
	const readCommand = page
		.getByRole("listitem")
		.filter({has: page.getByText("Read", {exact: true})});
	await readCommand.getByRole("button", {name: "Customize for Shop Counter"}).click();
	await expect(page).toHaveURL(
		new RegExp(
			`/worlds/${editor.worldSlug}\\?view=logic&section=commands&command=[^&]+&fromItem=shop-counter$`,
		),
	);
	await expect(
		page.getByText("Read (Customized for Shop Counter)", {exact: true}).first(),
	).toBeVisible();
	await page.getByRole("button", {name: /Target readable \(1 specific target\)/}).click();
	const targetSettings = page.getByRole("dialog", {name: "Edit command block"});
	await expect(targetSettings.getByRole("heading", {name: "Specific targets"})).toBeVisible();
	await expect(targetSettings.getByText("Item-specific scope")).toBeVisible();
	await expect(
		targetSettings.getByText(/Only Shop Counter can fill this target block/),
	).toBeVisible();
	await expect(targetSettings.getByText("shop-counter", {exact: true})).toHaveCount(0);
	await expect(targetSettings.getByRole("button", {name: "Add entry"})).toHaveCount(0);
	await expect(targetSettings.getByRole("button", {name: "Add a specific target"})).toHaveCount(0);
	await expect(targetSettings.getByText("Fixed", {exact: true})).toBeVisible();
	for (const width of [447, 310]) {
		await page.setViewportSize({width, height: 844});
		expect(
			await targetSettings.evaluate(
				(element) =>
					element.scrollWidth <= element.clientWidth &&
					document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);
	}
	await targetSettings.getByRole("button", {name: "Cancel"}).click();
	await page.setViewportSize({width: 1280, height: 720});
	await page.getByRole("button", {name: "Back to Commands"}).click();
	await expect(page).toHaveURL(
		new RegExp(`/worlds/${editor.worldSlug}\\?view=items&item=shop-counter$`),
	);
	await expect(page.getByRole("tab", {name: "Commands"})).toHaveAttribute("aria-selected", "true");
	await expect(page.getByText("Read (Customized for Shop Counter)", {exact: true})).toBeVisible();
	await expect(readCommand.getByRole("button", {name: "Edit item version"})).toBeVisible();
	await page.setViewportSize({width: 390, height: 844});
	await expectMobileLayoutIntegrity(page, {root: ".editorPage"});
	await expect(readCommand.getByRole("button", {name: "Edit item version"})).toBeVisible();
	await page.setViewportSize({width: 1280, height: 720});

	await page.getByRole("tab", {name: "Details"}).click();
	await page.getByRole("textbox", {name: "Name"}).fill("Front Counter");
	await expect(page.getByRole("heading", {name: "Front Counter", level: 1})).toBeVisible();
	await expect.poll(editor.saveCount, {timeout: 15_000}).toBeGreaterThanOrEqual(1);

	await page.reload();
	await expect(page.getByRole("heading", {name: "Front Counter", level: 1})).toBeVisible();
	await page.locator(".itemWorkspaceBack").click();
	await expect(page).toHaveURL(new RegExp(`/worlds/${editor.worldSlug}\\?view=items$`));
	await expect(page.getByRole("heading", {name: "Items", level: 1})).toBeVisible();
	await page.goBack();
	await expect(page.getByRole("heading", {name: "Front Counter", level: 1})).toBeVisible();
	await page.getByRole("button", {name: "Delete", exact: true}).click();
	const deleteDialog = page.getByRole("dialog", {name: "Delete Front Counter?"});
	await expect(deleteDialog).toBeVisible();
	await deleteDialog.getByRole("button", {name: "Cancel"}).click();
	await expect(page.getByRole("heading", {name: "Front Counter", level: 1})).toBeVisible();

	await page.setViewportSize({width: 390, height: 844});
	await expectMobileLayoutIntegrity(page, {root: ".editorPage"});
	await expect(page.locator(".header")).toBeHidden();
	await expect(page.locator(".mobileEditorNavigation")).toBeHidden();
	await expect(page.locator(".editorUtilityPanel")).toHaveCount(0);
	await expect(page.getByRole("button", {name: "Play"})).toBeVisible();
	await expect(page.getByRole("button", {name: "Delete", exact: true})).toBeVisible();
	await expect(page.getByRole("tab", {name: "Details"})).toBeVisible();
	await expect(page.getByRole("tab", {name: "Commands"})).toBeVisible();
	await expect(page.getByRole("region", {name: "Suggested aliases"})).toBeVisible();
	await expect(page.getByRole("region", {name: "Suggested tags"})).toBeVisible();
	await expect(page.locator(".itemSuggestionTags > li > button").first()).toBeVisible();
	const tabTops = await page
		.locator('.itemWorkspaceTabs [role="tab"]')
		.evaluateAll((tabs) => tabs.map((tab) => Math.round(tab.getBoundingClientRect().top)));
	expect(new Set(tabTops).size).toBe(1);
	await page.getByRole("button", {name: "Play"}).click();
	await expect(page.locator(".editorUtilityPanel")).toHaveCount(1);
	await page.getByRole("button", {name: "Collapse editor utility panel"}).click();
	await expect(page.locator(".editorUtilityPanel")).toHaveCount(0);
	expect(browserErrors).toEqual([]);
});

test("tag inference supplies automatic icons without authoring classification tags", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	const worldId = "d42d835a-f168-4ce6-bc66-c5934756ad8d";
	const inferredWorld = structuredClone(initialWorld);
	Object.assign(inferredWorld.items[0]!, {name: "Toast", aliases: [], tags: []});
	Object.assign(inferredWorld.items[1]!, {name: "Sardines", aliases: [], tags: []});
	const sharedWorlds = new Map<string, DeterministicWorld>([
		[
			worldId,
			{
				editorSlug: "inferred-icon-test",
				id: worldId,
				name: "Inferred icon test",
				ownerUserId: "3e816c4d-b957-45dc-8523-d53ec04c8d0f",
				world: inferredWorld,
				revision: 1,
				schemaVersion: PERSISTED_SCHEMA_VERSION,
				updatedAt: "2026-08-18T12:00:00.000Z",
				lastOpenedAt: "2026-08-18T12:00:00.000Z",
			},
		],
	]);
	const editor = await useDeterministicEditorWorld(page, worldId, 5, sharedWorlds);

	await page.goto(`/worlds/${editor.worldSlug}?view=items`);
	const toast = page.getByRole("button", {name: /Toast/});
	const sardines = page.getByRole("button", {name: /Sardines/});
	await expect(toast.locator("svg")).toHaveAttribute("data-icon-category", "food");
	await expect(sardines.locator("svg")).toHaveAttribute("data-icon-category", "meal");
	await expect(page.getByRole("list", {name: "Tags for Toast"})).toHaveCount(0);
	await expect(page.getByRole("list", {name: "Tags for Sardines"})).toHaveCount(0);

	await toast.click();
	await expect(page.locator(".itemWorkspaceMark svg")).toHaveAttribute("data-icon-category", "food");
	await expect(page.getByRole("button", {name: "Remove food"})).toHaveCount(0);
	expect(browserErrors).toEqual([]);
});

test("the item document remains legible in dark mode", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.addInitScript(() => window.localStorage.setItem("mothmark-theme", "dark"));
	const editor = await useDeterministicEditorWorld(page);

	await page.goto(`/worlds/${editor.worldSlug}?view=items&item=shop-counter`);
	await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
	await expect(page.getByRole("heading", {name: "Shop Counter", level: 1})).toBeVisible();
	await expect(page.getByRole("heading", {name: "Identity"})).toBeVisible();
	const darkContrast = await itemWorkspaceTextContrast(page);
	expect(darkContrast.inactiveTab).toBeGreaterThanOrEqual(4.5);
	expect(darkContrast.fieldLabel).toBeGreaterThanOrEqual(4.5);
	expect(browserErrors).toEqual([]);
});

test("map layers can be renamed", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	await page.goto(`/worlds/${editor.worldSlug}?view=map&room=shop-floor`);

	await page.getByRole("button", {name: "Layers · Main floor"}).click();
	const layerName = page.getByRole("textbox", {name: "Layer name"});
	await expect(layerName).toHaveValue("Main floor");
	await layerName.fill("Street level");
	await page.getByRole("button", {name: "Close layer menu"}).click();

	await expect(page.getByRole("button", {name: "Layers · Street level"})).toBeVisible();
	await expect
		.poll(() => editor.worlds()[0].world.metadata.layers.find((layer) => layer.layer === 0)?.name)
		.toBe("Street level");
	await page.reload();
	await expect(page.getByRole("button", {name: "Layers · Street level"})).toBeVisible();
	expect(browserErrors).toEqual([]);
});

test("a static layer preview opens the displayed layer", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	await page.goto(`/worlds/${editor.worldSlug}?view=map&room=shop-floor`);

	await page.getByRole("button", {name: "Layers · Main floor"}).click();
	const preview = page.getByRole("button", {name: "Open Main floor"});
	await expect(preview).toBeVisible();
	await expect(page.getByText("Starting layer", {exact: true}).first()).toBeVisible();
	await page.setViewportSize({width: 390, height: 844});
	await expectMobileLayoutIntegrity(page, {root: ".layerMenu"});
	await page.setViewportSize({width: 310, height: 720});
	await expectMobileLayoutIntegrity(page, {root: ".layerMenu"});
	await preview.click();

	await expect(page.getByRole("button", {name: "Layers · Main floor"})).toBeVisible();
	await expect(page.getByRole("textbox", {name: "Layer name"})).toHaveCount(0);
	expect(browserErrors).toEqual([]);
});

test("events edit inline condition and effect groups on focused logic pages", async ({page}) => {
	test.setTimeout(60_000);
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	await page.goto(`/worlds/${editor.worldSlug}`);

	await page.getByRole("button", {name: "Logic"}).click();
	await page.getByRole("button", {name: /Events Run effects/}).click();
	await page.getByRole("button", {name: "New event"}).click();

	await page.getByRole("button", {name: "Add effect to Always"}).click();
	await expect(page.getByRole("heading", {name: "Always"})).toBeVisible();
	await expect(page.getByRole("button", {name: /^Back/})).toBeVisible();
	await expect(page.getByRole("button", {name: "Cancel"})).toBeVisible();
	await expect(page.getByRole("button", {name: "Save"})).toBeEnabled();
	await page.setViewportSize({width: 390, height: 844});
	await expectMobileLayoutIntegrity(page, {root: ".editorPage"});
	await page.setViewportSize({width: 1280, height: 720});
	await page.getByRole("button", {name: "Save"}).click();
	await expect(page).toHaveURL(/\?view=logic&section=events&event=new-event$/);

	await page.getByRole("button", {name: "If When a condition passes"}).click();
	await expect(page.getByRole("heading", {name: "Edit condition group"})).toBeVisible();
	await page.getByRole("button", {name: "Save"}).click();
	await expect(page).toHaveURL(/\?view=logic&section=events&event=new-event$/);

	expect(browserErrors).toEqual([]);
});

test("editor URLs restore context through reload, history, and invalid selections", async ({
	page,
}) => {
	test.setTimeout(60_000);
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	await page.goto(`/worlds/${editor.worldSlug}?view=items&item=shop-counter`);

	await expect(page.getByRole("heading", {name: "Shop Counter"})).toBeVisible();
	await page.reload();
	await expect(page.getByRole("heading", {name: "Shop Counter"})).toBeVisible();
	await expect(page).toHaveURL(/\?view=items&item=shop-counter$/);

	await page.getByRole("button", {name: "Map"}).click();
	await page.getByRole("button", {name: "Stockroom"}).click();
	await expect(page).toHaveURL(/\?view=map&room=stockroom$/);
	await page.goBack();
	await expect(page).toHaveURL(/\?view=map$/);
	await page.goBack();
	await expect(page.getByRole("heading", {name: "Shop Counter"})).toBeVisible();
	await expect(page).toHaveURL(/\?view=items&item=shop-counter$/);
	await page.goForward();
	await expect(page).toHaveURL(/\?view=map$/);
	await page.goForward();
	await expect(page.getByRole("heading", {name: "Stockroom"})).toBeVisible();

	await page.goto(`/worlds/${editor.worldSlug}?view=items&item=removed-item`);
	await expect(page.getByRole("heading", {name: "Items"})).toBeVisible();
	await expect(page.locator(".editorContextNotice")).toContainText(
		"That item is no longer available",
	);
	await expect(page).toHaveURL(new RegExp(`/worlds/${editor.worldSlug}\\?view=items$`));

	const createSelector = page.getByRole("button", {name: "Choose page, current: Create"});
	const worldSelector = page.getByRole("button", {name: /Current world: Private test world/});
	const order = await createSelector.evaluate(
		(create, world) => {
			const relation = create.compareDocumentPosition(world as Node);
			return {
				comesFirst: Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING),
				createX: create.getBoundingClientRect().x,
				worldX: (world as Element).getBoundingClientRect().x,
			};
		},
		await worldSelector.elementHandle(),
	);
	expect(order.comesFirst).toBe(true);
	expect(order.createX).toBeLessThan(order.worldX);
	expect(browserErrors).toEqual([]);
});

test("the inspector only resets scroll for editor navigation", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	await page.setViewportSize({width: 1280, height: 500});
	await page.goto(`/worlds/${editor.worldSlug}?view=map&room=shop-floor`);
	await expect(page.getByRole("heading", {name: "Shop Floor"})).toBeVisible();

	const inspector = page.locator(".rightSideBar");
	const scrolledTop = await inspector.evaluate((element) => {
		element.scrollTop = Math.min(120, element.scrollHeight - element.clientHeight);
		return element.scrollTop;
	});
	expect(scrolledTop).toBeGreaterThan(0);
	await page
		.getByPlaceholder("Describe what the player sees...")
		.fill("A revised shop description.");
	expect(await inspector.evaluate((element) => element.scrollTop)).toBe(scrolledTop);

	await page.getByRole("button", {name: "Stockroom"}).click();
	await expect(page.getByRole("heading", {name: "Stockroom"})).toBeVisible();
	await expect.poll(() => inspector.evaluate((element) => element.scrollTop)).toBe(0);
	expect(browserErrors).toEqual([]);
});

test("the editor uses top navigation and a persistent bottom utility switcher on phones", async ({
	page,
}) => {
	test.setTimeout(60_000);
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	await page.setViewportSize({width: 390, height: 844});
	await page.goto(`/worlds/${editor.worldSlug}`);
	await expectMobileLayoutIntegrity(page, {root: ".editorPage"});
	const mapToolbar = page.locator(".toolbar");
	await expect(mapToolbar).toBeVisible();
	expect(
		await mapToolbar.evaluate((element) => ({
			clientWidth: element.clientWidth,
			scrollWidth: element.scrollWidth,
		})),
	).toEqual(
		expect.objectContaining({
			clientWidth: expect.any(Number),
			scrollWidth: expect.any(Number),
		}),
	);
	await expect
		.poll(() => mapToolbar.evaluate((element) => element.scrollWidth <= element.clientWidth + 1))
		.toBe(true);
	await page.getByRole("button", {name: "Add room"}).click();
	await expect(page.getByRole("button", {name: "Cancel room placement"})).toBeVisible();
	await expect(page.getByText("Choose where to place the room")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByRole("button", {name: "Add room"})).toBeVisible();
	await expect(page.getByRole("button", {name: "Room 5"})).not.toBeVisible();

	const destination = page.getByRole("button", {name: "Map", expanded: false});
	await expect(destination).toBeVisible();
	await destination.click();
	await page.getByRole("menuitem", {name: "Items"}).click();
	await expect(page.getByRole("button", {name: "Items", expanded: false})).toBeVisible();
	await expectMobileLayoutIntegrity(page, {root: ".editorPage"});
	await expect(page.getByRole("tab", {name: "Edit"})).toHaveCount(0);
	await expect(page.getByRole("tab", {name: "Play"})).toHaveAttribute("aria-selected", "true");

	await page.getByRole("button", {name: "Items", expanded: false}).click();
	await page.getByRole("menuitem", {name: "Map"}).click();
	await expect(page.getByRole("button", {name: "Map", expanded: false})).toBeVisible();
	await expect(page.getByRole("tab", {name: "Edit"})).toHaveAttribute("aria-selected", "true");
	await expect(page.getByRole("tab", {name: "Items"})).toBeVisible();
	await expect(page.getByRole("tab", {name: "Play"})).toBeVisible();
	await page.getByRole("tab", {name: "Items"}).click();
	await expect(page.getByRole("heading", {name: "Starting items"})).toBeVisible();
	await expect(page.getByRole("button", {name: "Add item"})).toBeVisible();
	await page.getByRole("tab", {name: "Edit"}).click();

	await page.getByRole("tab", {name: "Play"}).click();
	const commandInput = page.getByRole("textbox", {name: "Game command"});
	await expect(page.getByRole("button", {name: "Sync Room"})).toHaveCount(0);
	const playSurfaceColors = await page
		.getByRole("complementary", {name: "Editor utility panel"})
		.evaluate((panel) => ({
			body: getComputedStyle(panel.querySelector<HTMLElement>(".command-line")!).backgroundColor,
			tab: getComputedStyle(panel.querySelector<HTMLElement>("[role='tab'][aria-selected='true']")!)
				.backgroundColor,
		}));
	expect(playSurfaceColors.tab).toBe(playSurfaceColors.body);
	await commandInput.fill("look at lantern");
	await page.getByRole("tab", {name: "Edit"}).click();
	await expect(page.locator(".rightSideBar")).toBeVisible();
	const editorSurfaceColors = await page
		.getByRole("complementary", {name: "Editor utility panel"})
		.evaluate((panel) => ({
			body: getComputedStyle(panel.querySelector<HTMLElement>(".rightSideBar")!).backgroundColor,
			tab: getComputedStyle(panel.querySelector<HTMLElement>("[role='tab'][aria-selected='true']")!)
				.backgroundColor,
		}));
	expect(editorSurfaceColors.tab).toBe(editorSurfaceColors.body);
	await page.getByRole("tab", {name: "Play"}).click();
	await expect(commandInput).toHaveValue("look at lantern");
	const utilityPanel = page.getByRole("complementary", {name: "Editor utility panel"});
	const utilityTabs = page.locator(".editorUtilityTabs");
	const centeredTabs = await utilityPanel.evaluate((panel) => {
		const bar = panel.querySelector<HTMLElement>(".editorUtilityTabBar")!;
		const tabs = panel.querySelector<HTMLElement>(".editorUtilityTabs")!;
		const tabButtons = Array.from(tabs.querySelectorAll<HTMLElement>("[role='tab']"));
		const barRect = bar.getBoundingClientRect();
		const tabsRect = tabs.getBoundingClientRect();
		return {
			barWidth: barRect.width,
			centerOffset: Math.abs(tabsRect.left + tabsRect.width / 2 - (barRect.left + barRect.width / 2)),
			dividerStyle: getComputedStyle(bar).borderBottomStyle,
			tabWidths: tabButtons.map((button) => button.getBoundingClientRect().width),
		};
	});
	expect(centeredTabs.centerOffset).toBeLessThan(1);
	expect(centeredTabs.dividerStyle).toBe("solid");
	expect(centeredTabs.tabWidths[0]).toBeGreaterThan(70);
	expect(centeredTabs.tabWidths[0]).toBeCloseTo(centeredTabs.tabWidths[1] ?? 0, 1);
	expect(centeredTabs.tabWidths[0]).toBeCloseTo(centeredTabs.tabWidths[2] ?? 0, 1);
	expect(centeredTabs.barWidth).toBeGreaterThan(
		await utilityTabs.evaluate((element) => element.clientWidth),
	);
	const expandedUtilityHeight = await utilityPanel.evaluate(
		(element) => element.getBoundingClientRect().height,
	);
	await page.getByRole("button", {name: "Collapse editor utility panel"}).click();
	await expect(page.getByRole("tab", {name: "Play"})).toHaveAttribute("aria-expanded", "false");
	await expect(utilityPanel).toHaveClass(/editorUtilityPanel--collapsed/);
	const collapsedTabs = await utilityPanel.evaluate((panel) => {
		const panelRect = panel.getBoundingClientRect();
		const tabs = Array.from(panel.querySelectorAll<HTMLElement>("[role='tab']"));
		return {
			centerOffsets: tabs.map((tab) => {
				const rect = tab.getBoundingClientRect();
				return Math.abs(rect.top + rect.height / 2 - (panelRect.top + panelRect.height / 2));
			}),
			borderBottomWidths: tabs.map((tab) => getComputedStyle(tab).borderBottomWidth),
			bottomCornerRadii: tabs.map((tab) => {
				const style = getComputedStyle(tab);
				return [style.borderBottomLeftRadius, style.borderBottomRightRadius];
			}),
			verticalInsets: tabs.map((tab) => {
				const rect = tab.getBoundingClientRect();
				return {bottom: panelRect.bottom - rect.bottom, top: rect.top - panelRect.top};
			}),
		};
	});
	expect(collapsedTabs.centerOffsets.every((offset) => offset < 1)).toBe(true);
	expect(collapsedTabs.borderBottomWidths).toEqual(["1px", "1px", "1px"]);
	expect(collapsedTabs.bottomCornerRadii).toEqual([
		["0px", "0px"],
		["0px", "0px"],
		["0px", "0px"],
	]);
	for (const insets of collapsedTabs.verticalInsets) {
		expect(insets.top).toBeGreaterThan(1);
		expect(insets.bottom).toBeGreaterThan(1);
		expect(Math.abs(insets.top - insets.bottom)).toBeLessThan(2);
	}
	expect(
		await utilityPanel.evaluate((element) => element.getBoundingClientRect().height),
	).toBeLessThan(expandedUtilityHeight);
	await page.getByRole("tab", {name: "Play"}).click();
	await expect(page.getByRole("tab", {name: "Play"})).toHaveAttribute("aria-expanded", "true");

	const resizeHandle = page.getByRole("separator", {name: "Resize editor utility panel"});
	const beforeResize = await utilityPanel.evaluate(
		(element) => element.getBoundingClientRect().height,
	);
	await resizeHandle.press("ArrowUp");
	const resizedMobileHeight = await utilityPanel.evaluate(
		(element) => element.getBoundingClientRect().height,
	);
	expect(resizedMobileHeight).toBeGreaterThan(beforeResize);
	await page.reload();
	await page.getByRole("tab", {name: "Play"}).click();
	expect(
		await utilityPanel.evaluate((element) => element.getBoundingClientRect().height),
	).toBeCloseTo(resizedMobileHeight, 0);

	for (const viewport of [
		{width: 320, height: 568},
		{width: 390, height: 844},
		{width: 740, height: 430},
	]) {
		await page.setViewportSize(viewport);
		const geometry = await page.evaluate(() => {
			const navigation = document.querySelector<HTMLElement>(".mobileEditorNavigation")!;
			const workspace = document.querySelector<HTMLElement>(".editorMainPanel")!;
			const utility = document.querySelector<HTMLElement>(".editorUtilityPanel")!;
			const navigationBox = navigation.getBoundingClientRect();
			const workspaceBox = workspace.getBoundingClientRect();
			const utilityBox = utility.getBoundingClientRect();
			return {
				documentWidth: document.documentElement.scrollWidth,
				navigationBottom: navigationBox.bottom,
				utilityBottom: utilityBox.bottom,
				utilityTop: utilityBox.top,
				viewportHeight: window.innerHeight,
				viewportWidth: window.innerWidth,
				workspaceBottom: workspaceBox.bottom,
				workspaceHeight: workspaceBox.height,
				workspaceTop: workspaceBox.top,
			};
		});
		expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
		expect(geometry.workspaceTop).toBeGreaterThanOrEqual(geometry.navigationBottom - 1);
		expect(geometry.utilityTop).toBeGreaterThanOrEqual(geometry.workspaceBottom - 1);
		expect(geometry.utilityBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
		expect(geometry.workspaceHeight).toBeGreaterThan(80);
		await expectMobileLayoutIntegrity(page, {root: ".editorPage"});
	}

	await page.setViewportSize({width: 1000, height: 760});
	await page.getByRole("button", {name: "Collapse editor utility panel"}).click();
	const verticalTabs = await utilityPanel.evaluate((panel) => {
		const tabs = panel.querySelector<HTMLElement>(".editorUtilityTabs")!;
		const buttons = Array.from(tabs.querySelectorAll<HTMLElement>("[role='tab']"));
		const panelRect = panel.getBoundingClientRect();
		const tabsRect = tabs.getBoundingClientRect();
		return {
			centerOffset: Math.abs(
				tabsRect.top + tabsRect.height / 2 - (panelRect.top + panelRect.height / 2),
			),
			heights: buttons.map((button) => button.getBoundingClientRect().height),
			horizontalInsets: buttons.map((button) => {
				const rect = button.getBoundingClientRect();
				return {
					left: rect.left - panelRect.left,
					right: panelRect.right - rect.right,
				};
			}),
		};
	});
	expect(verticalTabs.centerOffset).toBeLessThan(1);
	expect(verticalTabs.heights[0]).toBeCloseTo(verticalTabs.heights[1] ?? 0, 1);
	for (const insets of verticalTabs.horizontalInsets) {
		expect(insets.left).toBeGreaterThan(1);
		expect(insets.right).toBeGreaterThan(1);
		expect(Math.abs(insets.left - insets.right)).toBeLessThan(2);
	}

	await page.getByRole("tab", {name: "Edit"}).click();
	const desktopWidthBeforeResize = await utilityPanel.evaluate(
		(element) => element.getBoundingClientRect().width,
	);
	await page.getByRole("separator", {name: "Resize editor utility panel"}).press("ArrowLeft");
	const resizedDesktopWidth = await utilityPanel.evaluate(
		(element) => element.getBoundingClientRect().width,
	);
	expect(resizedDesktopWidth).toBeGreaterThan(desktopWidthBeforeResize);
	await page.reload();
	expect(
		await utilityPanel.evaluate((element) => element.getBoundingClientRect().width),
	).toBeCloseTo(resizedDesktopWidth, 0);

	expect(browserErrors).toEqual([]);
});

test("narrow editor chrome preserves the working canvas", async ({page}) => {
	test.setTimeout(60_000);
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	await page.setViewportSize({width: 520, height: 844});

	await page.goto(`/worlds/${editor.worldSlug}?view=items`);
	await expect(page.getByRole("heading", {name: "Items", exact: true})).toBeVisible();
	await expectMobileLayoutIntegrity(page, {root: ".editorPage"});
	expect(
		await page.locator(".header").evaluate((element) => element.getBoundingClientRect().height),
	).toBe(52);
	expect(
		await page
			.locator(".mobileEditorNavigation")
			.evaluate((element) => element.getBoundingClientRect().height),
	).toBe(36);
	await expect(page.locator(".editorToolbar:not(.logicToolbar)")).toBeHidden();
	expect(
		await page
			.locator(".itemCatalogHeader")
			.evaluate((element) => element.getBoundingClientRect().height),
	).toBeLessThanOrEqual(130);
	expect(
		await page
			.locator(".itemCatalogBody")
			.evaluate((element) => element.getBoundingClientRect().height),
	).toBeGreaterThanOrEqual(400);

	await page.goto(`/worlds/${editor.worldSlug}?view=logic&section=conditions`);
	await expect(page.getByRole("heading", {name: "Conditions", exact: true})).toBeVisible();
	await expectMobileLayoutIntegrity(page, {root: ".logicLibraryWorkspace"});
	const conditionChromeHeight = await page
		.locator(".logicLibraryHeader, .logicLibraryTools")
		.evaluateAll((elements) =>
			elements.reduce((height, element) => height + element.getBoundingClientRect().height, 0),
		);
	expect(conditionChromeHeight).toBeLessThanOrEqual(160);
	expect(
		await page
			.locator(".logicLibraryBody")
			.evaluate((element) => element.getBoundingClientRect().height),
	).toBeGreaterThanOrEqual(400);

	await page.goto(`/worlds/${editor.worldSlug}?view=logic&section=events`);
	await page.getByRole("button", {name: "New event"}).click();
	await expect(page.getByText("New event", {exact: true}).first()).toBeVisible();
	await expectMobileLayoutIntegrity(page, {root: ".editorMainPanel"});
	expect(
		await page.locator(".logicToolbar").evaluate((element) => element.getBoundingClientRect().height),
	).toBeLessThanOrEqual(48);
	expect(
		await page
			.locator(".logicEventRail")
			.evaluate((element) => element.getBoundingClientRect().height),
	).toBeLessThanOrEqual(44);
	expect(
		await page.locator(".logicTree").evaluate((element) => element.getBoundingClientRect().height),
	).toBeGreaterThanOrEqual(500);
	expect(browserErrors).toEqual([]);
});

test("editor workspaces respond to the pane instead of only the viewport", async ({page}) => {
	test.setTimeout(90_000);
	const browserErrors = collectBrowserErrors(page);
	await page.addInitScript(() =>
		window.localStorage.setItem(
			"mothmark-editor-utility-layout",
			JSON.stringify({desktopWidth: 447, mobileHeight: 280}),
		),
	);
	const editor = await useDeterministicEditorWorld(page);
	await page.setViewportSize({width: 1040, height: 844});

	const expectContained = async (selector: string) => {
		await expect
			.poll(() =>
				page
					.locator(selector)
					.evaluate(
						(element) =>
							element.scrollWidth <= element.clientWidth + 1 &&
							element.getBoundingClientRect().left >= 0 &&
							element.getBoundingClientRect().right <= window.innerWidth + 1,
					),
			)
			.toBe(true);
	};
	const expandPlay = async () => {
		const playTab = page.getByRole("tab", {name: "Play"});
		if ((await playTab.getAttribute("aria-expanded")) === "false") await playTab.click();
	};

	await page.goto(`/worlds/${editor.worldSlug}?view=map&room=shop-floor`);
	expect(
		await page.locator(".header").evaluate((element) => element.getBoundingClientRect().height),
	).toBe(56);
	const map = page.locator("[data-map]");
	const layerControl = page.locator(".layoutControl");
	const utilityPanel = page.locator(".editorUtilityPanel");
	const mapGeometry = await map.evaluate((element) => {
		const mapRect = element.getBoundingClientRect();
		const controlRect = element.querySelector<HTMLElement>(".layoutControl")!.getBoundingClientRect();
		return {
			controlInside:
				controlRect.top >= mapRect.top &&
				controlRect.right <= mapRect.right &&
				controlRect.bottom <= mapRect.bottom,
			insetRight: Math.round(mapRect.right - controlRect.right),
			insetTop: Math.round(controlRect.top - mapRect.top),
		};
	});
	expect(mapGeometry.controlInside).toBe(true);
	expect(mapGeometry.insetRight).toBeGreaterThanOrEqual(20);
	expect(mapGeometry.insetRight).toBeLessThanOrEqual(21);
	expect(mapGeometry.insetTop).toBeGreaterThanOrEqual(20);
	expect(mapGeometry.insetTop).toBeLessThanOrEqual(21);
	const [controlBox, utilityBox] = await Promise.all([
		layerControl.boundingBox(),
		utilityPanel.boundingBox(),
	]);
	expect((controlBox?.x ?? Number.POSITIVE_INFINITY) + (controlBox?.width ?? 0)).toBeLessThanOrEqual(
		utilityBox?.x ?? 0,
	);

	await page.getByRole("button", {name: "Layers · Main floor"}).click();
	await expectContained(".layerMenu");
	const layerLayout = await page.locator(".layerMenu").evaluate((element) => {
		const left = element.querySelector<HTMLElement>(".layerMenu--leftPane")!.getBoundingClientRect();
		const right = element.querySelector<HTMLElement>(".layerMenu--right")!.getBoundingClientRect();
		const preview = element
			.querySelector<HTMLElement>(".layerMenu--preview")!
			.getBoundingClientRect();
		const header = element.querySelector<HTMLElement>(".layerMenu--header")!;
		return {
			stacked: left.bottom <= right.top + 1,
			previewHeight: Math.round(preview.height),
			headerContained: header.scrollWidth <= header.clientWidth + 1,
		};
	});
	expect(layerLayout.stacked).toBe(true);
	expect(layerLayout.previewHeight).toBeGreaterThan(300);
	expect(layerLayout.headerContained).toBe(true);
	await page.getByRole("button", {name: "Close layer menu"}).click();

	await page.goto(`/worlds/${editor.worldSlug}?view=items`);
	await expectContained(".itemCatalog");
	expect(
		await page
			.locator(".itemCatalogBody")
			.evaluate((element) => element.getBoundingClientRect().height),
	).toBeGreaterThan(500);

	await page.goto(`/worlds/${editor.worldSlug}?view=logic`);
	await expandPlay();
	await expectContained(".logicHome");
	expect(
		await page
			.locator(".logicHome__grid")
			.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length),
	).toBe(1);

	for (const section of ["conditions", "effects"] as const) {
		await page.goto(`/worlds/${editor.worldSlug}?view=logic&section=${section}`);
		await expandPlay();
		await expectContained(".logicLibraryWorkspace");
		const libraryChromeHeight = await page
			.locator(".logicLibraryHeader, .logicLibraryTools")
			.evaluateAll((elements) =>
				elements.reduce((height, element) => height + element.getBoundingClientRect().height, 0),
			);
		expect(libraryChromeHeight).toBeLessThanOrEqual(160);
		expect(
			await page
				.locator(".logicLibraryBody")
				.evaluate((element) => element.getBoundingClientRect().height),
		).toBeGreaterThan(500);
	}

	await page.goto(`/worlds/${editor.worldSlug}?view=logic&section=commands`);
	await expandPlay();
	await expectContained(".commandLibrary");
	await page.getByRole("button", {name: /Help/}).first().click();
	await expectContained(".commandEditor");

	await page.goto(`/worlds/${editor.worldSlug}?view=logic&section=events`);
	await expandPlay();
	await page.getByRole("button", {name: "New event"}).click();
	await expectContained(".logicEditor");
	const eventLayout = await page.locator(".logicEditor").evaluate((element) => {
		const rail = element.querySelector<HTMLElement>(".logicEventRail")!.getBoundingClientRect();
		const tree = element.querySelector<HTMLElement>(".logicTree")!.getBoundingClientRect();
		return {
			regionsSeparated: rail.right <= tree.left + 1 || rail.bottom <= tree.top + 1,
			treeHeight: Math.round(tree.height),
		};
	});
	expect(eventLayout.regionsSeparated).toBe(true);
	expect(eventLayout.treeHeight).toBeGreaterThan(500);

	expect(browserErrors).toEqual([]);
});

test("dense maps and long play output share the phone workspace without control overlap", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	const stored = editor.worldStore.get(editor.worldId)!;
	const denseWorld = structuredClone(initialWorld);
	const baseRoom = denseWorld.rooms[0]!;
	denseWorld.rooms = Array.from({length: 24}, (_, index) => ({
		...baseRoom,
		id: toID("room", `dense-room-${index + 1}`),
		name: `Dense room ${index + 1}`,
		metadata: {
			...baseRoom.metadata,
			position: {x: 32 + (index % 6) * 168, y: 32 + Math.floor(index / 6) * 112},
		},
	}));
	denseWorld.startRoomId = denseWorld.rooms[0]!.id;
	denseWorld.connections = [];
	denseWorld.items = [];
	denseWorld.metadata.layers = [
		{
			...denseWorld.metadata.layers.find((layer) => layer.layer === 0)!,
			rooms: denseWorld.rooms.map((room) => room.id),
		},
	];
	stored.world = denseWorld;

	await page.setViewportSize({width: 390, height: 844});
	await page.goto(`/worlds/${editor.worldSlug}`);
	await expect(page.getByRole("button", {name: "Dense room 24"})).toBeAttached();
	await page.getByRole("tab", {name: "Play"}).click();
	const commandInput = page.getByRole("textbox", {name: "Game command"});
	for (let turn = 0; turn < 12; turn += 1) {
		await commandInput.fill("look");
		await commandInput.press("Enter");
	}

	await expect
		.poll(() =>
			page
				.locator(".game-player__output")
				.evaluate((element) => element.scrollHeight > element.clientHeight),
		)
		.toBe(true);
	await expectMobileLayoutIntegrity(page, {root: ".editorPage"});
	const geometry = await page.evaluate(() => ({
		documentWidth: document.documentElement.scrollWidth,
		mapHeight: document.querySelector<HTMLElement>("[data-map]")!.getBoundingClientRect().height,
		viewportWidth: window.innerWidth,
	}));
	expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
	expect(geometry.mapHeight).toBeGreaterThan(80);
	expect(browserErrors).toEqual([]);
});

test("mobile command editing keeps every authoring control reachable without overlap", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	const editor = await useDeterministicEditorWorld(page);
	await page.setViewportSize({width: 320, height: 568});
	await page.goto(`/worlds/${editor.worldSlug}`);

	await page.getByRole("button", {name: "Map", expanded: false}).click();
	await page.getByRole("menuitem", {name: "Logic"}).click();
	await page.getByRole("button", {name: /Commands Define the commands/}).click();
	await expectMobileLayoutIntegrity(page, {root: ".editorPage"});

	await page.getByRole("button", {name: /Travel go <direction> Everywhere/}).click();
	const builder = page.locator(".commandBuilder");
	const phraseBlock = page.getByRole("button", {name: "Phrase go"});
	await expect(builder).toBeVisible();
	await builder.evaluate((element) => element.scrollTo({top: element.scrollHeight}));
	await expect(phraseBlock).toBeInViewport();
	await expectMobileLayoutIntegrity(page, {root: ".editorPage"});

	const geometry = await builder.evaluate((element) => ({
		clientHeight: element.clientHeight,
		scrollHeight: element.scrollHeight,
	}));
	expect(geometry.clientHeight).toBeGreaterThanOrEqual(300);
	expect(geometry.scrollHeight).toBeGreaterThanOrEqual(geometry.clientHeight);
	expect(browserErrors).toEqual([]);
});

test("a registered owner publishes the current saved world from world settings", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const environment = await useDeterministicEditorWorld(page);
	let publishRequest:
		| {
				expectedRevision: number;
				title: string;
				slug: string;
				summary: string;
				visibility: "listed" | "unlisted";
		  }
		| undefined;

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
		publishRequest = route.request().postDataJSON() as typeof publishRequest;
		if (!publishRequest) throw new Error("The publication request body is missing.");
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
					worldRevision: publishRequest.expectedRevision,
					currentWorldRevision: publishRequest.expectedRevision,
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

	await expect(page.getByText(/Release 1 uses saved revision \d+\./)).toBeVisible();
	await expect(page.getByRole("link", {name: "Open published world"})).toHaveAttribute(
		"href",
		"/play/quiet-archive",
	);
	const savedRevision = environment.worldStore.get(environment.worldId)?.revision;
	expect(publishRequest).toEqual({
		expectedRevision: savedRevision,
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
	const publicationId = "7973548a-9957-40f4-8146-64d3ff7fb017";
	let publication = {
		homepagePosition: null as number | null,
		id: publicationId,
		isOfficial: false,
		listedOnHomepage: false,
		ownerName: null,
		ownerUserId: registeredUser.id,
		ownerUsername: registeredUser.username,
		release: {id: "a00e257a-587f-4e28-aacf-4123875eedf1", number: 1, publishedAt: now},
		slug: "quiet-archive",
		status: "published" as const,
		summary: "A compact world for testing hosted play.",
		title: "Quiet archive",
		visibility: "listed" as const,
		worldId,
	};
	let permissionState: "deny" | "inherited" = "inherited";
	let permissionMutation: unknown;
	let publicationMutation: unknown;
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
	await page.route(new RegExp(`/api/admin/publications/${publicationId}$`), async (route) => {
		if (route.request().method() === "PUT") {
			publicationMutation = route.request().postDataJSON();
			publication = {
				...publication,
				homepagePosition: 1,
				isOfficial: true,
				listedOnHomepage: true,
			};
		}
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: publication}),
		});
	});
	await page.route("**/api/auth/csrf?audience=admin", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {csrfToken: "admin-csrf"}}),
		}),
	);
	await page.route("**/api/admin/auth/sign-out", (route) => route.fulfill({status: 204}));

	await page.goto("/admin/sign-in");
	await expect(page.getByRole("heading", {name: "Sign in to admin"})).toBeVisible();
	await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "username");
	await expect(page.getByLabel("Password")).toHaveAttribute("autocomplete", "current-password");
	await expect(page.getByRole("link", {name: "Mothmark home"})).toBeVisible();
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

	await page.goto(`/admin/publications/${publicationId}`);
	await expect(page.getByRole("heading", {name: "Quiet archive"})).toBeVisible();
	await page
		.getByRole("checkbox", {
			name: "Official world Mark this as deliberately reviewed and endorsed by Mothmark.",
		})
		.check();
	await page
		.getByRole("checkbox", {
			name: "Home page Feature this official world in the home page carousel.",
		})
		.check();
	await expect(page.getByLabel("Home page position")).toHaveValue("1");
	await page.getByLabel("Administrative reason").fill("Lead with the maintained introductory world");
	await page.getByRole("button", {name: "Save discovery settings"}).click();
	await page.getByRole("button", {name: "Make official"}).click();
	await expect(page.getByRole("status")).toHaveText("Discovery settings saved.");
	expect(publicationMutation).toEqual({
		action: "update_curation",
		homepagePosition: 1,
		isOfficial: true,
		listedOnHomepage: true,
		reason: "Lead with the maintained introductory world",
		visibility: "listed",
	});
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
	await expect(page.getByRole("heading", {name: "Sign in to admin"})).toBeVisible();
	expect(browserErrors.filter((error) => !error.includes("status of 401"))).toEqual([]);
});
