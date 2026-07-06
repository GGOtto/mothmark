import Link from "next/link";
import "./Header.scss";

export function Header() {
	return (
		<header className="header">
			<Link href="/" className="headerTitle">
				Mothmark
			</Link>

			<nav className="headerNav">
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
