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
			<body className="flex h-full flex-col overflow-hidden">
				<Header children={children} />
				{children}
			</body>
		</html>
	);
}
