import {expect, test, type Page} from "@playwright/test";

function collectBrowserErrors(page: Page) {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});
	return errors;
}

test("authors can find an effect by intent and return to its fields", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.setViewportSize({width: 760, height: 720});
	await page.goto("/test/effect-list");

	await page
		.getByRole("button", {name: /Edit effect:/})
		.first()
		.click();
	const effectEditor = page.getByRole("dialog");
	await expect(effectEditor.getByRole("heading", {name: "Edit effect"})).toBeVisible();
	await effectEditor.getByRole("button", {name: /Behavior Show a message Change/}).click();

	const picker = page.getByRole("dialog", {name: "Choose effect"});
	await picker.getByRole("searchbox", {name: "Search effects"}).fill("set a trap");
	await expect(picker.getByRole("option", {name: /Set a world flag/})).toBeVisible();
	await expect(picker.getByRole("option", {name: /Set an item flag/})).toBeVisible();

	await picker.getByRole("searchbox", {name: "Search effects"}).fill("bury");
	await picker.getByRole("option", {name: /Place an item inside another/}).click();

	const title = picker.getByRole("heading", {name: "Place an item inside another"});
	await expect(title).toBeVisible();
	const titleLayout = await title.evaluate((element) => {
		const styles = getComputedStyle(element);
		return {
			clientWidth: element.clientWidth,
			scrollWidth: element.scrollWidth,
			height: element.getBoundingClientRect().height,
			lineHeight: Number.parseFloat(styles.lineHeight),
		};
	});
	expect(titleLayout.scrollWidth).toBeLessThanOrEqual(titleLayout.clientWidth);
	expect(titleLayout.height).toBeGreaterThan(titleLayout.lineHeight);

	await picker.getByRole("button", {name: "Use effect"}).click();
	await expect(effectEditor.getByRole("heading", {name: "Edit effect"})).toBeVisible();
	await expect(
		effectEditor.getByRole("button", {name: /Behavior Place an item inside another Change/}),
	).toBeVisible();
	await expect(effectEditor.getByRole("button", {name: "Choose item"})).toHaveCount(2);
	expect(browserErrors).toEqual([]);
});

test("the refined chooser keeps its preview and actions usable on a phone", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.setViewportSize({width: 390, height: 844});
	await page.goto("/test/effect-list");

	await page
		.getByRole("button", {name: /Edit effect:/})
		.first()
		.click();
	const effectEditor = page.getByRole("dialog");
	await effectEditor.getByRole("button", {name: /Behavior Show a message Change/}).click();

	const picker = page.getByRole("dialog", {name: "Choose effect"});
	await picker.getByRole("searchbox", {name: "Search effects"}).fill("set a trap");
	await picker.getByRole("option", {name: /Set a world flag/}).click();

	await expect(picker.getByRole("heading", {name: "Creates"})).toBeVisible();
	await expect(picker.getByText(/Set a world flag — \[flag\], \[value\]/)).toBeVisible();
	await expect(picker.getByRole("button", {name: "Use effect"})).toBeVisible();

	const layout = await picker.evaluate((element) => ({
		clientWidth: element.clientWidth,
		scrollWidth: element.scrollWidth,
	}));
	expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
	expect(browserErrors).toEqual([]);
});
