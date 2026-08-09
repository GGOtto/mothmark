import Link from "next/link";
import "./page.scss";

export default function HomePage() {
	return (
		<main className="homePage">
			<section className="homeCard">
				<p className="homeEyebrow">Mothmark</p>

				<h1>Build and play text based adventure games.</h1>

				<p className="homeDescription">
					Map places, write commands, and test a text adventure in one quiet workspace. Your work is kept
					in a temporary account tied to this browser.
				</p>

				<Link href="/worlds" className="homeEditorLink">
					Start building
				</Link>
			</section>
		</main>
	);
}
