"use client";

import Link from "next/link";
import {useParams} from "next/navigation";
import {useCallback, useEffect, useState} from "react";

import {formatAdminDate, mutateAdminJson, readAdminJson} from "../../../adminClient";
import type {AdminUserDetail} from "../../../adminTypes";
import {AdminPlaythroughSummaryList} from "../../../AdminPlaythroughSummaryList";

export default function AdminUserDetailPage() {
	const {id} = useParams<{id: string}>();
	const [user, setUser] = useState<AdminUserDetail | null>(null);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [busy, setBusy] = useState("");
	const [reason, setReason] = useState("");
	const [maxWorlds, setMaxWorlds] = useState("");
	const protectedAdminPermissions = new Set(["admin.users.view", "admin.users.manage_permissions"]);

	const load = useCallback(async () => {
		const result = await readAdminJson<{data: AdminUserDetail}>(`/api/admin/users/${id}`);
		setUser(result.data);
		setMaxWorlds(String(result.data.maxWorlds));
	}, [id]);

	useEffect(() => {
		readAdminJson<{data: AdminUserDetail}>(`/api/admin/users/${id}`)
			.then((result) => {
				setUser(result.data);
				setMaxWorlds(String(result.data.maxWorlds));
			})
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : "User could not be loaded."),
			);
	}, [id]);

	const mutate = async (label: string, operation: () => Promise<unknown>) => {
		setBusy(label);
		setError("");
		setNotice("");
		try {
			await operation();
			await load();
			setNotice(`${label} completed.`);
			setReason("");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : `${label} failed.`);
		} finally {
			setBusy("");
		}
	};

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
			{notice ? (
				<p className="adminNotice" role="status">
					{notice}
				</p>
			) : null}
			{!user && !error ? <p role="status">Loading user…</p> : null}
			{user ? (
				<>
					<header className="adminPageHeader">
						<div>
							<h1>
								{user.username ||
									`${user.accountType === "anonymous" ? "Anonymous" : "User"} ${user.id.slice(0, 8)}`}
							</h1>
							<p>{user.id}</p>
						</div>
						<span className={`adminStatus adminStatus-${user.status}`}>{user.status}</span>
					</header>
					<section className="adminSection">
						<h2>Account and security metadata</h2>
						<dl className="adminDefinitionGrid">
							<div>
								<dt>Username</dt>
								<dd>{user.username || "—"}</dd>
							</div>
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
								<dt>Registered</dt>
								<dd>{formatAdminDate(user.registeredAt)}</dd>
							</div>
							<div>
								<dt>Verified email</dt>
								<dd>{user.emailVerifiedAt ? user.email || "Verified" : "Not verified"}</dd>
							</div>
							<div>
								<dt>Email verified</dt>
								<dd>
									{user.verificationPending ? "Verification pending" : formatAdminDate(user.emailVerifiedAt)}
								</dd>
							</div>
							<div>
								<dt>Credential changed</dt>
								<dd>{formatAdminDate(user.credentialChangedAt)}</dd>
							</div>
							<div>
								<dt>MFA enrollment</dt>
								<dd>{user.mfaEnrolled ? "Enrolled" : "Not enrolled"}</dd>
							</div>
							<div>
								<dt>Last activity</dt>
								<dd>{formatAdminDate(user.lastSeenAt)}</dd>
							</div>
						</dl>
						<p className="adminSectionNote">
							Credentials are inspectable only as security status. Use the ordinary password-recovery flow;
							administrators cannot view or set credential material.
						</p>
					</section>

					<AdminPlaythroughSummaryList playthroughs={user.playthroughs ?? []} />

					<section className="adminSection">
						<h2>Account controls</h2>
						<div className="adminControlGrid">
							<form
								onSubmit={(event) => {
									event.preventDefault();
									void mutate("World limit update", () =>
										mutateAdminJson(`/api/admin/users/${id}/limit`, "PUT", {maxWorlds: Number(maxWorlds)}),
									);
								}}
							>
								<label htmlFor="max-worlds">Active-world limit</label>
								<div className="adminInlineControl">
									<input
										id="max-worlds"
										min="1"
										max="10000"
										type="number"
										value={maxWorlds}
										onChange={(event) => setMaxWorlds(event.target.value)}
									/>
									<button disabled={Boolean(busy)} type="submit">
										Save limit
									</button>
								</div>
								<small>
									{user.worldCount} active world{user.worldCount === 1 ? "" : "s"}
								</small>
							</form>
							<div>
								<label htmlFor="account-reason">Administrative reason</label>
								<textarea
									id="account-reason"
									value={reason}
									onChange={(event) => setReason(event.target.value)}
									placeholder="Required for suspension"
								/>
								<button
									className={user.status === "suspended" ? "" : "adminDangerButton"}
									disabled={Boolean(busy) || (user.status !== "suspended" && !reason.trim())}
									type="button"
									onClick={() => {
										const next = user.status === "suspended" ? "reactivate" : "suspend";
										if (
											!window.confirm(
												`${next === "suspend" ? "Suspend" : "Reactivate"} this account?${next === "suspend" ? " All active sessions will be revoked immediately." : ""}`,
											)
										)
											return;
										void mutate(next === "suspend" ? "Suspension" : "Reactivation", () =>
											mutateAdminJson(
												`/api/admin/users/${id}/status`,
												"PUT",
												next === "suspend" ? {status: "suspended", reason} : {status: "active"},
											),
										);
									}}
								>
									{user.status === "suspended" ? "Reactivate account" : "Suspend account"}
								</button>
								{user.suspensionReason ? <small>Suspension reason: {user.suspensionReason}</small> : null}
							</div>
						</div>
					</section>

					{user.accountType === "anonymous" ? (
						<section className="adminSection">
							<h2>Anonymous cleanup</h2>
							<p>
								{user.cleanupScheduledAt
									? `Scheduled because of ${user.cleanupReason || "retention policy"}; deadline ${formatAdminDate(user.cleanupAfter)}.`
									: "Cleanup is not scheduled."}
							</p>
							<div className="adminButtonRow">
								{user.cleanupScheduledAt ? (
									<button
										disabled={Boolean(busy)}
										type="button"
										onClick={() =>
											void mutate("Cleanup cancellation", () =>
												mutateAdminJson(`/api/admin/users/${id}/cleanup`, "POST", {action: "cancel"}),
											)
										}
									>
										Cancel scheduled cleanup
									</button>
								) : null}
								<button
									disabled={Boolean(busy)}
									type="button"
									onClick={() =>
										void mutate("Eligibility recheck", () =>
											mutateAdminJson(`/api/admin/users/${id}/cleanup`, "POST", {action: "recheck"}),
										)
									}
								>
									Recheck eligibility
								</button>
							</div>
						</section>
					) : null}

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
						<div className="adminSectionHeading">
							<h2>Sessions</h2>
							{user.sessions.some(
								(session) => !session.revokedAt && new Date(session.expiresAt) > new Date(),
							) ? (
								<button
									disabled={Boolean(busy)}
									type="button"
									onClick={() => {
										if (window.confirm("Revoke every active session for this user?"))
											void mutate("All-session revocation", () =>
												mutateAdminJson(`/api/admin/users/${id}/sessions`, "DELETE", {}),
											);
									}}
								>
									Revoke all active
								</button>
							) : null}
						</div>
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
											<th>Action</th>
										</tr>
									</thead>
									<tbody>
										{user.sessions.map((session) => {
											const active = !session.revokedAt && new Date(session.expiresAt) > new Date();
											return (
												<tr key={session.id}>
													<td>{session.audience}</td>
													<td>{formatAdminDate(session.createdAt)}</td>
													<td>{formatAdminDate(session.lastSeenAt)}</td>
													<td>{formatAdminDate(session.expiresAt)}</td>
													<td>{session.revokedAt ? "Revoked" : active ? "Active" : "Expired"}</td>
													<td>
														{active ? (
															<button
																disabled={Boolean(busy)}
																type="button"
																onClick={() => {
																	if (window.confirm("Revoke only this session?"))
																		void mutate("Session revocation", () =>
																			mutateAdminJson(`/api/admin/users/${id}/sessions`, "DELETE", {
																				sessionId: session.id,
																			}),
																		);
																}}
															>
																Revoke
															</button>
														) : (
															"—"
														)}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						) : (
							<p>No sessions.</p>
						)}
					</section>

					<section className="adminSection">
						<h2>Permissions</h2>
						<p>
							Each control can inherit the code-defined default, explicitly allow, or explicitly deny.
							Expired overrides resolve as inherited.
						</p>
						<ul className="adminPermissionList">
							{user.permissions.map((permission) => (
								<li key={permission.permission}>
									<div>
										<code>{permission.permission}</code>
										<span className={`adminEffectiveResult ${permission.allowed ? "isAllowed" : "isDenied"}`}>
											Effective: {permission.allowed ? "allowed" : "denied"} · {permission.source}
											{permission.expiresAt ? ` until ${formatAdminDate(permission.expiresAt)}` : ""}
										</span>
									</div>
									<label>
										<span className="adminVisuallyHidden">Override for {permission.permission}</span>
										<select
											aria-label={`Override for ${permission.permission}`}
											value={permission.override}
											disabled={
												Boolean(busy) ||
												(user.siteRole === "admin" && protectedAdminPermissions.has(permission.permission))
											}
											onChange={(event) =>
												void mutate("Permission update", () =>
													mutateAdminJson(`/api/admin/users/${id}/permissions`, "PUT", {
														permission: permission.permission,
														state: event.target.value,
													}),
												)
											}
										>
											<option value="inherited">Inherited</option>
											<option value="allow">Explicitly allowed</option>
											<option value="deny">Explicitly denied</option>
										</select>
									</label>
								</li>
							))}
						</ul>
					</section>
				</>
			) : null}
		</main>
	);
}
