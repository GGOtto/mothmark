import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {FeaturedPublicationsCarousel} from "./FeaturedPublicationsCarousel";

describe("FeaturedPublicationsCarousel", () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("renders overlapping publication pages and advances the page on top", async () => {
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
						{
							authorUsername: "mapmaker",
							id: "publication-3",
							slug: "signal-room",
							title: "Signal room",
							summary: "A radio room at the edge of a quiet coast.",
							release: {number: 1, publishedAt: "2026-08-10T14:00:00.000Z"},
						},
					],
				},
			}),
		} as Response);

		render(<FeaturedPublicationsCarousel />);

		await waitFor(() => expect(screen.getByRole("heading", {name: "Corner Shop"})).toBeVisible());
		expect(screen.getByLabelText("Featured publication carousel")).toHaveClass("homeFeaturedDeck");
		expect(
			screen.getByRole("heading", {name: "Corner Shop"}).closest(".homeFeaturedPage"),
		).toHaveAttribute("aria-current", "true");
		expect(screen.getByText("Quiet archive").closest(".homeFeaturedPage")).toHaveClass(
			"homeFeaturedPage--previous",
		);
		expect(screen.getByText("Signal room").closest(".homeFeaturedPage")).toHaveClass(
			"homeFeaturedPage--next",
		);

		await user.click(screen.getByRole("button", {name: "Next featured publication"}));

		expect(
			screen.getByRole("heading", {name: "Signal room"}).closest(".homeFeaturedPage"),
		).toHaveAttribute("aria-current", "true");
		expect(screen.getByText("3 / 3")).toBeVisible();
		expect(screen.getByRole("link", {name: "Play Signal room"})).toHaveAttribute(
			"href",
			"/play/signal-room",
		);
	});
});
