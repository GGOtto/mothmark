import {act, render, screen, waitFor} from "@testing-library/react";

import {ThemeProvider, useTheme} from "./ThemeProvider";

function ThemeState() {
	const {theme, themePreference} = useTheme();
	return <output>{`${themePreference}:${theme}`}</output>;
}

describe("ThemeProvider", () => {
	const originalMatchMedia = window.matchMedia;

	afterEach(() => {
		window.localStorage.clear();
		window.matchMedia = originalMatchMedia;
		document.documentElement.dataset.theme = "dark";
		document.documentElement.style.colorScheme = "";
	});

	it("uses the system appearance by default and follows system changes", async () => {
		let listener: (() => void) | undefined;
		const query = {
			matches: true,
			addEventListener: jest.fn((_event: string, callback: () => void) => {
				listener = callback;
			}),
			removeEventListener: jest.fn(),
		} as unknown as MediaQueryList;
		window.matchMedia = jest.fn(() => query);

		render(
			<ThemeProvider>
				<ThemeState />
			</ThemeProvider>,
		);

		await waitFor(() => expect(screen.getByText("system:light")).toBeVisible());
		expect(document.documentElement.dataset.theme).toBe("light");

		Object.defineProperty(query, "matches", {configurable: true, value: false});
		act(() => listener?.());
		await waitFor(() => expect(screen.getByText("system:dark")).toBeVisible());
		expect(document.documentElement.dataset.theme).toBe("dark");
	});

	it("preserves an explicit stored appearance", async () => {
		window.localStorage.setItem("mothmark-theme", "light");
		window.matchMedia = jest.fn(
			() =>
				({
					matches: false,
					addEventListener: jest.fn(),
					removeEventListener: jest.fn(),
				}) as unknown as MediaQueryList,
		);

		render(
			<ThemeProvider>
				<ThemeState />
			</ThemeProvider>,
		);

		await waitFor(() => expect(screen.getByText("light:light")).toBeVisible());
		expect(document.documentElement.dataset.theme).toBe("light");
	});
});
