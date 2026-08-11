import {render, screen, waitFor} from "@testing-library/react";
import {useParams} from "next/navigation";

import PublicUserProfilePage from "./page";

jest.mock("next/navigation", () => ({useParams: jest.fn()}));

describe("public user profile page", () => {
	const originalFetch = global.fetch;

	beforeEach(() => jest.mocked(useParams).mockReturnValue({username: "archivekeeper"}));
	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("falls back to the username and lists only the returned published worlds", async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				data: {
					bio: "Makes quiet worlds.",
					createdAt: "2026-08-08T12:00:00.000Z",
					displayName: null,
					publications: [
						{
							authorUsername: "archivekeeper",
							id: "publication-id",
							release: {
								id: "release-id",
								number: 1,
								publishedAt: "2026-08-09T12:00:00.000Z",
							},
							slug: "quiet-archive",
							summary: "A compact world.",
							title: "Quiet archive",
						},
					],
					username: "archivekeeper",
					website: null,
				},
			}),
		} as Response);

		render(<PublicUserProfilePage />);

		await waitFor(() =>
			expect(screen.getByRole("heading", {name: "archivekeeper", level: 1})).toBeVisible(),
		);
		expect(screen.getByText("@archivekeeper")).toBeVisible();
		expect(screen.getByRole("link", {name: "Play"})).toHaveAttribute("href", "/play/quiet-archive");
	});

	it("uses an explicitly supplied display name", async () => {
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({
				data: {
					bio: null,
					createdAt: "2026-08-08T12:00:00.000Z",
					displayName: "Archive Keeper",
					publications: [],
					username: "archivekeeper",
					website: null,
				},
			}),
		} as Response);

		render(<PublicUserProfilePage />);

		await waitFor(() =>
			expect(screen.getByRole("heading", {name: "Archive Keeper", level: 1})).toBeVisible(),
		);
		expect(screen.getByText("This user has not published any listed worlds.")).toBeVisible();
	});
});
