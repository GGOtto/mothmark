import type {Metadata} from "next";
import "./globals.css";
import {Header} from "../components/header/Header";
import {ThemeProvider} from "../components/theme/ThemeProvider";
import {WorldAutosaveProvider} from "../components/world-autosave/WorldAutosave";
import {PopupProvider} from "../components/popup/Popup";
import {CommandCopyProvider} from "../components/header/CommandCopyAction";
import {resolveCurrentEditorPageActor} from "@/auth/currentPageActor";
import {getOwnedAccountSummary} from "@/db/dbal/accountRepository";

export const metadata: Metadata = {
	title: "Mothmark",
	description: "A room-and-command editor for text adventures.",
	manifest: "/site.webmanifest",
	icons: {
		icon: [
			{
				url: "/logo/light/favicon-full-16.png",
				media: "(prefers-color-scheme: light)",
				sizes: "16x16",
				type: "image/png",
			},
			{
				url: "/logo/light/favicon-full-32.png",
				media: "(prefers-color-scheme: light)",
				sizes: "32x32",
				type: "image/png",
			},
			{
				url: "/logo/dark/favicon-full-16.png",
				media: "(prefers-color-scheme: dark)",
				sizes: "16x16",
				type: "image/png",
			},
			{
				url: "/logo/dark/favicon-full-32.png",
				media: "(prefers-color-scheme: dark)",
				sizes: "32x32",
				type: "image/png",
			},
		],
		apple: [{url: "/logo/light/app-icon-512.png", sizes: "512x512", type: "image/png"}],
	},
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const actor = await resolveCurrentEditorPageActor();
	const account = actor ? await getOwnedAccountSummary(actor.userId) : undefined;
	const headerAccount = account
		? {accountType: account.accountType, siteRole: account.siteRole, username: account.username}
		: null;

	return (
		<html lang="en" className="h-full antialiased" data-theme="dark">
			<body className="flex h-dvh flex-col overflow-hidden">
				<ThemeProvider>
					<PopupProvider>
						<WorldAutosaveProvider>
							<CommandCopyProvider>
								<Header account={headerAccount} />

								<div className="min-h-0 flex-1 overflow-hidden">{children}</div>
							</CommandCopyProvider>
						</WorldAutosaveProvider>
					</PopupProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
