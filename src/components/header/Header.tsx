"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {MapPinned, Moon, Sun} from "lucide-react";
import {useTheme} from "../theme/ThemeProvider";
import {CurrentWorldName, WorldAutosaveIndicator} from "../world-autosave/WorldAutosave";
import {CommandCopyButton} from "./CommandCopyAction";
import "./Header.scss";

export function Header() {
	const {theme, toggleTheme} = useTheme();
	const isDark = theme === "dark";
	const pathname = usePathname();

	return (
		<header className="header">
			<Link href="/" className="headerLogo" aria-label="Mothmark home">
				<span className="headerLogoMark" aria-hidden="true">
					<MapPinned size={15} strokeWidth={1.8} />
				</span>

				<span className="headerTitle">Mothmark</span>
			</Link>

			<nav className="headerNav" aria-label="Primary navigation">
				<CurrentWorldName />
				<WorldAutosaveIndicator />
				<CommandCopyButton />

				<Link
					href="/"
					className={`headerLink ${pathname === "/" ? "headerLinkActive" : ""}`}
					aria-current={pathname === "/" ? "page" : undefined}
				>
					Home
				</Link>

				<Link
					href="/editor"
					className={`headerLink ${pathname.startsWith("/editor") ? "headerLinkActive" : ""}`}
					aria-current={pathname.startsWith("/editor") ? "page" : undefined}
				>
					Editor
				</Link>

				<Link
					href="/account"
					className={`headerLink ${pathname === "/account" ? "headerLinkActive" : ""}`}
					aria-current={pathname === "/account" ? "page" : undefined}
				>
					Account
				</Link>

				<button
					type="button"
					className="headerThemeToggle"
					onClick={toggleTheme}
					aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
					aria-pressed={isDark}
					title={`Switch to ${isDark ? "light" : "dark"} theme`}
				>
					<span className="headerThemeToggleTrack" aria-hidden="true">
						<span className="headerThemeToggleThumb">
							{isDark ? <Moon size={12} strokeWidth={2} /> : <Sun size={12} strokeWidth={2} />}
						</span>
					</span>
				</button>
			</nav>
		</header>
	);
}
