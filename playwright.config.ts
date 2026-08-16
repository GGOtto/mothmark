import {defineConfig, devices} from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: process.env.CI ? "github" : "list",
	expect: {timeout: 15_000},
	use: {
		baseURL: "http://localhost:3000",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: {...devices["Desktop Chrome"]},
		},
	],
	webServer: {
		command: "pnpm exec next dev --hostname localhost",
		url: "http://localhost:3000/api/health",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
