import Link from "next/link";

import "./page.scss";

export default function AccountPage() {
	return (
		<main className="accountPage">
			<section className="accountPanel">
				<p className="accountLabel">Temporary account</p>
				<h1>Your worlds stay with this browser</h1>
				<p>
					Mothmark creates a private anonymous account when you enter the editor. It uses an
					authentication cookie so other visitors cannot see or change your worlds.
				</p>
				<p>
					There is not yet a sign-in or account-recovery flow. Clearing this browser’s site data, using
					private browsing, or moving to another browser can make these worlds inaccessible.
				</p>
				<Link href="/worlds">Return to your worlds</Link>
			</section>
		</main>
	);
}
