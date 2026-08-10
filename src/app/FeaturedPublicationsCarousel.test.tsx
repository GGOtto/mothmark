import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {FeaturedPublicationsCarousel} from "./FeaturedPublicationsCarousel";

describe("FeaturedPublicationsCarousel", () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("renders a scrollable publication stack and advances its current card", async () => {
		const user = userEvent.setup();
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				data: {
					publications: [
						{
							authorUsername: "archivekeeper",
							id: "publication-1",
							slug: "quiet-archive",
							title: "Quiet archive",
							summary: "A compact world for testing hosted play.",
							release: {number: 1, publishedAt: "2026-08-09T12:00:00.000Z"},
						},
						{
							authorUsername: "Mothmark",
							id: "publication-2",
							slug: "corner-shop",
							title: "Corner Shop",
							summary: "A small example world.",
							release: {number: 2, publishedAt: "2026-08-10T12:00:00.000Z"},
						},
					],
				},
			}),
		} as Response);

		render(<FeaturedPublicationsCarousel />);

		await waitFor(() => expect(screen.getByRole("heading", {name: "Quiet archive"})).toBeVisible());
		expect(screen.getByLabelText("Featured publication stack")).toHaveClass("homeFeaturedRail");
		expect(
			screen.getByRole("heading", {name: "Quiet archive"}).closest(".homeFeaturedSlide"),
		).toHaveAttribute("aria-current", "true");

		await user.click(screen.getByRole("button", {name: "Next featured publication"}));

		expect(
			screen.getByRole("heading", {name: "Corner Shop"}).closest(".homeFeaturedSlide"),
		).toHaveAttribute("aria-current", "true");
		expect(screen.getByText("2 / 2")).toBeVisible();
		expect(screen.getByRole("link", {name: "Play Corner Shop"})).toHaveAttribute(
			"href",
			"/play/corner-shop",
		);
	});
});
