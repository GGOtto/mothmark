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

test("item icon gallery audits all 100 Hugeicons categories at both primary sizes", async ({
	context,
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	await context.grantPermissions(["clipboard-read", "clipboard-write"]);
	await page.goto("/test/item-icons");

	await expect(page.getByRole("heading", {level: 1, name: "Hugeicons item catalog"})).toBeVisible();
	await expect(
		page.getByText("100 official marks · 9 folded categories · 3+ choices each"),
	).toBeVisible();
	await expect(page.locator("[data-category]")).toHaveCount(100);
	await expect(page.locator('[data-category="generic"]')).toContainText("Shapes01Icon");
	await expect(page.locator('[data-category="generic"]')).toContainText("Official");
	const officialIconNames = await page
		.locator('[data-library-status="official"] .itemIconGallery__categoryIdentity code')
		.allTextContents();
	expect(officialIconNames).toHaveLength(100);
	expect(new Set(officialIconNames).size).toBe(100);

	const nature = page.locator('[data-category="nature"]');
	await expect(nature.getByRole("heading", {level: 2, name: "Nature"})).toBeVisible();
	await expect(nature.getByText("Official", {exact: true})).toBeVisible();
	await expect(nature.getByText("Leaf01Icon", {exact: true})).toBeVisible();
	await expect(nature.getByRole("region", {name: "Nature, light editor theme"})).toBeVisible();
	await expect(nature.getByRole("region", {name: "Nature, dark editor theme"})).toBeVisible();
	await expect(nature.getByText("64px")).toHaveCount(2);
	await expect(nature.getByText("128px")).toHaveCount(2);
	await expect(nature.getByText("Choice 1 of 3", {exact: true})).toBeVisible();
	await nature.getByRole("button", {name: "Next icon choice for Nature"}).click();
	await expect(nature.getByText("Leaf02Icon", {exact: true})).toBeVisible();
	await expect(nature.getByText("Alternative", {exact: true})).toBeVisible();
	await expect(page.locator('[data-category="control"]')).toContainText("ToggleOnIcon");
	const choiceLabels = await page
		.locator(".itemIconGallery__suggestionControls span")
		.allTextContents();
	expect(choiceLabels).toHaveLength(100);
	for (const label of choiceLabels) {
		const total = Number(label.match(/of (\d+)/)?.[1]);
		expect(total).toBeGreaterThanOrEqual(3);
	}

	const newOfficialCategories = {
		"bell-and-chime": "BellIcon",
		"chain-and-link": "Link03Icon",
		document: "Certificate01Icon",
		"egg-and-nest": "EggsIcon",
		explosive: "BombIcon",
		"fishing-tool": "FishingRodIcon",
		"flag-and-sign": "Flag01Icon",
		knife: "Knife02Icon",
		regalia: "Crown02Icon",
		rope: "ThreadIcon",
		"thread-and-sewing": "FilmRoll02Icon",
		treasure: "GoldIngotsIcon",
		"writing-tool": "PenTool03Icon",
	};
	for (const [category, iconName] of Object.entries(newOfficialCategories)) {
		const card = page.locator(`[data-category="${category}"]`);
		await expect(card).toContainText(iconName);
		await expect(card.getByText("Official", {exact: true})).toBeVisible();
	}

	for (const foldedCategory of [
		"polearm",
		"candle",
		"scroll",
		"corpse",
		"relic",
		"idol",
		"ritual-implement",
		"gem",
		"rune",
	]) {
		await expect(page.locator(`[data-category="${foldedCategory}"]`)).toHaveCount(0);
	}
	await expect(page.locator('[data-category="weapon"]')).toContainText("Folded vocabulary: polearm");
	await expect(page.locator('[data-category="shrine-and-altar"]')).toContainText(
		"Folded vocabulary: relic, idol, ritual implement",
	);

	const bluntWeapon = page.locator('[data-category="blunt-weapon"]');
	await expect(bluntWeapon.getByText("Official", {exact: true})).toBeVisible();
	await expect(bluntWeapon.getByText("BaseballBatIcon", {exact: true})).toBeVisible();
	await expect(bluntWeapon.getByText("Choice 1 of 4", {exact: true})).toBeVisible();

	await bluntWeapon.getByRole("button", {name: "Next icon choice for Blunt weapon"}).click();
	await expect(bluntWeapon.getByText("ClubIcon", {exact: true})).toBeVisible();
	await expect(bluntWeapon.getByText("Choice 2 of 4", {exact: true})).toBeVisible();

	await bluntWeapon.getByRole("button", {name: "Next icon choice for Blunt weapon"}).click();
	await expect(bluntWeapon.getByText("HammerIcon", {exact: true})).toBeVisible();
	await expect(bluntWeapon.getByText("Choice 3 of 4", {exact: true})).toBeVisible();

	await bluntWeapon.getByRole("button", {name: "Next icon choice for Blunt weapon"}).click();
	await expect(bluntWeapon.getByText("Crossed-out fallback", {exact: true})).toBeVisible();
	await expect(bluntWeapon.getByText("Choice 4 of 4", {exact: true})).toBeVisible();

	const showTags = bluntWeapon.getByRole("button", {name: "Show tags"});
	await expect(showTags).toHaveAttribute("aria-expanded", "false");
	await showTags.click();
	await expect(bluntWeapon.getByRole("heading", {name: "Names, aliases, and tags"})).toBeVisible();
	await expect(bluntWeapon.getByText("morning star", {exact: true})).toBeVisible();
	await expect(bluntWeapon.getByRole("button", {name: "Hide tags"})).toHaveAttribute(
		"aria-expanded",
		"true",
	);

	await expect(page.locator(".itemIconGallery__grid svg")).toHaveCount(400);

	await page.getByRole("button", {name: "Copy all choices"}).click();
	await expect(page.getByText("Copied 100 choices", {exact: true})).toBeVisible();
	const copiedChoices = await page.evaluate(() => navigator.clipboard.readText());
	expect(copiedChoices).toContain("1. generic: Shapes01Icon [Official]");
	expect(copiedChoices).toContain("45. blunt-weapon: Crossed-out fallback [No icon]");
	expect(copiedChoices).toContain("44. knife: Knife02Icon [Official]");
	expect(copiedChoices).toContain("33. rope: ThreadIcon [Official]");
	expect(copiedChoices).toContain("34. writing-tool: PenTool03Icon [Official]");
	expect(copiedChoices).toContain("57. chain-and-link: Link03Icon [Official]");
	expect(copiedChoices).toContain("99. thread-and-sewing: FilmRoll02Icon [Official]");
	expect(copiedChoices).toContain("100. spellbook: BookKeyIcon [Official]");
	expect(copiedChoices).not.toContain(". polearm:");
	expect(copiedChoices.split("\n")).toHaveLength(103);
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
	await expect(page.locator('[data-category="spellbook"]')).toBeVisible();
	expect((await header.boundingBox())?.y).toBe(initialHeaderTop);
	await expectMobileLayoutIntegrity(page, {root: ".itemIconGallery"});
	expect(browserErrors).toEqual([]);
});
