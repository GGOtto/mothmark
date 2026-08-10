"use client";

import Link from "next/link";
import {useParams} from "next/navigation";
import {useCallback, useEffect, useState} from "react";

import {formatAdminDate, formatBytes, mutateAdminJson, readAdminJson} from "../../../adminClient";
import type {AdminWorld} from "../../../adminTypes";

type AdminWorldDetail = AdminWorld & {world: unknown};

export default function AdminWorldDetailPage() {
	const {id} = useParams<{id: string}>();
	const [world, setWorld] = useState<AdminWorldDetail | null>(null);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [busy, setBusy] = useState(false);
	const [reason, setReason] = useState("");
	const [targetUserId, setTargetUserId] = useState("");
	const [editing, setEditing] = useState(false);
	const [documentText, setDocumentText] = useState("");

	const load = useCallback(async () => {
		const result = await readAdminJson<{data: AdminWorldDetail}>(`/api/admin/worlds/${id}`);
		setWorld(result.data);
		setDocumentText(JSON.stringify(result.data.world, null, 2));
	}, [id]);
	useEffect(() => {
		readAdminJson<{data: AdminWorldDetail}>(`/api/admin/worlds/${id}`)
			.then((result) => {
				setWorld(result.data);
				setDocumentText(JSON.stringify(result.data.world, null, 2));
			})
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : "World could not be loaded."),
			);
	}, [id]);

	const mutate = async (operation: () => Promise<unknown>, message: string) => {
		setBusy(true);
		setError("");
		setNotice("");
		try {
			await operation();
			await load();
			setNotice(message);
			setReason("");
			return true;
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The world action failed.");
			return false;
		} finally {
			setBusy(false);
		}
	};

	const control = (action: "archive" | "delete" | "restore" | "transfer") => {
		if ((action === "delete" || action === "transfer") && !reason.trim()) {
			setError("Enter an administrative reason first.");
			return;
		}
		if (
			!window.confirm(
				action === "delete"
					? "Permanently delete this world? This cannot be undone."
					: `${action[0].toUpperCase()}${action.slice(1)} this world?`,
			)
		)
			return;
		void mutate(
			() =>
				mutateAdminJson(`/api/admin/worlds/${id}/control`, "POST", {
					action,
					reason: reason || undefined,
					...(action === "transfer" && {targetUserId}),
				}),
			`World ${action} completed.`,
		);
	};

	return (
		<main className="adminPage">
			{editing ? (
				<div className="adminEditingBanner" role="status">
					<strong>Administrative editing</strong>
					<span>
						You are editing another user’s world. A reason and old/new revisions will be recorded.
					</span>
				</div>
			) : null}
			<Link className="adminBackLink" href="/admin/worlds">
				← Worlds
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
			{!world && !error ? <p role="status">Loading world…</p> : null}
			{world ? (
				<>
					<Link href={`/admin/playthroughs?worldId=${world.id}`}>View world playthroughs</Link>
					<header className="adminPageHeader">
						<div>
							<h1>{world.name}</h1>
							<p>{editing ? "Administrative edit mode" : "Read-only world inspection"}</p>
						</div>
						<span className={`adminStatus adminStatus-${world.lifecycle}`}>{world.lifecycle}</span>
					</header>
					<section className="adminSection">
						<h2>World metadata</h2>
						<dl className="adminDefinitionGrid">
							<div>
								<dt>Owner</dt>
								<dd>
									<Link href={`/admin/users/${world.owner.id}`}>
										{world.owner.username || world.owner.id}
									</Link>
								</dd>
							</div>
							<div>
								<dt>Revision</dt>
								<dd>{world.revision}</dd>
							</div>
							<div>
								<dt>Schema version</dt>
								<dd>{world.schemaVersion}</dd>
							</div>
							<div>
								<dt>Document size</dt>
								<dd>{formatBytes(world.worldSizeBytes)}</dd>
							</div>
							<div>
								<dt>Created</dt>
								<dd>{formatAdminDate(world.createdAt)}</dd>
							</div>
							<div>
								<dt>Updated</dt>
								<dd>{formatAdminDate(world.updatedAt)}</dd>
							</div>
							<div>
								<dt>Private editor slug</dt>
								<dd>{world.editorSlug || "—"}</dd>
							</div>
							<div>
								<dt>Archived</dt>
								<dd>{formatAdminDate(world.deletedAt)}</dd>
							</div>
						</dl>
					</section>
					<section className="adminSection">
						<h2>World controls</h2>
						<label htmlFor="world-reason">Administrative reason</label>
						<textarea
							id="world-reason"
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder="Required for transfer, permanent deletion, and editing"
						/>
						<div className="adminButtonRow">
							<a className="adminButtonLink" href={`/api/admin/worlds/${id}/export`}>
								Export world
							</a>
							{world.lifecycle === "active" ? (
								<button disabled={busy} type="button" onClick={() => control("archive")}>
									Archive world
								</button>
							) : (
								<button disabled={busy} type="button" onClick={() => control("restore")}>
									Restore world
								</button>
							)}
							<button
								className="adminDangerButton"
								disabled={busy || !reason.trim()}
								type="button"
								onClick={() => control("delete")}
							>
								Permanently delete
							</button>
						</div>
						<div className="adminTransferControl">
							<label htmlFor="target-user">Transfer to active user ID</label>
							<div className="adminInlineControl">
								<input
									id="target-user"
									value={targetUserId}
									onChange={(event) => setTargetUserId(event.target.value)}
									placeholder="User UUID"
								/>
								<button
									disabled={busy || !reason.trim() || !targetUserId.trim()}
									type="button"
									onClick={() => control("transfer")}
								>
									Transfer ownership
								</button>
							</div>
							<small>
								The transfer is rejected if the target is at their active-world limit. Change that limit on
								the user page first.
							</small>
						</div>
					</section>
					<section className="adminSection">
						<div className="adminSectionHeading">
							<h2>World document</h2>
							<span>{editing ? "Administrative editing" : "Inspection only"}</span>
						</div>
						{editing ? (
							<>
								<textarea
									className="adminJsonEditor"
									aria-label="World document JSON"
									value={documentText}
									onChange={(event) => setDocumentText(event.target.value)}
								/>
								<div className="adminButtonRow">
									<button
										disabled={busy || !reason.trim()}
										type="button"
										onClick={async () => {
											let parsed: unknown;
											try {
												parsed = JSON.parse(documentText);
											} catch {
												setError("The world document must be valid JSON.");
												return;
											}
											const saved = await mutate(
												() =>
													mutateAdminJson(`/api/admin/worlds/${id}/edit`, "PUT", {
														expectedRevision: world.revision,
														reason,
														world: parsed,
													}),
												"Administrative edit saved.",
											);
											if (saved) setEditing(false);
										}}
									>
										Save administrative edit
									</button>
									<button
										disabled={busy}
										type="button"
										onClick={() => {
											setEditing(false);
											setDocumentText(JSON.stringify(world.world, null, 2));
										}}
									>
										Cancel
									</button>
								</div>
							</>
						) : (
							<>
								<pre className="adminJson">
									<code>{documentText}</code>
								</pre>
								<button
									disabled={world.lifecycle !== "active"}
									type="button"
									onClick={() => setEditing(true)}
								>
									Enter administrative edit mode
								</button>
							</>
						)}
					</section>
				</>
			) : null}
		</main>
	);
}
