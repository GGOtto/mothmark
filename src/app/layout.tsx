import type {Metadata} from "next";
import "./globals.css";
import {Header} from "../components/header/Header";

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
		<html lang="en" className="h-full antialiased">
			<body className="flex h-dvh flex-col overflow-hidden bg-[#111]">
				<Header />

				<div className="min-h-0 flex-1 overflow-hidden">{children}</div>
			</body>
		</html>
	);
}
