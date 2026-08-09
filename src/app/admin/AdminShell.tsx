"use client";

import {MapPinned} from "lucide-react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState, type ReactNode} from "react";

export function AdminShell({children}: {children: ReactNode}) {
	const pathname = usePathname();
	const [signingOut, setSigningOut] = useState(false);
	const [error, setError] = useState("");

	const signOut = async () => {
		setSigningOut(true);
		setError("");
		try {
			const csrfResponse = await fetch("/api/auth/csrf?audience=admin");
			const csrf = ((await csrfResponse.json()) as {data?: {csrfToken?: string}}).data?.csrfToken;
			if (!csrf) throw new Error("Sign-out verification failed.");
			const response = await fetch("/api/admin/auth/sign-out", {
				method: "POST",
				headers: {"x-csrf-token": csrf},
			});
			if (!response.ok) throw new Error("The administrator session could not be ended.");
			window.location.assign("/admin/sign-in");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Sign out failed.");
			setSigningOut(false);
		}
	};

	return (
		<div className="adminApp">
			<header className="adminHeader">
				<Link href="/admin/users" className="adminHeaderIdentity">
					<MapPinned size={15} aria-hidden="true" />
					<span>Mothmark administration</span>
				</Link>
				<nav aria-label="Administrator navigation">
					<Link
						href="/admin/users"
						aria-current={pathname.startsWith("/admin/users") ? "page" : undefined}
					>
						Users
					</Link>
					<Link
						href="/admin/worlds"
						aria-current={pathname.startsWith("/admin/worlds") ? "page" : undefined}
					>
						Worlds
					</Link>
					<Link
						href="/admin/publications"
						aria-current={pathname.startsWith("/admin/publications") ? "page" : undefined}
					>
						Publications
					</Link>
					<Link
						href="/admin/audit"
						aria-current={pathname.startsWith("/admin/audit") ? "page" : undefined}
					>
						Audit
					</Link>
					<button type="button" onClick={() => void signOut()} disabled={signingOut}>
						{signingOut ? "Signing out…" : "Sign out"}
					</button>
				</nav>
			</header>
			{error ? (
				<p className="adminShellError" role="alert">
					{error}
				</p>
			) : null}
			<div className="adminContent">{children}</div>
		</div>
	);
}
