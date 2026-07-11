import type {Metadata} from "next";
import "./globals.css";
import {Header} from "../components/header/Header";
import {ThemeProvider} from "../components/theme/ThemeProvider";

export const metadata: Metadata = {
	title: "Mothmark",
	description: "A room-and-command editor for text adventures.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="h-full antialiased" data-theme="dark">
			<body className="flex h-dvh flex-col overflow-hidden">
				<ThemeProvider>
					<Header />

					<div className="min-h-0 flex-1 overflow-hidden">{children}</div>
				</ThemeProvider>
			</body>
		</html>
	);
}
