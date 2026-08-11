import {parseOptions} from "./deploy";

describe("deployment command", () => {
	it("defaults to a confirmed staging-to-production release", () => {
		expect(parseOptions([])).toEqual({
			autoApproveProduction: false,
			stagingOnly: false,
		});
	});

	it("supports unattended and staging-only releases", () => {
		expect(parseOptions(["--yes", "--staging-only"])).toEqual({
			autoApproveProduction: true,
			stagingOnly: true,
		});
	});

	it("rejects unknown options", () => {
		expect(() => parseOptions(["--force"])).toThrow("Unknown option: --force");
	});
});
