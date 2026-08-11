import {expect, test, type Page} from "@playwright/test";

function collectBrowserErrors(page: Page) {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	page.on("console", (message) => {
		if (message.type() === "error") errors.push(message.text());
	});
	return errors;
}

const feedbackId = "8ebc3f3f-b9ca-4f75-898f-e196bae50be4";
const feedback = {
	accountType: null,
	actorUserId: null,
	category: "idea",
	createdAt: "2026-08-11T12:00:00.000Z",
	customerReceiptStatus: "delivered",
	id: feedbackId,
	message: "Please make it possible to answer feedback without exposing a personal email.",
	notificationAttemptedAt: "2026-08-11T12:00:01.000Z",
	notificationStatus: "delivered",
	page: "http://localhost:3000/",
	replies: [],
	replyCount: 0,
	replyEmail: "reader@example.test",
	status: "open",
	subject: "Mothmark support: idea",
	username: null,
	viewedAt: "2026-08-11T12:05:00.000Z",
};

test("an administrator opens a feedback notification link and replies from Mothmark", async ({
	page,
}) => {
	const browserErrors = collectBrowserErrors(page);
	await page.route("**/api/auth/csrf?audience=admin", (route) =>
		route.fulfill({
			body: JSON.stringify({data: {csrfToken: "admin-csrf"}}),
			contentType: "application/json",
			status: 200,
		}),
	);
	await page.route(`**/api/admin/feedback/${feedbackId}`, (route) =>
		route.fulfill({
			body: JSON.stringify({data: feedback}),
			contentType: "application/json",
			status: 200,
		}),
	);
	await page.route(`**/api/admin/feedback/${feedbackId}/replies`, async (route) => {
		await route.fulfill({
			body: JSON.stringify({
				data: {
					...feedback,
					replies: [
						{
							actorUserId: "3e816c4d-b957-45dc-8523-d53ec04c8d0f",
							authorEmail: "admin@example.test",
							authorType: "admin",
							createdAt: "2026-08-11T12:10:00.000Z",
							deliveryAttemptedAt: "2026-08-11T12:10:01.000Z",
							deliveryStatus: "delivered",
							id: "fa64011c-a260-4712-baca-c8b0334b4740",
							message: "Thanks. Replies now stay inside Mothmark administration.",
							source: "admin_page",
						},
					],
					replyCount: 1,
					status: "replied",
				},
			}),
			contentType: "application/json",
			status: 201,
		});
	});

	await page.goto(`/admin/feedback/${feedbackId}`);
	await expect(page.getByRole("heading", {name: "Idea or request"})).toBeVisible();
	await expect(page.getByText(feedback.message)).toBeVisible();
	await expect(page.getByText("reader@example.test", {exact: true})).toBeVisible();

	await page.getByLabel("Message").fill("Thanks. Replies now stay inside Mothmark administration.");
	const submittedReply = page.waitForRequest(
		(request) =>
			request.method() === "POST" &&
			request.url().endsWith(`/api/admin/feedback/${feedbackId}/replies`),
	);
	await page.getByRole("button", {name: "Send reply"}).click();

	expect((await submittedReply).postDataJSON()).toEqual({
		message: "Thanks. Replies now stay inside Mothmark administration.",
	});
	await expect(
		page.getByText("Reply sent from support@mothmark.app to reader@example.test."),
	).toBeVisible();
	await expect(page.getByText("Admin page · delivered", {exact: true})).toBeVisible();
	expect(browserErrors).toEqual([]);
});
