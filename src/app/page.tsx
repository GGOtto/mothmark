import Link from "next/link";

import {resolveCurrentEditorPageActor} from "@/auth/currentPageActor";

import "./page.scss";

export const dynamic = "force-dynamic";

export default async function HomePage() {
	const actor = await resolveCurrentEditorPageActor();
	const registered = actor?.accountType === "registered";

	return (
		<main className="homePage">
			<section className="homeCard">
				<p className="homeEyebrow">Mothmark</p>

				<h1>Build and play text based adventure games.</h1>

				<p className="homeDescription">
					{registered
						? "Map places, write commands, and test a text adventure in one quiet workspace. Your saved worlds are ready when you are."
						: "Map places, write commands, and test a text adventure in one quiet workspace. Sign in to open your account, or continue with a temporary account tied to this browser."}
				</p>

				<div className="homeActions">
					{registered ? (
						<Link href="/worlds" className="homePrimaryLink">
							My worlds
						</Link>
					) : (
						<>
							<Link href="/sign-in" className="homePrimaryLink">
								Sign in
							</Link>
							<Link href="/worlds" className="homeSecondaryLink">
								Continue without an account
							</Link>
						</>
					)}
				</div>
			</section>
		</main>
	);
}
