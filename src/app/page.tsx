import Link from "next/link";
import "./page.scss";

export default function HomePage() {
	return (
		<main className="homePage">
			<section className="homeCard">
				<p className="homeEyebrow">Mothmark</p>

				<h1>Text adventure tools, eventually.</h1>

				<p className="homeDescription">
					This home page is just a placeholder for now. The editor is where the actual world-building
					lives. The editor does not currently work well on a phone.
				</p>

				<Link href="/editor" className="homeEditorLink">
					Open Editor
				</Link>
			</section>
		</main>
	);
}
