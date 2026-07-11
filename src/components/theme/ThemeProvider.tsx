"use client";

import {createContext, useContext, useEffect, useMemo, useRef, useState} from "react";
import type {ReactNode} from "react";

export type AppTheme = "light" | "dark";

type ThemeContextValue = {
	theme: AppTheme;
	setTheme: (theme: AppTheme) => void;
	toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_STORAGE_KEY = "mothmark-theme";

export function ThemeProvider({children}: {children: ReactNode}) {
	const [theme, setTheme] = useState<AppTheme>("dark");
	const hasHydratedThemeRef = useRef(false);

	useEffect(() => {
		const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
		let isActive = true;

		if (storedTheme === "light" || storedTheme === "dark") {
			queueMicrotask(() => {
				if (isActive) setTheme(storedTheme);
			});
		}

		return () => {
			isActive = false;
		};
	}, []);

	useEffect(() => {
		if (!hasHydratedThemeRef.current) {
			hasHydratedThemeRef.current = true;
			return;
		}

		document.documentElement.dataset.theme = theme;
		document.documentElement.style.colorScheme = theme;
		window.localStorage.setItem(THEME_STORAGE_KEY, theme);
	}, [theme]);

	const value = useMemo<ThemeContextValue>(
		() => ({
			theme,
			setTheme,
			toggleTheme: () => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark")),
		}),
		[theme],
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
	const context = useContext(ThemeContext);

	if (!context) throw new Error("useTheme must be used within a ThemeProvider");

	return context;
}
