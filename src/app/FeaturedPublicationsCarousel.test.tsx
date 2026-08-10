import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {FeaturedPublicationsCarousel} from "./FeaturedPublicationsCarousel";

describe("FeaturedPublicationsCarousel", () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("shows one real publication at a time and advances on request", async () => {
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
		expect(screen.queryByRole("heading", {name: "Corner Shop"})).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", {name: "Next featured publication"}));

		expect(screen.getByRole("heading", {name: "Corner Shop"})).toBeVisible();
		expect(screen.queryByRole("heading", {name: "Quiet archive"})).not.toBeInTheDocument();
		expect(screen.getByRole("link", {name: "Play Corner Shop"})).toHaveAttribute(
			"href",
			"/play/corner-shop",
		);
	});
});
