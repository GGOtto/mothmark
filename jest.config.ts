import type {Config} from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
	dir: "./",
});

const config: Config = {
	clearMocks: true,
	collectCoverageFrom: [
		"src/**/*.{ts,tsx}",
		"!src/**/*.test.{ts,tsx}",
		"!src/**/*.player.test.{ts,tsx}",
		"!**/*.d.ts",
		"!**/node_modules/**",
	],
	coverageProvider: "v8",
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/src/$1",
	},
	setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
	testEnvironment: "jsdom",
	testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/e2e/", "<rootDir>/node_modules/"],
};

export default createJestConfig(config);
