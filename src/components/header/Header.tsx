"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {Bell, ChevronDown, Menu, MessageSquare, UserRound, X} from "lucide-react";
import {useRef, useState} from "react";

import {readBrowserCsrfToken} from "@/auth/browserCsrf";
import {MothmarkLogo} from "../brand/MothmarkLogo";
import {AnchoredLayer} from "../overlay/Overlay";
import {useTheme} from "../theme/ThemeProvider";
import {
	useWorldAutosave,
	WorldAutosaveIndicator,
	WorldSaveButton,
	WorldSwitcher,
} from "../world-autosave/WorldAutosave";
import {CommandCopyButton} from "./CommandCopyAction";
import {FeedbackDialog} from "./FeedbackDialog";
import "./Header.scss";

export type HeaderAccount = {
	accountType: "anonymous" | "registered";
	siteRole: "admin" | "user";
	username: string | null;
} | null;

export function Header({account}: {account: HeaderAccount}) {
	const {setTheme, themePreference} = useTheme();
	const {allowNextUnload, prepareForNavigation} = useWorldAutosave();
	const pathname = usePathname();
	const [accountMenuOpen, setAccountMenuOpen] = useState(false);
	const [pageMenuOpen, setPageMenuOpen] = useState(false);
	const [feedbackOpen, setFeedbackOpen] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const [signingOut, setSigningOut] = useState(false);
	const [signOutError, setSignOutError] = useState("");
	const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
	const accountTriggerRef = useRef<HTMLButtonElement | null>(null);
	const pageTriggerRef = useRef<HTMLButtonElement | null>(null);
	const notificationsTriggerRef = useRef<HTMLButtonElement | null>(null);
	const feedbackReturnFocusRef = useRef<HTMLElement | null>(null);

	const registered = account?.accountType === "registered";
	const administrator = account?.siteRole === "admin";
	const accountName = account?.username || "Account";
	const playActive = pathname === "/play";
	const createActive = pathname.startsWith("/worlds");
	const currentPageLabel =
		pathname === "/"
			? "Home"
			: pathname.startsWith("/users/")
				? "Profile"
				: playActive
					? "Play"
					: createActive
						? "Create"
						: pathname.startsWith("/admin")
							? "Admin"
							: "Home";
	const hidden =
		pathname.startsWith("/admin") ||
		["/forgot-password", "/register", "/reset-password", "/sign-in", "/verify-email"].some(
			(path) => pathname === path,
		) ||
		/^\/play\/[^/]+/.test(pathname);

	if (hidden) return null;

	async function signOut() {
		setSigningOut(true);
		setSignOutError("");
		try {
			if (!(await prepareForNavigation())) {
				setSignOutError("Sign-out cancelled. This world still has unsaved changes.");
				return;
			}
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
			allowNextUnload();
			window.location.assign("/");
		} catch (caught) {
			setSignOutError(caught instanceof Error ? caught.message : "Sign out failed.");
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
						<MothmarkLogo className="headerLogoImage" priority variant="headerCompact" />
					</Link>
					<nav className="headerPrimaryNav" aria-label="Primary navigation">
						<div className="headerMenuAnchor">
							<button
								ref={pageTriggerRef}
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
								<AnchoredLayer
									anchorRef={pageTriggerRef}
									ariaLabel="Pages"
									className="headerPageMenu"
									onClose={() => setPageMenuOpen(false)}
									preferredWidth={200}
									role="menu"
								>
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
								</AnchoredLayer>
							) : null}
						</div>
					</nav>
					<WorldSwitcher showLoading={/^\/worlds\/[^/]+$/.test(pathname)} />
				</div>

				<div className="headerUtilities">
					<WorldAutosaveIndicator />
					<WorldSaveButton />
					<CommandCopyButton />
					<button
						type="button"
						className="headerFeedback"
						onClick={(event) => {
							feedbackReturnFocusRef.current = event.currentTarget;
							setFeedbackOpen(true);
						}}
					>
						<MessageSquare size={18} aria-hidden="true" />
						Send feedback
					</button>

					{registered ? (
						<>
							<div className="headerMenuAnchor">
								<button
									ref={notificationsTriggerRef}
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
									<AnchoredLayer
										anchorRef={notificationsTriggerRef}
										ariaLabel="Notifications"
										className="headerNotifications"
										mobilePresentation="sheet"
										onClose={() => setNotificationsOpen(false)}
										preferredWidth={230}
										role="dialog"
									>
										<strong>Notifications</strong>
										<p>You are all caught up.</p>
									</AnchoredLayer>
								) : null}
							</div>

							<div className="headerMenuAnchor">
								<button
									ref={accountTriggerRef}
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
									<AnchoredLayer
										anchorRef={accountTriggerRef}
										ariaLabel="Account menu"
										className="headerAccountMenu"
										mobilePresentation="sheet"
										onClose={() => setAccountMenuOpen(false)}
										preferredWidth={240}
										role="menu"
									>
										<strong>{accountName}</strong>
										{account?.username ? (
											<Link
												role="menuitem"
												href={`/users/${encodeURIComponent(account.username)}`}
												onClick={closeMenus}
											>
												View public profile
											</Link>
										) : null}
										<Link role="menuitem" href="/account" onClick={closeMenus}>
											Account settings
										</Link>
										<Link role="menuitem" href="/worlds" onClick={closeMenus}>
											Your worlds
										</Link>
										<div className="headerAppearance" role="group" aria-label="Appearance">
											<span>Appearance</span>
											<button
												type="button"
												aria-pressed={themePreference === "system"}
												onClick={() => setTheme("system")}
											>
												System
											</button>
											<button
												type="button"
												aria-pressed={themePreference === "light"}
												onClick={() => setTheme("light")}
											>
												Light
											</button>
											<button
												type="button"
												aria-pressed={themePreference === "dark"}
												onClick={() => setTheme("dark")}
											>
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
										{signOutError ? <p role="alert">{signOutError}</p> : null}
									</AnchoredLayer>
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

				<div className="headerMobile">
					<button
						ref={mobileTriggerRef}
						type="button"
						className="headerMobileTrigger"
						aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
						aria-expanded={mobileMenuOpen}
						onClick={() => setMobileMenuOpen((open) => !open)}
					>
						{mobileMenuOpen ? <X size={25} aria-hidden="true" /> : <Menu size={27} aria-hidden="true" />}
					</button>
					{mobileMenuOpen ? (
						<AnchoredLayer
							anchorRef={mobileTriggerRef}
							ariaLabel="Mobile navigation"
							className="headerMobileMenu"
							matchViewportWidth
							onClose={() => setMobileMenuOpen(false)}
							role="navigation"
						>
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
								className="headerMobileFeedback"
								onClick={() => {
									feedbackReturnFocusRef.current = mobileTriggerRef.current;
									closeMenus();
									setFeedbackOpen(true);
								}}
							>
								Send feedback
							</button>
							{registered ? (
								<>
									{account?.username ? (
										<Link href={`/users/${encodeURIComponent(account.username)}`} onClick={closeMenus}>
											View public profile
										</Link>
									) : null}
									<Link href="/account" onClick={closeMenus}>
										Account settings
									</Link>
									<button type="button" disabled={signingOut} onClick={() => void signOut()}>
										{signingOut ? "Signing out…" : "Sign out"}
									</button>
									{signOutError ? <p role="alert">{signOutError}</p> : null}
								</>
							) : (
								<Link href="/register" onClick={closeMenus}>
									Sign up
								</Link>
							)}
						</AnchoredLayer>
					) : null}
				</div>
			</header>
			{feedbackOpen ? (
				<FeedbackDialog
					onClose={() => setFeedbackOpen(false)}
					requiresReplyEmail={!registered}
					returnFocusRef={feedbackReturnFocusRef}
				/>
			) : null}
		</>
	);
}
