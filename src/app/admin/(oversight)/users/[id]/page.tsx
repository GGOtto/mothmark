"use client";

import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect, useState} from "react";

import {formatAdminDate, readAdminJson} from "../../../adminClient";
import type {AdminUserDetail} from "../../../adminTypes";

export default function AdminUserDetailPage() {
	const {id} = useParams<{id: string}>();
	const [user, setUser] = useState<AdminUserDetail | null>(null);
	const [error, setError] = useState("");
	useEffect(() => {
		readAdminJson<{data: AdminUserDetail}>(`/api/admin/users/${id}`)
			.then((result) => setUser(result.data))
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : "User could not be loaded."),
			);
	}, [id]);
	return (
		<main className="adminPage">
			<Link className="adminBackLink" href="/admin/users">
				← Users
			</Link>
			{error ? (
				<p className="adminError" role="alert">
					{error}
				</p>
			) : null}
			{!user && !error ? <p role="status">Loading user…</p> : null}
			{user ? (
				<>
					<header className="adminPageHeader">
						<div>
							<h1>{user.displayName || `Anonymous ${user.id.slice(0, 8)}`}</h1>
							<p>{user.id}</p>
						</div>
						<span className={`adminStatus adminStatus-${user.status}`}>{user.status}</span>
					</header>
					<section className="adminSection">
						<h2>Account metadata</h2>
						<dl className="adminDefinitionGrid">
							<div>
								<dt>Account type</dt>
								<dd>{user.accountType}</dd>
							</div>
							<div>
								<dt>Site role</dt>
								<dd>{user.siteRole}</dd>
							</div>
							<div>
								<dt>Created</dt>
								<dd>{formatAdminDate(user.createdAt)}</dd>
							</div>
							<div>
								<dt>Last activity</dt>
								<dd>{formatAdminDate(user.lastSeenAt)}</dd>
							</div>
							<div>
								<dt>World usage</dt>
								<dd>
									{user.worldCount} of {user.maxWorlds}
								</dd>
							</div>
							<div>
								<dt>Cleanup</dt>
								<dd>
									{user.cleanupScheduledAt
										? `Scheduled for ${formatAdminDate(user.cleanupAfter)}`
										: "Not scheduled"}
								</dd>
							</div>
						</dl>
					</section>
					<section className="adminSection">
						<h2>Worlds</h2>
						{user.worlds.length ? (
							<ul className="adminRecordList">
								{user.worlds.map((world) => (
									<li key={world.id}>
										<Link href={`/admin/worlds/${world.id}`}>{world.name}</Link>
										<span>
											Revision {world.revision} · {world.lifecycle}
										</span>
									</li>
								))}
							</ul>
						) : (
							<p>No worlds.</p>
						)}
					</section>
					<section className="adminSection">
						<h2>Sessions</h2>
						{user.sessions.length ? (
							<div className="adminTableFrame">
								<table>
									<thead>
										<tr>
											<th>Audience</th>
											<th>Created</th>
											<th>Last seen</th>
											<th>Expires</th>
											<th>State</th>
										</tr>
									</thead>
									<tbody>
										{user.sessions.map((session) => (
											<tr key={session.id}>
												<td>{session.audience}</td>
												<td>{formatAdminDate(session.createdAt)}</td>
												<td>{formatAdminDate(session.lastSeenAt)}</td>
												<td>{formatAdminDate(session.expiresAt)}</td>
												<td>
													{session.revokedAt
														? "Revoked"
														: new Date(session.expiresAt) <= new Date()
															? "Expired"
															: "Active"}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<p>No sessions.</p>
						)}
					</section>
					<section className="adminSection">
						<h2>Effective permissions</h2>
						<ul className="adminPermissionList">
							{user.permissions.map((permission) => (
								<li key={permission.permission}>
									<code>{permission.permission}</code>
									<span>
										{permission.allowed ? "Allowed" : "Not granted"} · {permission.source}
									</span>
								</li>
							))}
						</ul>
						<p className="adminSectionNote">
							Permission changes arrive in the next administrator-control slice. This view is read-only.
						</p>
					</section>
				</>
			) : null}
		</main>
	);
}
