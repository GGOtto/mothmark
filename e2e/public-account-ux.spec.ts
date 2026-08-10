import {expect, test, type Page} from "@playwright/test";

function collectBrowserErrors(page: Page) {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});
	return errors;
}

async function routeAvailableUsername(page: Page) {
	await page.route("**/api/auth/username-availability?*", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {available: true, message: "Username is available.", valid: true},
			}),
		}),
	);
}

test("registration catches a password mismatch before making a request", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await routeAvailableUsername(page);
	let securityRequests = 0;
	let registrationRequests = 0;
	await page.route("**/api/auth/csrf", async (route) => {
		securityRequests += 1;
		await route.fulfill({status: 500});
	});
	await page.route("**/api/auth/register", async (route) => {
		registrationRequests += 1;
		await route.fulfill({status: 500});
	});

	await page.goto("/register");
	await page.getByLabel("Username").fill("archivekeeper");
	await page.getByLabel("Email").fill("author@example.com");
	await page.getByLabel("Password", {exact: true}).fill("a durable password");
	await page.getByLabel("Confirm password").fill("a different password");
	await page.getByRole("button", {name: "Send verification email"}).click();

	await expect(page.locator("main").getByRole("alert")).toHaveText("The passwords do not match.");
	await expect(page.getByLabel("Email")).toHaveValue("author@example.com");
	await expect(page.getByLabel("Username")).toHaveValue("archivekeeper");
	await expect(page.getByLabel("Password", {exact: true})).toHaveValue("a durable password");
	expect(securityRequests).toBe(0);
	expect(registrationRequests).toBe(0);
	expect(browserErrors).toEqual([]);
});

test("an incomplete password-reset link explains why it cannot be submitted", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);

	await page.goto("/reset-password");

	await expect(page.getByRole("heading", {name: "Choose a new password"})).toBeVisible();
	await expect(page.getByRole("button", {name: "Reset password"})).toBeDisabled();
	await expect(page.locator("main").getByRole("alert")).toHaveText(
		"This password reset link is incomplete. Request a new recovery email.",
		{timeout: 1_000},
	);
	await expect(page.getByRole("link", {name: "Request a new recovery email"})).toHaveAttribute(
		"href",
		"/forgot-password",
	);
	expect(browserErrors).toEqual([]);
});

test("an incomplete verification link offers a recovery path", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);

	await page.goto("/verify-email");

	await expect(page.locator("main").getByRole("alert")).toHaveText(
		"This verification link is incomplete.",
	);
	await expect(page.getByRole("link", {name: "Request another verification email"})).toHaveAttribute(
		"href",
		"/register",
	);
	expect(browserErrors).toEqual([]);
});

test("a rejected account request preserves entered values and restores the submit action", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	await routeAvailableUsername(page);
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
			status: 409,
			contentType: "application/json",
			body: JSON.stringify({error: {message: "Registration is temporarily unavailable."}}),
		}),
	);

	await page.goto("/register");
	await page.getByLabel("Username").fill("archivekeeper");
	await page.getByLabel("Email").fill("author@example.com");
	await page.getByLabel("Password", {exact: true}).fill("a durable password");
	await page.getByLabel("Confirm password").fill("a durable password");
	await page.getByRole("button", {name: "Send verification email"}).click();

	await expect(page.locator("main").getByRole("alert")).toHaveText(
		"Registration is temporarily unavailable.",
	);
	await expect(page.getByLabel("Email")).toHaveValue("author@example.com");
	await expect(page.getByLabel("Username")).toHaveValue("archivekeeper");
	await expect(page.getByLabel("Password", {exact: true})).toHaveValue("a durable password");
	await expect(page.getByRole("button", {name: "Send verification email"})).toBeEnabled();
	expect(browserErrors.filter((error) => !error.includes("status of 409"))).toEqual([]);
});

test("registration explains invalid and unavailable usernames while typing", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	const checked: string[] = [];
	await page.route("**/api/auth/username-availability?*", (route) => {
		const username = new URL(route.request().url()).searchParams.get("username") || "";
		checked.push(username);
		const available = username.toLowerCase() === "open.archive";
		return route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					available,
					message: available ? "Username is available." : "That username is already in use.",
					valid: true,
				},
			}),
		});
	});

	await page.goto("/register");
	const username = page.getByLabel("Username");
	const submit = page.getByRole("button", {name: "Send verification email"});
	await username.fill("archive keeper$");
	await expect(page.getByText(/no spaces or other special characters/)).toBeVisible();
	await expect(username).toHaveAttribute("aria-invalid", "true");
	await expect(submit).toBeDisabled();
	await page.waitForTimeout(300);
	expect(checked).toEqual([]);

	await username.fill("UsedArchive");
	await expect(page.getByText("That username is already in use.")).toBeVisible();
	await expect(submit).toBeDisabled();
	await username.fill("Open.Archive");
	await expect(page.getByText("Username is available.")).toBeVisible();
	await expect(username).toHaveValue("Open.Archive");
	await expect(username).toHaveAttribute("aria-invalid", "false");
	await expect(submit).toBeEnabled();
	expect(checked).toEqual(["UsedArchive", "Open.Archive"]);
	expect(browserErrors).toEqual([]);
});

test("a registered account shows its public username without an edit control", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.route("**/api/account", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				data: {
					accountType: "registered",
					cleanupAfter: null,
					cleanupWasRecentlyCancelled: false,
					createdAt: "2026-08-09T12:00:00.000Z",
					email: "author@example.com",
					retentionClass: "authored_editor",
					sessions: [],
					siteRole: "user",
					usage: {activeWorlds: 1, maxWorlds: 5, trashedWorlds: 0},
					userId: "3e816c4d-b957-45dc-8523-d53ec04c8d0f",
					username: "archivekeeper",
				},
			}),
		}),
	);

	await page.goto("/account");
	await expect(page.getByText("Username:", {exact: true}).locator("..")).toContainText(
		"archivekeeper",
	);
	await expect(page.getByLabel("Username")).toHaveCount(0);
	expect(browserErrors).toEqual([]);
});

test("privacy guidance remains readable at the minimum narrow layout", async ({page}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.setViewportSize({width: 310, height: 844});

	await page.goto("/privacy");

	await expect(page.getByRole("heading", {name: "What Mothmark keeps"})).toBeVisible();
	await expect(page.getByText(/not used for advertising/)).toBeVisible();
	await expect(
		page.getByText(/Local recovery drafts may also be stored in this browser/),
	).toBeVisible();
	await expect(page.getByRole("link", {name: "Return to account"})).toHaveAttribute(
		"href",
		"/account",
	);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
		),
	).toBe(true);
	expect(browserErrors).toEqual([]);
});
