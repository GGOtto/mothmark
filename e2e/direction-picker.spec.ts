import {expect, test, type Page} from "@playwright/test";

function collectBrowserErrors(page: Page) {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});
	return errors;
}

function primaryDirectionField(page: Page) {
	return page.getByTestId("test-direction-picker-default-field-md-world-list-auto-plain-light-flat");
}

test("authors can choose compass and spatial directions", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.goto("/test/direction-picker");

	const field = primaryDirectionField(page);
	await field.getByRole("button", {name: "Up UP"}).click();
	const dialog = page.getByRole("dialog", {name: "Choose direction"});
	await expect(dialog).toBeVisible();
	await expect(
		dialog.getByRole("group", {name: "Compass directions"}).getByRole("button"),
	).toHaveCount(8);
	await expect(dialog.locator(".directionPickerCompass__sector")).toHaveCount(8);
	await expect(
		dialog.getByRole("group", {name: "Spatial directions"}).getByRole("button"),
	).toHaveCount(4);
	const desktopBounds = await dialog.boundingBox();
	expect(desktopBounds).not.toBeNull();
	expect(desktopBounds!.width).toBeLessThanOrEqual(422);

	await dialog.getByRole("button", {name: "Out", exact: true}).click();
	await expect(field.getByRole("button", {name: "Out OUT"})).toBeVisible();
	await expect(dialog).toBeHidden();
	await expect(field.getByRole("button", {name: "Out OUT"})).toBeFocused();
	expect(browserErrors).toEqual([]);
});

test("command direction blocks use a compact multi-direction control", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.goto("/test/direction-multi-picker");

	const field = page.getByTestId(
		"test-direction-multi-picker-allowed-directions-auto-plain-light-flat",
	);
	await expect(field.getByRole("button", {name: "All directions"})).toBeVisible();
	await expect(
		field.getByRole("group", {name: "Compass directions"}).getByRole("button"),
	).toHaveCount(8);
	await expect(
		field.getByRole("group", {name: "Spatial directions"}).getByRole("button"),
	).toHaveCount(4);
	await expect(field.getByText("2 directions accepted.")).toBeVisible();
	await expect(field.getByText("{name}")).toHaveCount(0);
	await expect(field.getByRole("button", {name: "Duplicate"})).toHaveCount(0);

	await field.getByRole("button", {name: "North", exact: true}).click();
	await expect(field.getByText("1 direction accepted.")).toBeVisible();
	expect(browserErrors).toEqual([]);
});

test("the direction picker remains usable on a phone viewport", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.setViewportSize({width: 390, height: 844});
	await page.goto("/test/direction-picker");

	await primaryDirectionField(page).getByRole("button", {name: "Up UP"}).click();
	const dialog = page.getByRole("dialog", {name: "Choose direction"});
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole("button", {name: "In", exact: true})).toBeVisible();
	await expect(dialog.getByRole("button", {name: "Out", exact: true})).toBeVisible();

	const bounds = await dialog.boundingBox();
	expect(bounds).not.toBeNull();
	expect(bounds!.x).toBeGreaterThanOrEqual(0);
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
	expect(bounds!.y).toBeGreaterThanOrEqual(0);
	expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
		),
	).toBe(true);
	expect(browserErrors).toEqual([]);
});
