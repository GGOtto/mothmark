import Link from "next/link";
import {MapPinned} from "lucide-react";
import "./Header.scss";

export function Header() {
	return (
		<header className="header">
			<Link href="/" className="headerLogo" aria-label="Mothmark home">
				<span className="headerLogoMark" aria-hidden="true">
					<MapPinned size={15} strokeWidth={1.8} />
				</span>

				<span className="headerTitle">Mothmark</span>
			</Link>

			<nav className="headerNav" aria-label="Primary navigation">
				<Link href="/" className="headerLink">
					Home
				</Link>

				<Link href="/editor" className="headerLink">
					Editor
				</Link>
			</nav>
		</header>
	);
}
