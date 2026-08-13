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

test("item icon gallery shows every theme and exported size", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.goto("/test/item-icons");

	await expect(page.getByRole("heading", {level: 1, name: "Item icons"})).toBeVisible();
	await expect(page.getByText(/\d+ categories · \d+ PNG files/)).toBeVisible();
	expect(await page.locator("[data-category]").count()).toBeGreaterThanOrEqual(20);

	const generic = page.locator('[data-category="generic"]');
	await expect(generic.getByRole("heading", {level: 2, name: "Generic"})).toBeVisible();
	await expect(generic.getByRole("region", {name: "Generic, light editor theme"})).toBeVisible();
	await expect(generic.getByRole("region", {name: "Generic, dark editor theme"})).toBeVisible();
	await expect(generic.getByText("24px")).toHaveCount(2);
	await expect(generic.getByText("64px")).toHaveCount(2);
	await expect(generic.getByText("128px")).toHaveCount(2);

	const galleryImages = page.locator(".itemIconGallery__grid img");
	expect(await galleryImages.count()).toBeGreaterThanOrEqual(200);
	await expect
		.poll(() =>
			galleryImages.evaluateAll((images) =>
				images.every(
					(image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
				),
			),
		)
		.toBe(true);
	expect(browserErrors).toEqual([]);
});

test("item icon gallery keeps its header and controls usable on a narrow viewport", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.setViewportSize({width: 320, height: 720});
	await page.goto("/test/item-icons");

	const header = page.locator(".itemIconGallery__header");
	const body = page.locator(".itemIconGallery__body");
	const initialHeaderTop = (await header.boundingBox())?.y;

	await body.evaluate((element) => element.scrollTo(0, element.scrollHeight));
	await expect(page.locator('[data-category="wearable"]')).toBeVisible();
	expect((await header.boundingBox())?.y).toBe(initialHeaderTop);
	await expectMobileLayoutIntegrity(page, {root: ".itemIconGallery"});
	expect(browserErrors).toEqual([]);
});
