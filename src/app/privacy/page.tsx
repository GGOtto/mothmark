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
					Registered accounts store a verified email address and a one-way Argon2id password hash.
					Verification and recovery links are short-lived and single-use. The administrator area uses a
					separate necessary session cookie and requires a second factor.
				</p>
				<p>
					World documents and basic activity times are stored so editing, recovery, quotas, and
					inactivity cleanup work. Local recovery drafts may also be stored in this browser.
				</p>
				<p>
					Hosted play stores submitted command text, the visible transcript, and game state so a
					playthrough can resume. Mothmark administrators may inspect this material to diagnose game or
					engine problems. Raw commands are not shared with world authors. You can delete a saved
					playthrough from its About panel.
				</p>
				<p>
					Temporary accounts are cleaned up after the inactivity period shown on the Account page,
					followed by a 7-day grace period. Anonymized play diagnostics are retained for up to 90
					additional days. You can export or delete editor-account data from the Account page.
				</p>
				<p>
					Mothmark uses only necessary host-bound session and request-verification cookies for editor,
					play, and administrator sessions. Advertising, cross-site tracking, optional analytics, and
					session recording are not enabled, so no consent banner is required for the current cookie set.
				</p>
				<Link href="/account">Return to account</Link>
			</article>
		</main>
	);
}
