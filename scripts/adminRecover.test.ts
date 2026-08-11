import {recoverAdministrator} from "../src/db/dbal/adminAuthRepository";
import {runAdminRecover} from "./adminRecover";

jest.mock("../src/db/dbal/adminAuthRepository", () => ({
	recoverAdministrator: jest.fn(),
	replaceAdministrator: jest.fn(),
}));

describe("administrator recovery command", () => {
	afterEach(() => jest.restoreAllMocks());

	it("targets password recovery by the entered administrator email", async () => {
		jest.mocked(recoverAdministrator).mockResolvedValue({userId: "admin-id"});
		const answers = ["Admin@Example.com", "RESET PASSWORD"];
		const secrets = ["new password", "new password"];
		jest.spyOn(process.stdout, "write").mockImplementation(() => true);

		await runAdminRecover(
			"password",
			async () => secrets.shift() ?? "",
			async () => answers.shift() ?? "",
		);

		expect(recoverAdministrator).toHaveBeenCalledWith({
			email: "Admin@Example.com",
			password: "new password",
			resetMfa: false,
		});
	});

	it("does not recover an administrator when confirmation is absent", async () => {
		const answers = ["admin@example.com", "no"];

		await expect(
			runAdminRecover(
				"mfa",
				async () => "unused",
				async () => answers.shift() ?? "",
			),
		).rejects.toThrow("Recovery was cancelled.");
		expect(recoverAdministrator).not.toHaveBeenCalled();
	});
});
