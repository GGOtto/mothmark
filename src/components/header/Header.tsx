"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {Bell, ChevronDown, Menu, MessageSquare, UserRound, X} from "lucide-react";
import {useEffect, useRef, useState} from "react";

import {readBrowserCsrfToken} from "@/auth/browserCsrf";
import {MothmarkMark} from "../brand/MothmarkMark";
import {useTheme} from "../theme/ThemeProvider";
import {WorldAutosaveIndicator, WorldSwitcher} from "../world-autosave/WorldAutosave";
import {CommandCopyButton} from "./CommandCopyAction";
import {FeedbackDialog} from "./FeedbackDialog";
import "./Header.scss";

export type HeaderAccount = {
	accountType: "anonymous" | "registered";
	siteRole: "admin" | "user";
	username: string | null;
} | null;

export function Header({account}: {account: HeaderAccount}) {
	const {setTheme, theme} = useTheme();
	const pathname = usePathname();
	const [accountMenuOpen, setAccountMenuOpen] = useState(false);
	const [pageMenuOpen, setPageMenuOpen] = useState(false);
	const [feedbackOpen, setFeedbackOpen] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const [signingOut, setSigningOut] = useState(false);
	const accountRef = useRef<HTMLDivElement | null>(null);
	const pageRef = useRef<HTMLDivElement | null>(null);
	const mobileRef = useRef<HTMLDivElement | null>(null);
	const notificationsRef = useRef<HTMLDivElement | null>(null);

	const registered = account?.accountType === "registered";
	const administrator = account?.siteRole === "admin";
	const accountName = account?.username || "Account";
	const playActive = pathname === "/play";
	const createActive = pathname.startsWith("/worlds");
	const currentPageLabel =
		pathname === "/"
			? "Home"
			: playActive
				? "Play"
				: createActive
					? "Create"
					: pathname.startsWith("/admin")
						? "Admin"
						: "Home";
	const hidden = pathname.startsWith("/admin") || /^\/play\/[^/]+/.test(pathname);

	useEffect(() => {
		if (!accountMenuOpen && !pageMenuOpen && !mobileMenuOpen && !notificationsOpen) return;
		const closeOutside = (event: PointerEvent) => {
			if (!(event.target instanceof Node)) return;
			if (!accountRef.current?.contains(event.target)) setAccountMenuOpen(false);
			if (!pageRef.current?.contains(event.target)) setPageMenuOpen(false);
			if (!mobileRef.current?.contains(event.target)) setMobileMenuOpen(false);
			if (!notificationsRef.current?.contains(event.target)) setNotificationsOpen(false);
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			setAccountMenuOpen(false);
			setPageMenuOpen(false);
			setMobileMenuOpen(false);
			setNotificationsOpen(false);
		};
		document.addEventListener("pointerdown", closeOutside, true);
		document.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("pointerdown", closeOutside, true);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [accountMenuOpen, pageMenuOpen, mobileMenuOpen, notificationsOpen]);

	if (hidden) return null;

	async function signOut() {
		setSigningOut(true);
		try {
			let token = readBrowserCsrfToken();
			if (!token) {
				const response = await fetch("/api/auth/csrf");
				const body = (await response.json()) as {data?: {csrfToken?: unknown}};
				if (typeof body.data?.csrfToken === "string") token = body.data.csrfToken;
			}
			if (!token) throw new Error("The sign-out request could not be verified.");
			const response = await fetch("/api/auth/sign-out", {
				method: "POST",
				headers: {"x-csrf-token": token},
			});
			if (!response.ok) throw new Error("Sign out failed.");
			window.location.assign("/");
		} finally {
			setSigningOut(false);
		}
	}

	function closeMenus() {
		setAccountMenuOpen(false);
		setPageMenuOpen(false);
		setMobileMenuOpen(false);
		setNotificationsOpen(false);
	}

	const feedbackButton = (className: string) => (
		<button type="button" className={className} onClick={() => setFeedbackOpen(true)}>
			<MessageSquare size={18} aria-hidden="true" />
			Send feedback
		</button>
	);

	return (
		<>
			<header className="header">
				<div className="headerIdentity">
					<Link
						href="/"
						className="headerLogo"
						aria-label="Mothmark home"
						aria-current={pathname === "/" ? "page" : undefined}
					>
						<MothmarkMark className="headerLogoMark" />
						<span className="headerTitle">Mothmark</span>
					</Link>
					<WorldSwitcher showLoading={/^\/worlds\/[^/]+$/.test(pathname)} />
				</div>

				<div className="headerUtilities">
					<WorldAutosaveIndicator />
					<CommandCopyButton />
					{feedbackButton("headerFeedback")}

					{registered ? (
						<>
							<div className="headerMenuAnchor" ref={notificationsRef}>
								<button
									type="button"
									className="headerIconButton"
									aria-label="Notifications"
									aria-haspopup="dialog"
									aria-expanded={notificationsOpen}
									onClick={() => setNotificationsOpen((open) => !open)}
								>
									<Bell size={20} aria-hidden="true" />
								</button>
								{notificationsOpen ? (
									<div className="headerNotifications" role="dialog" aria-label="Notifications">
										<strong>Notifications</strong>
										<p>You are all caught up.</p>
									</div>
								) : null}
							</div>

							<div className="headerMenuAnchor" ref={accountRef}>
								<button
									type="button"
									className="headerAccountTrigger"
									aria-haspopup="menu"
									aria-expanded={accountMenuOpen}
									onClick={() => setAccountMenuOpen((open) => !open)}
								>
									<UserRound size={21} aria-hidden="true" />
									<span>{accountName}</span>
									<ChevronDown size={16} aria-hidden="true" />
								</button>
								{accountMenuOpen ? (
									<div className="headerAccountMenu" role="menu">
										<strong>{accountName}</strong>
										<Link role="menuitem" href="/account" onClick={closeMenus}>
											Account
										</Link>
										<Link role="menuitem" href="/worlds" onClick={closeMenus}>
											My worlds
										</Link>
										<div className="headerAppearance" role="group" aria-label="Appearance">
											<span>Appearance</span>
											<button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>
												Light
											</button>
											<button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>
												Dark
											</button>
										</div>
										<button
											type="button"
											role="menuitem"
											disabled={signingOut}
											onClick={() => void signOut()}
										>
											{signingOut ? "Signing out…" : "Sign out"}
										</button>
									</div>
								) : null}
							</div>
						</>
					) : (
						<div className="headerSignedOutActions">
							<Link href="/sign-in" className="headerLogIn">
								Log in
							</Link>
							<Link href="/register" className="headerSignUp">
								Sign up
							</Link>
						</div>
					)}
				</div>

				<nav className="headerPrimaryNav" aria-label="Primary navigation">
					<div className="headerMenuAnchor" ref={pageRef}>
						<button
							type="button"
							className="headerPageSelector"
							aria-haspopup="menu"
							aria-expanded={pageMenuOpen}
							aria-label={`Choose page, current: ${currentPageLabel}`}
							onClick={() => setPageMenuOpen((open) => !open)}
						>
							<span>{currentPageLabel}</span>
							<ChevronDown size={17} aria-hidden="true" />
						</button>
						{pageMenuOpen ? (
							<div className="headerPageMenu" role="menu">
								<Link role="menuitem" href="/" onClick={closeMenus}>
									Home
								</Link>
								<Link role="menuitem" href="/worlds" onClick={closeMenus}>
									Create
								</Link>
								<Link role="menuitem" href="/play" onClick={closeMenus}>
									Play
								</Link>
								{administrator ? (
									<Link role="menuitem" href="/admin" onClick={closeMenus}>
										Admin
									</Link>
								) : null}
							</div>
						) : null}
					</div>
				</nav>

				<div className="headerMobile" ref={mobileRef}>
					<button
						type="button"
						className="headerMobileTrigger"
						aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
						aria-expanded={mobileMenuOpen}
						onClick={() => setMobileMenuOpen((open) => !open)}
					>
						{mobileMenuOpen ? <X size={25} aria-hidden="true" /> : <Menu size={27} aria-hidden="true" />}
					</button>
					{mobileMenuOpen ? (
						<nav className="headerMobileMenu" aria-label="Mobile navigation">
							<Link href="/" onClick={closeMenus}>
								Home
							</Link>
							<Link href="/worlds" onClick={closeMenus}>
								Create
							</Link>
							<Link href="/play" onClick={closeMenus}>
								Play
							</Link>
							{administrator ? (
								<Link href="/admin" onClick={closeMenus}>
									Admin
								</Link>
							) : null}
							<button
								type="button"
								onClick={() => {
									closeMenus();
									setFeedbackOpen(true);
								}}
							>
								<MessageSquare size={18} aria-hidden="true" /> Send feedback
							</button>
							{registered ? (
								<>
									<Link href="/account" onClick={closeMenus}>
										{accountName}
									</Link>
									<div className="headerMobileAppearance" role="group" aria-label="Appearance">
										<span>Appearance</span>
										<button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>
											Light
										</button>
										<button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>
											Dark
										</button>
									</div>
									<button type="button" disabled={signingOut} onClick={() => void signOut()}>
										{signingOut ? "Signing out…" : "Sign out"}
									</button>
								</>
							) : (
								<Link href="/register" onClick={closeMenus}>
									Sign up
								</Link>
							)}
						</nav>
					) : null}
				</div>
			</header>
			{feedbackOpen ? <FeedbackDialog onClose={() => setFeedbackOpen(false)} /> : null}
		</>
	);
}
