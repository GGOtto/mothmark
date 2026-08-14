import {expect, test, type Page} from "@playwright/test";

function collectBrowserErrors(page: Page) {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});
	return errors;
}

test("the approved logo suite is used in the site shell and metadata", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.emulateMedia({colorScheme: "dark"});
	await page.goto("/");

	const headerLogo = page.getByRole("link", {name: "Mothmark home"}).locator("img");
	await expect(headerLogo).toHaveAttribute("src", "/logo/dark/header-compact.png");
	await expect(headerLogo).toBeVisible();

	const footerLogo = page.getByRole("link", {name: "Mothmark footer home"}).locator("img");
	await expect(footerLogo).toHaveAttribute("src", "/logo/dark/header-primary.png");
	await footerLogo.scrollIntoViewIfNeeded();
	await expect(footerLogo).toBeVisible();

	const logoLayout = await page.evaluate(() => {
		const header = document.querySelector<HTMLImageElement>(".headerLogoImage");
		const footer = document.querySelector<HTMLImageElement>(".siteFooter__logo");
		return {
			clientWidth: document.documentElement.clientWidth,
			header: header
				? {height: header.getBoundingClientRect().height, width: header.getBoundingClientRect().width}
				: null,
			footer: footer
				? {height: footer.getBoundingClientRect().height, width: footer.getBoundingClientRect().width}
				: null,
			scrollWidth: document.documentElement.scrollWidth,
		};
	});
	expect(logoLayout.header?.width).toBeGreaterThan(190);
	expect(logoLayout.header?.height).toBeLessThan(60);
	expect(logoLayout.footer?.width).toBeGreaterThan(250);
	expect(logoLayout.scrollWidth).toBeLessThanOrEqual(logoLayout.clientWidth);

	await expect(
		page.locator('link[rel="icon"][sizes="16x16"][media="(prefers-color-scheme: light)"]'),
	).toHaveAttribute("href", "/logo/light/favicon-optical-16.png?v=4");
	await expect(
		page.locator('link[rel="icon"][sizes="32x32"][media="(prefers-color-scheme: light)"]'),
	).toHaveAttribute("href", "/logo/light/favicon-optical-32.png?v=4");
	await expect(
		page.locator('link[rel="icon"][sizes="16x16"][media="(prefers-color-scheme: dark)"]'),
	).toHaveAttribute("href", "/logo/dark/favicon-optical-16.png?v=4");
	await expect(
		page.locator('link[rel="icon"][sizes="32x32"][media="(prefers-color-scheme: dark)"]'),
	).toHaveAttribute("href", "/logo/dark/favicon-optical-32.png?v=4");
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/site.webmanifest");
	expect(browserErrors).toEqual([]);
});

test("the approved compact lockup fits the narrow header", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.setViewportSize({width: 320, height: 568});
	await page.goto("/");

	const headerLogo = page.getByRole("link", {name: "Mothmark home"}).locator("img");
	await expect(headerLogo).toBeVisible();
	const logoBox = await headerLogo.boundingBox();
	expect(logoBox?.width).toBeLessThanOrEqual(132.5);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
		),
	).toBe(true);
	expect(browserErrors).toEqual([]);
});

test("account entry uses the approved theme-aware logo", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.emulateMedia({colorScheme: "dark"});
	await page.goto("/sign-in");
	const accountLogo = page.getByRole("link", {name: "Mothmark home"}).locator("img");
	await expect(accountLogo).toHaveAttribute("src", "/logo/dark/header-compact.png");
	await expect(accountLogo).toBeVisible();

	await page.evaluate(() => window.localStorage.setItem("mothmark-theme", "light"));
	await page.reload();
	await expect(accountLogo).toHaveAttribute("src", "/logo/light/header-compact.png");
	expect(browserErrors).toEqual([]);
});
