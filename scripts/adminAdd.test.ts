import {createTotpSecret, totpEnrollmentUri} from "../src/auth/totp";
import {addAdministrator} from "../src/db/dbal/adminAuthRepository";
import {runAdminAdd} from "./adminAdd";

jest.mock("../src/auth/totp", () => ({
	createTotpSecret: jest.fn(),
	totpEnrollmentUri: jest.fn(),
}));
jest.mock("../src/db/dbal/adminAuthRepository", () => ({
	addAdministrator: jest.fn(),
}));

describe("administrator promotion command", () => {
	afterEach(() => jest.restoreAllMocks());

	it("promotes the entered verified account after confirming its authenticator", async () => {
		jest.mocked(createTotpSecret).mockReturnValue("totp-secret");
		jest.mocked(totpEnrollmentUri).mockReturnValue("otpauth://enrollment");
		jest.mocked(addAdministrator).mockResolvedValue({
			recoveryCodes: ["FIRST-CODE", "SECOND-CODE"],
			totpSecret: "totp-secret",
			totpUri: "otpauth://enrollment",
			userId: "user-id",
		});
		const write = jest.spyOn(process.stdout, "write").mockImplementation(() => true);

		await runAdminAdd(
			async () => "  Admin@Example.com  ",
			async () => "123456",
		);

		expect(totpEnrollmentUri).toHaveBeenCalledWith("Admin@Example.com", "totp-secret");
		expect(addAdministrator).toHaveBeenCalledWith({
			email: "Admin@Example.com",
			totpCode: "123456",
			totpSecret: "totp-secret",
		});
		expect(write.mock.calls.flat().join("")).toContain("FIRST-CODE");
		expect(write.mock.calls.flat().join("")).toContain("Administrator user-id is ready");
	});

	it("rejects an empty email before starting authenticator enrollment", async () => {
		await expect(
			runAdminAdd(
				async () => " ",
				async () => "unused",
			),
		).rejects.toThrow("A verified account email is required.");

		expect(createTotpSecret).not.toHaveBeenCalled();
		expect(addAdministrator).not.toHaveBeenCalled();
	});
});
