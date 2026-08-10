/** @jest-environment node */

import {isUsernameAvailable} from "@/db/dbal/registeredAccountRepository";

import {GET} from "./route";

jest.mock("@/db/dbal/registeredAccountRepository", () => ({isUsernameAvailable: jest.fn()}));

describe("username availability route", () => {
	it("rejects invalid characters without querying account data", async () => {
		const response = await GET(
			new Request("http://localhost/api/auth/username-availability?username=archive%20keeper%24"),
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			data: {
				available: false,
				message:
					"Use only letters, numbers, periods, underscores, or hyphens—no spaces or other special characters.",
				valid: false,
			},
		});
		expect(isUsernameAvailable).not.toHaveBeenCalled();
	});

	it.each([
		[true, "Username is available."],
		[false, "That username is already in use."],
	])("reports valid username availability %s", async (available, message) => {
		jest.mocked(isUsernameAvailable).mockResolvedValue(available);
		const response = await GET(
			new Request("http://localhost/api/auth/username-availability?username=ArchiveKeeper"),
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			data: {available, message, valid: true},
		});
		expect(isUsernameAvailable).toHaveBeenCalledWith("ArchiveKeeper");
	});
});
