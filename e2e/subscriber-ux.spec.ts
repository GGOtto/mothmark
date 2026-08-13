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

test("the footer subscribes an email without leaving the page", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	let submitted: Record<string, unknown> | undefined;
	await page.route("**/api/auth/csrf", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {csrfToken: "csrf"}}),
		}),
	);
	await page.route("**/api/subscribers", (route) => {
		submitted = route.request().postDataJSON() as Record<string, unknown>;
		return route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({data: {message: "You're subscribed to Notes from Mothmark."}}),
		});
	});

	await page.goto("/");
	await page.getByLabel("Email address").fill("reader@example.com");
	await page.getByRole("button", {name: "Subscribe"}).click();
	await expect(page).toHaveURL("/");
	await expect(page.getByText("You're subscribed to Notes from Mothmark.")).toBeVisible();
	await expect(page.getByLabel("Email address")).toHaveValue("");
	expect(submitted).toEqual({email: "reader@example.com"});
	expect(browserErrors).toEqual([]);
});

test("an administrator can review, copy, and safely address subscribers", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: {
				writeText: async (value: string) => {
					(window as typeof window & {copiedSubscriberEmails?: string}).copiedSubscriberEmails = value;
				},
			},
		});
	});
	await page.route("**/api/admin/subscribers", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					subscribers: [
						{
							email: "reader@example.com",
							source: "footer",
							subscribedAt: "2026-08-13T12:00:00.000Z",
						},
						{
							email: "author@example.com",
							source: "registration",
							subscribedAt: "2026-08-12T12:00:00.000Z",
						},
					],
				},
			}),
		}),
	);

	await page.setViewportSize({width: 390, height: 844});
	await page.goto("/admin/subscribers");
	await expect(page.getByRole("heading", {name: "Subscribers"})).toBeVisible();
	await expect(page.getByText("reader@example.com")).toBeVisible();
	await expectMobileLayoutIntegrity(page);

	await page.getByRole("button", {name: "Copy all"}).click();
	await expect(page.getByRole("status")).toHaveText("2 emails copied.");
	expect(
		await page.evaluate(
			() => (window as typeof window & {copiedSubscriberEmails?: string}).copiedSubscriberEmails,
		),
	).toBe("reader@example.com\nauthor@example.com");

	const emailAll = page.getByRole("button", {name: "Email all"});
	await emailAll.click();
	const dialog = page.getByRole("dialog", {name: "Email every subscriber?"});
	await expect(dialog).toBeVisible();
	await expect(dialog.getByText(/addresses are placed in BCC/)).toBeVisible();
	await expect(dialog.getByRole("link", {name: "Open BCC draft"})).toHaveAttribute(
		"href",
		/^mailto:\?bcc=reader%40example\.com%2Cauthor%40example\.com&subject=Notes%20from%20Mothmark$/,
	);
	await page.keyboard.press("Escape");
	await expect(dialog).not.toBeVisible();
	await expect(emailAll).toBeFocused();
	expect(browserErrors).toEqual([]);
});
