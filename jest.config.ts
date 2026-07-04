import type {Config} from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
	dir: "./",
});

const config: Config = {
	clearMocks: true,
	collectCoverageFrom: [
		"app/**/*.{ts,tsx}",
		"components/**/*.{ts,tsx}",
		"types/**/*.{ts,tsx}",
		"utils/**/*.{ts,tsx}",
		"!**/*.d.ts",
		"!**/node_modules/**",
	],
	coverageProvider: "v8",
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/$1",
	},
	setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
	testEnvironment: "jsdom",
	testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
};

export default createJestConfig(config);
