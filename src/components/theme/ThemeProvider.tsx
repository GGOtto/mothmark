"use client";

import {createContext, useContext, useEffect, useMemo, useRef, useState} from "react";
import type {ReactNode} from "react";

export type AppTheme = "light" | "dark";
export type ThemePreference = AppTheme | "system";

type ThemeContextValue = {
	theme: AppTheme;
	themePreference: ThemePreference;
	setTheme: (theme: ThemePreference) => void;
	toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_STORAGE_KEY = "mothmark-theme";

export function ThemeProvider({children}: {children: ReactNode}) {
	const [themePreference, setThemePreference] = useState<ThemePreference>("system");
	const [systemTheme, setSystemTheme] = useState<AppTheme>("dark");
	const hasHydratedThemeRef = useRef(false);
	const theme = themePreference === "system" ? systemTheme : themePreference;

	useEffect(() => {
		const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
		const systemThemeQuery =
			typeof window.matchMedia === "function"
				? window.matchMedia("(prefers-color-scheme: light)")
				: undefined;
		let isActive = true;
		const updateSystemTheme = () => {
			if (isActive) setSystemTheme(systemThemeQuery?.matches ? "light" : "dark");
		};

		updateSystemTheme();
		if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
			queueMicrotask(() => {
				if (isActive) setThemePreference(storedTheme);
			});
		}
		systemThemeQuery?.addEventListener("change", updateSystemTheme);

		return () => {
			isActive = false;
			systemThemeQuery?.removeEventListener("change", updateSystemTheme);
		};
	}, []);

	useEffect(() => {
		if (!hasHydratedThemeRef.current) {
			hasHydratedThemeRef.current = true;
			return;
		}

		document.documentElement.dataset.theme = theme;
		document.documentElement.style.colorScheme = theme;
		window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
	}, [theme, themePreference]);

	const value = useMemo<ThemeContextValue>(
		() => ({
			theme,
			themePreference,
			setTheme: setThemePreference,
			toggleTheme: () => setThemePreference(theme === "dark" ? "light" : "dark"),
		}),
		[theme, themePreference],
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
	const context = useContext(ThemeContext);

	if (!context) throw new Error("useTheme must be used within a ThemeProvider");

	return context;
}
