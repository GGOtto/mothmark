"use client";

import Link from "next/link";
import {useEffect, useState} from "react";

import {formatAdminDate, readAdminJson} from "../../adminClient";
import type {AdminUser} from "../../adminTypes";

export default function AdminUsersPage() {
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	useEffect(() => {
		readAdminJson<{data: {users: AdminUser[]}}>("/api/admin/users")
			.then((result) => setUsers(result.data.users))
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : "Users could not be loaded."),
			)
			.finally(() => setLoading(false));
	}, []);
	return (
		<main className="adminPage">
			<header className="adminPageHeader">
				<div>
					<h1>Users</h1>
					<p>Read-only account and retention oversight.</p>
				</div>
				<span>{users.length} accounts</span>
			</header>
			{loading ? <p role="status">Loading users…</p> : null}
			{error ? (
				<p className="adminError" role="alert">
					{error}
				</p>
			) : null}
			{!loading && !error ? (
				<div className="adminTableFrame">
					<table>
						<thead>
							<tr>
								<th>User</th>
								<th>Status</th>
								<th>Worlds</th>
								<th>Limit</th>
								<th>Last activity</th>
								<th>Cleanup</th>
							</tr>
						</thead>
						<tbody>
							{users.map((user) => (
								<tr key={user.id}>
									<td>
										<Link href={`/admin/users/${user.id}`}>
											{user.displayName || `Anonymous ${user.id.slice(0, 8)}`}
										</Link>
										<small>
											{user.accountType}
											{user.siteRole === "admin" ? " · administrator" : ""}
										</small>
									</td>
									<td>
										<span className={`adminStatus adminStatus-${user.status}`}>{user.status}</span>
									</td>
									<td>
										{user.worldCount}
										<small>
											{user.trashedWorldCount ? `${user.trashedWorldCount} in trash` : "No trash"}
										</small>
									</td>
									<td>{user.maxWorlds}</td>
									<td>{formatAdminDate(user.lastSeenAt)}</td>
									<td>{user.cleanupScheduledAt ? formatAdminDate(user.cleanupAfter) : "Not scheduled"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}
		</main>
	);
}
