import {expect, test, type Page} from "@playwright/test";
import {expectMobileLayoutIntegrity} from "./mobile-layout";

function collectBrowserErrors(page: Page) {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});
	return errors;
}

test("the signed-out desktop header uses a left page selector and sends feedback", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	let submittedFeedback: Record<string, unknown> | undefined;
	await page.route("**/api/auth/csrf", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			headers: {"set-cookie": "mothmark_editor_csrf=csrf; Path=/; SameSite=Lax"},
			body: JSON.stringify({data: {csrfToken: "csrf"}}),
		}),
	);
	await page.route("**/api/feedback", async (route) => {
		submittedFeedback = route.request().postDataJSON() as Record<string, unknown>;
		await route.fulfill({
			status: 201,
			contentType: "application/json",
			body: JSON.stringify({data: {sent: true}}),
		});
	});

	await page.emulateMedia({colorScheme: "dark"});
	await page.goto("/");
	const primary = page.getByRole("navigation", {name: "Primary navigation"});
	const selector = primary.getByRole("button", {name: "Choose page, current: Home"});
	const brand = page.getByRole("link", {name: "Mothmark home"});
	await expect(brand.locator("img")).toHaveAttribute("src", "/logo/dark/header-compact.png");
	const selectorBox = await selector.boundingBox();
	const brandBox = await brand.boundingBox();
	expect(selectorBox?.x).toBeGreaterThan(brandBox?.x ?? 0);
	const primaryBox = await primary.boundingBox();
	const viewport = page.viewportSize();
	expect((primaryBox?.x ?? 0) + (primaryBox?.width ?? 0)).toBeLessThan((viewport?.width ?? 0) / 2);

	await selector.click();
	await expect(page.getByRole("menuitem", {name: "Home"})).toHaveAttribute("href", "/");
	await expect(page.getByRole("menuitem", {name: "Create"})).toHaveAttribute("href", "/worlds");
	await expect(page.getByRole("menuitem", {name: "Play"})).toHaveAttribute("href", "/play");
	await expect(page.getByRole("menuitem", {name: "Admin"})).toHaveCount(0);
	await expect(page.getByRole("link", {name: "Log in"})).toHaveAttribute("href", "/sign-in");
	await expect(page.getByRole("link", {name: "Sign up"})).toHaveAttribute("href", "/register");

	await page.getByRole("button", {name: "Send feedback"}).click();
	await page.getByLabel("About").selectOption("idea");
	await page.getByLabel("Your email").fill("reader@example.test");
	await page.getByLabel("Message").fill("Make browsing the easiest place to start.");
	await page.getByRole("dialog").getByRole("button", {name: "Send feedback"}).click();
	await expect(page.getByText("Feedback sent.")).toBeVisible();
	expect(submittedFeedback).toMatchObject({
		category: "idea",
		includePage: true,
		message: "Make browsing the easiest place to start.",
		replyEmail: "reader@example.test",
	});
	expect(browserErrors).toEqual([]);
});

test("the narrow header collapses secondary actions into one menu", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.setViewportSize({width: 390, height: 844});
	await page.goto("/");

	await expect(page.getByRole("navigation", {name: "Primary navigation"})).toBeHidden();
	await expect(page.getByRole("button", {name: "Send feedback"})).toBeHidden();
	await expectMobileLayoutIntegrity(page);
	await page.getByRole("button", {name: "Open menu"}).click();

	const mobile = page.getByRole("navigation", {name: "Mobile navigation"});
	await expect(mobile.getByRole("link", {name: "Home"})).toHaveAttribute("href", "/");
	await expect(mobile.getByRole("link", {name: "Create"})).toHaveAttribute("href", "/worlds");
	await expect(mobile.getByRole("link", {name: "Play"})).toHaveAttribute("href", "/play");
	await expect(mobile.getByRole("button", {name: "Send feedback"})).toBeVisible();
	await expect(mobile.getByRole("link", {name: "Sign up"})).toBeVisible();
	await mobile.getByRole("button", {name: "Send feedback"}).click();
	const feedback = page.getByRole("dialog", {name: "Send feedback"});
	await expect(feedback).toBeVisible();
	await expectMobileLayoutIntegrity(page, {root: "[role='dialog']"});

	for (const viewport of [
		{width: 320, height: 568},
		{width: 390, height: 360},
		{width: 740, height: 430},
	]) {
		await page.setViewportSize(viewport);
		await expect
			.poll(async () => {
				const currentBounds = await feedback.boundingBox();
				return (currentBounds?.x ?? 0) + (currentBounds?.width ?? Number.POSITIVE_INFINITY);
			})
			.toBeLessThanOrEqual(viewport.width + 1);
		await expect
			.poll(async () => {
				const currentBounds = await feedback.boundingBox();
				return (currentBounds?.y ?? 0) + (currentBounds?.height ?? Number.POSITIVE_INFINITY);
			})
			.toBeLessThanOrEqual(viewport.height + 1);
		const bounds = await feedback.boundingBox();
		expect(bounds?.x ?? -1).toBeGreaterThanOrEqual(0);
		expect(bounds?.y ?? -1).toBeGreaterThanOrEqual(0);
		await expectMobileLayoutIntegrity(page, {root: "[role='dialog']"});
	}

	await feedback.getByRole("button", {name: "Close feedback"}).click();
	await expect(page.getByRole("button", {name: "Open menu"})).toBeFocused();
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
		),
	).toBe(true);
	expect(browserErrors).toEqual([]);
});

test("the full header remains through 901px and collapses at 900px", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.setViewportSize({width: 901, height: 760});
	await page.goto("/");

	await expect(page.getByRole("navigation", {name: "Primary navigation"})).toBeVisible();
	await expect(page.getByRole("button", {name: "Open menu"})).toBeHidden();

	await page.setViewportSize({width: 900, height: 760});
	await expect(page.getByRole("navigation", {name: "Primary navigation"})).toBeHidden();
	await expect(page.getByRole("button", {name: "Open menu"})).toBeVisible();
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
		),
	).toBe(true);
	expect(browserErrors).toEqual([]);
});

test("the approved header logo follows the selected appearance", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.emulateMedia({colorScheme: "light"});
	await page.goto("/");

	const brandImage = page.getByRole("link", {name: "Mothmark home"}).locator("img");
	await expect(brandImage).toHaveAttribute("src", "/logo/light/header-compact.png");
	await page.evaluate(() => {
		window.localStorage.setItem("mothmark-theme", "dark");
	});
	await page.reload();
	await expect(brandImage).toHaveAttribute("src", "/logo/dark/header-compact.png");
	await page.evaluate(() => {
		window.localStorage.setItem("mothmark-theme", "system");
	});
	await page.reload();
	await expect(brandImage).toHaveAttribute("src", "/logo/light/header-compact.png");
	expect(browserErrors).toEqual([]);
});
