import {expect, test, type Page} from "@playwright/test";

import {world as initialWorld} from "../src/data/worlds/initialWorld";

function collectBrowserErrors(page: Page) {
	const errors: string[] = [];

	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});

	return errors;
}

async function useDeterministicEditorWorld(page: Page) {
	await page.route("**/api/world/slug/main", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					id: "57c635aa-7792-4a13-9595-58cd1ef05fd6",
					world: initialWorld,
					revision: 1,
				},
			}),
		});
	});
}

test("the home page opens the editor in one action", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await useDeterministicEditorWorld(page);

	await page.goto("/");
	await expect(page.getByRole("heading", {name: "Text adventure tools, eventually."})).toBeVisible();
	await expect(page.getByRole("link", {name: "Home", exact: true})).toHaveAttribute(
		"aria-current",
		"page",
	);

	await page.getByRole("link", {name: "Open Editor"}).click();

	await expect(page).toHaveURL(/\/editor$/);
	await expect(page.getByRole("button", {name: "Map"})).toHaveAttribute("aria-current", "page");
	await expect(page.getByRole("textbox", {name: "Game command"})).toBeEnabled();
	expect(browserErrors).toEqual([]);
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
