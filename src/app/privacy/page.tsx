import Link from "next/link";

import "../account/page.scss";

export default function PrivacyPage() {
	return (
		<main className="accountPage">
			<article className="accountPanel">
				<p className="accountLabel">Privacy and cookies</p>
				<h1>What Mothmark keeps</h1>
				<p>
					The editor uses a necessary, browser-bound session cookie to keep your temporary account and
					private worlds separate from other visitors. The cookie is not used for advertising.
				</p>
				<p>
					World documents and basic activity times are stored so editing, recovery, quotas, and
					inactivity cleanup work. Local recovery drafts may also be stored in this browser.
				</p>
				<p>
					Future hosted play will retain submitted command text, the visible transcript, and game state
					to resume a playthrough. Editor sessions are not recorded, and optional analytics or
					session-recording cookies are not enabled.
				</p>
				<p>
					Temporary accounts are cleaned up after the inactivity period shown on the Account page,
					followed by a 7-day grace period. You can export or delete your data from that page.
				</p>
				<Link href="/account">Return to account</Link>
			</article>
		</main>
	);
}
